import { spawn } from "child_process";
import fs from "fs/promises";
import path from "path";

function runFfmpeg(args, label) {
	const ffmpegPath = process.env.FFMPEG_PATH || "ffmpeg";

	return new Promise((resolve, reject) => {
		const proc = spawn(ffmpegPath, args, { stdio: ["ignore", "ignore", "pipe"], windowsHide: true });
		let stderr = "";
		proc.stderr.on("data", chunk => {
			stderr += chunk.toString();
		});
		proc.on("error", reject);
		proc.on("close", code => {
			if (code === 0) {
				resolve();
				return;
			}
			reject(new Error(`${label} failed with code ${code}: ${stderr}`));
		});
	});
}

export async function transcodeRecording({ inputPath, outputDir }) {
	await fs.mkdir(outputDir, { recursive: true });

	const hlsDir = path.join(outputDir, "hls");
	const mp4Dir = path.join(outputDir, "mp4");
	await fs.mkdir(hlsDir, { recursive: true });
	await fs.mkdir(mp4Dir, { recursive: true });

	const masterPlaylist = path.join(hlsDir, "master.m3u8");
	const hlsPlaylistPattern = path.join(hlsDir, "stream_%v.m3u8");
	const hlsSegmentPattern = path.join(hlsDir, "segment_%v_%03d.ts");

	const hlsArgs = [
		"-y",
		"-i",
		inputPath,
		"-filter_complex",
		"[0:v]split=3[v1][v2][v3];[v1]scale=1920:1080[v1out];[v2]scale=1280:720[v2out];[v3]scale=854:480[v3out]",
		"-map",
		"[v1out]",
		"-map",
		"0:a",
		"-map",
		"[v2out]",
		"-map",
		"0:a",
		"-map",
		"[v3out]",
		"-map",
		"0:a",
		"-c:v",
		"libx264",
		"-preset",
		"veryfast",
		"-c:a",
		"aac",
		"-b:a",
		"128k",
		"-b:v:0",
		"4500k",
		"-b:v:1",
		"2800k",
		"-b:v:2",
		"1400k",
		"-f",
		"hls",
		"-hls_time",
		"6",
		"-hls_playlist_type",
		"vod",
		"-hls_segment_filename",
		hlsSegmentPattern,
		"-master_pl_name",
		"master.m3u8",
		"-var_stream_map",
		"v:0,a:0 v:1,a:1 v:2,a:2",
		hlsPlaylistPattern,
	];

	await runFfmpeg(hlsArgs, "HLS transcode");

	const mp4_720 = path.join(mp4Dir, "720p.mp4");
	const mp4_480 = path.join(mp4Dir, "480p.mp4");
	const mp3Path = path.join(outputDir, "audio.mp3");
	const thumbPath = path.join(outputDir, "thumb.jpg");

	await runFfmpeg(
		[
			"-y",
			"-i",
			inputPath,
			"-vf",
			"scale=1280:720",
			"-c:v",
			"libx264",
			"-preset",
			"fast",
			"-c:a",
			"aac",
			"-b:a",
			"128k",
			mp4_720,
		],
		"MP4 720p transcode"
	);

	await runFfmpeg(
		[
			"-y",
			"-i",
			inputPath,
			"-vf",
			"scale=854:480",
			"-c:v",
			"libx264",
			"-preset",
			"fast",
			"-c:a",
			"aac",
			"-b:a",
			"96k",
			mp4_480,
		],
		"MP4 480p transcode"
	);

	await runFfmpeg(["-y", "-i", inputPath, "-vn", "-c:a", "libmp3lame", "-b:a", "128k", mp3Path], "MP3 transcode");

	await runFfmpeg(["-y", "-i", inputPath, "-ss", "00:00:01", "-vframes", "1", "-vf", "scale=640:-1", thumbPath], "Thumbnail");

	return {
		hlsMaster: masterPlaylist,
		mp4_720,
		mp4_480,
		mp3Path,
		thumbPath,
	};
}
