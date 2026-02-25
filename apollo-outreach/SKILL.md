---
name: apollo-outreach
description: |
  Apollo.io outreach sequencing via the OpsRev managed OAuth gateway. Search contacts, manage sequences, add contacts to sequences, and monitor outreach emails. Use this skill when users ask to run sales outreach or manage Apollo sequences.
compatibility: Requires network access and configured OpsRev connector env vars in the bot runtime.
metadata:
  author: opsrev
  version: "1.0"
  clawdbot:
    emoji: "\U0001F680"
    requires:
      env:
        - OPSREV_CONNECTOR_URL
        - OPSREV_BOT_ID
        - OPSREV_ORG_ID
---

# Apollo Outreach Sequencing via OpsRev OAuth Gateway

Use the OpsRev connector proxy to call native Apollo.io API routes with managed OAuth.

## Base URL

```
$OPSREV_CONNECTOR_URL/api/v1/apollo/{native-apollo-path}
```

## Required Headers

Always include:
- `X-Bot-Id: $OPSREV_BOT_ID`
- `X-Org-Id: $OPSREV_ORG_ID`
- `Content-Type: application/json` (for POST/PATCH)

Optional:
- `X-User-Id: <opsrev_user_uuid>` to force user-scoped tokens.

## Quick Connectivity Check

Run this first to verify Apollo connectivity.

```bash
python3 <<'PY'
import json, os, urllib.request

base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
url = f"{base}/api/v1/apollo/email_accounts"

req = urllib.request.Request(url, method='GET')
req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])

with urllib.request.urlopen(req) as res:
    data = json.load(res)
    print(json.dumps(data, indent=2))
PY
```

## Generic Python Helper

```bash
python3 <<'PY'
import json, os, urllib.request

def apollo(method, path, payload=None):
    base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
    url = f"{base}/api/v1/apollo/{path.lstrip('/')}"
    body = None if payload is None else json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
    req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])
    if payload is not None:
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as res:
        return json.load(res)

# Example: list sequences
result = apollo('POST', 'emailer_campaigns/search', {'per_page': 5, 'page': 1})
for seq in result.get('emailer_campaigns', []):
    print(f"{seq['id']}: {seq['name']}")
PY
```

---

## Sequences

### Search Sequences

```
POST /emailer_campaigns/search
```

Body:
```json
{
  "q_keywords": "onboarding",
  "per_page": 25,
  "page": 1
}
```

Returns an `emailer_campaigns` array with id, name, active status, step counts, and creation dates.

### Get Sequence Details

Retrieve a specific sequence by its ID (embed the ID in a search filter or use the search results).

---

## Contacts

### Search Contacts (in your database)

```
POST /contacts/search
```

Body:
```json
{
  "q_keywords": "Jane Doe",
  "per_page": 25,
  "page": 1
}
```

Returns a `contacts` array. Display limit: 50,000 records (100 per page, up to 500 pages). Add filters to narrow results.

### Create a Contact

```
POST /contacts
```

Body:
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "email": "jane@example.com",
  "organization_name": "Acme Corp",
  "title": "VP of Sales"
}
```

Key parameters: `first_name`, `last_name`, `email`, `organization_name`, `title`, `website_url`, `direct_phone`, `mobile_phone`. Set `run_dedupe: true` to prevent duplicates.

### Bulk Create Contacts

```
POST /contacts/bulk_create
```

Body:
```json
{
  "contacts": [
    {"first_name": "Jane", "last_name": "Doe", "email": "jane@example.com", "organization_name": "Acme Corp"},
    {"first_name": "John", "last_name": "Smith", "email": "john@example.com", "organization_name": "Globex"}
  ]
}
```

Supports up to 100 contacts per request with built-in deduplication.

---

## People Search (Apollo Database)

### Find People Using Filters

```
POST /mixed_people/api_search
```

Query parameters (pass as URL params, not body):
- `person_titles[]` - Job titles to match (e.g. `sales director`)
- `person_locations[]` - Locations (e.g. `California, US`)
- `per_page` - Results per page

```bash
python3 <<'PY'
import json, os, urllib.request, urllib.parse

base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
params = urllib.parse.urlencode({
    'person_titles[]': ['VP of Sales', 'Director of Sales'],
    'person_locations[]': ['California, US', 'New York, US'],
    'per_page': 10
}, doseq=True)
url = f"{base}/api/v1/apollo/mixed_people/api_search?{params}"

req = urllib.request.Request(url, method='POST')
req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])

with urllib.request.urlopen(req) as res:
    data = json.load(res)
    for p in data.get('people', []):
        org = p.get('organization', {}).get('name', 'N/A')
        print(f"{p.get('first_name', '')} {p.get('last_name', 'N/A')} - {p.get('title', 'N/A')} @ {org}")
PY
```

Does not consume credits. Use returned `id` values with People Enrichment for full profiles.

### People Enrichment

```
POST /people/match
```

Body:
```json
{
  "first_name": "Jane",
  "last_name": "Doe",
  "organization_name": "Acme Corp",
  "reveal_personal_emails": false,
  "reveal_phone_number": true
}
```

Enriches a person record with email, phone, and company data.

---

## Add Contacts to a Sequence

```
POST /emailer_campaigns/{sequence_id}/add_contact_ids
```

Body:
```json
{
  "contact_ids": ["contact_id_1", "contact_id_2"],
  "emailer_campaign_id": "sequence_id",
  "send_email_from_email_account_id": "mailbox_id",
  "sequence_no_email": false,
  "sequence_active_in_other_campaigns": false,
  "sequence_finished_in_other_campaigns": false
}
```

Key parameters:
- `contact_ids` (required) - Array of contact IDs to add
- `emailer_campaign_id` (required) - The sequence ID
- `send_email_from_email_account_id` - Mailbox to send from (get IDs from Email Accounts endpoint)
- `sequence_no_email` - Add contacts even if they lack an email
- `sequence_active_in_other_campaigns` - Add even if active in another sequence
- `sequence_finished_in_other_campaigns` - Add even if finished another sequence

Only contacts (not raw people) can be added to sequences. Create contacts first if needed.

---

## Update Contact Status in a Sequence

```
POST /emailer_campaigns/remove_or_stop_contact_ids
```

### Mark contacts as finished:
```json
{
  "emailer_campaign_id": "sequence_id",
  "finish_contact_ids": ["contact_id_1"]
}
```

### Remove contacts entirely:
```json
{
  "emailer_campaign_id": "sequence_id",
  "remove_contact_ids": ["contact_id_1"]
}
```

Use "finish" when a contact replies or completes the process. Use "remove" with caution as it bypasses safety checks that prevent re-enrollment.

---

## Email Accounts

### List Email Accounts

```
GET /email_accounts
```

No parameters required. Returns IDs and metadata for all linked email inboxes. Use these IDs with `send_email_from_email_account_id` when adding contacts to sequences.

---

## Search Outreach Emails

```
POST /emailer_campaigns/{emailer_campaign_id}/emailer_touches/search
```

Body:
```json
{
  "per_page": 25,
  "page": 1
}
```

Display limit: 50,000 records (100 per page, up to 500 pages).

---

## Typical Outreach Workflow

1. **Find prospects** - Use People Search to find people matching your ICP
2. **Enrich** - Call People Enrichment to get email/phone data
3. **Create contacts** - Add prospects to your Apollo database via Create Contact
4. **List sequences** - Search existing sequences or note the target sequence ID
5. **Get mailbox** - Call Email Accounts to get the sender mailbox ID
6. **Enroll** - Add contacts to the sequence via Add Contacts to Sequence
7. **Monitor** - Search outreach emails and check contact status

---

## Working Rules

1. Use native Apollo request/response shapes. Do not invent schema fields.
2. Always verify contact exists before enrolling in a sequence.
3. Return the action result first, then include IDs/names of affected records.
4. If proxy returns connection/auth errors, state exact error and instruct user to reconnect Apollo in OpsRev Connectors.
5. Keep outputs concise and decision-oriented.

## Error Semantics

- `403` - No usable connector token (not connected, expired, or not a master API key).
- `400/404/409` - Native Apollo API validation or resource errors.
- `422` - Invalid parameters or contact already in sequence.
- Proxy wraps successful responses as `{ "data": ... }`.
