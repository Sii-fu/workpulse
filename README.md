<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://ai.google.dev/static/site-assets/images/share-ais-513315318.png" />
</div>

# Run and deploy your AI Studio app

This contains everything you need to run your app locally.

View your app in AI Studio: https://ai.studio/apps/527143a0-4ed6-4b7d-8f8c-08199719a8ea

## Run Locally

**Prerequisites:** Node.js 20.19+ or 22.12+ (no Docker needed)

### Windows: one click

Double-click **`run.bat`** (or run it from a terminal). It will:

1. Check that Node.js is installed
2. Install dependencies (first run only, or when `package.json` changes)
3. Create `.env.local` on first run
4. Pick a free port (starting at 3000)
5. Start the server and open http://localhost:3000 in your browser

Options:

- `run.bat prod` builds an optimized bundle and runs in production mode
- `set PORT=4000` before running chooses a different starting port
- `set NO_BROWSER=1` before running skips opening the browser

Press `Ctrl+C` in the window to stop the server.

### AI features (optional)

Set `GEMINI_API_KEY` in `.env.local` to your Gemini API key, or paste a key
in the app under **Settings**. Everything else works without a key.

### Manual

1. `npm install`
2. `npm run dev`
