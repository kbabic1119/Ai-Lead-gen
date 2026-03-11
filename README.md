# LEADGEN.AI

AI-powered lead generation and cold outreach tool for web design freelancers.

Find potential clients on Google Maps or LinkedIn, analyze their websites with Gemini AI, generate personalized cold email pitches, and send them via Resend — all in one workflow.

---

## Features

- **Lead Discovery** — Search businesses via Google Maps or scrape LinkedIn profiles by job title, industry, and location
- **Website Analysis** — Gemini AI visits the business website and identifies design & SEO issues
- **Pitch Generation** — Generates a short, human-sounding cold email based on the analysis
- **Pitch Reframing** — Give feedback to rewrite the pitch (e.g. "make it shorter", "more casual")
- **Email Outreach** — Send via Resend API or open directly in your mail client
- **Lead Database** — All leads stored locally in SQLite with status tracking (`new → analyzed → pitched → sent`)
- **Bulk Send** — Send emails to all pitched leads at once

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Backend | Express (Node.js), TypeScript |
| Database | SQLite (`better-sqlite3`) |
| AI | Google Gemini (`gemini-2.5-flash`, `gemini-2.0-flash`) |
| Email | Resend API |
| Build | Vite 6 |

---

## Run Locally

**Prerequisites:** Node.js 18+

```bash
# 1. Clone the repo
git clone https://github.com/kbabic1119/Ai-Lead-gen.git
cd Ai-Lead-gen

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
```

Edit `.env.local` and fill in your keys:

```env
GEMINI_API_KEY="your-gemini-api-key"
RESEND_API_KEY="your-resend-api-key"
APP_URL="http://localhost:3000"
```

```bash
# 4. Start the dev server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000)

---

## Environment Variables

| Variable | Required | Description |
|----------|----------|-------------|
| `GEMINI_API_KEY` | ✅ | Get from [Google AI Studio](https://aistudio.google.com/apikey) |
| `RESEND_API_KEY` | ✅ for email | Get from [resend.com](https://resend.com) — free tier works |
| `APP_URL` | Optional | URL where the app is hosted |

> **Note:** Resend free tier only allows sending to verified email addresses. Use "Open in Email App" as an alternative.

---

## Deploy to Railway

This app needs a backend (Express + SQLite), so it can't be hosted on GitHub Pages. **Railway** is the easiest free option.

1. Go to [railway.app](https://railway.app) and sign in with GitHub
2. Click **New Project → Deploy from GitHub repo** → select `Ai-Lead-gen`
3. Add environment variables in the Railway dashboard:
   - `GEMINI_API_KEY`
   - `RESEND_API_KEY`
4. Railway auto-detects Node.js and will run:
   - **Build:** `npm run build`
   - **Start:** `npm start`

Your app will be live at a `*.railway.app` URL.

---

## Project Structure

```
ai-lead-gen/
├── src/
│   ├── App.tsx                  # Main React UI
│   ├── main.tsx                 # React entry point
│   ├── index.css                # Global styles
│   ├── constants.ts             # HOT_ROLES, HOT_INDUSTRIES
│   └── services/
│       └── geminiService.ts     # All Gemini AI functions
├── server.ts                    # Express server + SQLite + API routes
├── vite.config.ts               # Vite config
├── package.json
├── tsconfig.json
├── .env.example                 # Environment variable template
└── .gitignore
```

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | Get all leads |
| POST | `/api/leads` | Save a new lead |
| PATCH | `/api/leads/:id` | Update lead (status, analysis, pitch, email) |
| POST | `/api/verify-email` | DNS MX check for email validation |
| POST | `/api/send-email` | Send email via Resend |

---

## Scripts

| Script | Description |
|--------|-------------|
| `npm run dev` | Start dev server with Vite HMR at port 3000 |
| `npm run build` | Build React frontend to `dist/` |
| `npm start` | Run production server (serves built `dist/`) |
| `npm run lint` | TypeScript type check |
