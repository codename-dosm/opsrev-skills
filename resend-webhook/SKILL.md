---
name: resend-webhook
description: |
  Receive inbound emails via Resend webhooks. A mapped webhook skill that transforms
  Resend email.received events into agent tasks, with optional body and attachment
  retrieval via the Resend API.
compatibility: Requires network access and a Resend account with a receiving domain configured.
metadata:
  author: opsrev
  version: "1.0"
  clawdbot:
    emoji: "📨"
    requires:
      env:
        - RESEND_API_KEY
---

# Resend Inbound Email Webhook

Receive inbound emails from Resend and route them to an OpenClaw agent session.

Resend fires an `email.received` webhook whenever mail arrives at your receiving
domain. This skill provides a mapped-webhook transform that parses the event,
fetches the email body from the Resend API, and delivers a structured task prompt
to the agent.

## How it works

1. Resend receives an email at your configured domain (e.g. `inbox@yourdomain.com`).
2. Resend POSTs an `email.received` webhook to your OpenClaw gateway.
3. The `resend-transform.js` transform parses the payload and calls the
   Resend API to retrieve the email body.
4. A task prompt is built with sender, recipients, subject, and body, then
   handed to the agent.

## Setup

### 1. Configure hooks in `config.json5`

See `config-example.json5` in this skill folder. The key block:

```json5
{
  hooks: {
    enabled: true,
    token: "YOUR_HOOK_TOKEN",       // openssl rand -base64 32
    path: "/hooks",
    transformsDir: "/path/to/skills/resend-webhook",
    mappings: [
      {
        name: "resend",
        match: { path: "/resend", method: "POST" },
        action: "agent",
        transform: {
          module: "./resend-transform.js",
          export: "transformResendWebhook"
        },
        deliver: false,
      }
    ]
  }
}
```

### 2. Set environment variables

```bash
export RESEND_API_KEY="re_..."          # Resend API key (for fetching email body)
export CLAWDBOT_HOOK_TOKEN="..."        # same value as hooks.token above
```

### 3. Expose the webhook endpoint

Use Cloudflare Tunnel, Tailscale Funnel, or ngrok to make the gateway
reachable from the internet:

```bash
# Cloudflare Tunnel (example)
cloudflared tunnel --url http://127.0.0.1:18789
```

Your public webhook URL will be:
```
https://<your-tunnel>/hooks/resend
```

### 4. Register the webhook in Resend

1. Go to **Resend Dashboard → Webhooks → Add Webhook**.
2. Set the endpoint URL to your public webhook URL above.
3. Subscribe to the **email.received** event.
4. Save.

Resend signs webhooks via Svix. If you want to verify signatures, set
`RESEND_WEBHOOK_SECRET` (the signing secret from the Resend dashboard) and
the transform will validate the `svix-signature` header automatically.

### 5. Test

Send an email to your Resend receiving domain and confirm the agent wakes
with the email content.

```bash
# Or simulate with curl:
curl -X POST http://127.0.0.1:18789/hooks/resend \
  -H "x-openclaw-token: $CLAWDBOT_HOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d @example-payload.json
```

## Payload overview

Resend `email.received` webhooks include metadata only — **no email body or
attachment content**. The transform calls the Resend API to fetch the full
email content:

| Webhook field | Description |
|---|---|
| `data.email_id` | Unique email identifier |
| `data.from` | Sender (e.g. `"Alice <alice@example.com>"`) |
| `data.to` | Recipient addresses |
| `data.cc` / `data.bcc` | CC / BCC addresses |
| `data.subject` | Subject line |
| `data.attachments` | Attachment metadata (id, filename, content_type) |

Body and attachments are fetched via:
- `GET https://api.resend.com/emails/{email_id}` (returns `text_body` and `html_body`)
- `GET https://api.resend.com/emails/{email_id}/attachments` (returns download URLs)

## Routing

By default every inbound email goes to the default agent. You can customise
routing in the transform by inspecting the `to` address:

- `support@yourdomain.com` → route to a support agent session
- `tasks@yourdomain.com` → route to a task-runner agent session

Edit the `ROUTING` map in `resend-transform.js` to match your setup.

## Security

- Never commit your hook token or API keys to version control.
- Use environment variables (`RESEND_API_KEY`, `CLAWDBOT_HOOK_TOKEN`).
- Use HTTPS only for the public endpoint.
- Optionally verify Svix webhook signatures by setting `RESEND_WEBHOOK_SECRET`.

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook not arriving | Check Resend dashboard → Webhooks → Logs for delivery status |
| 401 from gateway | Verify `x-openclaw-token` header matches `hooks.token` |
| Empty email body | Confirm `RESEND_API_KEY` is set and has read permissions |
| Transform errors | Check gateway logs; run `node resend-transform.js` with test payload |
