import express from 'express';
import { localDateStr } from './src/utils/dates';
import http from 'http';
import { createServer as createViteServer } from 'vite';
import { GoogleGenAI } from '@google/genai';
import path from 'path';
import { fileURLToPath } from 'url';
import dotenv from 'dotenv';
import { isAllowedScriptUrl } from './src/utils/scriptUrl';
import { GEMINI_MODEL_CASCADE, GEMINI_TIMEOUT_MS } from './src/utils/geminiModels';
import { buildBuckets, mergeSynthesis, templateLog } from './src/utils/eodSynthesis';
import { isAllowedHostHeader, isAllowedOrigin } from './src/utils/hostCheck';

// Load .env.local first (local overrides), then fall back to .env
dotenv.config({ path: ['.env.local', '.env'], quiet: true });

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// The SDK reports API errors as a JSON string; show just the human-readable message.
function readableError(raw: unknown): string {
  const text = typeof raw === 'string' && raw ? raw : 'error';
  const m = /"message"\s*:\s*"((?:[^"\\]|\\.)*)"/.exec(text);
  return m ? m[1] : text;
}

// Tries each model in order. Every request is cancelled (AbortSignal) after GEMINI_TIMEOUT_MS,
// so a hung model cannot stall the route. Returns the first non-empty answer, or all the errors.
async function generateWithCascade(
  ai: GoogleGenAI,
  contents: string,
  config: Record<string, unknown>,
): Promise<{ text: string; model: string; errors: string[] }> {
  const errors: string[] = [];
  for (const model of GEMINI_MODEL_CASCADE) {
    try {
      const response = await ai.models.generateContent({
        model,
        contents,
        config: { ...config, abortSignal: AbortSignal.timeout(GEMINI_TIMEOUT_MS) },
      });
      const text = response.text || '';
      if (text.trim()) return { text, model, errors };
      errors.push(`${model}: empty response`);
    } catch (err: any) {
      const message = readableError(err?.message);
      console.warn(`Gemini model ${model} failed (${message}), trying the next one...`);
      errors.push(`${model}: ${message}`);
      // A rejected key will be rejected by every model: stop instead of repeating the failure.
      if (/api key|permission|unauthori[sz]ed|forbidden/i.test(message)) break;
    }
  }
  return { text: '', model: '', errors };
}

const shortReason = (errors: string[]) => (errors[0] || 'unknown error').slice(0, 200);

async function startServer() {
  const app = express();
  const httpServer = http.createServer(app);
  const PORT = Number(process.env.PORT) || 3000;
  // Localhost only by default. Set HOST=0.0.0.0 to allow other devices on your network (no authentication!).
  const HOST = process.env.HOST || '127.0.0.1';

  // DNS-rebinding guard (S3): while bound to localhost, /api only answers requests addressed to a
  // local hostname. With HOST set to something else the user opted in to LAN access, so skip it.
  const extraHosts = (process.env.ALLOWED_HOSTS || '').split(',').map((h) => h.trim()).filter(Boolean);
  if (HOST === '127.0.0.1') {
    app.use('/api', (req, res, next) => {
      if (!isAllowedHostHeader(req.headers.host, extraHosts) || !isAllowedOrigin(req.headers.origin, extraHosts)) {
        return res.status(403).json({ error: 'Forbidden: unexpected Host or Origin.' });
      }
      next();
    });
  }

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

      const result = await generateWithCascade(
        ai,
        prompt,
        systemInstruction ? { systemInstruction, temperature: 0.7 } : {},
      );
      if (!result.text) {
        console.error('Gemini standup failed on every model:', result.errors);
        return res.status(502).json({
          error: `AI request failed: ${shortReason(result.errors)}`,
          details: result.errors,
        });
      }
      return res.json({ text: result.text, modelUsed: result.model });
    } catch (err: any) {
      console.error('Gemini API Error:', err);
      const message = err?.message || 'Failed to generate content with Gemini';
      return res.status(500).json({ error: message });
    }
  });

  // End-of-Day (EOD) AI Log Synthesizer endpoint
  app.post('/api/synthesize-eod', async (req, res) => {
    try {
      const { tasks = [], projects = [], date = localDateStr(), customApiKey } = req.body;

      if (!Array.isArray(tasks) || tasks.length === 0) {
        return res.json({ synthesizedLogs: [] });
      }

      const splitBuckets = buildBuckets(tasks, Array.isArray(projects) ? projects.filter((p: any) => p && p.id) : []);
      if (splitBuckets.length === 0) {
        return res.json({ synthesizedLogs: [] });
      }

      const templates = () => splitBuckets.map(templateLog);
      const activeApiKey = customApiKey?.trim() || process.env.GEMINI_API_KEY;

      if (!activeApiKey) {
        return res.json({
          synthesizedLogs: templates(),
          isAIGenerated: false,
          apiKeyMissing: true,
          notice: 'No Gemini API key: using template text. Add your key in Settings for AI synthesis.',
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
6. Duration is computed by the app from tracked time. Set durationMinutes to round(totalElapsedSeconds / 60); do not estimate.
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

      const result = await generateWithCascade(ai, userPrompt, {
        systemInstruction,
        responseMimeType: 'application/json',
        temperature: 0.3,
      });

      if (!result.text) {
        console.warn('All Gemini models failed, using templates:', result.errors);
        return res.json({
          synthesizedLogs: templates(),
          isAIGenerated: false,
          apiError: result.errors.join('; '),
          notice: `AI request failed (${shortReason(result.errors)}). Showing template text instead.`,
        });
      }

      let aiItems: unknown[] = [];
      try {
        const parsed = JSON.parse(result.text);
        aiItems = Array.isArray(parsed?.synthesized) ? parsed.synthesized : [];
      } catch (parseErr: any) {
        console.error('Failed to parse Gemini JSON output:', parseErr, result.text);
        return res.json({
          synthesizedLogs: templates(),
          isAIGenerated: false,
          apiError: 'Failed to parse AI output',
          notice: 'The AI returned an unreadable answer. Showing template text instead.',
        });
      }

      const { logs, fallbackSplitIds } = mergeSynthesis(splitBuckets, aiItems);
      const aiCount = logs.length - fallbackSplitIds.length;
      return res.json({
        synthesizedLogs: logs,
        isAIGenerated: aiCount > 0,
        modelUsed: result.model,
        fallbackSplitIds,
        notice:
          fallbackSplitIds.length > 0
            ? `The AI wrote ${aiCount} of ${logs.length} groups. The other ${fallbackSplitIds.length} use template text: check them before pushing.`
            : undefined,
      });
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
          // Not JSON: usually a Google sign-in or error page. This is a failure, not a success.
          return res.status(502).json({
            status: 'error',
            error:
              'Google returned a web page instead of the script response. Deploy the script as a Web app with "Who has access" set to "Anyone", and check the URL ends in /exec.',
          });
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
  const isProd = process.env.NODE_ENV === 'production' || process.argv.includes('--prod');
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
