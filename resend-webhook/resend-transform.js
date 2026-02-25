/**
 * Resend inbound-email webhook transform for OpenClaw.
 *
 * Parses Resend "email.received" webhook events, fetches the full email body
 * via the Resend API, and returns a structured agent task prompt.
 *
 * Exported function: transformResendWebhook(payload, headers)
 *
 * Environment variables:
 *   RESEND_API_KEY          – Resend API key (required for body retrieval)
 *   RESEND_WEBHOOK_SECRET   – Svix signing secret (optional, for verification)
 */

const https = require("https");
const crypto = require("crypto");

// ---------------------------------------------------------------------------
// Configuration
// ---------------------------------------------------------------------------

/** Map a "to" address prefix to a sessionKey for agent routing. */
const ROUTING = {
  // "support": "hook:support",
  // "tasks":   "hook:tasks",
};

const DEFAULT_SESSION_KEY = "hook:resend-inbound";

// ---------------------------------------------------------------------------
// Svix signature verification (optional)
// ---------------------------------------------------------------------------

function verifySvixSignature(payload, headers) {
  const secret = process.env.RESEND_WEBHOOK_SECRET;
  if (!secret) return; // skip verification when secret is not configured

  const msgId = headers["svix-id"];
  const timestamp = headers["svix-timestamp"];
  const signature = headers["svix-signature"];

  if (!msgId || !timestamp || !signature) {
    throw new Error("Missing svix signature headers");
  }

  // Guard against replay attacks (5-minute tolerance)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - Number(timestamp)) > 300) {
    throw new Error("Webhook timestamp too old");
  }

  const toSign = `${msgId}.${timestamp}.${typeof payload === "string" ? payload : JSON.stringify(payload)}`;
  // Svix secrets are base64-encoded with a "whsec_" prefix
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
// Resend API helpers
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
              resolve(null);
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

async function fetchEmailContent(emailId) {
  return resendGet(`/emails/${emailId}`);
}

// ---------------------------------------------------------------------------
// Prompt builder
// ---------------------------------------------------------------------------

function buildTaskMessage(data, emailContent) {
  const parts = [];

  parts.push("## Inbound Email Received\n");
  parts.push(`**From:** ${data.from}`);
  parts.push(`**To:** ${(data.to || []).join(", ")}`);

  if (data.cc && data.cc.length > 0) {
    parts.push(`**CC:** ${data.cc.join(", ")}`);
  }

  parts.push(`**Subject:** ${data.subject || "(no subject)"}`);
  parts.push(`**Date:** ${data.created_at}`);
  parts.push(`**Email ID:** ${data.email_id}`);

  // Body from API
  if (emailContent) {
    const body = emailContent.text_body || emailContent.html_body || null;
    if (body) {
      parts.push("\n### Body\n");
      parts.push(body);
    }
  }

  // Attachment summary
  if (data.attachments && data.attachments.length > 0) {
    parts.push("\n### Attachments\n");
    for (const att of data.attachments) {
      parts.push(
        `- **${att.filename}** (${att.content_type}, id: ${att.id})`
      );
    }
    parts.push(
      "\nUse the Resend API to download attachments if needed:"
    );
    parts.push(
      `\`GET https://api.resend.com/emails/${data.email_id}/attachments\``
    );
  }

  parts.push(
    "\n---\nProcess this email and take appropriate action."
  );

  return parts.join("\n");
}

// ---------------------------------------------------------------------------
// Routing helper
// ---------------------------------------------------------------------------

function resolveSessionKey(toAddresses) {
  for (const addr of toAddresses || []) {
    const local = addr.split("@")[0].toLowerCase();
    if (ROUTING[local]) return ROUTING[local];
  }
  return DEFAULT_SESSION_KEY;
}

// ---------------------------------------------------------------------------
// Main transform (exported)
// ---------------------------------------------------------------------------

async function transformResendWebhook(payload, headers) {
  // Optional: verify Svix signature
  verifySvixSignature(payload, headers || {});

  // Normalise — payload may already be parsed or may be a string
  const event = typeof payload === "string" ? JSON.parse(payload) : payload;

  // Only handle email.received events
  if (event.type !== "email.received") {
    return null; // returning null tells OpenClaw to ignore this event
  }

  const data = event.data;
  if (!data || !data.email_id) {
    return null;
  }

  // Fetch full email content (body) from Resend API
  let emailContent = null;
  try {
    emailContent = await fetchEmailContent(data.email_id);
  } catch (err) {
    console.error("[resend-transform] Failed to fetch email body:", err.message);
    // Continue without body — the agent still gets metadata
  }

  const message = buildTaskMessage(data, emailContent);
  const sessionKey = resolveSessionKey(data.to);

  return {
    message,
    name: `Email from ${data.from}`,
    sessionKey,
  };
}

// ---------------------------------------------------------------------------
// Exports
// ---------------------------------------------------------------------------

module.exports = { transformResendWebhook };

// ---------------------------------------------------------------------------
// CLI testing
// ---------------------------------------------------------------------------

if (require.main === module) {
  const fs = require("fs");
  const path = require("path");

  const payloadPath = path.join(__dirname, "example-payload.json");
  const payload = JSON.parse(fs.readFileSync(payloadPath, "utf-8"));

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
