/**
 * Resend inbound-email webhook transform — Valentine Roofing.
 *
 * Handles Driving For Dollars (D4$) CSV exports arriving via Resend
 * email.received webhooks. Downloads the CSV attachment, parses the
 * tab-delimited property/contact records, and hands structured data
 * to the Smart Scout skill for CRM ingestion, mailer, and Apollo sequence.
 *
 * Exported function: transformResendWebhook(payload, headers)
 *
 * Environment variables:
 *   RESEND_API_KEY          – required, for attachment download
 *   RESEND_WEBHOOK_SECRET   – optional, Svix signing secret for verification
 */

const https = require("https");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

const SESSION_KEY = "hook:valentine-roofing:d4s-inbound";

// ---------------------------------------------------------------------------
// Svix signature verification (optional)
// ---------------------------------------------------------------------------

function verifySvixSignature(payload, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return;

  const msgId = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];

  if (!msgId || !timestamp || !signature) {
    throw new Error("Missing svix signature headers");
  }

  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const toSign = `${msgId}.${timestamp}.${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
  const secretBytes = Buffer.from(secret.replace(/^whsec_/, ""), "base64");
  const expected = crypto
    .createHmac("sha256", secretBytes)
    .update(toSign)
    .digest("base64");

  const valid = signature
    .split(" ")
    .some((sig) => sig.replace(/^v1,/, "") === expected);

  if (!valid) {
    throw new Error("Invalid svix signature");
  }
}

// ---------------------------------------------------------------------------
// HTTP helpers
// ---------------------------------------------------------------------------

function resendGet(path) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) return Promise.resolve(null);

  return new Promise((resolve, reject) => {
    const req = https.request(
      {
        hostname: "api.resend.com",
        path,
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
      },
      (res) => {
        let body = "";
        res.on("data", (chunk) => (body += chunk));
        res.on("end", () => {
          if (res.statusCode >= 200 && res.statusCode < 300) {
            try {
              resolve(JSON.parse(body));
            } catch {
              resolve(body);
            }
          } else {
            reject(new Error(`Resend API ${res.statusCode}: ${body}`));
          }
        });
      }
    );
    req.on("error", reject);
    req.end();
  });
}

function httpGet(url) {
  return new Promise((resolve, reject) => {
    https.get(url, (res) => {
      let body = "";
      res.on("data", (chunk) => (body += chunk));
      res.on("end", () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(body);
        } else {
          reject(new Error(`HTTP ${res.statusCode}: ${body}`));
        }
      });
    }).on("error", reject);
  });
}

// ---------------------------------------------------------------------------
// Attachment download
// ---------------------------------------------------------------------------

async function fetchCsvAttachment(emailId, attachments) {
  const csvAtt = (attachments || []).find(
    (a) =>
      (a.content_type && a.content_type.includes("csv")) ||
      (a.filename && a.filename.toLowerCase().endsWith(".csv"))
  );
  if (!csvAtt) return null;

  const attList = await resendGet(`/emails/${emailId}/attachments`);
  if (!attList) return null;

  const items = Array.isArray(attList) ? attList : attList.data || [];
  const target = items.find((a) => a.id === csvAtt.id) || items[0];
  if (!target || !target.download_url) return null;

  return httpGet(target.download_url);
}

// ---------------------------------------------------------------------------
// TSV parser — maps D4$ column headers to snake_case keys
// ---------------------------------------------------------------------------

const FIELD_MAP = {
  "Property Address": "property_address",
  "City": "property_city",
  "State": "property_state",
  "Zip": "property_zip",
  "Primary Owner First Name": "primary_owner_first_name",
  "Primary Owner Last Name": "primary_owner_last_name",
  "Secondary Owner First Name": "secondary_owner_first_name",
  "Secondary Owner Last Name": "secondary_owner_last_name",
  "Mailing Address": "mailing_address",
  "Mailing City": "mailing_city",
  "Mailing State": "mailing_state",
  "Mailing Zip": "mailing_zip",
  "Phone 1": "phone_1",
  "Phone 1 Type": "phone_1_type",
  "Phone 2": "phone_2",
  "Phone 2 Type": "phone_2_type",
  "Phone 3": "phone_3",
  "Phone 3 Type": "phone_3_type",
  "Phone 4": "phone_4",
  "Phone 4 Type": "phone_4_type",
  "Phone 5": "phone_5",
  "Phone 5 Type": "phone_5_type",
  "Email 1": "email_1",
  "Email 2": "email_2",
  "Email 3": "email_3",
  "Email 4": "email_4",
  "Email 5": "email_5",
  "IP Address": "ip_address",
  "Owner Occupied Indicator": "owner_occupied",
  "Last Market Sale Date": "last_sale_date",
  "Last Market Sale Price": "last_sale_price",
  "House Year Built": "year_built",
  "House Sqft": "house_sqft",
  "Lot Sqft": "lot_sqft",
  "Bedrooms": "bedrooms",
  "Bathrooms": "bathrooms",
  "Mortgage Amount": "mortgage_amount",
  "Mortage Recording Date": "mortgage_recording_date",
  "Mortgage Interest Rate": "mortgage_interest_rate",
  "Mortgage Interest Rate Type": "mortgage_interest_rate_type",
  "Zoning Code": "zoning_code",
  "Zoning Code Desc": "zoning_code_desc",
  "Age": "age",
  "Bankruptcy (Y/N/U)": "bankruptcy",
  "Alt. Address 1": "alt_address_1",
  "Alt. Address 1 City": "alt_address_1_city",
  "Alt. Address 1 State": "alt_address_1_state",
  "Alt. Address 1 Zip": "alt_address_1_zip",
  "Alt. Address 2": "alt_address_2",
  "Alt. Address 2 City": "alt_address_2_city",
  "Alt. Address 2 State": "alt_address_2_state",
  "Alt. Address 2 Zip": "alt_address_2_zip",
  "Alt. Address 3": "alt_address_3",
  "Alt. Address 3 City": "alt_address_3_city",
  "Alt. Address 3 State": "alt_address_3_state",
  "Alt. Address 3 Zip": "alt_address_3_zip",
};

function parseTsv(raw) {
  const lines = raw.split(/\r?\n/).filter((l) => l.trim().length > 0);
  if (lines.length < 2) return [];

  const headers = lines[0].split("\t");
  const records = [];

  for (let i = 1; i < lines.length; i++) {
    const cols = lines[i].split("\t");
    const record = {};
    for (let j = 0; j < headers.length; j++) {
      const key = FIELD_MAP[headers[j]] || headers[j];
      const val = (cols[j] || "").trim();
      record[key] = val === "n/a" || val === "" ? null : val;
    }
    records.push(record);
  }

  return records;
}

// ---------------------------------------------------------------------------
// Prompt builder — formats parsed records for the Smart Scout skill
// ---------------------------------------------------------------------------

function buildSmartScoutPrompt(records, emailMeta) {
  const parts = [];

  parts.push("## D4$ CSV Import — Valentine Roofing\n");
  parts.push(
    `Received **${records.length}** property record(s) via Driving For Dollars export.`
  );
  parts.push(`**From:** ${emailMeta.from}`);
  parts.push(`**Subject:** ${emailMeta.subject}`);
  parts.push(`**Email ID:** ${emailMeta.email_id}\n`);
  parts.push(
    "Use the **Smart Scout** skill to process each record below. For every record:"
  );
  parts.push("1. Add the property address and owner contact to the CRM");
  parts.push("2. Send the mailer");
  parts.push("3. Start the Apollo sequence\n");
  parts.push("### Records\n");
  parts.push("```json");
  parts.push(JSON.stringify(records, null, 2));
  parts.push("```");

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Main transform (exported)
// ---------------------------------------------------------------------------

async function transformResendWebhook(payload, headers) {
  verifySvixSignature(payload, headers || {});

  const event = typeof payload === "string" ? JSON.parse(payload) : payload;

  if (event.type !== "email.received") {
    return null;
  }

  const data = event.data;
  if (!data || !data.email_id) {
    return null;
  }

  // Download and parse the CSV attachment (email body is ignored)
  let csvRaw = null;
  try {
    csvRaw = await fetchCsvAttachment(data.email_id, data.attachments);
  } catch (err) {
    console.error("[resend-transform] Failed to fetch CSV attachment:", err.message);
  }

  if (!csvRaw) {
    console.error("[resend-transform] No CSV attachment found in email", data.email_id);
    return null;
  }

  const records = parseTsv(csvRaw);
  if (records.length === 0) {
    console.error("[resend-transform] CSV parsed but contained no data rows");
    return null;
  }

  const message = buildSmartScoutPrompt(records, {
    from: data.from,
    subject: data.subject,
    email_id: data.email_id,
  });

  return {
    message,
    name: `D4$ Import (${records.length} records)`,
    sessionKey: SESSION_KEY,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { transformResendWebhook, parseTsv };

// ---------------------------------------------------------------------------
// CLI testing
// ---------------------------------------------------------------------------

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");

  const payloadPath = path.join(__dirname, "example-payload.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));

  if (!process.env.RESEND_API_KEY) {
    console.log("No RESEND_API_KEY — running with mock CSV data.\n");
    const mockCsv =
      "Property Address\tCity\tState\tZip\tPrimary Owner First Name\tPrimary Owner Last Name\n" +
      "1953 E Blaine St\tSeattle\tWA\t98112\tAllan\tSeidenverg\n" +
      "1941 E Blaine St\tSeattle\tWA\t98112\tJill\tDineen\n";
    const records = parseTsv(mockCsv);
    const message = buildSmartScoutPrompt(records, {
      from: payload.data.from,
      subject: payload.data.subject,
      email_id: payload.data.email_id,
    });
    console.log(
      JSON.stringify(
        { message, name: `D4$ Import (${records.length} records)`, sessionKey: SESSION_KEY },
        null,
        2
      )
    );
    process.exit(0);
  }

  transformResendWebhook(payload, {})
    .then((result) => {
      if (result) {
        console.log("Transform result:\n");
        console.log(JSON.stringify(result, null, 2));
      } else {
        console.log("Transform returned null (event ignored).");
      }
    })
    .catch((err) => {
      console.error("Transform error:", err);
      process.exit(1);
    });
}
