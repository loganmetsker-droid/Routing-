#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'frontend/public/training');
const manifestPath = path.join(output, 'generation-manifest.json');
const minimumDuration = 180.5;

const durationOf = (file) => Number(execFileSync('ffprobe', [
  '-v', 'error', '-show_entries', 'format=duration',
  '-of', 'default=noprint_wrappers=1:nokey=1', file,
], { encoding: 'utf8' }).trim());

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
for (const module of manifest.modules) {
  const video = path.join(output, `${module.key}.mp4`);
  const originalDuration = durationOf(video);
  if (originalDuration >= minimumDuration) {
    module.durationSeconds = Number(originalDuration.toFixed(2));
    continue;
  }

  const padding = minimumDuration - originalDuration;
  const normalized = path.join(output, `${module.key}.normalized.mp4`);
  execFileSync('ffmpeg', [
    '-y', '-i', video,
    '-filter_complex', `[0:v]tpad=stop_mode=clone:stop_duration=${padding.toFixed(3)}[v];[0:a]apad=pad_dur=${padding.toFixed(3)}[a]`,
    '-map', '[v]', '-map', '[a]',
    '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '25', '-pix_fmt', 'yuv420p',
    '-c:a', 'aac', '-b:a', '112k', '-t', String(minimumDuration), '-movflags', '+faststart', normalized,
  ], { stdio: 'ignore' });
  rmSync(video);
  renameSync(normalized, video);

  module.durationSeconds = Number(durationOf(video).toFixed(2));
  module.endingHoldSeconds = Number(padding.toFixed(2));
  console.log(`${module.key}: normalized to ${module.durationSeconds.toFixed(1)} seconds`);
}

manifest.minimumLessonDurationSeconds = minimumDuration;
writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
