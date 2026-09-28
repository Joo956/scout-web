# ScoutLead Signup

A React + Vite single-page app for scout troop sign-ups, backed by Supabase (auth + database) and deployed on Vercel.

## Prerequisites

- **Node.js** >= 18 ([nodejs.org](https://nodejs.org))
- **npm** (comes with Node)
- A **Supabase** project (free tier is fine) — needed for auth and data. Ask whoever owns the project for access, or create your own project at [supabase.com](https://supabase.com) if you're setting up a fresh backend.

## 1. Install dependencies

```bash
npm install
```

## 2. Configure environment variables

Copy the example env file and fill in your Supabase project's values:

```bash
cp .env.example .env.local
```

Then open `.env.local` and set:

```
VITE_SUPABASE_URL=<your-project>.supabase.co
VITE_SUPABASE_ANON_KEY=<your-anon-public-key>
```

You can find both values in the Supabase dashboard under **Project Settings → API**. `.env.local` is already git-ignored, so your keys won't be committed.

## 3. Run the app locally

```bash
npm run dev
```

This starts the Vite dev server (default: [http://localhost:5173](http://localhost:5173)) with hot reload.

## Other scripts

| Command           | Description                                  |
| ------------------ | --------------------------------------------- |
| `npm run dev`      | Start the local dev server                    |
| `npm run build`    | Build a production bundle into `dist/`        |
| `npm run preview`  | Preview the production build locally          |

## Test login

Use these credentials to sign in once the app is running:

- **Email:** ava.ebram324@gmail.com
- **Password:** 123456

> This is a real login for the connected Supabase project — don't push this file to a public GitHub repo with these credentials still in it.

## Notes

- If the Supabase env vars are missing or left as placeholders, the app detects this at runtime (`src/lib/supabaseClient.js`) and disables Supabase-dependent features instead of crashing — useful for a quick UI-only preview, but you'll need real credentials for auth, data, and admin features to work.
- Deployment is configured for Vercel (`vercel.json`), using `npm run build` and serving the `dist/` folder with SPA rewrites.
