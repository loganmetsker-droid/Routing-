#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'frontend/public/training');
const expectedKeys = ['start-here', 'workspace-setup', 'route-operations', 'driver-quick-start', 'go-live', 'viewer-basics'];
const manifest = JSON.parse(readFileSync(path.join(output, 'generation-manifest.json'), 'utf8'));

if (!String(manifest.pipeline).includes('server-local AI')) throw new Error('Training provenance does not identify the server-local AI pipeline');
if (manifest.voiceEngine !== 'kokoro-onnx') throw new Error('Training narration is not marked as Kokoro-generated');
if (!String(manifest.visualPolicy).includes('Playwright-recorded')) throw new Error('Training provenance does not identify Playwright-recorded walkthroughs');
if (!String(manifest.narrationBrandPolicy).includes('brand name is omitted')) throw new Error('Training provenance does not record the narration brand policy');

const secondsFromTimestamp = (value) => {
  const [hours, minutes, seconds] = value.split(':');
  return Number(hours) * 3600 + Number(minutes) * 60 + Number(seconds);
};

for (const key of expectedKeys) {
  const video = path.join(output, `${key}.mp4`);
  const captions = path.join(output, `${key}.vtt`);
  if (!existsSync(video) || statSync(video).size < 100_000) throw new Error(`${key} video is missing or empty`);
  if (!existsSync(captions)) throw new Error(`${key} captions are missing`);
  const captionText = readFileSync(captions, 'utf8');
  if (/\btrovan\b/i.test(captionText)) throw new Error(`${key} captions contain the brand name`);

  const probe = JSON.parse(execFileSync('ffprobe', [
    '-v', 'error', '-show_entries', 'format=duration:stream=codec_type,codec_name,width,height,avg_frame_rate',
    '-of', 'json', video,
  ], { encoding: 'utf8' }));
  const duration = Number(probe.format.duration);
  const videoStream = probe.streams.find((stream) => stream.codec_type === 'video');
  const audioStream = probe.streams.find((stream) => stream.codec_type === 'audio');
  if (duration < 180 || duration > 360) throw new Error(`${key} duration ${duration} is outside the 3-6 minute lesson target`);
  if (videoStream?.codec_name !== 'h264' || videoStream.width !== 1280 || videoStream.height !== 720) throw new Error(`${key} is not 1280x720 H.264`);
  const [frameRateNumerator, frameRateDenominator] = String(videoStream.avg_frame_rate).split('/').map(Number);
  if (!frameRateDenominator || Math.abs(frameRateNumerator / frameRateDenominator - 30) > 0.01) throw new Error(`${key} is not encoded at a smooth 30 fps`);
  if (audioStream?.codec_name !== 'aac') throw new Error(`${key} does not contain AAC narration`);

  const cueLines = captionText.match(/\d{2}:\d{2}:\d{2}\.\d{3} --> \d{2}:\d{2}:\d{2}\.\d{3}/g) || [];
  if (cueLines.length < 10) throw new Error(`${key} does not contain enough caption cues`);
  const lastEnd = secondsFromTimestamp(cueLines.at(-1).split(' --> ')[1]);
  const endingHold = duration - lastEnd;
  if (endingHold < -0.25 || endingHold > 15) throw new Error(`${key} captions end ${Math.abs(endingHold).toFixed(2)} seconds away from the media`);
  console.log(`${key}: ${duration.toFixed(1)}s, ${cueLines.length} cues, H.264/AAC`);
}

console.log('Training media verification passed.');
