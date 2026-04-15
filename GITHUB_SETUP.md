# GitHub Setup & Configuration Guide

> **Note:** For general setup instructions, see the main [README.md](README.md)

This guide covers GitHub-specific configuration and deployment for Toolkitr.

---

## Initial Setup

### 1. Create GitHub OAuth App

1. Go to **GitHub Settings** → **[Developer settings](https://github.com/settings/developers)**
2. Click **"OAuth Apps"** → **"New OAuth App"**
3. Fill in the form:
   - **Application name:** `Toolkitr`
   - **Homepage URL:** `http://localhost:3000` (dev) or your production domain
   - **Authorization callback URL:** `http://localhost:3000/api/auth/callback`
4. Copy your **Client ID** and **Client Secret**
5. Add to `.env.local`:
   ```env
   GITHUB_CLIENT_ID=your_client_id_here
   GITHUB_CLIENT_SECRET=your_client_secret_here
   ```

### 2. Generate AUTH_SECRET

```bash
# Generate a random 32-character hex string
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

Add to `.env.local`:
```env
AUTH_SECRET=<paste_generated_value_here>
```

### 3. Set Up Database & Start

See [README.md → Quick Start](README.md#quick-start) for database and server setup.

---

## Production Deployment

### Option 1: Vercel (Recommended for Next.js)

```bash
# Install Vercel CLI
npm install -g vercel

# Add environment variables
vercel env add GITHUB_CLIENT_ID
vercel env add GITHUB_CLIENT_SECRET
vercel env add AUTH_SECRET
vercel env add DATABASE_URL

# Deploy
vercel
```

### Option 2: Railway.app

1. Connect GitHub repo to [Railway.app](https://railway.app/)
2. Add variables in Railway dashboard
3. Deploy automatically on push

---

## Production OAuth Configuration

When deploying to production:

1. Create a **new** OAuth App for production in GitHub Settings
2. Update callback URL to: `https://your-domain.com/api/auth/callback`
3. Update environment variables in production:
   ```env
   GITHUB_CLIENT_ID=prod_client_id
   GITHUB_CLIENT_SECRET=prod_client_secret
   NEXT_PUBLIC_APP_URL=https://your-domain.com
   ```

---

## Secrets Management

### Never Commit ❌
- `.env.local`
- `GITHUB_CLIENT_SECRET`
- `AUTH_SECRET`
- `DATABASE_URL`

### Use Environment Variables ✅
- Set secrets via platform dashboard (Vercel, Railway, etc.)
- Keep separate OAuth apps for dev/prod
- Rotate secrets periodically

---

## Troubleshooting

| Issue | Solution |
|-------|----------|
| OAuth flow fails | Check callback URL matches exactly (including http vs https) |
| Database connection error | Verify DATABASE_URL format and network access |
| Frontend breaks after login | Clear browser cookies, check AUTH_SECRET is set |

---

**For complete setup and feature documentation, see [README.md](README.md)**

