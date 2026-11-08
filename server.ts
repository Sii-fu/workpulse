import express from 'express';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isAllowedScriptUrl } from './src/utils/scriptUrl';

// Load .env.local first (local overrides), then fall back to .env
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  // Localhost only by default. Set HOST=0.0.0.0 to allow other devices on your network (no authentication!).
  const HOST = process.env.HOST || '127.0.0.1';

  app.use(express.json({ limit: '15mb' }));

  // Gemini AI generation endpoint
  app.post('/api/gemini/generate', async (req, res) => {
    try {
      const { prompt, systemInstruction, customApiKey } = req.body;

      if (!prompt) {
        return res.status(400).json({ error: 'Prompt is required' });
      }

      const activeApiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;

      if (!activeApiKey) {
        return res.status(400).json({
          error: 'No Gemini API key provided. Please configure your key in Settings or set GEMINI_API_KEY.',
          needsKey: true,
        });
      }

      const ai = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      const response = await ai.models.generateContent({
        model: 'gemini-3.8-flash',
        contents: prompt,
        config: systemInstruction
          ? {
              systemInstruction,
              temperature: 0.7,
            }
          : undefined,
      });

      const text = response.text || '';
      return res.json({ text });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      const message = err?.message || 'Failed to generate content with Gemini';
      return res.status(500).json({ error: message });
    }
  });

  // End-of-Day (EOD) AI Log Synthesizer endpoint
  app.post('/api/synthesize-eod', async (req, res) => {
    try {
      const { tasks = [], projects = [], date = new Date().toISOString().split('T')[0], customApiKey } = req.body;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.json({ synthesizedLogs: [] });
      }

      // Group candidate tasks by project
      const projectMap = new Map<string, { id: string; name: string; color: string }>();
      (projects || []).forEach((p: any) => {
        if (p && p.id) projectMap.set(p.id, p);
      });

      const grouped = new Map<string, any[]>();
      tasks.forEach((t: any) => {
        const pId = t.projectId || 'general';
        if (!grouped.has(pId)) grouped.set(pId, []);
        grouped.get(pId)!.push(t);
      });

      // Status-Separated Split Groups (Project × Status)
      // Planned tasks are strictly excluded from timesheets
      interface SplitBucket {
        splitId: string;
        projectId: string;
        projectName: string;
        projectColor: string;
        status: 'completed' | 'in_progress' | 'blocked';
        tasks: any[];
        totalElapsedSeconds: number;
      }

      const splitBuckets: SplitBucket[] = [];

      for (const [pId, pTasks] of grouped.entries()) {
        const project = projectMap.get(pId) || { id: pId, name: 'General Initiative', color: '#6366f1' };

        const doneTasks: any[] = [];
        const blockedTasks: any[] = [];
        const inProgressTasks: any[] = [];

        pTasks.forEach((t) => {
          const stage = t.stage || (t.completed ? 'done' : 'planned');
          // Planned tasks without activity are NEVER logged to official timesheets
          if (stage === 'planned' && !t.completed) {
            return;
          }
          if (stage === 'blocked') {
            blockedTasks.push(t);
          } else if (stage === 'done' || t.completed) {
            doneTasks.push(t);
          } else if (stage === 'in_progress' || stage === 'paused') {
            inProgressTasks.push(t);
          }
        });

        if (doneTasks.length > 0) {
          const totalSecs = doneTasks.reduce((acc, t) => acc + (t.elapsedSeconds || 0), 0);
          splitBuckets.push({
            splitId: `${pId}_completed`,
            projectId: pId,
            projectName: project.name,
            projectColor: project.color,
            status: 'completed',
            tasks: doneTasks,
            totalElapsedSeconds: totalSecs,
          });
        }

        if (blockedTasks.length > 0) {
          const totalSecs = blockedTasks.reduce((acc, t) => acc + (t.elapsedSeconds || 0), 0);
          splitBuckets.push({
            splitId: `${pId}_blocked`,
            projectId: pId,
            projectName: project.name,
            projectColor: project.color,
            status: 'blocked',
            tasks: blockedTasks,
            totalElapsedSeconds: totalSecs,
          });
        }

        if (inProgressTasks.length > 0) {
          const totalSecs = inProgressTasks.reduce((acc, t) => acc + (t.elapsedSeconds || 0), 0);
          splitBuckets.push({
            splitId: `${pId}_in_progress`,
            projectId: pId,
            projectName: project.name,
            projectColor: project.color,
            status: 'in_progress',
            tasks: inProgressTasks,
            totalElapsedSeconds: totalSecs,
          });
        }
      }

      if (splitBuckets.length === 0) {
        return res.json({ synthesizedLogs: [] });
      }

      const activeApiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;

      // Intelligent natural language fallback generator (Project × Status Split)
      const generateFallback = () => {
        return splitBuckets.map((bucket) => {
          const bullets: string[] = [];
          if (bucket.status === 'completed') {
            const titles = bucket.tasks.map((t) => t.title).join(', ');
            bullets.push(`• Completed deliverables: Successfully finalized and delivered ${titles}.`);
          } else if (bucket.status === 'blocked') {
            bucket.tasks.forEach((t) => {
              const reason = t.blockReason ? ` (Blocker: ${t.blockReason})` : '';
              bullets.push(`• Roadblock encountered: Progress halted on ${t.title}${reason}.`);
            });
          } else {
            const titles = bucket.tasks.map((t) => t.title).join(', ');
            bullets.push(`• Active focus: Currently advancing engineering implementation for ${titles}.`);
          }

          const durationMinutes = Math.max(Math.round(bucket.totalElapsedSeconds / 60), bucket.tasks.length * 20, 15);

          return {
            id: bucket.splitId,
            splitId: bucket.splitId,
            projectId: bucket.projectId,
            projectName: bucket.projectName,
            projectColor: bucket.projectColor,
            status: bucket.status,
            durationMinutes,
            summaryBullets: bullets.join('\n'),
            tags: [
              '#eod-synthesis',
              `#${bucket.projectName.toLowerCase().replace(/[^a-z0-9]/g, '-')}`,
              `#${bucket.status}`,
            ],
            taskIds: bucket.tasks.map((t) => t.id),
            underlyingTasks: bucket.tasks.map((t) => ({
              id: t.id,
              title: t.title,
              stage: t.stage || (t.completed ? 'done' : 'in_progress'),
              elapsedSeconds: t.elapsedSeconds || 0,
            })),
          };
        });
      };

      if (!activeApiKey) {
        return res.json({
          synthesizedLogs: generateFallback(),
          isAIGenerated: false,
          apiKeyMissing: true,
          notice: 'Synthesized using natural language fallback. Add your Gemini API key in Settings for AI executive synthesis.',
        });
      }

      // We have an active API key: synthesize via resilient Gemini cascade!
      const ai = new GoogleGenAI({
        apiKey: activeApiKey,
        httpOptions: {
          headers: {
            'User-Agent': 'aistudio-build',
          },
        },
      });

      // Reliable Gemini model cascade to avoid 503 server overloaded errors
      const MODEL_CASCADE = [
        'gemini-3.5-flash',      // Primary: rock-solid, zero 503 high-demand errors
        'gemini-3.8-flash',      // Latest frontier release
        'gemini-3.1-flash-lite', // Rapid fallback
        'gemini-2.5-flash',      // Safety net
      ];

      const promptPayload = {
        date,
        groups: splitBuckets.map((b) => ({
          splitId: b.splitId,
          projectId: b.projectId,
          projectName: b.projectName,
          status: b.status,
          totalElapsedSeconds: b.totalElapsedSeconds,
          tasks: b.tasks.map((t) => ({
            id: t.id,
            title: t.title,
            stage: t.stage || (t.completed ? 'done' : 'in_progress'),
            elapsedSeconds: t.elapsedSeconds || 0,
            blockReason: t.blockReason || null,
          })),
        })),
      };

      const systemInstruction = `You are a Principal Engineering Staff Architect and executive work log synthesizer.
Your mission is to take daily task records split by Project AND Status (Completed, Blocked, In Progress) and synthesize distinct, executive-ready timesheet entries for each group.

CRITICAL ARCHITECTURAL RULES (ABSOLUTE REQUIREMENTS):
1. STATUS SEPARATION: Maintain separate log entries for each split group (do NOT merge completed items with blocked or in-progress items).
2. NO RAW DUMPS: NEVER output a raw list of task titles.
3. NO COMPLETION TAGS: NEVER prefix items with '[COMPLETED]', '[IN PROGRESS]', '[BLOCKED]', or '[PLANNED]'.
4. NARRATIVE SYNTHESIS (1-3 bullets per group):
   - For 'completed' groups: Highlight concrete features shipped, bugs resolved, or technical milestones delivered using strong action verbs (e.g., "• Finalized client report schema, resolving token expiration race conditions across user onboarding.")
   - For 'blocked' groups: Concisely articulate the external blocker, dependency, or decision gate (e.g., "• Halted database migration pending upstream API credentials from DevOps.")
   - For 'in_progress' groups: Summarize the active development milestone, technical investigation, or next steps (e.g., "• Advancing performance profiling on client-side state hydration to eliminate initial paint latency.")
5. Each bullet point MUST start with "• ".
6. Estimate realistic duration in minutes based on totalElapsedSeconds (min 15 mins per group).
7. Suggest 2-3 relevant tags (e.g., #deep-work, #backend, #infra, #frontend).

You MUST respond strictly with valid JSON conforming to this schema (no markdown formatting or wrappers outside JSON):
{
  "synthesized": [
    {
      "splitId": "string",
      "projectId": "string",
      "projectName": "string",
      "status": "completed" | "in_progress" | "blocked",
      "durationMinutes": number,
      "summaryBullets": "string (bullet points separated by \\n, each starting with •)",
      "tags": ["#tag1", "#tag2"]
    }
  ]
}`;

      const userPrompt = `Synthesize the following project-status split groups into executive work logs for date: ${date}.\n\nSplit Groups Data:\n${JSON.stringify(promptPayload, null, 2)}\n\nSynthesize distinct executive entries for each split group now. Remember: NO raw task titles with [COMPLETED] tags.`;

      let aiResponseText = '';
      let successfulModel = '';
      const cascadeErrors: string[] = [];

      for (const model of MODEL_CASCADE) {
        try {
          const timeoutPromise = new Promise<never>((_, reject) =>
            setTimeout(() => reject(new Error(`${model} request timed out after 18s`)), 18000)
          );

          const aiResponse = await Promise.race([
            ai.models.generateContent({
              model,
              contents: userPrompt,
              config: {
                systemInstruction,
                responseMimeType: 'application/json',
                temperature: 0.3,
              },
            }),
            timeoutPromise,
          ]);

          const text = aiResponse.text || '';
          if (text.trim()) {
            aiResponseText = text;
            successfulModel = model;
            break;
          }
        } catch (err: any) {
          console.warn(`Gemini cascade model ${model} failed (${err?.message || err}), trying next model in cascade...`);
          cascadeErrors.push(`${model}: ${err?.message || 'error'}`);
        }
      }

      if (!aiResponseText) {
        console.warn('All Gemini cascade models failed, activating status-split natural fallback:', cascadeErrors);
        return res.json({
          synthesizedLogs: generateFallback(),
          isAIGenerated: false,
          apiError: cascadeErrors.join('; '),
          notice: 'AI models temporarily in high demand. Formatted via natural language executive fallback.',
        });
      }

      try {
        const parsed = JSON.parse(aiResponseText);
        const synthesizedList = Array.isArray(parsed.synthesized) ? parsed.synthesized : [];

        const bucketMap = new Map<string, SplitBucket>();
        splitBuckets.forEach((b) => bucketMap.set(b.splitId, b));

        const finalResults = synthesizedList.map((item: any) => {
          const bucket = bucketMap.get(item.splitId) || splitBuckets.find((b) => b.projectId === item.projectId && b.status === item.status);
          const project = projectMap.get(item.projectId || bucket?.projectId || '');
          const bTasks = bucket?.tasks || [];

          return {
            id: item.splitId || bucket?.splitId || `${item.projectId}_${item.status}`,
            splitId: item.splitId || bucket?.splitId || `${item.projectId}_${item.status}`,
            projectId: item.projectId || bucket?.projectId || 'general',
            projectName: item.projectName || project?.name || bucket?.projectName || 'Project',
            projectColor: project?.color || bucket?.projectColor || '#6366f1',
            status: (item.status === 'blocked' ? 'blocked' : item.status === 'in_progress' ? 'in_progress' : 'completed') as 'completed' | 'in_progress' | 'blocked',
            durationMinutes: item.durationMinutes || (bucket ? Math.max(15, Math.round(bucket.totalElapsedSeconds / 60)) : 30),
            summaryBullets: item.summaryBullets || bTasks.map((t: any) => `• ${t.title}`).join('\n'),
            tags: Array.isArray(item.tags) ? item.tags : ['#eod-synthesis'],
            taskIds: bTasks.map((t: any) => t.id),
            underlyingTasks: bTasks.map((t: any) => ({
              id: t.id,
              title: t.title,
              stage: t.stage || (t.completed ? 'done' : 'in_progress'),
              elapsedSeconds: t.elapsedSeconds || 0,
            })),
          };
        });

        return res.json({
          synthesizedLogs: finalResults.length > 0 ? finalResults : generateFallback(),
          isAIGenerated: true,
          modelUsed: successfulModel,
        });
      } catch (parseErr: any) {
        console.error('Failed to parse Gemini JSON output:', parseErr, aiResponseText);
        return res.json({
          synthesizedLogs: generateFallback(),
          isAIGenerated: false,
          apiError: 'Failed to parse AI output schema',
          notice: 'AI formatting anomaly. Formatted via natural language executive fallback.',
        });
      }
    } catch (err: any) {
      console.error('EOD Synthesis API Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to synthesize EOD logs' });
    }
  });

  // Google Apps Script Proxy to circumvent browser CORS / redirect issues
  app.post('/api/sheets/proxy', async (req, res) => {
    try {
      const { scriptUrl, payload, action, method } = req.body;
      if (!scriptUrl) {
        return res.status(400).json({ error: 'Google Apps Script URL is required' });
      }

      if (!isAllowedScriptUrl(String(scriptUrl))) {
        return res.status(400).json({
          error: 'Only Google Apps Script URLs (https://script.google.com/macros/s/...) are allowed',
        });
      }

      const targetUrl = new URL(scriptUrl);
      if (action) {
        targetUrl.searchParams.set('action', action);
      }

      const reqMethod = method || (action === 'ping' ? 'GET' : 'POST');

      let response: Response;
      if (reqMethod === 'GET') {
        response = await fetch(targetUrl.toString(), {
          method: 'GET',
          redirect: 'follow',
        });
      } else {
        const bodyPayload = {
          action: action || payload?.action || 'appendLog',
          ...payload,
        };

        response = await fetch(targetUrl.toString(), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(bodyPayload),
          redirect: 'follow',
        });
      }

      const contentType = response.headers.get('content-type') || '';
      if (contentType.includes('application/json')) {
        const data = await response.json();
        return res.json(data);
      } else {
        const text = await response.text();
        try {
          const json = JSON.parse(text);
          return res.json(json);
        } catch {
          return res.json({ success: response.ok, raw: text });
        }
      }
    } catch (err: any) {
      console.error('Sheets Proxy Error:', err);
      return res.status(500).json({ error: err?.message || 'Failed to communicate with Google Apps Script' });
    }
  });

  // Health check
  app.get('/api/health', (req, res) => {
    res.json({
      status: 'ok',
      hasEnvGeminiKey: Boolean(process.env.GEMINI_API_KEY),
      time: new Date().toISOString(),
    });
  });

  // Vite middleware in dev or static files in prod
  const isProd = process.env.NODE_ENV === 'production';
  if (!isProd) {
    const vite = await createViteServer({
      // Share the app's HTTP server for HMR so no extra port (24678) is needed
      server: { middlewareMode: true, ws: { server: httpServer } },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static(path.resolve(__dirname, 'dist')));
    app.get('*', (req, res) => {
      res.sendFile(path.resolve(__dirname, 'dist', 'index.html'));
    });
  }

  httpServer.listen(PORT, HOST, () => {
    console.log(`WorkPulse Server running on http://${HOST}:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed to start server:', err);
  process.exit(1);
});
