import { env } from "./_generated/server";

export type MailProvider = "gmail" | "outlook";

export type ProviderTokenSet = {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
  scope: string;
};

export type ProviderProfile = {
  id: string;
  emailAddress: string;
  displayName: string;
};

export type ImportedMessage = {
  externalMessageId: string;
  direction: "inbound" | "outbound";
  senderName: string;
  senderEmail: string;
  body: string;
  sentAt: number;
};

export type ImportedThread = {
  externalThreadId: string;
  subject: string;
  senderName: string;
  senderEmail: string;
  lastMessageAt: number;
  unread: boolean;
  messages: ImportedMessage[];
};

type ProviderConfiguration = {
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  scope: string;
};

type JsonRecord = Record<string, unknown>;

const GMAIL_SCOPE = "https://www.googleapis.com/auth/gmail.readonly";
const OUTLOOK_SCOPE = "offline_access User.Read Mail.Read";
const MAX_BODY_LENGTH = 200_000;

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function requiredString(value: unknown, label: string) {
  if (typeof value !== "string" || value.length === 0) {
    throw new Error(`The provider returned an invalid ${label}`);
  }
  return value;
}

function optionalString(value: unknown) {
  return typeof value === "string" && value.length > 0 ? value : undefined;
}

function configuredValue(value: string | undefined, name: string) {
  const configured = value?.trim();
  if (!configured) {
    throw new Error(`${name} is not configured on this Convex deployment`);
  }
  return configured;
}

export function providerConfiguration(provider: MailProvider): ProviderConfiguration {
  if (provider === "gmail") {
    return {
      clientId: configuredValue(env.MAIL_GOOGLE_CLIENT_ID, "MAIL_GOOGLE_CLIENT_ID"),
      clientSecret: configuredValue(env.MAIL_GOOGLE_CLIENT_SECRET, "MAIL_GOOGLE_CLIENT_SECRET"),
      authorizationUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      scope: GMAIL_SCOPE,
    };
  }
  return {
    clientId: configuredValue(env.MAIL_MICROSOFT_CLIENT_ID, "MAIL_MICROSOFT_CLIENT_ID"),
    clientSecret: configuredValue(env.MAIL_MICROSOFT_CLIENT_SECRET, "MAIL_MICROSOFT_CLIENT_SECRET"),
    authorizationUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/authorize",
    tokenUrl: "https://login.microsoftonline.com/common/oauth2/v2.0/token",
    scope: OUTLOOK_SCOPE,
  };
}

export function oauthCallbackUrl() {
  return `${env.CONVEX_SITE_URL.replace(/\/$/, "")}/mail/oauth/callback`;
}

export function appSettingsUrl(status: "connected" | "error", message?: string) {
  const url = new URL("/settings", env.APP_URL);
  url.searchParams.set("section", "inboxes");
  url.searchParams.set("mail", status);
  if (message) url.searchParams.set("mailMessage", message.slice(0, 160));
  return url.toString();
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = "";
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

function base64UrlToBytes(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  const padded = normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "=");
  const binary = atob(padded);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function toArrayBuffer(bytes: Uint8Array) {
  const buffer = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(buffer).set(bytes);
  return buffer;
}

function encryptionKeyBytes() {
  const encoded = configuredValue(env.MAIL_TOKEN_ENCRYPTION_KEY, "MAIL_TOKEN_ENCRYPTION_KEY");
  let bytes: Uint8Array;
  try {
    bytes = base64UrlToBytes(encoded);
  } catch {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY must be a base64-encoded 32-byte key");
  }
  if (bytes.byteLength !== 32) {
    throw new Error("MAIL_TOKEN_ENCRYPTION_KEY must decode to exactly 32 bytes");
  }
  return toArrayBuffer(bytes);
}

export function randomToken(byteLength = 32) {
  const bytes = new Uint8Array(byteLength);
  crypto.getRandomValues(bytes);
  return bytesToBase64Url(bytes);
}

export async function hashToken(value: string) {
  const digest = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return bytesToBase64Url(new Uint8Array(digest));
}

export async function pkceChallenge(verifier: string) {
  return await hashToken(verifier);
}

export async function encryptSecret(value: string) {
  const iv = new Uint8Array(12);
  crypto.getRandomValues(iv);
  const key = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    { name: "AES-GCM" },
    false,
    ["encrypt"],
  );
  const encrypted = await crypto.subtle.encrypt(
    { name: "AES-GCM", iv },
    key,
    new TextEncoder().encode(value),
  );
  return `v1.${bytesToBase64Url(iv)}.${bytesToBase64Url(new Uint8Array(encrypted))}`;
}

export async function decryptSecret(value: string) {
  const [version, encodedIv, encodedCiphertext] = value.split(".");
  if (version !== "v1" || !encodedIv || !encodedCiphertext) {
    throw new Error("Stored mailbox credentials are invalid");
  }
  const key = await crypto.subtle.importKey(
    "raw",
    encryptionKeyBytes(),
    { name: "AES-GCM" },
    false,
    ["decrypt"],
  );
  try {
    const decrypted = await crypto.subtle.decrypt(
      { name: "AES-GCM", iv: toArrayBuffer(base64UrlToBytes(encodedIv)) },
      key,
      toArrayBuffer(base64UrlToBytes(encodedCiphertext)),
    );
    return new TextDecoder().decode(decrypted);
  } catch {
    throw new Error("Stored mailbox credentials could not be decrypted");
  }
}

export function authorizationUrl(
  provider: MailProvider,
  state: string,
  challenge: string,
) {
  const configuration = providerConfiguration(provider);
  const url = new URL(configuration.authorizationUrl);
  url.searchParams.set("client_id", configuration.clientId);
  url.searchParams.set("redirect_uri", oauthCallbackUrl());
  url.searchParams.set("response_type", "code");
  url.searchParams.set("scope", configuration.scope);
  url.searchParams.set("state", state);
  url.searchParams.set("code_challenge", challenge);
  url.searchParams.set("code_challenge_method", "S256");
  if (provider === "gmail") {
    url.searchParams.set("access_type", "offline");
    url.searchParams.set("prompt", "consent");
    url.searchParams.set("include_granted_scopes", "true");
  } else {
    url.searchParams.set("response_mode", "query");
  }
  return url.toString();
}

async function fetchJson(url: string, init: RequestInit, label: string): Promise<JsonRecord> {
  const response = await fetch(url, init);
  const payload: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const description = isRecord(payload)
      ? optionalString(payload.error_description) ??
        (isRecord(payload.error) ? optionalString(payload.error.message) : undefined)
      : undefined;
    throw new Error(description ?? `${label} failed with status ${response.status}`);
  }
  if (!isRecord(payload)) throw new Error(`${label} returned an invalid response`);
  return payload;
}

function parseTokenSet(payload: JsonRecord, fallbackScope: string): ProviderTokenSet {
  const expiresIn = Number(payload.expires_in);
  return {
    accessToken: requiredString(payload.access_token, "access token"),
    refreshToken: optionalString(payload.refresh_token),
    expiresAt: Date.now() + (Number.isFinite(expiresIn) ? expiresIn : 3600) * 1000,
    scope: optionalString(payload.scope) ?? fallbackScope,
  };
}

export async function exchangeAuthorizationCode(
  provider: MailProvider,
  code: string,
  verifier: string,
) {
  const configuration = providerConfiguration(provider);
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    code,
    code_verifier: verifier,
    grant_type: "authorization_code",
    redirect_uri: oauthCallbackUrl(),
  });
  if (provider === "outlook") body.set("scope", configuration.scope);
  const payload = await fetchJson(
    configuration.tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    `${provider === "gmail" ? "Google" : "Microsoft"} token exchange`,
  );
  return parseTokenSet(payload, configuration.scope);
}

export async function refreshAccessToken(provider: MailProvider, refreshToken: string) {
  const configuration = providerConfiguration(provider);
  const body = new URLSearchParams({
    client_id: configuration.clientId,
    client_secret: configuration.clientSecret,
    refresh_token: refreshToken,
    grant_type: "refresh_token",
  });
  if (provider === "outlook") body.set("scope", configuration.scope);
  const payload = await fetchJson(
    configuration.tokenUrl,
    {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body,
    },
    `${provider === "gmail" ? "Google" : "Microsoft"} token refresh`,
  );
  return parseTokenSet(payload, configuration.scope);
}

function bearerHeaders(accessToken: string) {
  return { Authorization: `Bearer ${accessToken}`, Accept: "application/json" };
}

export async function fetchProviderProfile(provider: MailProvider, accessToken: string) {
  if (provider === "gmail") {
    const payload = await fetchJson(
      "https://gmail.googleapis.com/gmail/v1/users/me/profile",
      { headers: bearerHeaders(accessToken) },
      "Gmail profile request",
    );
    const emailAddress = requiredString(payload.emailAddress, "email address").toLowerCase();
    return { id: emailAddress, emailAddress, displayName: emailAddress };
  }
  const payload = await fetchJson(
    "https://graph.microsoft.com/v1.0/me?$select=id,displayName,mail,userPrincipalName",
    { headers: bearerHeaders(accessToken) },
    "Microsoft profile request",
  );
  const emailAddress = (
    optionalString(payload.mail) ?? requiredString(payload.userPrincipalName, "email address")
  ).toLowerCase();
  return {
    id: requiredString(payload.id, "account ID"),
    emailAddress,
    displayName: optionalString(payload.displayName) ?? emailAddress,
  };
}

function decodeGmailBody(value: string) {
  try {
    return new TextDecoder().decode(base64UrlToBytes(value));
  } catch {
    return "";
  }
}

function htmlToText(value: string) {
  return value
    .replace(/<(script|style)[^>]*>[\s\S]*?<\/\1>/gi, " ")
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/p>/gi, "\n\n")
    .replace(/<[^>]+>/g, " ")
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function gmailHeader(payload: JsonRecord | undefined, name: string) {
  const headers = payload?.headers;
  if (!Array.isArray(headers)) return "";
  const header = headers.find(
    (candidate) =>
      isRecord(candidate) &&
      typeof candidate.name === "string" &&
      candidate.name.toLowerCase() === name.toLowerCase(),
  );
  return isRecord(header) ? optionalString(header.value) ?? "" : "";
}

function gmailPartBody(part: JsonRecord, preferredMimeType: string): string | undefined {
  if (part.mimeType === preferredMimeType && isRecord(part.body)) {
    const data = optionalString(part.body.data);
    if (data) return decodeGmailBody(data);
  }
  if (Array.isArray(part.parts)) {
    for (const child of part.parts) {
      if (!isRecord(child)) continue;
      const body = gmailPartBody(child, preferredMimeType);
      if (body) return body;
    }
  }
  return undefined;
}

function gmailMessageBody(message: JsonRecord) {
  const payload = isRecord(message.payload) ? message.payload : undefined;
  if (!payload) return optionalString(message.snippet) ?? "";
  const plain = gmailPartBody(payload, "text/plain");
  if (plain) return plain.trim().slice(0, MAX_BODY_LENGTH);
  const html = gmailPartBody(payload, "text/html");
  if (html) return htmlToText(html).slice(0, MAX_BODY_LENGTH);
  if (isRecord(payload.body)) {
    const direct = optionalString(payload.body.data);
    if (direct) {
      const decoded = decodeGmailBody(direct);
      return (payload.mimeType === "text/html" ? htmlToText(decoded) : decoded)
        .trim()
        .slice(0, MAX_BODY_LENGTH);
    }
  }
  return (optionalString(message.snippet) ?? "").slice(0, MAX_BODY_LENGTH);
}

function parseMailbox(value: string) {
  const angleAddress = value.match(/<([^<>\s]+@[^<>\s]+)>/);
  const plainAddress = value.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
  const address = (angleAddress?.[1] ?? plainAddress?.[0] ?? "").toLowerCase();
  const rawName = angleAddress ? value.slice(0, angleAddress.index).trim() : "";
  const name = rawName.replace(/^['"]|['"]$/g, "").trim() || address || "Unknown sender";
  return { name, address };
}

export function parseGmailThread(thread: JsonRecord, accountEmail: string): ImportedThread | null {
  if (!Array.isArray(thread.messages)) return null;
  const messages: ImportedMessage[] = [];
  let unread = false;
  for (const value of thread.messages.slice(-100)) {
    if (!isRecord(value)) continue;
    const payload = isRecord(value.payload) ? value.payload : undefined;
    const from = parseMailbox(gmailHeader(payload, "From"));
    const sentAt = Number(value.internalDate);
    const direction = from.address === accountEmail ? "outbound" : "inbound";
    if (direction === "inbound" && Array.isArray(value.labelIds) && value.labelIds.includes("UNREAD")) {
      unread = true;
    }
    messages.push({
      externalMessageId: `gmail:${requiredString(value.id, "Gmail message ID")}`,
      direction,
      senderName: from.name,
      senderEmail: from.address,
      body: gmailMessageBody(value),
      sentAt: Number.isFinite(sentAt) ? sentAt : Date.now(),
    });
  }
  messages.sort((left, right) => left.sentAt - right.sentAt);
  const lastMessage = messages[messages.length - 1];
  if (!lastMessage) return null;
  const customer = [...messages].reverse().find((message) => message.direction === "inbound") ?? lastMessage;
  const firstPayload = isRecord(thread.messages[0]) && isRecord(thread.messages[0].payload)
    ? thread.messages[0].payload
    : undefined;
  return {
    externalThreadId: `gmail:${requiredString(thread.id, "Gmail thread ID")}`,
    subject: gmailHeader(firstPayload, "Subject") || "(no subject)",
    senderName: customer.senderName,
    senderEmail: customer.senderEmail,
    lastMessageAt: lastMessage.sentAt,
    unread,
    messages,
  };
}

async function fetchGmailThreads(accessToken: string, accountEmail: string) {
  const listUrl = new URL("https://gmail.googleapis.com/gmail/v1/users/me/threads");
  listUrl.searchParams.set("maxResults", "25");
  listUrl.searchParams.set("q", "-in:spam -in:trash");
  const list = await fetchJson(
    listUrl.toString(),
    { headers: bearerHeaders(accessToken) },
    "Gmail thread list",
  );
  if (!Array.isArray(list.threads)) return [];
  const imported: ImportedThread[] = [];
  for (const row of list.threads) {
    if (!isRecord(row) || typeof row.id !== "string") continue;
    const thread = await fetchJson(
      `https://gmail.googleapis.com/gmail/v1/users/me/threads/${encodeURIComponent(row.id)}?format=full`,
      { headers: bearerHeaders(accessToken) },
      "Gmail thread request",
    );
    const normalized = parseGmailThread(thread, accountEmail);
    if (normalized) imported.push(normalized);
  }
  return imported;
}

function outlookAddress(value: unknown) {
  if (!isRecord(value) || !isRecord(value.emailAddress)) {
    return { name: "Unknown sender", address: "" };
  }
  const address = (optionalString(value.emailAddress.address) ?? "").toLowerCase();
  return {
    address,
    name: optionalString(value.emailAddress.name) ?? (address || "Unknown sender"),
  };
}

function outlookBody(message: JsonRecord) {
  if (!isRecord(message.body)) return optionalString(message.bodyPreview) ?? "";
  const content = optionalString(message.body.content) ?? optionalString(message.bodyPreview) ?? "";
  return (message.body.contentType === "html" || message.body.contentType === "HTML"
    ? htmlToText(content)
    : content
  ).slice(0, MAX_BODY_LENGTH);
}

export function parseOutlookThreads(values: unknown[], accountEmail: string) {
  const groups = new Map<string, JsonRecord[]>();
  for (const value of values) {
    if (!isRecord(value) || value.isDraft === true) continue;
    const id = optionalString(value.id);
    if (!id) continue;
    const conversationId = optionalString(value.conversationId) ?? id;
    const group = groups.get(conversationId) ?? [];
    group.push(value);
    groups.set(conversationId, group);
  }
  const threads: ImportedThread[] = [];
  for (const [conversationId, group] of groups) {
    const messages = group
      .map((message): ImportedMessage | null => {
        const id = optionalString(message.id);
        if (!id) return null;
        const from = outlookAddress(message.from);
        const sentAt = Date.parse(
          optionalString(message.sentDateTime) ?? optionalString(message.receivedDateTime) ?? "",
        );
        return {
          externalMessageId: `outlook:${id}`,
          direction: from.address === accountEmail ? "outbound" : "inbound",
          senderName: from.name,
          senderEmail: from.address,
          body: outlookBody(message),
          sentAt: Number.isFinite(sentAt) ? sentAt : Date.now(),
        };
      })
      .filter((message): message is ImportedMessage => message !== null)
      .sort((left, right) => left.sentAt - right.sentAt);
    const lastMessage = messages[messages.length - 1];
    if (!lastMessage) continue;
    const customer = [...messages].reverse().find((message) => message.direction === "inbound") ?? lastMessage;
    const unread = group.some((message) => {
      const from = outlookAddress(message.from);
      return from.address !== accountEmail && message.isRead === false;
    });
    threads.push({
      externalThreadId: `outlook:${conversationId}`,
      subject: optionalString(group[group.length - 1]?.subject) ?? "(no subject)",
      senderName: customer.senderName,
      senderEmail: customer.senderEmail,
      lastMessageAt: lastMessage.sentAt,
      unread,
      messages,
    });
  }
  return threads.sort((left, right) => right.lastMessageAt - left.lastMessageAt).slice(0, 25);
}

async function fetchOutlookThreads(accessToken: string, accountEmail: string) {
  const url = new URL("https://graph.microsoft.com/v1.0/me/messages");
  url.searchParams.set(
    "$select",
    "id,conversationId,subject,bodyPreview,body,from,toRecipients,sentDateTime,receivedDateTime,isRead,isDraft",
  );
  url.searchParams.set("$orderby", "receivedDateTime desc");
  url.searchParams.set("$top", "75");
  const payload = await fetchJson(
    url.toString(),
    {
      headers: {
        ...bearerHeaders(accessToken),
        Prefer: 'IdType="ImmutableId", outlook.body-content-type="text"',
      },
    },
    "Microsoft message list",
  );
  return parseOutlookThreads(Array.isArray(payload.value) ? payload.value : [], accountEmail);
}

export async function fetchMailboxThreads(
  provider: MailProvider,
  accessToken: string,
  accountEmail: string,
) {
  return provider === "gmail"
    ? await fetchGmailThreads(accessToken, accountEmail.toLowerCase())
    : await fetchOutlookThreads(accessToken, accountEmail.toLowerCase());
}
