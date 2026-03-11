# ai-lead-gen

**Path:** `C:\Users\ASUS\Desktop\Programming\ai-lead-gen`
**Type:** AI-powered lead generation & outreach tool
**Tech Stack:** React 19, TypeScript, Vite, Express, SQLite, Tailwind CSS v4, Google Gemini AI, Resend
**Status:** Active development

---

## What It Does

Full-stack web app that helps find potential clients (businesses or LinkedIn profiles), analyze their websites with Gemini AI, generate personalized cold email pitches, and send outreach emails via Resend.

**Workflow:**
1. Search for leads via Google Maps or LinkedIn (powered by Gemini AI)
2. Analyze their website for design/SEO issues
3. Generate a personalized cold email pitch
4. Send the email via Resend API or open in mail client

---

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Frontend | React 19, TypeScript, Tailwind CSS v4 |
| Backend | Express (Node.js), TypeScript (`tsx`) |
| Database | SQLite via `better-sqlite3` (`leads.db`) |
| AI | Google Gemini (`@google/genai`) — `gemini-2.5-flash` / `gemini-3-flash-preview` |
| Email | Resend API |
| Build | Vite 6, `@vitejs/plugin-react` |

---

## Project Structure

```
ai-lead-gen/
├── src/
│   ├── App.tsx              # Main React component (entire UI)
│   ├── main.tsx             # React entry point
│   ├── index.css            # Global styles
│   ├── constants.ts         # HOT_ROLES, HOT_INDUSTRIES lists
│   └── services/
│       └── geminiService.ts # All Gemini AI calls (findLeads, analyzeWebsite, etc.)
├── server.ts                # Express server + SQLite setup + API routes
├── leads.db                 # SQLite database (gitignored)
├── vite.config.ts           # Vite config with React + Tailwind plugins
├── tsconfig.json            # TypeScript config
├── package.json             # Dependencies and scripts
├── .env.example             # Environment variable template
├── .gitignore               # Ignores node_modules, dist, .env*, leads.db
├── index.html               # HTML entry point
└── metadata.json            # AI Studio metadata
```

---

## Key Files

- **[server.ts](server.ts)** — Express server, SQLite DB init, API routes (`/api/leads`, `/api/verify-email`, `/api/send-email`), Vite middleware
- **[src/App.tsx](src/App.tsx)** — All UI: search panel, leads list, detail view with analysis + pitch workflow
- **[src/services/geminiService.ts](src/services/geminiService.ts)** — Gemini AI integration: `findLeads`, `findLinkedInLeads`, `analyzeWebsite`, `generatePitch`, `reframePitch`
- **[src/constants.ts](src/constants.ts)** — `HOT_ROLES` and `HOT_INDUSTRIES` arrays for LinkedIn search quick-picks

---

## API Routes

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | Fetch all leads from SQLite |
| POST | `/api/leads` | Save a new lead |
| PATCH | `/api/leads/:id` | Update lead status, analysis, pitch, or email |
| POST | `/api/verify-email` | DNS MX record check for email validation |
| POST | `/api/send-email` | Send email via Resend API |

---

## Environment Variables

Create a `.env.local` file (copy from `.env.example`):

```bash
GEMINI_API_KEY="your-gemini-api-key"
APP_URL="http://localhost:3000"
RESEND_API_KEY="your-resend-api-key"
```

- `GEMINI_API_KEY` — Required. Get from Google AI Studio.
- `RESEND_API_KEY` — Required for email sending. Get from resend.com. Free tier only sends to verified addresses.
- `APP_URL` — URL where the app is hosted (used for self-referential links).

---

## Running Locally

**Prerequisites:** Node.js 18+

```bash
# Install dependencies
npm install

# Create env file
cp .env.example .env.local
# Edit .env.local and add your API keys

# Start dev server (Express + Vite)
npm run dev
# App runs at http://localhost:3000
```

**Build for production:**
```bash
npm run build
npm run preview
```

---

## Scripts

| Script | Command | Description |
|--------|---------|-------------|
| `dev` | `tsx server.ts` | Starts Express + Vite dev middleware |
| `build` | `vite build` | Builds React frontend to `dist/` |
| `preview` | `vite preview` | Preview production build |
| `lint` | `tsc --noEmit` | TypeScript type checking |
| `clean` | `rm -rf dist` | Remove build output |

---

## Lead Statuses

```
new → analyzing → analyzed → pitching → pitched → sent
```

---

## Gemini AI Models Used

- `gemini-2.5-flash` — Google Maps lead search (with `googleMaps` tool)
- `gemini-3-flash-preview` — LinkedIn leads, website analysis (with `urlContext` tool), pitch generation, pitch reframing

---

## Notes

- `leads.db` is gitignored — SQLite database persists locally only
- The portfolio and LinkedIn in `geminiService.ts` are hardcoded to the owner: Kazimiez Babic
- Resend free tier only allows sending to verified email addresses — use "Open in Email App" as alternative
- Server runs on port 3000 (`0.0.0.0`)
- Logging: browser console only (vanilla Express + React — no file logging needed for dev)
