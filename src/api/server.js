import express from "express";
import { db } from "../db.js";
import { randomUUID } from "crypto";
import "dotenv/config";
import { colomboStringToUtcMySqlDatetime } from "../time.js";

const app = express();
app.use(express.json());

function isValidMeetUrl(url) {
  try {
    const u = new URL(url);
    return u.hostname === "meet.google.com";
  } catch {
    return false;
  }
}

app.post("/meetings", async (req, res) => {
  try {
    const { title, meet_url, scheduled_at, duration_sec } = req.body;

    if (!title || typeof title !== "string") {
      return res.status(400).json({ ok: false, error: "title is required" });
    }
    if (!meet_url || !isValidMeetUrl(meet_url)) {
      return res
        .status(400)
        .json({
          ok: false,
          error: "meet_url must be a valid meet.google.com URL",
        });
    }
    if (!scheduled_at || typeof scheduled_at !== "string") {
      return res
        .status(400)
        .json({
          ok: false,
          error: 'scheduled_at must be "YYYY-MM-DD HH:mm:ss" (Sri Lanka time)',
        });
    }
    const dur = Number(duration_sec);
    if (!Number.isFinite(dur) || dur <= 0) {
      return res
        .status(400)
        .json({ ok: false, error: "duration_sec must be a positive number" });
    }

    // Convert Sri Lanka local time → UTC string for DB
    const scheduledAtUtc = colomboStringToUtcMySqlDatetime(scheduled_at);

    const id = randomUUID();

    await db.execute(
      "INSERT INTO meetings (id,title,meet_url,scheduled_at,duration_sec) VALUES (?,?,?,?,?)",
      [id, title, meet_url, scheduledAtUtc, dur],
    );

    await db.execute(
      "INSERT INTO jobs (type, run_at, payload) VALUES ('RECORD_MEET', ?, CAST(? AS JSON))",
      [scheduledAtUtc, JSON.stringify({ meeting_id: id })],
    );

    return res.json({
      ok: true,
      id,
      // helpful debug output:
      scheduled_at_input_colombo: scheduled_at,
      scheduled_at_utc_saved: scheduledAtUtc,
    });
  } catch (e) {
    return res.status(500).json({ ok: false, error: String(e?.message || e) });
  }
});

app.get("/meetings", async (req, res) => {
  const [rows] = await db.query(
    "SELECT id,title,meet_url,scheduled_at,duration_sec,created_at FROM meetings ORDER BY scheduled_at DESC",
  );
  res.json({ ok: true, data: rows });
});

app.get("/jobs", async (req, res) => {
  const [rows] = await db.query(
    "SELECT id,type,status,run_at,locked_by,locked_at,attempts,last_error,created_at,updated_at FROM jobs ORDER BY id DESC LIMIT 50",
  );
  res.json({ ok: true, data: rows });
});

app.get("/health/db", async (req, res) => {
  const [rows] = await db.query(
    "SELECT DATABASE() as db, NOW() as now, UTC_TIMESTAMP() as utc",
  );
  res.json({ ok: true, ...rows[0] });
});

app.listen(process.env.PORT || 5055, () => {
  console.log("API listening on", process.env.PORT || 5055);
});
