## OpsRev Skills Repo

Local staging area for publishable OpenClaw skills and hooks.

### Structure

```
global/                          # Shared across all orgs
  hooks/                         # Global webhook transforms (empty for now)
  skills/                        # Global skills
    weather/
    github/
    summarize/
    notion/

orgs/                            # Per-org customisations
  valentine-roofing/
    hooks/
      resend-webhook/            # D4$ CSV ingest via Resend email.received
    skills/
      smart-scout/               # Process D4$ records → CRM, mailer, Apollo
```

### Conventions

- **`global/skills/`** — Skills available to every org/tenant.
- **`global/hooks/`** — Webhook transforms available to every org/tenant.
- **`orgs/{org-slug}/skills/`** — Skills scoped to a single org.
- **`orgs/{org-slug}/hooks/`** — Webhook transforms scoped to a single org.

Each skill or hook folder contains at minimum a `SKILL.md` and `_meta.json`.
Hooks also include a JS/TS transform module and a `config-example.json5`.

### Publishing

These can be published as separate repos under `opsrev/opsrev-skills` to match:

```
https://github.com/{org}/{slug}.git
```

Keep this folder in sync with the exact versions installed via `SKILL_SOURCE=github`.
