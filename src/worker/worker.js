import { db } from "../db.js";
import "dotenv/config";
import { randomUUID } from "crypto";
import { recordMeetJob } from "./recorder/runRecordMeet.js";

const WORKER_ID = process.env.WORKER_ID || `worker-${randomUUID()}`;

async function fetchAndLockJob() {
  const conn = await db.getConnection();
  try {
    await conn.beginTransaction();

    // Find due job
    const [jobs] = await conn.query(
      `SELECT * FROM jobs
       WHERE status='PENDING' AND run_at <= NOW()
       ORDER BY run_at ASC
       LIMIT 1
       FOR UPDATE`
    );
    if (jobs.length === 0) {
      await conn.commit();
      return null;
    }

    const job = jobs[0];

    await conn.execute(
      `UPDATE jobs
       SET status='RUNNING', locked_by=?, locked_at=NOW(), attempts=attempts+1
       WHERE id=?`,
      [WORKER_ID, job.id]
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

async function loop() {
  while (true) {
    const job = await fetchAndLockJob();
    if (!job) {
      await new Promise(r => setTimeout(r, 2000));
      continue;
    }

    try {
      const payload = JSON.parse(job.payload);
      if (job.type === "RECORD_MEET") {
        await recordMeetJob(payload);
      }

      await db.execute(`UPDATE jobs SET status='DONE' WHERE id=?`, [job.id]);
    } catch (e) {
      await db.execute(
        `UPDATE jobs SET status='FAILED', last_error=? WHERE id=?`,
        [String(e?.stack || e), job.id]
      );
    }
  }
}

loop().catch(console.error);