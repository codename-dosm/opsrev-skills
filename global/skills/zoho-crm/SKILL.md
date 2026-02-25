---
name: zoho-crm-opsrev
description: |
  Zoho CRM API integration through the OpsRev managed OAuth gateway. Manage leads, contacts, accounts, deals, tasks, notes, and all CRM modules by proxying native Zoho CRM API v7 routes. Use this skill when users ask to work with Zoho CRM data.
compatibility: Requires network access and configured OpsRev connector env vars in the bot runtime.
metadata:
  author: opsrev
  version: "1.0"
  clawdbot:
    emoji: "📊"
    requires:
      env:
        - OPSREV_CONNECTOR_URL
        - OPSREV_BOT_ID
        - OPSREV_ORG_ID
---

# Zoho CRM via OpsRev OAuth Gateway

Use the OpsRev connector proxy to call native Zoho CRM API v7 routes with managed OAuth.

## Base URL

```
$OPSREV_CONNECTOR_URL/api/v1/zoho-crm/{native-zoho-crm-path}
```

The proxy maps to the native Zoho CRM REST API at `https://www.zohoapis.com/crm/v7/...`. Drop the host and version prefix — the gateway handles routing, authentication, and token refresh.

Examples:
- `Leads` (list/create leads)
- `Contacts/5725767000004594012` (get/update a contact)
- `Deals/search?criteria=(Deal_Name:equals:Acme)` (search deals)
- `coql` (COQL query)
- `settings/modules` (list modules)
- `settings/fields?module=Leads` (get field metadata)

## Required Headers

Always include:
- `X-Bot-Id: $OPSREV_BOT_ID`
- `X-Org-Id: $OPSREV_ORG_ID`
- `Content-Type: application/json` (for POST/PUT/PATCH)

Optional:
- `X-User-Id: <opsrev_user_uuid>` to force user-scoped tokens. If omitted, proxy falls back to org-scoped connection.

## Quick Connectivity Check

Run this first when user asks to verify Zoho CRM connectivity.

```bash
python3 <<'PY'
import json, os, urllib.request

base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
url = f"{base}/api/v1/zoho-crm/org"

req = urllib.request.Request(url, method='GET')
req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])

with urllib.request.urlopen(req) as res:
    print(json.dumps(json.load(res), indent=2))
PY
```

## Useful Generic Python Helper

```bash
python3 <<'PY'
import json, os, urllib.request, urllib.parse

def call(method, path, payload=None, params=None):
    base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
    url = f"{base}/api/v1/zoho-crm/{path.lstrip('/')}"
    if params:
        url += '?' + urllib.parse.urlencode(params)
    body = None if payload is None else json.dumps(payload).encode('utf-8')
    req = urllib.request.Request(url, data=body, method=method)
    req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
    req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])
    if payload is not None:
        req.add_header('Content-Type', 'application/json')
    with urllib.request.urlopen(req) as res:
        return json.load(res)

# Example: list first 3 leads
result = call('GET', 'Leads', params={'page': 1, 'per_page': 3})
print(json.dumps(result, indent=2))
PY
```

---

## Records API

Standard CRUD for any module. Replace `{module}` with the module API name (Leads, Contacts, Accounts, Deals, Tasks, Events, Calls, Campaigns, Products, Quotes, Sales_Orders, Purchase_Orders, Invoices, Vendors, Price_Books, Cases, Solutions, or any custom module).

### Get Records

```
GET /{module}
```

Query params: `fields`, `sort_order`, `sort_by`, `page`, `per_page` (max 200), `cvid` (custom view id), `ids` (comma-separated).

### Get a Specific Record

```
GET /{module}/{record_id}
```

### Insert Records

```
POST /{module}
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "Last_Name": "Smith",
      "Email": "smith@example.com",
      "Company": "Acme Corp"
    }
  ],
  "trigger": ["workflow", "approval", "blueprint"]
}
```

Trigger values: `workflow`, `approval`, `blueprint`, `pathfinder`, `orchestration`. Set `"trigger": []` to skip all automations. Max 100 records per call.

### Update Records

```
PUT /{module}/{record_id}
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "id": "5725767000004594012",
      "Deal_Name": "Updated Deal"
    }
  ],
  "trigger": ["workflow"]
}
```

Omit `{record_id}` from the path and include `id` in each object to update multiple records at once.

Use `"$append_values"` key in the record object to append to multi-select picklist fields instead of replacing them.

### Upsert Records

```
POST /{module}/upsert
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "Last_Name": "Smith",
      "Email": "smith@example.com",
      "Company": "Acme Corp"
    }
  ],
  "duplicate_check_fields": ["Email"],
  "trigger": ["workflow"]
}
```

### Delete Records

```
DELETE /{module}/{record_id}
```

Or delete multiple:
```
DELETE /{module}?ids={id1},{id2},{id3}
```

Optional `wf_trigger=true` param to fire workflows on delete.

---

## Search Records

```
GET /{module}/search
```

Query params:
- `criteria` — filter expression, e.g. `(Email:equals:smith@example.com)`
- `email` — search by email field
- `phone` — search by phone field
- `word` — keyword search across all fields
- `page`, `per_page`

Criteria operators: `equals`, `not_equal`, `starts_with`, `ends_with`, `contains`, `not_contains`, `in`, `not_in`, `between`, `not_between`, `less_than`, `less_equal`, `greater_than`, `greater_equal`, `is_empty`, `is_not_empty`.

Combine with `and`/`or`: `((Last_Name:equals:Smith)and(Company:equals:Acme))`.

---

## COQL (CRM Object Query Language)

SQL-like queries for complex data retrieval across modules.

```
POST /coql
Content-Type: application/json
```

Body:
```json
{
  "select_query": "select Last_Name, First_Name, Email, Company from Leads where Lead_Status = 'Contacted' order by Created_Time desc limit 0, 50"
}
```

### COQL Syntax

```sql
SELECT field1, field2
FROM module_api_name
WHERE field operator value [AND/OR field operator value]
ORDER BY field ASC/DESC
LIMIT offset, count
```

Operators: `=`, `!=`, `like`, `not like`, `in`, `not in`, `is null`, `is not null`, `<`, `<=`, `>`, `>=`, `between`.

Wildcards with `like`: `'%tech'` (ends with), `'C%'` (starts with), `'%tech%'` (contains).

Lookup joins via dot notation: `select Deal_Name, Account_Name.Account_Name from Deals`. Max 2 joins per query.

Aggregate functions: `COUNT()`, `SUM()`, `AVG()`, `MIN()`, `MAX()`.

Max 25 WHERE conditions. Max 10 ORDER BY fields. Max 4 GROUP BY fields. Max 5 aggregate fields. Max 2,000 records per call; paginate with OFFSET up to 100,000 total.

COQL reflects changes instantly (no indexing delay like the Search API).

---

## Related Records

```
GET /{module}/{record_id}/{related_module}
```

Examples:
- `GET /Deals/555000001234/Contacts` — contacts linked to a deal
- `GET /Contacts/555000005678/Notes` — notes on a contact
- `GET /Accounts/555000009012/Deals` — deals under an account

### Link Related Records

```
PUT /{module}/{record_id}/{related_module}/{related_record_id}
```

### Unlink Related Records

```
DELETE /{module}/{record_id}/{related_module}/{related_record_id}
```

---

## Notes

### Get Notes for a Record

```
GET /{module}/{record_id}/Notes
```

### Create a Note

```
POST /{module}/{record_id}/Notes
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "Note_Title": "Follow-up call",
      "Note_Content": "Discussed pricing. Will send proposal by Friday."
    }
  ]
}
```

### Update a Note

```
PUT /{module}/{record_id}/Notes/{note_id}
Content-Type: application/json
```

### Delete a Note

```
DELETE /{module}/{record_id}/Notes/{note_id}
```

---

## Attachments

### List Attachments

```
GET /{module}/{record_id}/Attachments
```

### Upload an Attachment

```
POST /{module}/{record_id}/Attachments
```

Send as multipart/form-data with the file in the `file` field.

### Download an Attachment

```
GET /{module}/{record_id}/Attachments/{attachment_id}
```

### Delete an Attachment

```
DELETE /{module}/{record_id}/Attachments/{attachment_id}
```

### Upload File to ZFS (for File Upload Fields)

Two-step process for file upload fields (not record attachments):

**Step 1:** Upload to Zoho File System:
```
POST /files
Content-Type: multipart/form-data
```

Returns `file_id` values.

**Step 2:** Update the record with the file ID:
```
PUT /{module}/{record_id}
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "File_Upload_Field_API_Name": [
        { "file_id": "{id_from_step_1}" }
      ]
    }
  ]
}
```

### Record Photos

```
POST /{module}/{record_id}/photo   (upload, multipart/form-data)
GET  /{module}/{record_id}/photo   (download)
DELETE /{module}/{record_id}/photo  (remove)
```

---

## Tags

### Get Tags for a Module

```
GET /settings/tags?module={module}
```

### Create Tags

```
POST /settings/tags?module={module}
Content-Type: application/json
```

Body:
```json
{
  "tags": [
    { "name": "High Priority" },
    { "name": "Follow Up" }
  ]
}
```

### Add Tags to Records

```
POST /{module}/actions/add_tags
Content-Type: application/json
```

Body:
```json
{
  "ids": ["555000001234", "555000005678"],
  "tags": [
    { "name": "High Priority" }
  ]
}
```

### Remove Tags from Records

```
POST /{module}/actions/remove_tags
Content-Type: application/json
```

---

## Convert Lead

```
POST /Leads/{lead_id}/actions/convert
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "overwrite": true,
      "notify_lead_owner": true,
      "notify_new_entity_owner": true,
      "Accounts": "555000009012",
      "Deals": {
        "Deal_Name": "Acme - New Deal",
        "Closing_Date": "2026-06-30",
        "Stage": "Qualification",
        "Amount": 50000
      },
      "carry_over_tags": {
        "Contacts": ["all"],
        "Accounts": ["all"],
        "Deals": ["all"]
      }
    }
  ]
}
```

---

## Modules Metadata

### List All Modules

```
GET /settings/modules
```

### Get Module Details

```
GET /settings/modules/{module_api_name}
```

---

## Fields Metadata

### Get Fields for a Module

```
GET /settings/fields?module={module}
```

Returns field API names, labels, data types, picklist values, and validation rules. Use this to discover the correct `api_name` values before inserting/updating records.

### Get a Specific Field

```
GET /settings/fields/{field_id}?module={module}
```

---

## Related Lists Metadata

```
GET /settings/related_lists?module={module}
```

Returns the available related lists for a module. The `href` field in each item provides the exact endpoint for fetching related records.

---

## Layouts

```
GET /settings/layouts?module={module}
GET /settings/layouts/{layout_id}?module={module}
```

---

## Users

```
GET /users
GET /users/{user_id}
```

Query param `type` to filter: `AllUsers`, `ActiveUsers`, `DeactiveUsers`, `ConfirmedUsers`, `NotConfirmedUsers`, `DeletedUsers`, `ActiveConfirmedUsers`, `AdminUsers`, `ActiveConfirmedAdmins`, `CurrentUser`.

---

## Roles and Profiles

```
GET /settings/roles
GET /settings/roles/{role_id}
GET /settings/profiles
GET /settings/profiles/{profile_id}
```

---

## Organization

```
GET /org
```

---

## Pipelines

```
GET /settings/pipeline?module=Deals
GET /settings/pipeline/{pipeline_id}?module=Deals
```

---

## Blueprints

### Get Blueprint

```
GET /{module}/{record_id}/actions/blueprint
```

### Update Blueprint Transition

```
PUT /{module}/{record_id}/actions/blueprint
Content-Type: application/json
```

---

## Custom Views

```
GET /settings/custom_views?module={module}
GET /settings/custom_views/{custom_view_id}?module={module}
```

---

## Bulk Read

### Create Bulk Read Job

```
POST /bulk-read
Content-Type: application/json
```

Body:
```json
{
  "callback": {
    "url": "https://example.com/callback",
    "method": "post"
  },
  "query": {
    "module": {
      "api_name": "Contacts"
    },
    "page": 1,
    "fields": ["Last_Name", "Email", "Phone"]
  }
}
```

### Get Bulk Read Job Status

```
GET /bulk-read/{job_id}
```

### Download Bulk Read Result

```
GET /bulk-read/{job_id}/result
```

---

## Bulk Write

### Create Bulk Write Job

```
POST /bulk-write
Content-Type: application/json
```

Upload a CSV first, then reference it in the job. Max 25,000 records per job.

### Get Bulk Write Job Status

```
GET /bulk-write/{job_id}
```

---

## Mass Actions

### Mass Update

```
POST /{module}/actions/mass_update
Content-Type: application/json
```

Body:
```json
{
  "data": [
    {
      "Lead_Status": "Contacted"
    }
  ],
  "ids": ["555000001234", "555000005678"],
  "over_write": true
}
```

### Mass Delete

```
POST /{module}/actions/mass_delete
Content-Type: application/json
```

---

## Notifications (Webhooks)

### Enable Notifications

```
POST /actions/watch
Content-Type: application/json
```

Body:
```json
{
  "watch": [
    {
      "channel_id": "1000001",
      "events": ["Deals.create", "Deals.edit", "Deals.delete"],
      "notify_url": "https://example.com/zoho-webhook"
    }
  ]
}
```

### Get Notification Details

```
GET /actions/watch
```

### Disable Notifications

```
PATCH /actions/watch
Content-Type: application/json
```

---

## Data Sharing Rules

```
GET /settings/data_sharing/rules?module={module}
GET /settings/data_sharing/public
```

---

## Standard Modules Quick Reference

| Module API Name | Description |
|---|---|
| `Leads` | Unqualified prospects |
| `Contacts` | People / qualified contacts |
| `Accounts` | Companies / organizations |
| `Deals` | Sales opportunities |
| `Tasks` | Action items |
| `Events` | Calendar events / meetings |
| `Calls` | Phone call logs |
| `Campaigns` | Marketing campaigns |
| `Products` | Product catalog |
| `Quotes` | Price quotes |
| `Sales_Orders` | Sales orders |
| `Purchase_Orders` | Purchase orders |
| `Invoices` | Invoices |
| `Vendors` | Supplier companies |
| `Price_Books` | Pricing tiers |
| `Cases` | Support cases |
| `Solutions` | Knowledge base articles |
| `Notes` | Notes (also accessible as related records) |
| `Activities` | Combined tasks + events + calls |

---

## Working Rules

1. Use native Zoho CRM request/response shapes. Do not invent schema fields.
2. Always discover field API names via `GET /settings/fields?module={module}` before inserting/updating records in an unfamiliar module.
3. For writes, fetch the current record first when possible to avoid overwriting data.
4. Return answers first, then include record IDs/URLs changed.
5. If proxy returns connection/auth errors, state exact error and instruct user to reconnect Zoho CRM in OpsRev Connectors.
6. Keep outputs concise and decision-oriented.
7. Prefer COQL for complex multi-condition queries; use search endpoint for simple lookups.
8. Max 100 records per insert/update/upsert call. Use bulk APIs for larger volumes.

## Error Semantics

- `403` usually means no usable connector token (not connected, expired, or missing access token).
- `400` native Zoho validation error (bad field names, missing required fields, invalid data types).
- `404` record or module not found.
- `429` API rate limit exceeded — back off and retry.
- `204` successful delete (no response body).
- Proxy wraps successful responses as `{ "data": ... }`.

## Rate Limits

- Minimum 4,000 requests/day per org; max 25,000/day or 500/user license (whichever lower).
- Credit system: 50,000 base credits + 1,000 per user license per 24h window.
- Concurrency limit: 20 simultaneous calls per org per app.
- Back off on 429 responses and retry with exponential delay.
