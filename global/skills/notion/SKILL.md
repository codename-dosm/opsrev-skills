---
name: notion-workspace-opsrev
description: |
  Notion API integration through the OpsRev managed OAuth gateway. Read, query, create, and update Notion pages, databases, blocks, and comments by proxying native Notion API routes. Use this skill when users ask to work with Notion content.
compatibility: Requires network access and configured OpsRev connector env vars in the bot runtime.
metadata:
  author: opsrev
  version: "2.0"
  clawdbot:
    emoji: "🧠"
    requires:
      env:
        - OPSREV_CONNECTOR_URL
        - OPSREV_BOT_ID
        - OPSREV_ORG_ID
---

# Notion via OpsRev OAuth Gateway

Use the OpsRev connector proxy to call native Notion API routes with managed OAuth.

## Base URL

```
$OPSREV_CONNECTOR_URL/api/v1/notion/{native-notion-path}
```

Examples:
- `search`
- `pages/{page_id}`
- `databases/{database_id}/query`
- `blocks/{block_id}/children`
- `comments`

## Required Headers

Always include:
- `X-Bot-Id: $OPSREV_BOT_ID`
- `X-Org-Id: $OPSREV_ORG_ID`
- `Content-Type: application/json` (for POST/PATCH)

Optional:
- `X-User-Id: <opsrev_user_uuid>` to force user-scoped tokens. If omitted, proxy falls back to org-scoped connection.

## Quick Connectivity Check

Run this first when user asks to verify Notion connectivity.

```bash
python <<'PY'
import json, os, urllib.request

base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
url = f"{base}/api/v1/notion/search"
body = json.dumps({
  "query": "",
  "page_size": 1,
  "filter": {"value": "page", "property": "object"}
}).encode('utf-8')

req = urllib.request.Request(url, data=body, method='POST')
req.add_header('Content-Type', 'application/json')
req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])

with urllib.request.urlopen(req) as res:
  print(json.dumps(json.load(res), indent=2))
PY
```

## Native Route Patterns

### Search

```bash
POST /search
```

Body example:

```json
{
  "query": "Q1 pipeline",
  "page_size": 20
}
```

### Get Page

```bash
GET /pages/{page_id}
```

### Get Page Content (block children)

```bash
GET /blocks/{block_id}/children?page_size=100
```

### Query Database

```bash
POST /databases/{database_id}/query
```

### Create Page

```bash
POST /pages
Content-Type: application/json
```

### Update Page

```bash
PATCH /pages/{page_id}
Content-Type: application/json
```

### Append Blocks

```bash
POST /blocks/{block_id}/children
Content-Type: application/json
```

### Update Block

```bash
PATCH /blocks/{block_id}
Content-Type: application/json
```

### Delete Block

```bash
DELETE /blocks/{block_id}
```

### Create Database

```bash
POST /databases
Content-Type: application/json
```

### Comments

```bash
GET /comments?block_id={page_or_block_id}
POST /comments
```

## Working Rules

1. Use native Notion request/response shapes. Do not invent schema fields.
2. For writes, fetch current object first when possible.
3. Return answer first, then include object IDs/URLs changed.
4. If proxy returns connection/auth errors, state exact error and instruct user to reconnect Notion in OpsRev Connectors.
5. Keep outputs concise and decision-oriented.

## Error Semantics

- `403` usually means no usable connector token (not connected, expired, or missing access token).
- `400/404/409` are typically native Notion API validation/resource errors.
- Proxy wraps successful responses as `{ "data": ... }`.

## Useful Generic Python Helper

```bash
python <<'PY'
import json, os, urllib.request

def call(method, path, payload=None):
  base = os.environ['OPSREV_CONNECTOR_URL'].rstrip('/')
  url = f"{base}/api/v1/notion/{path.lstrip('/')}"
  body = None if payload is None else json.dumps(payload).encode('utf-8')
  req = urllib.request.Request(url, data=body, method=method)
  req.add_header('X-Bot-Id', os.environ['OPSREV_BOT_ID'])
  req.add_header('X-Org-Id', os.environ['OPSREV_ORG_ID'])
  if payload is not None:
    req.add_header('Content-Type', 'application/json')
  with urllib.request.urlopen(req) as res:
    return json.load(res)

print(json.dumps(call('POST', 'search', {'query': '', 'page_size': 3}), indent=2))
PY
```
