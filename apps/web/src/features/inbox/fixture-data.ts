/**
 * Single source of seeded dummy data for the fixture-driven inbox.
 *
 * Everything the UI renders during this branch comes from this module, so the
 * integration developer can delete this file and swap in the Convex adapter
 * without touching visual components.
 */

import type {
  CompanyProfile,
  InboxSummary,
  Message,
  Teammate,
  ThreadLabel,
  ThreadSummary,
} from "./types";

const now = Date.now();
const minutes = (n: number) => now - n * 60_000;
const hours = (n: number) => now - n * 3_600_000;
const days = (n: number) => now - n * 86_400_000;

export const FIXTURE_TEAMMATES: Teammate[] = [
  { id: "tm-connor", name: "Connor John", initials: "CJ", role: "Support lead" },
  { id: "tm-steven", name: "Steven Smith", initials: "SS", role: "Account manager" },
  { id: "tm-priya", name: "Priya Raman", initials: "PR", role: "Sales engineer" },
  { id: "tm-jordan", name: "Jordan Burgess", initials: "JB", role: "Success manager" },
];

export const FIXTURE_INBOXES: InboxSummary[] = [
  { id: "inbox-personal", name: "Your inbox", slug: "your-inbox", kind: "personal", displayOrder: 0, unreadCount: 0, openCount: 0, accent: "yellow", hasChannel: false },
  { id: "inbox-sales", name: "Sales", slug: "sales", kind: "shared", displayOrder: 1, unreadCount: 3, openCount: 3, accent: "purple", hasChannel: true },
  { id: "inbox-accounts", name: "Accounts", slug: "accounts", kind: "shared", displayOrder: 2, unreadCount: 1, openCount: 2, accent: "blue", hasChannel: true },
  { id: "inbox-support", name: "Support", slug: "support", kind: "shared", displayOrder: 3, unreadCount: 2, openCount: 2, accent: "magenta", hasChannel: true },
];

const label = (id: string, name: string, accent: ThreadLabel["accent"]): ThreadLabel => ({ id, name, accent });

export const FIXTURE_LABELS: ThreadLabel[] = [
  label("lb-vip", "VIP", "magenta"),
  label("lb-renewal", "Renewal", "purple"),
  label("lb-billing", "Billing", "amber"),
  label("lb-onboarding", "Onboarding", "blue"),
  label("lb-feedback", "Feedback", "yellow"),
];

const [vip, renewal, billing, onboarding, feedback] = FIXTURE_LABELS as [
  ThreadLabel,
  ThreadLabel,
  ThreadLabel,
  ThreadLabel,
  ThreadLabel,
];

export const FIXTURE_THREADS: ThreadSummary[] = [
  {
    id: "th-northstar",
    inboxId: "inbox-sales",
    customerName: "Maya Chen",
    customerEmail: "maya.chen@northstar.io",
    companyName: "Northstar",
    subject: "Upgrading to the Scale plan",
    preview: "We're ready to move our team of 45 onto the Scale plan — can you walk me through…",
    status: "open",
    priority: "urgent",
    assigneeId: null,
    labels: [vip, renewal],
    unread: true,
    lastActivityAt: minutes(15),
  },
  {
    id: "th-atlas-pricing",
    inboxId: "inbox-sales",
    customerName: "Daniel Walker",
    customerEmail: "daniel@atlasfreight.com",
    companyName: "Atlas Freight",
    subject: "Question about pricing tiers",
    preview: "Do you offer discounts for annual billing? We're comparing you against two other…",
    status: "open",
    priority: "normal",
    assigneeId: "tm-priya",
    labels: [],
    unread: true,
    lastActivityAt: hours(4),
  },
  {
    id: "th-lumen-demo",
    inboxId: "inbox-sales",
    customerName: "Sophia Nguyen",
    customerEmail: "sophia@lumenlabs.co",
    companyName: "Lumen Labs",
    subject: "Demo follow-up and security review",
    preview: "Thanks for the demo yesterday. Our security team has a short questionnaire before…",
    status: "waiting",
    priority: "normal",
    assigneeId: "tm-steven",
    labels: [onboarding],
    unread: false,
    lastActivityAt: hours(9),
  },
  {
    id: "th-harbor-won",
    inboxId: "inbox-sales",
    customerName: "Owen Smith",
    customerEmail: "owen@harborandco.com",
    companyName: "Harbor & Co",
    subject: "Re: Contract signed 🎉",
    preview: "Great support through the whole process, thanks for your help!",
    status: "closed",
    priority: "normal",
    assigneeId: "tm-priya",
    labels: [feedback],
    unread: false,
    lastActivityAt: days(2),
  },
  {
    id: "th-invoice",
    inboxId: "inbox-accounts",
    customerName: "Caleb Foster",
    customerEmail: "caleb@brightpath.org",
    companyName: "Brightpath",
    subject: "Invoice #4821 shows the wrong amount",
    preview: "The March invoice lists 12 seats but we downgraded to 8 in February. Could you…",
    status: "open",
    priority: "urgent",
    assigneeId: null,
    labels: [billing],
    unread: true,
    lastActivityAt: minutes(45),
  },
  {
    id: "th-po-number",
    inboxId: "inbox-accounts",
    customerName: "Ethan Ramirez",
    customerEmail: "ethan@fleetworks.dev",
    companyName: "Fleetworks",
    subject: "Adding a PO number to invoices",
    preview: "Our finance team needs PO-7734 printed on every invoice going forward. Is that…",
    status: "waiting",
    priority: "normal",
    assigneeId: "tm-jordan",
    labels: [billing],
    unread: false,
    lastActivityAt: days(1),
  },
  {
    id: "th-delivery",
    inboxId: "inbox-support",
    customerName: "Oscar Sullivan",
    customerEmail: "oscar.sullivan@email.com",
    subject: "Re: Delivery delay",
    preview: "Is there an updated delivery estimate? The original window passed on Tuesday.",
    status: "open",
    priority: "normal",
    assigneeId: "tm-connor",
    labels: [],
    unread: true,
    lastActivityAt: minutes(20),
  },
  {
    id: "th-refund",
    inboxId: "inbox-support",
    customerName: "Oliver Scott",
    customerEmail: "oliverscott@email.com",
    subject: "Refund request #88213",
    preview: "Could you process this refund today please? The duplicate charge is still pending…",
    status: "open",
    priority: "urgent",
    assigneeId: null,
    labels: [vip],
    unread: true,
    lastActivityAt: hours(1),
  },
  {
    id: "th-booking",
    inboxId: "inbox-support",
    customerName: "Amelia Hart",
    customerEmail: "amelia@hartevents.com",
    companyName: "Hart Events",
    subject: "Booking confirmation needed",
    preview: "I have not received a confirmation email for the workshop on the 22nd.",
    status: "closed",
    priority: "normal",
    assigneeId: "tm-connor",
    labels: [],
    unread: false,
    lastActivityAt: days(3),
  },
];

export const FIXTURE_MESSAGES: Record<string, Message[]> = {
  "th-northstar": [
    {
      id: "msg-ns-1",
      threadId: "th-northstar",
      direction: "inbound",
      authorName: "Maya Chen",
      authorEmail: "maya.chen@northstar.io",
      recipientEmail: "sales@reply.dev",
      body: "Hi there,\n\nWe're ready to move our team of 45 onto the Scale plan — can you walk me through the migration steps and confirm whether our current integrations carry over?\n\nWe'd like to complete this before the end of the quarter, so a quick turnaround would be appreciated.\n\nBest,\nMaya",
      sentAt: hours(26),
    },
    {
      id: "msg-ns-2",
      threadId: "th-northstar",
      direction: "outbound",
      authorName: "Priya Raman",
      authorEmail: "sales@reply.dev",
      recipientEmail: "maya.chen@northstar.io",
      body: "Hi Maya,\n\nGreat to hear! Migration is zero-downtime and all existing integrations carry over automatically. I'll send the seat-upgrade order form shortly.",
      sentAt: hours(24),
    },
    {
      id: "msg-ns-3",
      threadId: "th-northstar",
      direction: "inbound",
      authorName: "Maya Chen",
      authorEmail: "maya.chen@northstar.io",
      recipientEmail: "sales@reply.dev",
      body: "Thanks Priya. One more thing — our finance team is asking whether the Scale plan supports consolidated monthly invoicing across our two workspaces, and if we can lock the current rate for 12 months.",
      sentAt: minutes(15),
    },
  ],
  "th-refund": [
    {
      id: "msg-rf-1",
      threadId: "th-refund",
      direction: "inbound",
      authorName: "Oliver Scott",
      authorEmail: "oliverscott@email.com",
      recipientEmail: "support@reply.dev",
      body: "Thank you for your recent order with us. We are reaching out to inform you about an issue — I was charged twice for order #88213. Could you process this refund today please?",
      sentAt: hours(2),
    },
    {
      id: "msg-rf-2",
      threadId: "th-refund",
      direction: "outbound",
      authorName: "Connor John",
      authorEmail: "support@reply.dev",
      recipientEmail: "oliverscott@email.com",
      body: "Hi Oliver,\n\nThanks for reaching out — I can see the duplicate charge and have flagged it for our payments team. You'll see the refund within 3–5 business days.",
      sentAt: hours(1),
    },
  ],
  "th-delivery": [
    {
      id: "msg-dl-1",
      threadId: "th-delivery",
      direction: "inbound",
      authorName: "Oscar Sullivan",
      authorEmail: "oscar.sullivan@email.com",
      recipientEmail: "support@reply.dev",
      body: "Is there an updated delivery estimate? The original window passed on Tuesday.",
      sentAt: minutes(20),
    },
  ],
  "th-invoice": [
    {
      id: "msg-iv-1",
      threadId: "th-invoice",
      direction: "inbound",
      authorName: "Caleb Foster",
      authorEmail: "caleb@brightpath.org",
      recipientEmail: "accounts@reply.dev",
      body: "The March invoice lists 12 seats but we downgraded to 8 in February. Could you send a corrected invoice? Our payment run closes Friday.",
      sentAt: minutes(45),
    },
  ],
  "th-atlas-pricing": [
    {
      id: "msg-at-1",
      threadId: "th-atlas-pricing",
      direction: "inbound",
      authorName: "Daniel Walker",
      authorEmail: "daniel@atlasfreight.com",
      recipientEmail: "sales@reply.dev",
      body: "Do you offer discounts for annual billing? We're comparing you against two other vendors and price will be a deciding factor.",
      sentAt: hours(4),
    },
  ],
  "th-lumen-demo": [
    {
      id: "msg-lm-1",
      threadId: "th-lumen-demo",
      direction: "inbound",
      authorName: "Sophia Nguyen",
      authorEmail: "sophia@lumenlabs.co",
      recipientEmail: "sales@reply.dev",
      body: "Thanks for the demo yesterday. Our security team has a short questionnaire before we can proceed — attached is the list of questions.",
      sentAt: hours(10),
    },
    {
      id: "msg-lm-2",
      threadId: "th-lumen-demo",
      direction: "outbound",
      authorName: "Steven Smith",
      authorEmail: "sales@reply.dev",
      recipientEmail: "sophia@lumenlabs.co",
      body: "Happy to help — I've forwarded the questionnaire to our security lead and will have answers back to you within two business days.",
      sentAt: hours(9),
    },
  ],
  "th-po-number": [
    {
      id: "msg-po-1",
      threadId: "th-po-number",
      direction: "inbound",
      authorName: "Ethan Ramirez",
      authorEmail: "ethan@fleetworks.dev",
      recipientEmail: "accounts@reply.dev",
      body: "Our finance team needs PO-7734 printed on every invoice going forward. Is that something you can configure on your side?",
      sentAt: days(1),
    },
  ],
  "th-harbor-won": [
    {
      id: "msg-hb-1",
      threadId: "th-harbor-won",
      direction: "inbound",
      authorName: "Owen Smith",
      authorEmail: "owen@harborandco.com",
      recipientEmail: "sales@reply.dev",
      body: "Great support through the whole process, thanks for your help!",
      sentAt: days(2),
    },
  ],
  "th-booking": [
    {
      id: "msg-bk-1",
      threadId: "th-booking",
      direction: "inbound",
      authorName: "Amelia Hart",
      authorEmail: "amelia@hartevents.com",
      recipientEmail: "support@reply.dev",
      body: "I have not received a confirmation email for the workshop on the 22nd.",
      sentAt: days(3),
    },
  ],
};

export const FIXTURE_COMPANIES: Record<string, CompanyProfile> = {
  "th-northstar": {
    name: "Northstar",
    domain: "northstar.io",
    description: "Workflow analytics platform helping operations teams ship faster.",
    industry: "B2B SaaS",
    location: "Austin, TX",
  },
  "th-atlas-pricing": {
    name: "Atlas Freight",
    domain: "atlasfreight.com",
    description: "Mid-market logistics carrier network across North America.",
    industry: "Logistics",
    location: "Chicago, IL",
  },
  "th-lumen-demo": {
    name: "Lumen Labs",
    domain: "lumenlabs.co",
    description: "Applied research studio building lighting simulation tools.",
    industry: "Software",
    location: "Portland, OR",
  },
  "th-invoice": {
    name: "Brightpath",
    domain: "brightpath.org",
    description: "Nonprofit education network serving 40 school districts.",
    industry: "Education",
    location: "Denver, CO",
  },
};

/** Canned but editable Copilot draft used by the fixture `generateDraft`. */
export const FIXTURE_DRAFTS: Record<string, string> = {
  "th-northstar":
    "Hi Maya,\n\nGreat questions — yes on both counts. The Scale plan supports consolidated monthly invoicing across workspaces, and I can lock your current per-seat rate for 12 months on an annual agreement.\n\nI'll send the order form for 45 seats today. Once it's signed, migration takes under an hour with no downtime and all integrations carry over automatically.\n\nBest,\nPriya",
  default:
    "Hi there,\n\nThanks for reaching out — I've looked into this and will follow up with the details shortly. Let me know if anything else comes up in the meantime.\n\nBest regards",
};

export function getFixtureDraft(threadId: string): string {
  return FIXTURE_DRAFTS[threadId] ?? FIXTURE_DRAFTS.default!;
}
