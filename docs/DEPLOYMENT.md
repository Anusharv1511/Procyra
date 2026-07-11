# Deploying Procyra (free tier) — Neon + Vercel

Time: ~15 minutes. You need: a GitHub account, a Neon account, a Vercel account.

## 1. Database — Neon

1. Go to https://neon.tech → sign up → **New project** (any name, region near you, Postgres 16+).
2. On the project dashboard, open **Connection details** and copy the **pooled** connection string (it contains `-pooler` in the host). It looks like:
   `postgresql://user:password@ep-xxx-pooler.region.aws.neon.tech/neondb?sslmode=require`

## 2. Push the code to GitHub

```bash
cd procyra
git init && git add -A && git commit -m "Procyra Phase 1"
# create an empty repo on github.com, then:
git remote add origin https://github.com/<you>/procyra.git
git push -u origin main
```

Confirm `.env` is **not** in the repo (`git ls-files | grep .env` should show only `.env.example`).

## 3. Create the tables

From your machine, point drizzle at Neon once:

```bash
DATABASE_URL="<your neon pooled url>" npx drizzle-kit migrate
```

## 4. App — Vercel

1. https://vercel.com → **Add New → Project** → import your `procyra` repo.
2. Framework preset: Next.js (auto-detected). Leave build settings default.
3. **Environment variables** (Production):
   - `DATABASE_URL` = your Neon pooled connection string
   - `AUTH_SECRET` = output of `openssl rand -hex 32`
4. **Deploy**. First build takes ~2 minutes.

## 5. Post-deploy smoke checklist (do all of these)

- [ ] Open the production URL → landing page renders.
- [ ] Register an account → you land on the setup wizard.
- [ ] Create a workspace (pick e.g. Aerospace) + first project → dashboard loads.
- [ ] Sidebar shows aerospace terms ("Non-conformities") and defaults (Cpk 1.67 on new SPC streams).
- [ ] Create an I-MR SPC stream with LSL/USL → log ~10 normal values, then one wild value → the entry response says OUT OF CONTROL, the point turns red, and an alert appears on the dashboard.
- [ ] Log the same defect code 2× (aerospace threshold) in the NC module → a draft CAPA appears with the "auto-drafted" badge.
- [ ] On a phone or Chrome desktop, use "Install app" → Procyra installs; open a project page, go offline, re-open it → the page is still readable.
- [ ] `https://<your-app>/manifest.json` and `/sw.js` return 200.

## Troubleshooting

- **`ECONNREFUSED` / DB errors on Vercel**: you used the direct (non-pooled) Neon URL. Serverless needs the `-pooler` host.
- **Login loops**: `AUTH_SECRET` missing or different between deployments — set it in Vercel env and redeploy.
- **Tables missing**: step 3 was skipped; run the migrate command against the Neon URL.
