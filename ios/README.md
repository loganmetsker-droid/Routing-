# Trovan Driver iOS Wrapper

This target runs the driver PWA inside a small WKWebView shell for simulator and Xcode testing.

## Run

From the repo root:

```sh
(cd frontend && PATH="/Users/logan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" ../node_modules/.bin/vite build)
PATH="/Users/logan/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/bin:$PATH" DEMO_PREVIEW_HOST=0.0.0.0 DEMO_PREVIEW_ALLOW_NETWORK=1 DEMO_PREVIEW_PORT=5186 node scripts/demo-preview-server.mjs
xcodegen generate --spec ios/project.yml
open ios/TrovanDriver.xcodeproj
```

The app tries `TROVAN_DRIVER_URL` first when set, then the `opshub` Tailscale preview server, then `http://127.0.0.1:5186/driver` for simulator use. The bundled private-dev build injects the local demo preview flag so the driver workspace can open without a production account.

For physical iPhone testing, the preview runs on the Tailscale server:

```sh
ssh opshub 'systemctl --user status trovan-driver-preview.service --no-pager'
curl -fsS http://opshub.tail75017b.ts.net:5186/healthz
curl -fsS http://100.124.206.21:5186/healthz
```

For away-from-home use, keep Tailscale running on the server and iPhone. The Mac is only needed to rebuild/reinstall the app, not to serve the driver UI.
