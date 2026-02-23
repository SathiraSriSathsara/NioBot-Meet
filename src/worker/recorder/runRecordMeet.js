import fs from "fs/promises";
import path from "path";
import { randomUUID } from "crypto";
import { db } from "../../db.js";
import { joinMeet } from "./joinMeet.playwright.js";
import { startRecording } from "./ffmpeg.js";
import { transcodeRecording } from "./transcode.js";

const RECORDINGS_DIR = process.env.RECORDINGS_DIR || "./recordings";

function toPosix(p) {
  return p.split(path.sep).join(path.posix.sep);
}

export async function recordMeetJob({ meeting_id }) {
  if (!meeting_id) {
    throw new Error("meeting_id missing in job payload");
  }

  const [meetings] = await db.query("SELECT * FROM meetings WHERE id=?", [meeting_id]);
  if (!meetings.length) {
    throw new Error(`Meeting not found: ${meeting_id}`);
  }

  const meeting = meetings[0];
  const recordingId = randomUUID();
  const outputDirRel = path.posix.join(meeting_id, recordingId);
  const recordingsRoot = path.resolve(RECORDINGS_DIR);
  const outputDirAbs = path.resolve(recordingsRoot, outputDirRel);
  const rawPathAbs = path.join(outputDirAbs, "raw.mp4");
  const ffmpegLogAbs = path.join(outputDirAbs, "ffmpeg.log");

  await fs.mkdir(outputDirAbs, { recursive: true });

  await db.execute(
    `INSERT INTO recordings
     (id, meeting_id, status, output_dir, raw_path, duration_sec)
     VALUES (?, ?, 'RECORDING', ?, ?, ?)` ,
    [recordingId, meeting_id, outputDirRel, toPosix(path.posix.join(outputDirRel, "raw.mp4")), meeting.duration_sec]
  );

  let browser;
  let recorder;

  try {
    const { browser: joinedBrowser } = await joinMeet({
      meetUrl: meeting.meet_url,
      botEmail: process.env.BOT_EMAIL,
      botPass: process.env.BOT_PASS,
    });
    browser = joinedBrowser;

    recorder = startRecording({ outputPath: rawPathAbs, logPath: ffmpegLogAbs });

    const durationMs = Number(meeting.duration_sec || 0) * 1000;
    if (durationMs > 0) {
      await new Promise(resolve => setTimeout(resolve, durationMs));
    }

    await recorder.stop();

    await db.execute(`UPDATE recordings SET status='TRANSCODING' WHERE id=?`, [recordingId]);

    const outputs = await transcodeRecording({ inputPath: rawPathAbs, outputDir: outputDirAbs });

    const hlsMasterRel = toPosix(path.relative(recordingsRoot, outputs.hlsMaster));
    const mp4_720_Rel = toPosix(path.relative(recordingsRoot, outputs.mp4_720));
    const mp4_480_Rel = toPosix(path.relative(recordingsRoot, outputs.mp4_480));
    const mp3Rel = toPosix(path.relative(recordingsRoot, outputs.mp3Path));
    const thumbRel = toPosix(path.relative(recordingsRoot, outputs.thumbPath));

    await db.execute(
      `UPDATE recordings
       SET status='READY', hls_master_path=?, mp4_720_path=?, mp4_480_path=?, mp3_path=?, thumb_path=?
       WHERE id=?`,
      [hlsMasterRel, mp4_720_Rel, mp4_480_Rel, mp3Rel, thumbRel, recordingId]
    );
  } catch (error) {
    const message = String(error?.stack || error);
    await db.execute(
      `UPDATE recordings SET status='FAILED', error_message=? WHERE id=?`,
      [message, recordingId]
    );
    throw error;
  } finally {
    if (recorder?.process && !recorder.process.killed) {
      try {
        await recorder.stop();
      } catch {
        recorder.process.kill("SIGINT");
      }
    }
    if (browser) {
      await browser.close();
    }
  }
}
