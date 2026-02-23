import { spawn } from "child_process";
import fs from "fs";

function buildDefaultArgs({ display, audioSource, videoSize, frameRate }) {
	return [
		"-f",
		"x11grab",
		"-video_size",
		videoSize,
		"-framerate",
		String(frameRate),
		"-i",
		display,
		"-f",
		"pulse",
		"-i",
		audioSource,
	];
}

export function startRecording({ outputPath, logPath } = {}) {
	if (!outputPath) {
		throw new Error("outputPath is required for recording");
	}

	const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";
	const display = process.env.FFMPEG_DISPLAY || ":99.0";
	const audioSource = process.env.FFMPEG_AUDIO_SOURCE || "default";
	const videoSize = process.env.FFMPEG_VIDEO_SIZE || "1920x1080";
	const frameRate = Number(process.env.FFMPEG_FRAME_RATE || 30);
	const logLevel = process.env.FFMPEG_LOGLEVEL || "info";

	const inputArgs = buildDefaultArgs({ display, audioSource, videoSize, frameRate });

	const args = [
		"-y",
		"-loglevel",
		logLevel,
		...inputArgs,
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-pix_fmt",
		"yuv420p",
		"-c:a",
		"aac",
		"-b:a",
		"128k",
		"-movflags",
		"+faststart",
		"-shortest",
		outputPath,
	];

	const proc = spawn(ffmpegPath, args, {
		stdio: ["pipe", "ignore", "pipe"],
		windowsHide: true,
	});

	if (logPath) {
		proc.stderr?.pipe(fs.createWriteStream(logPath, { flags: "a" }));
	}

	const stop = () =>
		new Promise((resolve, reject) => {
			if (proc.killed) {
				resolve();
				return;
			}

			proc.once("exit", code => {
				if (code === 0 || code === null) {
					resolve();
					return;
				}
				reject(new Error(`FFmpeg exited with code ${code}`));
			});

			try {
				proc.stdin.write("q");
				proc.stdin.end();
			} catch (error) {
				proc.kill("SIGINT");
			}
		});

	return { process: proc, stop };
}
