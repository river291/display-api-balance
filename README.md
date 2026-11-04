# display-api-balance

English | [中文](README.zh.md)

Shows the **DeepSeek API balance** as an ambient stat under the DeepSeek Harness
composer and refreshes it every 60 seconds. Click the balance to set a local
low-balance threshold; the amount turns red once it reaches the threshold.

## Features

- Renders in the composer's stat row below the input, after the shipped
  "turns · steps · tok/s" and token-usage stats, sharing their font size, color
  and icon style — no separate floating layer.
- Refreshes every 60 seconds; also refreshes immediately when the window or tab
  regains focus.
- Click the balance to open a small panel and set a low-balance threshold
  (default ¥20). At or below it the amount turns red and bold; leave the field
  empty to disable the alert.
- The threshold is a local preference stored in the browser
  `localStorage` (`display-api-balance:threshold`); it is never uploaded or sent
  over the network.
- Clear states for a missing `DEEPSEEK_API_KEY`, a failed request, or a
  signed-out account — no wrong number is displayed.
- Theme aware: every color comes from DSH's `--dsw-alias-*` semantic tokens.

## Install

DSH bundles are installed into a profile. From the desktop Plugins page or the
CLI:

```sh
# From GitHub (source is the artifact: no build step, no allowBuilds approval)
dsh plugin --profile <profile> add github:river291/display-api-balance
```

Then confirm `display-api-balance` is enabled on the Plugins page.

The plugin is distributed from GitHub; there is no npm release yet, so install
with the GitHub spec above. If it is published to npm later,
`dsh plugin add display-api-balance` will work as well. The published package's
`repository` field points back at this repository, so marketplaces can map npm
data to it.

## Requirements

- The host's credential service must resolve `DEEPSEEK_API_KEY`: fill in a
  DeepSeek API key under DSH Settings → Models, or export the variable in the
  environment that launches DSH.
- DSH version: developed and verified on `0.2.1-rc.5` (desktop). The host half
  only uses `webServer` and `credentials`; the client half only uses `slots` and
  `locale`.

## How it works

- **Host half** (`index.js`) registers `GET /api/balance`. Each request
  re-resolves the `DEEPSEEK_API_KEY` credential (rotating the key needs no
  restart), calls `https://api.deepseek.com/user/balance` with
  `Authorization: Bearer`, applies a 15-second timeout, and returns the upstream
  JSON. The key stays inside the host process and is never handed to the
  browser.
- **Client half** (`client.js`) registers the balance as one text stat in the
  `conversation.composer.dock` slot (`order: 2`, after the context-occupancy
  meter). A relative `fetch('/api/balance')` reaches the host route above
  through the `dsh-app://` protocol in the desktop app, and as a same-origin
  request in the web build.
- For plain-HTTP web deployments: like any other host route, `/api/balance` is
  meant to be bound to the loopback address only.

## Difference from the old web approach

The web version used `webServer.tapIndex` to inject a DOM script into
`index.html`. The desktop (Electron) window loads the page from the packaged
`dsh-web-frontend/dist` and never runs the host's `renderIndex`, so injected
scripts do not execute there. This plugin renders through a client slot with
React instead, so both the desktop and web builds work.

## Uninstall

```sh
dsh plugin --profile <profile> remove display-api-balance
```

## License

MIT
