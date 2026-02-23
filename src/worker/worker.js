import { db } from "../db.js";
import "dotenv/config";
import { randomUUID } from "crypto";
import { recordMeetJob } from "./recorder/runRecordMeet.js";

const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID()}`;

async function fetchAndLockJob() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Find due job using UTC time
    const [jobs] = await conn.query(
      `SELECT * FROM jobs
       WHERE status='PENDING' AND run_at <= UTC_TIMESTAMP()
       ORDER BY run_at ASC
       LIMIT 1
       FOR UPDATE`,
    );

    if (jobs.length === 0) {
      await conn.commit();
      return null;
    }

    const job = jobs[0];

    await conn.execute(
      `UPDATE jobs
       SET status='RUNNING', locked_by=?, locked_at=UTC_TIMESTAMP(), attempts=attempts+1
       WHERE id=?`,
      [WORKER_ID, job.id],
    );

    await conn.commit();
    return job;
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
}

async function debugNoJob() {
  const [t] = await db.query("SELECT UTC_TIMESTAMP() as utc_now, NOW() as now");
  const [next] = await db.query(
    "SELECT id, run_at FROM jobs WHERE status='PENDING' ORDER BY run_at ASC LIMIT 1",
  );
  console.log(
    "No jobs due. MySQL UTC_TIMESTAMP() =",
    t[0]?.utc_now,
    "NOW() =",
    t[0]?.now,
  );
  console.log("Next pending job:", next[0] || null);
}

async function loop() {
  while (true) {
    const job = await fetchAndLockJob();
    if (!job) {
      await debugNoJob();
      await new Promise((r) => setTimeout(r, 2000));
      continue;
    }

    try {
      const payload =
        typeof job.payload === "string" ? JSON.parse(job.payload) : job.payload; // already parsed by mysql2 depending on config
      if (job.type === "RECORD_MEET") {
        await recordMeetJob(payload);
      }

      await db.execute(`UPDATE jobs SET status='DONE' WHERE id=?`, [job.id]);
    } catch (e) {
      await db.execute(
        `UPDATE jobs SET status='FAILED', last_error=? WHERE id=?`,
        [String(e?.stack || e), job.id],
      );
    }
  }
}

loop().catch(console.error);
