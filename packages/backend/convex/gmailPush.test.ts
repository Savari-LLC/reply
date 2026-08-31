import { describe, expect, test } from "vitest";

import {
  assertGmailPushClaims,
  gmailWatchRequest,
  parseGmailPushPayload,
} from "./gmailPush";

function encodePayload(value: unknown) {
  return btoa(JSON.stringify(value)).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

describe("Gmail push notifications", () => {
  test("registers an inbox-only watch using Gmail's documented enum casing", () => {
    expect(gmailWatchRequest("projects/reply-demo/topics/reply-gmail")).toEqual({
      topicName: "projects/reply-demo/topics/reply-gmail",
      labelIds: ["INBOX"],
      labelFilterBehavior: "include",
    });
  });

  test("decodes the Pub/Sub envelope without trusting unrelated fields", () => {
    expect(
      parseGmailPushPayload({
        message: {
          data: encodePayload({
            emailAddress: "Owner@Example.com",
            historyId: "9876543210",
          }),
          messageId: "pubsub-message-1",
        },
        subscription: "projects/reply/subscriptions/gmail-push",
      }),
    ).toEqual({
      emailAddress: "owner@example.com",
      historyId: "9876543210",
    });
  });

  test("rejects malformed notification envelopes", () => {
    expect(() => parseGmailPushPayload({ message: {} })).toThrow("invalid Gmail notification");
    expect(() =>
      parseGmailPushPayload({
        message: {
          data: encodePayload({ emailAddress: "not-an-email", historyId: "123" }),
        },
      }),
    ).toThrow("invalid Gmail notification");
    expect(() =>
      parseGmailPushPayload({
        message: {
          data: encodePayload({ emailAddress: "owner@example.com", historyId: "not-numeric" }),
        },
      }),
    ).toThrow("invalid Gmail notification");
  });

  test("accepts only the configured verified Pub/Sub service account", () => {
    expect(() =>
      assertGmailPushClaims(
        { email: "gmail-push@example-project.iam.gserviceaccount.com", email_verified: true },
        "gmail-push@example-project.iam.gserviceaccount.com",
      ),
    ).not.toThrow();
    expect(() =>
      assertGmailPushClaims(
        { email: "attacker@example.com", email_verified: true },
        "gmail-push@example-project.iam.gserviceaccount.com",
      ),
    ).toThrow("unauthorized");
    expect(() =>
      assertGmailPushClaims(
        { email: "gmail-push@example-project.iam.gserviceaccount.com", email_verified: false },
        "gmail-push@example-project.iam.gserviceaccount.com",
      ),
    ).toThrow("unauthorized");
  });
});
