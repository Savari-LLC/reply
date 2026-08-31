import { createRemoteJWKSet, jwtVerify } from "jose";

import { env } from "./_generated/server";

const GOOGLE_JWKS = createRemoteJWKSet(new URL("https://www.googleapis.com/oauth2/v3/certs"));
const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const TOPIC_PATTERN = /^projects\/[a-z0-9][a-z0-9-]{4,28}[a-z0-9]\/(topics)\/[A-Za-z][A-Za-z0-9._~+%-]{2,254}$/;

type JsonRecord = Record<string, unknown>;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function configuredValue(value: string | undefined, name: string) {
  const configured = value?.trim();
  if (!configured) throw new Error(`${name} is not configured on this Convex deployment`);
  return configured;
}

function decodeBase64Url(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  return new TextDecoder().decode(Uint8Array.from(atob(padded), (character) => character.charCodeAt(0)));
}

export function gmailWebhookUrl() {
  return `${env.CONVEX_SITE_URL.replace(/\/$/, "")}/mail/webhooks/gmail`;
}

export function gmailPushConfiguration() {
  const topicName = configuredValue(env.MAIL_GOOGLE_PUBSUB_TOPIC, "MAIL_GOOGLE_PUBSUB_TOPIC");
  if (!TOPIC_PATTERN.test(topicName)) {
    throw new Error("MAIL_GOOGLE_PUBSUB_TOPIC must use projects/{project}/topics/{topic}");
  }
  return {
    topicName,
    serviceAccount: configuredValue(
      env.MAIL_GOOGLE_PUBSUB_SERVICE_ACCOUNT,
      "MAIL_GOOGLE_PUBSUB_SERVICE_ACCOUNT",
    ).toLowerCase(),
  };
}

export function assertGmailPushClaims(
  payload: { email?: unknown; email_verified?: unknown },
  expectedServiceAccount: string,
) {
  if (
    typeof payload.email !== "string" ||
    payload.email.toLowerCase() !== expectedServiceAccount.toLowerCase() ||
    (payload.email_verified !== true && payload.email_verified !== "true")
  ) {
    throw new Error("Gmail webhook is unauthorized");
  }
}

export async function verifyGmailPushRequest(request: Request) {
  const authorization = request.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    throw new Error("Gmail webhook is unauthorized");
  }
  const configuration = gmailPushConfiguration();
  const { payload } = await jwtVerify(authorization.slice(7), GOOGLE_JWKS, {
    algorithms: ["RS256"],
    audience: gmailWebhookUrl(),
    issuer: ["https://accounts.google.com", "accounts.google.com"],
  });
  assertGmailPushClaims(
    payload as { email?: unknown; email_verified?: unknown },
    configuration.serviceAccount,
  );
}

export function parseGmailPushPayload(value: unknown) {
  if (!isRecord(value) || !isRecord(value.message) || typeof value.message.data !== "string") {
    throw new Error("The provider returned an invalid Gmail notification");
  }
  let decoded: unknown;
  try {
    decoded = JSON.parse(decodeBase64Url(value.message.data));
  } catch {
    throw new Error("The provider returned an invalid Gmail notification");
  }
  if (
    !isRecord(decoded) ||
    typeof decoded.emailAddress !== "string" ||
    decoded.emailAddress.length > 254 ||
    !EMAIL_PATTERN.test(decoded.emailAddress) ||
    typeof decoded.historyId !== "string" ||
    !/^\d{1,30}$/.test(decoded.historyId)
  ) {
    throw new Error("The provider returned an invalid Gmail notification");
  }
  return {
    emailAddress: decoded.emailAddress.toLowerCase(),
    historyId: decoded.historyId,
  };
}

export function gmailWatchRequest(topicName: string) {
  return {
    topicName,
    labelIds: ["INBOX"],
    labelFilterBehavior: "include",
  };
}

export async function registerGmailWatch(accessToken: string) {
  const { topicName } = gmailPushConfiguration();
  const response = await fetch("https://gmail.googleapis.com/gmail/v1/users/me/watch", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(gmailWatchRequest(topicName)),
  });
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const message =
      isRecord(payload) && isRecord(payload.error) && typeof payload.error.message === "string"
        ? payload.error.message
        : `Gmail watch request failed with status ${response.status}`;
    throw new Error(message);
  }
  if (
    !isRecord(payload) ||
    typeof payload.historyId !== "string" ||
    !/^\d{1,30}$/.test(payload.historyId) ||
    !Number.isFinite(Number(payload.expiration))
  ) {
    throw new Error("Gmail watch returned an invalid response");
  }
  return {
    historyId: payload.historyId,
    expirationAt: Number(payload.expiration),
  };
}
