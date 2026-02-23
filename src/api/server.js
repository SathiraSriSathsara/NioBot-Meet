import express from "express";
import path from "path";
import { db } from "../db.js";
import { randomUUID } from "crypto";
import "dotenv/config";
import { z } from "zod";

const app = express();
app.use(express.json());

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "./recordings";
app.use("/media", express.static(path.resolve(RECORDINGS_DIR)));

const meetingSchema = z.object({
  title: z.string().min(1),
  meet_url: z.string().url(),
  scheduled_at: z.string().min(1),
  duration_sec: z.number().int().positive(),
});

app.post("/meetings", async (req, res) => {
  const parseResult = meetingSchema.safeParse(req.body);
  if (!parseResult.success) {
    res.status(400).json({ ok: false, error: parseResult.error.flatten() });
    return;
  }

  const { title, meet_url, scheduled_at, duration_sec } = parseResult.data;

  const id = randomUUID();

  await db.execute(
    "INSERT INTO meetings (id,title,meet_url,scheduled_at,duration_sec) VALUES (?,?,?,?,?)",
    [id, title, meet_url, scheduled_at, duration_sec]
  );

  // Create a job
  await db.execute(
    "INSERT INTO jobs (type, run_at, payload) VALUES ('RECORD_MEET', ?, ?)",
    [scheduled_at, JSON.stringify({ meeting_id: id })]
  );

  res.json({ id, ok: true });
});

app.get("/meetings", async (_req, res) => {
  const [rows] = await db.query(
    `SELECT id, title, meet_url, scheduled_at, duration_sec, created_at
     FROM meetings
     ORDER BY scheduled_at DESC`
  );
  res.json(rows);
});

app.get("/recordings", async (req, res) => {
  const [rows] = await db.query(
    `SELECT r.*, m.title, m.meet_url
     FROM recordings r
     JOIN meetings m ON m.id = r.meeting_id
     ORDER BY r.created_at DESC`
  );
  const baseUrl = `${req.protocol}://${req.get("host")}`;

  const mapped = rows.map(row => {
    const hlsUrl = row.hls_master_path ? `${baseUrl}/media/${row.hls_master_path}` : null;
    const mp4Url = row.mp4_720_path ? `${baseUrl}/media/${row.mp4_720_path}` : null;
    const thumbUrl = row.thumb_path ? `${baseUrl}/media/${row.thumb_path}` : null;

    return {
      ...row,
      watch_url: hlsUrl,
      download_url: mp4Url,
      thumbnail_url: thumbUrl,
    };
  });

  res.json(mapped);
});

app.listen(process.env.PORT || 5055, () => {
  console.log("API listening on", process.env.PORT || 5055);
});