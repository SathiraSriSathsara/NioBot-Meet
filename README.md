# NioBot

Self-hosted Google Meet recording bot and portal built with Node.js, MySQL, Playwright, and FFmpeg.

This project automates a real browser to join meetings. Only use it when you are allowed to record.

## Features

- Schedule meetings with a Meet link, time, and duration
- Worker joins at the right time and records with FFmpeg
- Transcodes to HLS and MP4 with thumbnails
- Serves watch and download links

## Tech Stack

- Node.js + Express
- MySQL
- Playwright (Chromium)
- FFmpeg

## Project Structure

- `src/api/server.js` API server
- `src/worker/worker.js` job worker
- `src/worker/recorder/*` join + record + transcode
- `recordings/` output media files
- `schema.sql` MySQL schema

## Setup (Windows dev)

1) Install dependencies:

```
npm install
```

2) Create the database and tables:

```
mysql -u root -p meetrecorder < schema.sql
```

3) Configure environment variables:

Edit `.env` and set:

- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `BOT_EMAIL`, `BOT_PASS`
- `RECORDINGS_DIR`

4) Start the API:

```
npm run start:api
```

5) Start the worker:

```
npm run start:worker
```

## Usage

Create a meeting:

```
curl -X POST http://localhost:5055/meetings \
  -H "Content-Type: application/json" \
  -d "{\"title\":\"Demo\",\"meet_url\":\"https://meet.google.com/xxx-xxxx-xxx\",\"scheduled_at\":\"2026-02-24 15:00:00\",\"duration_sec\":600}"
```

List meetings:

```
curl http://localhost:5055/meetings
```

List recordings (includes watch/download URLs):

```
curl http://localhost:5055/recordings
```

## Production Notes (Ubuntu VPS)

This flow uses a headless Chromium with a virtual screen and audio:

- Xvfb for the virtual display
- PulseAudio (or PipeWire) for virtual audio
- FFmpeg to capture screen + audio

You must:

- Install Chromium deps, Xvfb, PulseAudio, and FFmpeg
- Start Xvfb and set `FFMPEG_DISPLAY` (example `:99.0`)
- Ensure an audio source exists and set `FFMPEG_AUDIO_SOURCE`

## Environment Variables

Core:

- `PORT` API server port
- `DB_HOST`, `DB_USER`, `DB_PASS`, `DB_NAME`
- `RECORDINGS_DIR`
- `BOT_EMAIL`, `BOT_PASS`

Optional:

- `PLAYWRIGHT_HEADLESS` (`true` or `false`)
- `FFMPEG_PATH`
- `FFMPEG_DISPLAY`
- `FFMPEG_AUDIO_SOURCE`
- `FFMPEG_VIDEO_SIZE`
- `FFMPEG_FRAME_RATE`
- `FFMPEG_LOGLEVEL`

## Safety and Reliability

- Google may change login or Meet UI selectors at any time
- MFA logins are not handled by default
- Ensure meetings allow the bot to join (auto-admit or same domain)
