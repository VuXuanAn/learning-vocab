# Deploy React + Express on one Vercel project

The Vite build serves `dist` through Vercel's CDN. Requests under `/api` are rewritten to `api/index.mjs`, which exports the shared Express app without starting a port listener. Other paths fall back to `index.html` for React Router. Existing local `npm run dev`/`npm start` are unchanged.

1. Commit and push the deployment changes to the GitHub repository connected to Vercel. Never commit `.env` or `server/.env`.
2. In the existing Vercel project, use the repository root (not `server`) as Root Directory. Use Vite, build command `npm run build`, output `dist`, install `npm install` and Node 22.x. `vercel.json` supplies build/routing configuration.
3. Project Settings → Environment Variables. Set Production, and Preview if needed:

| Name | Value |
|---|---|
| `VITE_SUPABASE_URL` | Existing Supabase URL |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | Existing public/publishable or anon key |
| `GEMINI_API_KEY` | Private Gemini key, backend only |
| `GEMINI_MODEL` | The model already working in your local server/.env |
| `FRONTEND_ORIGIN` | Production HTTPS origin, without a trailing slash |
| `VITE_MAX_REVIEW_AUDIO_MB` | `3` |

Do not set `PORT`, expose Gemini via a `VITE_` key, or upload server/.env. Preview and production deployment origins supplied by Vercel are also allowed by this API entry.

4. Deploy the latest commit, or redeploy it after changing environment variables. Old deployments retain old build-time frontend values.
5. Open `https://<domain>/api/health`: expect JSON with `status: "ok"`, `provider: "gemini"` and `aiConfigured: true`. A 404 means the new API/config files were not deployed; HTML means API rewrite/build settings need checking. Test a normal page refresh and one AI generation.
6. Supabase Authentication → URL Configuration: set Site URL to the production origin and add actual app callback routes (`/`, `/settings`) under Redirect URLs, plus any intentional preview URLs. Google Cloud OAuth Client: add the production app origin to Authorized JavaScript origins if used. Keep the Supabase `https://<project>.supabase.co/auth/v1/callback` as the Google authorized redirect URI.

Vercel Functions limit request/response payloads to 4.5 MB. Audio is base64-encoded, so a 3 MB raw-audio cap leaves room for JSON/reference text. It affects AI review only, not direct browser uploads to Google Drive. Larger audio needs a separate upload/reference workflow, not a higher Express JSON limit.

Usage metrics on this Vercel entry are intentionally in-memory, with no attempted writes to the deployment filesystem. Counts can reset or differ between instances; UI explains this. Durable totals require an external database implementation. The current in-memory rate limiter is also instance-local. Supabase learning data and Drive recordings are separate from those runtime counters.

Local validation includes the production build, API-entry health/origin/routing tests, and the existing server suite. It does not constitute a live Vercel deployment test.

References: [Vercel Node functions](https://vercel.com/docs/functions/runtimes/node-js), [Vite SPA routing](https://vercel.com/docs/frameworks/frontend/vite), [function limits](https://vercel.com/docs/functions/limitations).
