---
name: resend-webhook-valentine-roofing
description: |
  Mapped webhook for Valentine Roofing that receives Driving For Dollars (D4$)
  CSV exports via Resend email.received events. Downloads the CSV attachment,
  parses tab-delimited property/contact records, and hands them to the
  Smart Scout skill for CRM ingestion, mailer dispatch, and Apollo sequencing.
compatibility: Requires network access, a Resend receiving domain, and RESEND_API_KEY.
metadata:
  author: opsrev
  version: "1.0"
  org: valentine-roofing
  clawdbot:
    emoji: "📨"
    requires:
      env:
        - RESEND_API_KEY
---

# Resend D4$ Webhook — Valentine Roofing

Mapped webhook that receives Driving For Dollars CSV exports from Resend and
feeds parsed property records into the **Smart Scout** skill.

## Flow

1. A D4$ export email arrives at the Resend receiving domain.
2. Resend POSTs an `email.received` webhook to the OpenClaw gateway.
3. `resend-transform.js` downloads the CSV attachment via the Resend API.
4. The tab-delimited CSV is parsed into structured property/contact records.
5. A prompt is built instructing the agent to run **Smart Scout** on each record.

The email body is ignored — only the CSV attachment matters.

## CSV format

The D4$ app exports a tab-delimited CSV with these columns:

| Column | Mapped key |
|---|---|
| Property Address / City / State / Zip | `property_address`, `property_city`, `property_state`, `property_zip` |
| Primary Owner First/Last Name | `primary_owner_first_name`, `primary_owner_last_name` |
| Secondary Owner First/Last Name | `secondary_owner_first_name`, `secondary_owner_last_name` |
| Mailing Address / City / State / Zip | `mailing_address`, `mailing_city`, `mailing_state`, `mailing_zip` |
| Phone 1–5 / Phone 1–5 Type | `phone_1` … `phone_5`, `phone_1_type` … `phone_5_type` |
| Email 1–5 | `email_1` … `email_5` |
| Owner Occupied Indicator | `owner_occupied` |
| Last Market Sale Date / Price | `last_sale_date`, `last_sale_price` |
| House Year Built / Sqft / Lot Sqft | `year_built`, `house_sqft`, `lot_sqft` |
| Bedrooms / Bathrooms | `bedrooms`, `bathrooms` |
| Mortgage Amount / Recording Date / Rate / Type | `mortgage_amount`, `mortgage_recording_date`, `mortgage_interest_rate`, `mortgage_interest_rate_type` |
| Zoning Code / Desc | `zoning_code`, `zoning_code_desc` |
| Age / Bankruptcy | `age`, `bankruptcy` |
| Alt. Address 1–3 (Address/City/State/Zip) | `alt_address_1` … `alt_address_3_zip` |

Values of `n/a` or empty strings are normalised to `null`.

## Setup

### 1. Add the mapping to `config.json5`

```json5
{
  hooks: {
    enabled: true,
    token: "${CLAWDBOT_HOOK_TOKEN}",
    path: "/hooks",
    transformsDir: "/path/to/orgs/valentine-roofing/hooks/resend-webhook",
    mappings: [
      {
        name: "resend-d4s",
        match: { path: "/resend-d4s", method: "POST" },
        action: "agent",
        transform: {
          module: "./resend-transform.js",
          export: "transformResendWebhook",
        },
        deliver: false,
      },
    ],
  },
}
```

### 2. Set environment variables

```bash
export RESEND_API_KEY="re_..."
export CLAWDBOT_HOOK_TOKEN="..."            # openssl rand -base64 32
# Optional — enables Svix signature verification:
export RESEND_WEBHOOK_SECRET="whsec_..."
```

### 3. Expose the endpoint and register in Resend

Expose the gateway (Cloudflare Tunnel, Tailscale Funnel, ngrok, etc.) then
add a webhook in **Resend Dashboard → Webhooks**:

- **URL:** `https://<your-tunnel>/hooks/resend-d4s`
- **Events:** `email.received`

### 4. Test

```bash
node resend-transform.js          # runs with mock CSV, no API key needed
```

Or with curl against the live gateway:

```bash
curl -X POST http://127.0.0.1:18789/hooks/resend-d4s \
  -H "x-openclaw-token: $CLAWDBOT_HOOK_TOKEN" \
  -H "Content-Type: application/json" \
  -d @example-payload.json
```

## Troubleshooting

| Problem | Fix |
|---|---|
| Webhook not arriving | Check Resend dashboard → Webhooks → Logs |
| 401 from gateway | Verify `x-openclaw-token` matches `hooks.token` |
| No CSV found | Confirm the D4$ email has a `.csv` attachment |
| Empty records | Check CSV is tab-delimited, not comma-delimited |
