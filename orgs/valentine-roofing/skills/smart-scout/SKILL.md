---
name: smart-scout-valentine-roofing
description: |
  Process D4$ property/contact records for Valentine Roofing. Receives parsed
  CSV data from the resend-webhook hook and executes: CRM contact creation,
  mailer dispatch, and Apollo sequence enrollment.
compatibility: Requires CRM, mailer, and Apollo API access (not yet implemented).
metadata:
  author: opsrev
  version: "0.1"
  org: valentine-roofing
  status: stub
  clawdbot:
    emoji: "🏠"
---

# Smart Scout — Valentine Roofing

Process Driving For Dollars (D4$) property records into actionable sales pipeline steps.

## Status

**Stub** — this skill defines the interface and intended workflow. Implementation
of CRM, mailer, and Apollo integrations is pending.

## Input

Smart Scout receives an array of property/contact records (parsed from a D4$ CSV
by the `resend-webhook` hook). Each record contains:

### Property

| Field | Example |
|---|---|
| `property_address` | `1953 E Blaine St` |
| `property_city` | `Seattle` |
| `property_state` | `WA` |
| `property_zip` | `98112` |
| `year_built` | `1926` |
| `house_sqft` | `1230` |
| `lot_sqft` | `3204` |
| `bedrooms` | `2` |
| `bathrooms` | (may be empty) |
| `last_sale_date` | `1977-09-13` |
| `last_sale_price` | `60900.0` |
| `mortgage_amount` | `46000.00` |
| `owner_occupied` | (flag) |
| `zoning_code` | `NR3` |

### Owner / Contact

| Field | Example |
|---|---|
| `primary_owner_first_name` | `Allan` |
| `primary_owner_last_name` | `Seidenverg` |
| `secondary_owner_first_name` | (nullable) |
| `secondary_owner_last_name` | (nullable) |
| `mailing_address` / `mailing_city` / `mailing_state` / `mailing_zip` | Mailing address |
| `phone_1` … `phone_5` | Phone numbers with `phone_N_type` (land_line, mobile) |
| `email_1` … `email_5` | Email addresses |
| `alt_address_1` … `alt_address_3` (+ city/state/zip) | Alternative addresses |
| `age` | Owner age |
| `bankruptcy` | `Yes` / `No` / `Unknown` |

## Intended workflow

For each record the skill should:

1. **Add to CRM** — Create or update the property and owner contact in the CRM.
2. **Send mailer** — Trigger a physical mailer to the property or mailing address.
3. **Start Apollo sequence** — Enroll the contact in the appropriate Apollo
   outreach sequence using available phone numbers and emails.

## Future work

- [ ] CRM integration (create/upsert contacts and properties)
- [ ] Mailer dispatch (select template, send to mailing address)
- [ ] Apollo sequence enrollment (match sequence by campaign, enroll contact)
- [ ] Deduplication (skip records already in CRM)
- [ ] Status reporting (summarize processed / skipped / errored records)
