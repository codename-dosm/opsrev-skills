## OpsRev Skills Repo (for cloning to GitHub)

This folder is a local staging area for publishable OpenClaw skill repos.

Each immediate child folder is a skill repository:

- `weather`
- `github`
- `summarize`
- `resend-webhook`

These were copied directly from ClawHub public skill packages:

```text
https://clawhub.ai/skills?sort=downloads&nonSuspicious=true
```

You can publish these as separate repos under `opsrev/opsrev-skills` (or another shared org/repo namespace) to match:

- `https://github.com/{org}/{slug}.git`
- e.g. `https://github.com/opsrev/opsrev-skills/weather.git`

Keep this folder in sync with the exact versions you want to install from OpenClaw via `SKILL_SOURCE=github`.
