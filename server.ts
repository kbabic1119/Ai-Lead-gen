import express from "express";
import { createServer as createViteServer } from "vite";
import Database from "better-sqlite3";
import { Resend } from "resend";
import dotenv from "dotenv";
import dns from "dns";
import { promisify } from "util";

const resolveMx = promisify(dns.resolveMx);

dotenv.config();

const db = new Database("leads.db");

// Initialize database
db.exec(`
  CREATE TABLE IF NOT EXISTS leads (
    id TEXT PRIMARY KEY,
    name TEXT,
    website TEXT,
    address TEXT,
    phone TEXT,
    rating REAL,
    user_ratings_total INTEGER,
    status TEXT DEFAULT 'new',
    analysis TEXT,
    pitch TEXT,
    email TEXT,
    linkedin TEXT,
    source TEXT,
    role TEXT,
    company_size TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )
`);

// Add columns if they don't exist (simple migration)
try {
  db.prepare("ALTER TABLE leads ADD COLUMN role TEXT").run();
} catch (e) {}
try {
  db.prepare("ALTER TABLE leads ADD COLUMN company_size TEXT").run();
} catch (e) {}

async function startServer() {
  const app = express();
  const PORT = process.env.PORT || 3000;

  app.use(express.json());

  // API Routes
  app.get("/api/leads", (req, res) => {
    const leads = db.prepare("SELECT * FROM leads ORDER BY created_at DESC").all();
    res.json(leads);
  });

  app.post("/api/leads", (req, res) => {
    const { id, name, website, address, phone, rating, user_ratings_total, linkedin, source, role, company_size, email } = req.body;
    const insert = db.prepare(`
      INSERT OR IGNORE INTO leads (id, name, website, address, phone, rating, user_ratings_total, linkedin, source, role, company_size, email)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `);
    insert.run(id, name, website, address, phone, rating, user_ratings_total, linkedin, source, role, company_size, email);
    res.json({ success: true });
  });

  app.patch("/api/leads/:id", (req, res) => {
    const { id } = req.params;
    const { status, analysis, pitch, email } = req.body;
    
    const updates: string[] = [];
    const values: any[] = [];

    if (status !== undefined) { updates.push("status = ?"); values.push(status); }
    if (analysis !== undefined) { updates.push("analysis = ?"); values.push(analysis); }
    if (pitch !== undefined) { updates.push("pitch = ?"); values.push(pitch); }
    if (email !== undefined) { updates.push("email = ?"); values.push(email); }

    if (updates.length === 0) return res.status(400).json({ error: "No fields to update" });

    values.push(id);
    const stmt = db.prepare(`UPDATE leads SET ${updates.join(", ")} WHERE id = ?`);
    stmt.run(...values);
    res.json({ success: true });
  });

  app.post("/api/verify-email", async (req, res) => {
    const { email } = req.body;
    if (!email || !email.includes('@')) {
      return res.json({ valid: false, reason: "Invalid format" });
    }
    const domain = email.split('@')[1];
    try {
      const records = await resolveMx(domain);
      if (records && records.length > 0) {
        res.json({ valid: true });
      } else {
        res.json({ valid: false, reason: "No mail servers found for domain" });
      }
    } catch (err) {
      res.json({ valid: false, reason: "Domain does not exist or has no mail servers" });
    }
  });

  app.post("/api/send-email", async (req, res) => {
    const { to, subject, html } = req.body;
    
    if (!process.env.RESEND_API_KEY) {
      return res.status(500).json({ error: "RESEND_API_KEY not configured in environment variables." });
    }

    const resend = new Resend(process.env.RESEND_API_KEY);

    try {
      const { data, error } = await resend.emails.send({
        from: "LeadGen AI <onboarding@resend.dev>",
        to: [to],
        subject: subject,
        html: html,
      });

      if (error) {
        return res.status(400).json({ error: error.message || "Resend API Error" });
      }

      res.json(data);
    } catch (err: any) {
      res.status(500).json({ error: err.message || "Failed to send email" });
    }
  });

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    app.use(express.static("dist"));
    app.get("*", (req, res) => {
      res.sendFile("dist/index.html", { root: "." });
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
