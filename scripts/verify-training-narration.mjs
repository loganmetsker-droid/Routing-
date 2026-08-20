#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const ttsBaseUrl = String(process.env.TROVAN_LOCAL_TTS_BASE_URL || 'http://opshub.tail75017b.ts.net:4123/v1').replace(/\/$/, '');
const moduleKeys = ['start-here', 'workspace-setup', 'route-operations', 'driver-quick-start', 'go-live', 'viewer-basics'];
const rejectedBrandForms = ['TROVAN', 'TROVIN', 'TROBIN', 'TROWVEN'];
const temp = mkdtempSync(path.join(tmpdir(), 'training-narration-'));

try {
  for (const key of moduleKeys) {
    const sample = path.join(temp, `${key}.wav`);
    execFileSync('ffmpeg', [
      '-y', '-loglevel', 'error',
      '-i', path.join(root, `frontend/public/training/${key}.mp4`),
      '-vn', '-ac', '1', '-ar', '16000', sample,
    ]);
    const form = new FormData();
    form.append('file', new Blob([readFileSync(sample)], { type: 'audio/wav' }), `${key}.wav`);
    form.append('language', 'en');
    const response = await fetch(`${ttsBaseUrl}/audio/transcriptions`, {
      method: 'POST', body: form, signal: AbortSignal.timeout(300_000),
    });
    if (!response.ok) throw new Error(`${key} narration transcription failed with HTTP ${response.status}`);
    const payload = await response.json();
    const transcript = String(payload.text || '');
    const compact = transcript.toUpperCase().replace(/[^A-Z]/g, '');
    const detected = rejectedBrandForms.find((form) => compact.includes(form));
    if (detected) throw new Error(`${key} narration contains rejected brand form ${detected}: ${transcript.slice(0, 240)}`);
    console.log(`${key}: narration contains no spoken brand name`);
  }
  console.log('Training narration verification passed.');
} finally {
  rmSync(temp, { recursive: true, force: true });
}
