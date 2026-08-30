import { describe, expect, test } from "vitest";

import { parseGmailThread, parseOutlookThreads } from "./mailProvider";

function base64Url(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replace(/=+$/g, "");
}

describe("mail provider normalization", () => {
  test("normalizes Gmail headers, body, direction, and unread state", () => {
    const thread = parseGmailThread(
      {
        id: "thread-1",
        messages: [
          {
            id: "message-1",
            internalDate: "1000",
            labelIds: ["INBOX", "UNREAD"],
            payload: {
              mimeType: "text/plain",
              headers: [
                { name: "From", value: '"Acme Customer" <customer@acme.test>' },
                { name: "Subject", value: "A Gmail question" },
              ],
              body: { data: base64Url("Hello from Gmail") },
            },
          },
        ],
      },
      "owner@example.com",
    );

    expect(thread).toMatchObject({
      externalThreadId: "gmail:thread-1",
      subject: "A Gmail question",
      senderName: "Acme Customer",
      senderEmail: "customer@acme.test",
      unread: true,
      messages: [
        {
          externalMessageId: "gmail:message-1",
          direction: "inbound",
          body: "Hello from Gmail",
          sentAt: 1000,
        },
      ],
    });
  });

  test("groups Outlook messages by conversation and strips HTML bodies", () => {
    const threads = parseOutlookThreads(
      [
        {
          id: "message-2",
          conversationId: "conversation-1",
          subject: "Re: Outlook question",
          from: { emailAddress: { address: "owner@example.com", name: "Owner" } },
          body: { contentType: "text", content: "Thanks, we are checking." },
          sentDateTime: "2026-08-30T10:01:00.000Z",
          receivedDateTime: "2026-08-30T10:01:00.000Z",
          isRead: true,
          isDraft: false,
        },
        {
          id: "message-1",
          conversationId: "conversation-1",
          subject: "Outlook question",
          from: { emailAddress: { address: "customer@acme.test", name: "Acme Customer" } },
          body: { contentType: "HTML", content: "<p>Hello from <strong>Outlook</strong></p>" },
          sentDateTime: "2026-08-30T10:00:00.000Z",
          receivedDateTime: "2026-08-30T10:00:00.000Z",
          isRead: false,
          isDraft: false,
        },
      ],
      "owner@example.com",
    );

    expect(threads).toHaveLength(1);
    expect(threads[0]).toMatchObject({
      externalThreadId: "outlook:conversation-1",
      senderName: "Acme Customer",
      senderEmail: "customer@acme.test",
      unread: true,
      messages: [
        {
          externalMessageId: "outlook:message-1",
          direction: "inbound",
          body: "Hello from Outlook",
        },
        {
          externalMessageId: "outlook:message-2",
          direction: "outbound",
        },
      ],
    });
  });
});
