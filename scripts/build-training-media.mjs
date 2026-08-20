#!/usr/bin/env node
import { execFileSync } from 'node:child_process';
import { copyFileSync, existsSync, mkdirSync, rmSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const output = path.join(root, 'frontend/public/training');
const temp = path.join(root, 'tmp/training-media');
const walkthroughs = path.join(root, 'tmp/training-walkthroughs');
mkdirSync(output, { recursive: true });
mkdirSync(temp, { recursive: true });

const media = path.join(root, 'frontend/public/marketing');
const localAiBaseUrl = String(process.env.TROVAN_LOCAL_AI_BASE_URL || 'http://opshub.tail75017b.ts.net:11435/v1').replace(/\/$/, '');
const localTtsBaseUrl = String(process.env.TROVAN_LOCAL_TTS_BASE_URL || 'http://opshub.tail75017b.ts.net:4123/v1').replace(/\/$/, '');
const localAiModel = process.env.TROVAN_LOCAL_AI_MODEL || 'Mistral-Nemo-Instruct-2407-Q4_K_M.gguf';
const localTtsVoice = process.env.TROVAN_LOCAL_TTS_VOICE || 'af_heart';

const request = async (url, init, label, timeout = 180_000) => {
  const response = await fetch(url, { ...init, signal: AbortSignal.timeout(timeout) });
  if (!response.ok) {
    const detail = (await response.text()).slice(0, 500);
    throw new Error(`${label} failed with HTTP ${response.status}: ${detail}`);
  }
  return response;
};

const parseJsonArray = (value) => {
  const first = value.indexOf('[');
  const last = value.lastIndexOf(']');
  if (first < 0 || last <= first) throw new Error('Local AI did not return a JSON array');
  return JSON.parse(value.slice(first, last + 1));
};

const refineNarrationWithLocalAi = async (item, paragraphs) => {
  const response = await request(
    `${localAiBaseUrl}/chat/completions`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: localAiModel,
        temperature: 0.1,
        max_tokens: 4_800,
        messages: [
          {
            role: 'system',
            content: [
              'You are a precise instructional editor for route operations software.',
              'Polish narration for a calm spoken training video while preserving every product fact, boundary, role, sequence, and warning.',
              'Do not invent controls, capabilities, policies, metrics, or workflows. Do not remove security or provider-readiness warnings.',
              'Keep each paragraph between 55 and 100 spoken words. Return only a JSON array of strings with exactly the same number of entries as the source.',
            ].join(' '),
          },
          {
            role: 'user',
            content: JSON.stringify({ title: item.title, sourceParagraphs: paragraphs }),
          },
        ],
      }),
    },
    `Local AI narration refinement for ${item.key}`,
    300_000,
  );
  const payload = await response.json();
  const content = payload?.choices?.[0]?.message?.content;
  if (typeof content !== 'string') throw new Error(`Local AI returned no narration for ${item.key}`);
  let refined;
  try {
    refined = parseJsonArray(content);
  } catch {
    console.warn(`${item.key}: retained the approved narration because the local-AI edit was not valid JSON`);
    return paragraphs;
  }
  if (refined.length !== paragraphs.length || refined.some((entry) => typeof entry !== 'string')) {
    console.warn(`${item.key}: retained the approved narration because the local-AI edit changed the paragraph structure`);
    return paragraphs;
  }
  return refined.map((entry, index) => {
    const candidate = entry.trim();
    if (candidate.length >= 120) return candidate;
    console.warn(`${item.key} paragraph ${index + 1}: retained approved source after an over-compressed local-AI edit`);
    return paragraphs[index];
  });
};

const synthesizeWithLocalAi = async (text, outputFile) => {
  const response = await request(
    `${localTtsBaseUrl}/audio/speech`,
    {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({
        model: 'kokoro',
        voice: localTtsVoice,
        input: text,
        response_format: 'wav',
        speed: 0.87,
      }),
    },
    'Local Kokoro narration',
    300_000,
  );
  writeFileSync(outputFile, Buffer.from(await response.arrayBuffer()));
};
const modules = [
  {
    key: 'start-here', title: 'Start Here: Own the Rollout',
    clips: ['academy-overview', 'settings', 'drivers', 'vehicles', 'jobs', 'routing', 'academy-overview'],
    narration: [
      'Welcome to the training academy. This lesson gives the Customer Champion a practical way to lead implementation without scheduling a long series of training calls. The goal is simple: prepare one small team, prove one complete route day, and arrive at the readiness review with evidence instead of unanswered setup questions.',
      'The Customer Champion must be an Owner or Admin. That person coordinates the implementation calendar, verifies the data file, assigns the right user roles, makes sure the Dispatcher and pilot Driver finish their training, and owns the customer signoff. The onboarding program supplies the Academy, launch docket, product support, and one focused thirty minute readiness review.',
      'Use the seven day rhythm in the launch docket. On day one, confirm the Champion, users, depot, and support path. On day two, prepare the pilot driver, vehicle, customers, and route file. On days three and four, import, validate, optimize, and review blockers. On days five and six, run the practice route, capture proof, and rehearse an exception.',
      'Keep the first implementation narrow. One depot, one Dispatcher, one Driver, one ready vehicle, and one representative route day are enough. A small scope makes it easier to identify a bad address, a missing capacity rule, an access problem, or a confusing status transition before the team expands the system to more routes.',
      'The standard onboarding package includes Academy access, the Customer Launch Docket, best effort support with a one business day initial response target, and one thirty minute launch readiness review. Customer data cleanup, custom integrations, onsite work, live team training, and customer specific process design are separately scoped services.',
      'After this lesson, open Settings and confirm the customer Champion, the Dispatcher, the pilot Driver, and the escalation contact. Then complete the knowledge check. Your progress is saved to the organization, and the readiness card will identify the next incomplete training or workspace step.',
    ],
  },
  {
    key: 'workspace-setup', title: 'Set Up the Operating Workspace',
    clips: ['settings', 'settings', 'academy-overview', 'drivers', 'vehicles', 'customers', 'academy-overview'],
    narration: [
      'This lesson builds the minimum operating workspace for a practice route. The objective is not to migrate every record the company has. The objective is to create one accurate depot, one pilot team, one ready vehicle, and the customer and route data needed to prove a full day from planning through delivery proof.',
      'Begin in Settings. Confirm the organization name, service timezone, primary depot, support contact, and customer facing information. The timezone matters because appointment windows, planned arrival, tracking, and event history must all describe the same operating day. Save one primary depot that matches where the practice vehicle actually begins service.',
      'Invite users with the least privileged role they need. Owners and Admins manage the organization. Dispatchers plan, publish, assign, dispatch, and resolve route changes. Drivers use the mobile execution flow for assigned work. Viewers can inspect dashboards, tracking, proof, and reports without changing operational records.',
      'Create the pilot Driver and verify the name, phone, email, license information, employment status, and any required certifications. Then create an available vehicle with realistic weight, volume, pallet, equipment, territory, and driver eligibility rules. Unrealistic capacity produces a practice route that cannot prove the real workflow.',
      'Add or import only the customers needed for the pilot route. Verify service addresses, contacts, receiver hours, site restrictions, and special instructions. Never put passwords, tokens, or private access instructions into a spreadsheet or support request. Sensitive access codes belong only in the approved secure field.',
      'Finish by checking the Academy readiness card. The depot, active Driver, and ready vehicle steps should be complete from persisted organization data. If a step remains incomplete, open its action and correct the underlying record. Then complete the knowledge check before moving to Route Operations.',
    ],
  },
  {
    key: 'route-operations', title: 'Plan, Dispatch, and Prove a Route Day',
    clips: ['jobs', 'jobs', 'routing', 'routing', 'dispatch', 'route-run', 'proof'],
    narration: [
      'Route Operations follows one route day from import to proof. Start with the job import template in the Customer Launch Docket. The minimum fields are customer name and delivery address. Add time windows, service duration, load dimensions, required equipment, driver rules, access instructions, temperature, hazmat, and handling fields only when they affect the real route.',
      'Import one representative day and inspect the preview before saving. Correct duplicate rows, incomplete addresses, conflicting appointment windows, inconsistent units, and missing routing constraints. After import, open job readiness. Every pilot job needs a routable pickup or delivery location. Missing location data must be corrected before optimization.',
      'Open Routing and create the route draft. Confirm the intended service date, depot, jobs, vehicles, Drivers, and optimization objective. Review every unassigned job and blocker. A capacity, pallet fit, appointment, equipment, certification, driver, territory, access, temperature, or hazmat conflict needs a specific resolution, not a silent override.',
      'Review optimizer provenance before publication. A hosted pilot route must use provider backed road network inputs. The system identifies the solver, matrix provider and mode, coverage, solve time, fallback state, and warnings. A simulated preview or straight line fallback is not accepted as production readiness evidence. Correct the provider or data issue and run the plan again.',
      'When the draft is ready, publish it and open Dispatch. Assign the trained pilot Driver and eligible vehicle, confirm dispatch readiness, and release the practice route. During execution, follow stop status, Driver messages, timing, and exceptions. Keep route changes and decisions inside the system so the operational record remains complete.',
      'After the Driver services a stop, open Proof of Delivery. Confirm that the required photo, signature, recipient, note, and timestamps are persisted for that stop. Resolve every failed or skipped stop with a reason and owner. The readiness card completes only when the organization has imported jobs, a provider backed route, a dispatched practice route, and a proof artifact.',
    ],
  },
  {
    key: 'driver-quick-start', title: 'Driver Quick Start',
    clips: ['driver-workspace', 'driver-route', 'driver-route', 'driver-route', 'driver-workspace', 'driver-help', 'driver-route'],
    narration: [
      'Driver Quick Start covers the complete mobile stop flow. Use only your assigned work identity and route. Before leaving, open the Driver workspace, confirm the vehicle, review the stop order, and read addresses, appointment times, access notes, and special instructions. Contact Dispatch immediately if the route or vehicle does not match your assignment.',
      'Start the route only when the vehicle is loaded and ready to leave. At each destination, review the stop before entering the property. Record arrival when you are physically at the stop. Arrival is an operational timestamp, so do not tap it early from another location simply to move the screen forward.',
      'Complete the service and capture every required proof item before departing. Depending on the stop, proof can include a photo, signature, recipient name, note, and time or location context. Make sure the image is clear, the recipient information is correct, and the proof is shown as saved before leaving the customer.',
      'If the stop cannot be completed, use the exception path. Choose the reason that describes what happened, add a useful note, and preserve customer impact. Do not silently skip the stop. Message Dispatch whenever the exception changes route timing, stop order, customer expectations, safety, access, or the ability to complete later work.',
      'After the stop is resolved, record departure and continue to the next stop. Finish the route only after every stop is completed, failed with a recorded reason, rescheduled, or otherwise resolved. A clean route history lets Dispatch, support, and the customer Champion understand what happened without rebuilding the day from text messages.',
      'Protect delivery data throughout the route. Do not share sessions, access codes, proof images, customer details, or tracking links outside approved operational channels. When support is needed, provide the route or stop identifier, the visible request ID, what you expected, and what happened. Never include a password or token. Complete the quick check now.',
    ],
  },
  {
    key: 'go-live', title: 'Complete Launch Readiness',
    clips: ['academy-overview', 'academy-overview', 'routing', 'route-run', 'analytics', 'academy-overview', 'support'],
    narration: [
      'Go Live turns the self guided work into a clear readiness decision. The Customer Champion should begin this lesson only after the practice route is complete. The system calculates readiness from organization records, training progress, route state, and proof evidence. A checked box in the browser is not a substitute for persisted workspace facts.',
      'Confirm the training evidence first. The Champion must complete Start Here, Workspace Setup, Route Operations, and this Go Live track with passing knowledge checks. At least one Driver role team member must complete Driver Quick Start. Confirm that the selected Champion is still the person responsible for preparation, internal follow through, and customer signoff.',
      'Confirm the operating evidence next. The organization needs a primary depot, active Driver, ready vehicle, imported jobs, validated locations, provider backed route, dispatched practice route, and persisted proof. Open the readiness card action for any incomplete step. Resolve the underlying record rather than asking Support to mark it complete manually.',
      'Rehearse the support and exception path. The Driver records the on road condition and messages Dispatch. The Dispatcher owns route changes and customer impact coordination. The Champion owns access, policy, privacy, and escalation issues. Preserve record identifiers and request IDs, but never copy passwords, tokens, access codes, or unnecessary customer data into support.',
      'Prepare the first month review. Record the baseline and assign an owner for planning time, planned and actual mileage, unassigned jobs, late risk stops, failed deliveries, proof completion, Driver and Dispatcher support questions, and knowledge base searches without a useful answer. Review these measures after week one and again on day thirty.',
      'Acknowledge the customer responsibilities and submit the final knowledge check. When every training and operational step is complete, the readiness card will say Ready for Review. Use the included thirty minute checkpoint to confirm remaining blockers, escalation ownership, fallback procedures, and the exact launch date. It is not intended as a replacement for the Academy.',
    ],
  },
  {
    key: 'viewer-basics', title: 'Viewer Basics',
    clips: ['academy-overview', 'tracking', 'proof', 'analytics', 'settings', 'academy-overview', 'support'],
    narration: [
      'Viewer Basics explains how to use the system without changing route day records. Viewer access is intentionally read only. Use the Dashboard to understand active routes, jobs waiting, route risk, and daily readiness. If an operational value must change, contact an Owner, Admin, or Dispatcher rather than looking for a workaround.',
      'Open route and tracking views to understand planned work, Driver progress, estimated arrival, completed stops, and exceptions. Treat customer location, delivery status, tracking links, and Driver information as operationally sensitive. Share information only through the company channels approved for the route day.',
      'Use Proof of Delivery to verify that required delivery evidence is attached to the correct stop. Depending on policy, the record may include a photo, signature, recipient, note, and timestamps. A Viewer can inspect this evidence but should contact Dispatch or an Admin when a record appears incomplete or incorrect.',
      'Use Reports to review service, efficiency, utilization, route history, and proof completion. Compare trends with the actual operating context. A single route can be affected by appointments, weather, access, vehicle constraints, or customer changes, so use the event and exception record when interpreting a surprising result.',
      'When requesting help, provide the organization, page, route or job identifier, expected result, observed result, visible request ID, and a redacted screenshot. Do not include passwords, tokens, access codes, signatures, or unrelated customer details. The public support hub also contains searchable answers for common workflow questions.',
      'Complete the Viewer knowledge check to confirm the role boundary. Viewer training is optional for launch readiness, but it gives supervisors and customer service teams a safe way to use route visibility without creating accidental route changes.',
    ],
  },
];

const closingByKey = {
  'start-here': 'Before moving on, open the launch docket and write down the Champion, Dispatcher, pilot Driver, target practice date, and escalation contact. Confirm that everyone understands the self guided model and the boundary between included support and separately scoped services. If any owner is missing, stop here and assign one. Clear ownership now prevents the readiness review from turning into a basic setup meeting later.',
  'workspace-setup': 'Pause and verify the saved records rather than relying on what the team intended to enter. Open the depot, user list, Driver, vehicle, and pilot customers. Check status, role, timezone, capacity, contact, and instruction fields one more time. A few minutes of record review here prevents bad assignments and false routing blockers during the practice day. Return to the Academy only when the readiness card reflects the real setup.',
  'route-operations': 'Use the practice route as a rehearsal, not a demo shortcut. Ask the Dispatcher to explain why the route is provider backed, why each vehicle and Driver are eligible, what the top blocker would look like, and where the final proof appears. If the explanation depends on a spreadsheet or private text message, move that information into the appropriate system record before considering the route operations track complete.',
  'driver-quick-start': 'Now perform the practice task on the same device the Driver expects to use. Open the route, review a stop, record arrival, capture sanitized practice proof, send a message or exception, and record departure. Confirm that Dispatch can see each state change. If a permission, camera, network, or proof problem appears, resolve it before production and record the answer in the customer team notes.',
  'go-live': 'Finally, compare the Academy readiness card with the signed docket. The same Champion, trained pilot Driver, route evidence, proof, escalation owner, and KPI dates should appear in both. Write down any remaining blocker and its owner before booking the checkpoint. When the card is green, schedule the single readiness review with the people who can make launch decisions, then keep broader team questions in the searchable Academy and support hub.',
  'viewer-basics': 'Practice locating one active route, one tracking record, one proof artifact, and one report without changing any data. If the information does not answer the business question, record the question and ask the appropriate Dispatcher or Admin. Viewer access is most useful when supervisors and customer service teams know exactly where to look and exactly when an operational owner must step in.',
};

const formatTime = (seconds) => {
  const value = Math.max(0, Number(seconds));
  const hours = Math.floor(value / 3600);
  const minutes = Math.floor((value % 3600) / 60);
  const secs = Math.floor(value % 60);
  const millis = Math.round((value - Math.floor(value)) * 1000);
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(secs).padStart(2, '0')}.${String(millis).padStart(3, '0')}`;
};

const durationOf = (file) => Number(execFileSync('ffprobe', ['-v', 'error', '-show_entries', 'format=duration', '-of', 'default=noprint_wrappers=1:nokey=1', file], { encoding: 'utf8' }).trim());
const spokenText = (text) => text
  .replace(/\bTrovan Academy\b/gi, 'the training academy')
  .replace(/\bTrovan's\b/gi, "the system's")
  .replace(/\bTrovan\b/gi, 'the system')
  .replace(/\bthe the system\b/gi, 'the system');

const [modelHealth, ttsHealth] = await Promise.all([
  request(`${localAiBaseUrl}/models`, { method: 'GET' }, 'Local AI health check', 15_000).then((response) => response.json()),
  request(`${localTtsBaseUrl.replace(/\/v1$/, '')}/health`, { method: 'GET' }, 'Local TTS health check', 15_000).then((response) => response.json()),
]);
if (!JSON.stringify(modelHealth).includes(localAiModel)) throw new Error(`Configured local AI model is not available: ${localAiModel}`);
if (ttsHealth?.tts?.available !== true) throw new Error('Local Kokoro TTS is not available');

const generationManifest = {
  generatedAt: new Date().toISOString(),
  pipeline: 'Real-interface capture + server-local AI narration + Kokoro TTS + ffmpeg',
  narrationModel: localAiModel,
  voiceEngine: 'kokoro-onnx',
  voice: localTtsVoice,
  narrationBrandPolicy: 'The brand name is omitted from synthesized narration and captions; neutral references use the platform or the training academy.',
  visualPolicy: 'Playwright-recorded sanitized walkthroughs with visible cursor movement and real clicks; no generative UI footage.',
  modules: [],
};
const resumeGeneration = process.env.TRAINING_MEDIA_RESUME === 'true';

for (const item of modules) {
  const moduleTemp = path.join(temp, item.key);
  const finalVideo = path.join(output, `${item.key}.mp4`);
  const finalCaptions = path.join(output, `${item.key}.vtt`);
  if (resumeGeneration && existsSync(finalVideo) && existsSync(finalCaptions)) {
    const finalDuration = durationOf(finalVideo);
    generationManifest.modules.push({ key: item.key, title: item.title, durationSeconds: Number(finalDuration.toFixed(2)), paragraphCount: item.narration.length + 1 });
    console.log(`${item.key}: reusing ${finalDuration.toFixed(1)} second completed lesson`);
    continue;
  }
  rmSync(moduleTemp, { recursive: true, force: true });
  mkdirSync(moduleTemp, { recursive: true });
  const audioFiles = [];
  const videoFiles = [];
  const cues = [];
  let cursor = 0;
  const sourceNarration = [...item.narration, closingByKey[item.key]];
  const narration = await refineNarrationWithLocalAi(item, sourceNarration);
  writeFileSync(path.join(moduleTemp, 'narration-source.json'), JSON.stringify(sourceNarration, null, 2));
  writeFileSync(path.join(moduleTemp, 'narration-local-ai.json'), JSON.stringify(narration, null, 2));

  for (let index = 0; index < narration.length; index += 1) {
    const audio = path.join(moduleTemp, `audio-${index}.wav`);
    const voiceover = spokenText(narration[index]);
    await synthesizeWithLocalAi(voiceover, audio);
    const duration = durationOf(audio);
    audioFiles.push(audio);
    const sourceClip = path.join(walkthroughs, `${item.clips[index]}.mp4`);
    if (!existsSync(sourceClip)) throw new Error(`Missing Playwright walkthrough: ${sourceClip}. Run npm run training:record:walkthroughs first.`);
    const clip = path.join(moduleTemp, `video-${index}.mp4`);
    execFileSync('ffmpeg', [
      '-y', '-i', sourceClip,
      '-vf', `fps=30,tpad=stop_mode=clone:stop_duration=${Math.ceil(duration + 2)},trim=duration=${duration.toFixed(3)},setpts=PTS-STARTPTS,drawbox=x=0:y=0:w=iw:h=18:color=#071829@0.96:t=fill,drawbox=x=0:y=16:w=iw:h=4:color=#B97129:t=fill`,
      '-an', '-c:v', 'libx264', '-preset', 'veryfast', '-crf', '28', '-pix_fmt', 'yuv420p', clip,
    ], { stdio: 'ignore' });
    videoFiles.push(clip);
    const sentences = voiceover.match(/[^.!?]+[.!?]+/g) || [voiceover];
    const sentenceDuration = duration / sentences.length;
    for (const sentence of sentences) {
      cues.push({ start: cursor, end: cursor + sentenceDuration, text: sentence.trim() });
      cursor += sentenceDuration;
    }
  }

  const audioList = path.join(moduleTemp, 'audio-list.txt');
  const videoList = path.join(moduleTemp, 'video-list.txt');
  writeFileSync(audioList, audioFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
  writeFileSync(videoList, videoFiles.map((file) => `file '${file.replaceAll("'", "'\\''")}'`).join('\n'));
  const joinedAudio = path.join(moduleTemp, 'joined.wav');
  const joinedVideo = path.join(moduleTemp, 'joined.mp4');
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', audioList, '-c:a', 'pcm_s16le', joinedAudio], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-f', 'concat', '-safe', '0', '-i', videoList, '-c', 'copy', joinedVideo], { stdio: 'ignore' });
  execFileSync('ffmpeg', ['-y', '-i', joinedVideo, '-i', joinedAudio, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '96k', '-shortest', '-movflags', '+faststart', finalVideo], { stdio: 'ignore' });

  const vtt = ['WEBVTT', '', ...cues.flatMap((cue, index) => [`${index + 1}`, `${formatTime(cue.start)} --> ${formatTime(cue.end)}`, cue.text, ''])].join('\n');
  writeFileSync(finalCaptions, vtt);
  const finalDuration = durationOf(finalVideo);
  generationManifest.modules.push({ key: item.key, title: item.title, durationSeconds: Number(finalDuration.toFixed(2)), paragraphCount: narration.length });
  console.log(`${item.key}: ${finalDuration.toFixed(1)} seconds`);
}

const posterSource = path.join(media, 'trovan-product-tour-poster.webp');
copyFileSync(posterSource, path.join(output, 'trovan-academy-poster.webp'));
writeFileSync(path.join(output, 'generation-manifest.json'), JSON.stringify(generationManifest, null, 2));
console.log(`Training media written to ${output}`);
