# Customer Implementation Program

Version 1.2 - reviewed 2026-08-19

## Purpose

This is the acceptance map for the customer-led implementation and training program. A customer may use video, written procedures, or both. The required workspace task, knowledge check, and saved readiness evidence are the same in either format.

The searchable Academy guide is canonical. The versioned Customer Launch Docket is the printable handoff companion.

## Start-to-finish curriculum

| Stage | Target | Owner | Video track | Written procedures | Required evidence |
|---|---|---|---|---:|---|
| 1. Kickoff and ownership | Day 1 | Customer Champion | Start Here | 2 | Champion, pilot team, practice date, support path, and docket |
| 2. Workspace foundation | Day 1 | Champion or Admin | Workspace Setup | 2 | Workspace settings and successful role-based sign-ins |
| 3. Operational records | Day 2 | Champion, Admin, or fleet owner | Workspace Setup | 3 | Active Driver, ready vehicle, and accurate pilot customers |
| 4. Route-day data | Day 3 | Dispatcher | Route Operations | 2 | Reconciled import, valid locations, and explained exclusions |
| 5. Plan and approve | Day 4 | Dispatcher | Route Operations | 2 | Provider provenance, resolved blockers, and published version |
| 6. Dispatch and practice | Days 5-6 | Dispatcher and pilot Driver | Route Operations and Driver Quick Start | 4 | Dispatch, Driver events, proof, message history, and resolved exception |
| 7. Monitor and close | Day 6 | Dispatcher, Champion, and Viewer | Route Operations and Viewer Basics | 3 | Tracking state, proof, resolved exceptions, and closed route record |
| 8. Readiness and first 30 days | Day 7 and ongoing | Customer Champion | Go-Live | 3 | Ready-for-review state, signoff, launch date, KPI owners, and escalation path |

Total: 8 stages and 21 written procedures.

## Customer artifacts

- Authenticated Academy overview and role-filtered lessons: `/academy`
- Searchable written program, index, Q&A, and troubleshooting: `/academy/guide`
- Mobile Driver help: `/driver/help`
- Public searchable knowledge base: `/support`
- Versioned docket ZIP: `/downloads/trovan-customer-launch-docket-v1.zip`
- Customer Launch Docket PDF: `/downloads/trovan-customer-launch-docket-v1.pdf`
- Driver Quick Start PDF: `/downloads/trovan-driver-quick-start-v1.pdf`
- Six captioned local-AI lessons: `frontend/public/training/*.mp4`
- Seventeen Playwright-captured annotated screenshots: `frontend/public/training/guides/*.png`

## Training-media acceptance

- Real sanitized interface is recorded with Playwright.
- A visible cursor glides to and clicks the documented controls.
- Desktop recordings are 1280 by 720; Driver recordings are centered mobile captures.
- Final video is 30 fps H.264 with AAC audio and fast-start metadata.
- Narration is refined by the configured server-local model and synthesized by local Kokoro TTS.
- The synthesized narration and captions do not say the product brand name.
- Every lesson includes WebVTT captions, a transcript-equivalent article, chapters, a workspace task, and a knowledge check.

## Written-guide acceptance

Each procedure includes the audience, page route, goal, annotated screenshot, exact click target, instruction, expected result, safety warning where needed, and completion evidence. Every procedure belongs to exactly one program stage. Every video chapter links to one or more existing procedures.

The guide contains common implementation Q&A and symptom-first troubleshooting. Troubleshooting paths include the likely cause, ordered customer checks, and the precise condition for escalation.

## Automated verification

- Catalog unit tests validate role filtering, media fields, content versions, 8 stages, 21 unique procedures, chapter-to-procedure mappings, screenshots, Q&A, and troubleshooting.
- Playwright tests validate public support search and downloads, Owner access to all stages and procedures, image responses, video chapter seeking, persisted lesson completion, and the mobile Driver guide.
- Media scripts validate minimum duration, caption coverage, 30 fps video, H.264/AAC codecs, and zero spoken brand-name detections.
- The docket builder fails when a required screenshot is missing. Every generated PDF page is rendered to PNG and reviewed for layout, clipping, and legibility.

## Readiness rule

Ready for Review requires the primary depot, active Driver, ready vehicle, validated jobs, provider-backed route, dispatched practice route, persisted proof, required Champion tracks, one Driver Quick Start completion, and customer signoff. The customer corrects the source workspace record through the next-action link; browser-only checkboxes do not replace persisted evidence.

## Ownership boundary

The customer Champion owns data preparation, internal scheduling, team completion, the practice route, and reinforcement. Standard onboarding includes Academy, docket, best-effort support, and one 30-minute readiness review. Data cleanup, custom integrations, live team training, onsite implementation, and customer-specific process design remain separately scoped.
