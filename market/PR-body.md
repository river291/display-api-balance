# Add dsh-api-balance

This PR adds one entry for [dsh-api-balance](https://github.com/river291/dsh-api-balance).

## What it does

A DeepSeek Harness bundle that shows the DeepSeek API-key balance as one ambient
stat in the composer row (next to the shipped turn/token usage stats), refreshes
it every 60 seconds, and turns the amount red below a locally configured
low-balance threshold.

## Checklist

- [x] `package.json` declares `dsh.bundle` (patch `./cordis.patch.yml`) and
      `dsh.client` (platform `web`)
- [x] Real, working Host + Client code in the repository
- [x] No build step and no runtime dependencies; installs from GitHub source
      without a build-script approval
- [x] Repository has the `dsh-plugin` topic
- [x] Repository is more than 1 day old
- [x] Entry file: `data/plugins/river291__dsh-api-balance.yml`
- [x] Only this entry file is added; generated READMEs untouched
- [x] Description is checked against the code: the balance comes from
      `GET /api/balance` on the host, which calls
      `https://api.deepseek.com/user/balance` with `DEEPSEEK_API_KEY`; the
      client refreshes every 60s and the threshold is local (`localStorage`)

## How to verify locally

```sh
dsh plugin --profile <profile> add github:river291/dsh-api-balance
```

Then open a conversation and check the stat row under the composer for
`API余额 CNY …`; click it to edit the threshold.

---

Created by the repository author. Market text is third-party content.
