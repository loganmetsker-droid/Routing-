# Trovan Academy Local-AI Media Pipeline

Trovan Academy training clips are generated from Playwright screen recordings of the real, sanitized Trovan interface. Playwright moves a visible high-contrast cursor to each target and performs the actual click, including dialogs, filters, planning views, dispatch lanes, proof review, tracking, Academy tasks, and the mobile Driver flow. The local server refines the factual source narration with its configured GGUF model and synthesizes the voice with Kokoro ONNX. Local ffmpeg assembles the approved walkthroughs, narration, and WebVTT captions at 30 fps.

The pipeline intentionally does not use generative video for product controls. Generated UI can misrepresent labels, permissions, route states, or compliance boundaries. Wan/ComfyUI can be used later for non-instructional title cards only after its real-video workflow passes runtime verification.

## Commands

```sh
npm run training:record:walkthroughs
npm run training:capture:guide
npm run training:build:media
npm run training:verify:media
npm run training:verify:narration
```

Run the compiled preview server on `http://127.0.0.1:5197` before recording. The recorder uses installed Chrome and writes its reusable walkthrough library under `tmp/training-walkthroughs/`.

The written implementation guide uses a separate Playwright capture pass. It writes 1280x720 sanitized screenshots to `frontend/public/training/guides/`, outlines the exact control in copper, and adds a numbered click label and visible cursor. These images are used by Academy lessons, the searchable `/academy/guide` index, and the versioned launch docket. Re-run the capture whenever a documented control or page layout changes.

The builder fails if the server model or Kokoro is unavailable. It does not fall back to macOS `say`, cloud TTS, stock footage, or a motion-graphics placeholder. Server endpoints and model/voice choices can be overridden with `TROVAN_LOCAL_AI_BASE_URL`, `TROVAN_LOCAL_TTS_BASE_URL`, `TROVAN_LOCAL_AI_MODEL`, and `TROVAN_LOCAL_TTS_VOICE`.

The brand name is intentionally omitted from synthesized narration and video captions because local voices do not pronounce it reliably. Before Kokoro synthesis, narration replaces brand references with neutral phrases such as `the platform` and `the training academy`. The underlying product interface keeps its normal visual branding.

Generation provenance is written to `frontend/public/training/generation-manifest.json`. Factual source and local-AI-refined narration are retained under `tmp/training-media/<module>/` for human comparison during the build session.

## Acceptance checks

- Each lesson is 3–6 minutes, 1280×720 H.264 with AAC narration.
- Every lesson has synchronized WebVTT captions.
- Visuals contain only sanitized Playwright recordings of Trovan with visible cursor movement and click feedback.
- Server-side speech recognition confirms that no brand-name variant is spoken in any lesson.
- Local-AI edits preserve roles, workflows, provider-readiness rules, support boundaries, and security warnings.
- Academy desktop and Driver Help mobile playback pass the onboarding Playwright suite.
