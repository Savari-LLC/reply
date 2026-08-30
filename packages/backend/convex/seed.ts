import { v } from "convex/values";

import type { Doc, Id } from "./_generated/dataModel";
import type { MutationCtx } from "./_generated/server";
import type { ChannelProvider } from "./lib/providers";

const MINUTE = 60_000;

type TeammateKey = "maya" | "noah" | "leila" | "omar";

const teammates: Array<{
  key: TeammateKey;
  username: string;
  name: string;
}> = [
  { key: "maya", username: "maya", name: "Maya Haddad" },
  { key: "noah", username: "noah", name: "Noah Clarke" },
  { key: "leila", username: "leila", name: "Leila Mansour" },
  { key: "omar", username: "omar", name: "Omar Farouk" },
];

export type SampleDataset = "sales" | "accounts" | "support";
type InboxKey = SampleDataset;

export const sampleDatasetValidator = v.union(
  v.literal("sales"),
  v.literal("accounts"),
  v.literal("support"),
);

export const SAMPLE_DATASETS: Array<{ key: SampleDataset; name: string }> = [
  { key: "sales", name: "Sales sample" },
  { key: "accounts", name: "Accounts sample" },
  { key: "support", name: "Support sample" },
];

const labelDefs = [
  { name: "New lead", color: "#2563eb" },
  { name: "VIP", color: "#9333ea" },
  { name: "Billing", color: "#d97706" },
  { name: "Bug", color: "#dc2626" },
  { name: "Renewal", color: "#059669" },
  { name: "Feature request", color: "#0891b2" },
];

const companyProfiles = [
  {
    domain: "northstar.ae",
    name: "Northstar Logistics",
    description:
      "Dubai-based freight forwarding and last-mile delivery operator serving the GCC.",
    industry: "Logistics",
    website: "https://northstar.ae",
  },
  {
    domain: "harborlane.test",
    name: "Harbor Lane Hospitality",
    description: "Boutique hotel group operating waterfront properties.",
    industry: "Hospitality",
    website: "https://harborlane.test",
  },
  {
    domain: "brightgrid.test",
    name: "BrightGrid",
    description: "Solar monitoring software for commercial installers.",
    industry: "Clean energy",
    website: "https://brightgrid.test",
  },
  {
    domain: "atlasclinics.test",
    name: "Atlas Clinics",
    description: "Multi-site physiotherapy and sports medicine clinics.",
    industry: "Healthcare",
    website: "https://atlasclinics.test",
  },
];

type SeedMessage = {
  direction: "inbound" | "outbound";
  minutesBefore: number;
  author?: TeammateKey;
  body: string;
};

type SeedThread = {
  inbox: InboxKey;
  subject: string;
  senderName: string;
  senderEmail: string;
  status: "open" | "waiting" | "closed";
  priority: "normal" | "urgent";
  assignee?: TeammateKey;
  labels: string[];
  unread: boolean;
  minutesAgo: number;
  messages: SeedMessage[];
};

const threads: SeedThread[] = [
  {
    inbox: "sales",
    subject: "Quote for GCC-wide delivery coverage",
    senderName: "Rania Khalil",
    senderEmail: "rania.khalil@northstar.ae",
    status: "open",
    priority: "urgent",
    labels: ["New lead", "VIP"],
    unread: true,
    minutesAgo: 4,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Hi team,\n\nWe're evaluating shared-inbox tools for our operations desk in Dubai. We handle around 1,200 customer conversations a week across sales and dispatch, and email is where everything falls apart today.\n\nCould you send pricing for roughly 25 seats, and confirm whether you support assignment rules per inbox? We'd like to make a decision before the end of the month.\n\nBest,\nRania Khalil\nHead of Operations, Northstar Logistics",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Follow-up: pilot for two hotel properties",
    senderName: "James Okafor",
    senderEmail: "j.okafor@harborlane.test",
    status: "open",
    priority: "normal",
    assignee: "maya",
    labels: ["New lead"],
    unread: true,
    minutesAgo: 95,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 2880,
        body: "Hello, we spoke at the hospitality expo last week. We'd like to trial your product for our front-desk and reservations teams at two properties. What does onboarding look like?",
      },
      {
        direction: "outbound",
        minutesBefore: 2760,
        author: "maya",
        body: "Hi James, great meeting you! Onboarding takes about a day: we connect your shared mailboxes, import your team, and set up inboxes for reservations and front desk. Happy to run a pilot for both properties. Would Tuesday work for a kickoff call?",
      },
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Tuesday works. Can you also confirm whether reservations agents can see front-desk threads, or are inboxes fully separated? That matters for our GM.",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Pricing for 8-seat installer team",
    senderName: "Priya Nair",
    senderEmail: "priya@brightgrid.test",
    status: "waiting",
    priority: "normal",
    assignee: "maya",
    labels: ["New lead"],
    unread: false,
    minutesAgo: 300,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 180,
        body: "Hi, we're an 8-person team and drowning in support@ email. What would this cost us per month, billed annually?",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "maya",
        body: "Hi Priya, for 8 seats billed annually you'd be looking at our Team plan. I've attached a breakdown. The short version: every conversation gets an owner and a status, so nothing sits unanswered in support@. Happy to jump on a 15-minute call if useful.",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Do you integrate with HubSpot?",
    senderName: "Tom Berger",
    senderEmail: "tom.berger@fieldsetagency.test",
    status: "open",
    priority: "normal",
    labels: ["New lead"],
    unread: true,
    minutesAgo: 480,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Quick pre-sales question: we live in HubSpot. Does your product sync contacts or log conversations there? That's a hard requirement for us.",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Re: Demo recording and next steps",
    senderName: "Sofia Marchetti",
    senderEmail: "sofia@velatravel.test",
    status: "waiting",
    priority: "normal",
    assignee: "noah",
    labels: [],
    unread: false,
    minutesAgo: 1500,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 2000,
        body: "Thanks for the demo yesterday. Could you send the recording and a summary of the assignment workflow? I need to share it with our COO.",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "noah",
        body: "Of course, Sofia — recording link and a one-page summary attached. The key point for your COO: every email becomes an owned conversation with a status, so handoffs between agents are explicit instead of forwarded. Let me know when you'd like to talk next steps.",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Reseller / partnership enquiry",
    senderName: "Daniel Kim",
    senderEmail: "daniel@channelworks.test",
    status: "closed",
    priority: "normal",
    assignee: "noah",
    labels: [],
    unread: false,
    minutesAgo: 4300,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 300,
        body: "We resell productivity SaaS to SMBs in Southeast Asia. Do you have a partner program?",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "noah",
        body: "Hi Daniel, thanks for reaching out. We don't have a formal partner program yet — I'll add you to the list to be notified when we launch one. Closing this for now.",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Trial extension request",
    senderName: "Amira Boulos",
    senderEmail: "amira@stonebridgelegal.test",
    status: "open",
    priority: "normal",
    assignee: "maya",
    labels: [],
    unread: false,
    minutesAgo: 2100,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Our trial ends Friday but our managing partner has been travelling and hasn't reviewed it. Could we get another two weeks?",
      },
    ],
  },
  {
    inbox: "sales",
    subject: "Security questionnaire before purchase",
    senderName: "Henrik Olsen",
    senderEmail: "henrik.olsen@nordvik.test",
    status: "open",
    priority: "normal",
    labels: ["New lead"],
    unread: true,
    minutesAgo: 2600,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Before we can proceed, our IT team needs your standard security documentation: data residency, encryption at rest, and your subprocessor list. Can you share these?",
      },
    ],
  },

  {
    inbox: "accounts",
    subject: "Invoice #2041 shows the wrong VAT number",
    senderName: "Fatima Al Suwaidi",
    senderEmail: "finance@northstar.ae",
    status: "open",
    priority: "urgent",
    assignee: "leila",
    labels: ["Billing", "VIP"],
    unread: true,
    minutesAgo: 55,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Hello, invoice #2041 was issued with our old VAT registration number. Our accounts payable system rejected it. Please reissue with TRN 100-3456-789-0003 so we can process payment this week.",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Upgrade from Team to Business plan",
    senderName: "James Okafor",
    senderEmail: "j.okafor@harborlane.test",
    status: "waiting",
    priority: "normal",
    assignee: "leila",
    labels: ["Billing"],
    unread: false,
    minutesAgo: 700,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 120,
        body: "We want to move to the Business plan and add 6 more seats effective next billing cycle. What's the prorated cost?",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "leila",
        body: "Hi James, I've drafted the upgrade: 6 additional seats on Business, effective on your next cycle so there's no proration to worry about. You'll receive a confirmation email with the updated amount — just reply to approve and I'll apply it.",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Payment failed twice — card declined",
    senderName: "Priya Nair",
    senderEmail: "priya@brightgrid.test",
    status: "open",
    priority: "normal",
    assignee: "leila",
    labels: ["Billing"],
    unread: true,
    minutesAgo: 950,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "We got two failed-payment emails this week but our card is fine and has been charged by other vendors. Can you check what's happening on your end before our account gets suspended?",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Renewal terms for annual contract",
    senderName: "Marcus Webb",
    senderEmail: "m.webb@atlasclinics.test",
    status: "open",
    priority: "normal",
    assignee: "omar",
    labels: ["Renewal", "VIP"],
    unread: false,
    minutesAgo: 1300,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 1440,
        body: "Our annual contract renews in six weeks. We've grown from 12 to 19 seats this year — can we discuss volume pricing before auto-renewal kicks in?",
      },
      {
        direction: "outbound",
        minutesBefore: 720,
        author: "omar",
        body: "Absolutely, Marcus. At 19 seats you qualify for our volume tier, which would actually bring your per-seat cost down from the current rate. I'll put together a renewal proposal — expect it by Thursday.",
      },
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Thanks Omar. One more thing: our finance team needs the proposal as a formal quote on letterhead with a 30-day validity window.",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Request for W-9 and vendor onboarding form",
    senderName: "Alicia Torres",
    senderEmail: "ap@meridianfoods.test",
    status: "waiting",
    priority: "normal",
    assignee: "leila",
    labels: ["Billing"],
    unread: false,
    minutesAgo: 2900,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 60,
        body: "To set you up as a vendor we need a completed W-9 and our onboarding form (attached). Payments can't be released until these are on file.",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "leila",
        body: "Hi Alicia, completed W-9 and onboarding form attached. Let me know if anything else is needed to release the outstanding invoices.",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Duplicate charge on May statement",
    senderName: "Yusuf Demir",
    senderEmail: "yusuf@anatoliaimports.test",
    status: "closed",
    priority: "normal",
    assignee: "omar",
    labels: ["Billing"],
    unread: false,
    minutesAgo: 5700,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 400,
        body: "We were charged twice on May 3rd — same amount, two transactions. Please refund one of them.",
      },
      {
        direction: "outbound",
        minutesBefore: 250,
        author: "omar",
        body: "You're right, Yusuf — a retry was processed twice on our side. I've issued a full refund for the duplicate; it should appear within 5–7 business days. Apologies for the hassle.",
      },
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Refund received. Thanks for the quick turnaround.",
      },
    ],
  },
  {
    inbox: "accounts",
    subject: "Change billing contact and invoice email",
    senderName: "Grace Muthoni",
    senderEmail: "grace@savannahtours.test",
    status: "open",
    priority: "normal",
    labels: ["Billing"],
    unread: true,
    minutesAgo: 3400,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Our bookkeeper has changed. Please send all future invoices to accounts@savannahtours.test and update the billing contact to Grace Muthoni.",
      },
    ],
  },

  {
    inbox: "support",
    subject: "Notifications stopped arriving for our dispatch team",
    senderName: "Khalid Rahman",
    senderEmail: "dispatch@northstar.ae",
    status: "open",
    priority: "urgent",
    assignee: "noah",
    labels: ["Bug", "VIP"],
    unread: true,
    minutesAgo: 25,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 90,
        body: "Since this morning none of our dispatch team is getting email notifications for new conversations. We've missed two time-sensitive customer requests already. This is urgent.",
      },
      {
        direction: "outbound",
        minutesBefore: 60,
        author: "noah",
        body: "Sorry about this, Khalid — we're looking now. Can you confirm whether in-app notifications still appear, and roughly what time the last email notification arrived?",
      },
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "In-app still works. Last email notification was 7:40 AM Dubai time. It's affecting all 9 members of the dispatch inbox.",
      },
    ],
  },
  {
    inbox: "support",
    subject: "How do I set up an auto-assignment rule?",
    senderName: "Elena Petrova",
    senderEmail: "elena@lumenstudio.test",
    status: "open",
    priority: "normal",
    labels: [],
    unread: true,
    minutesAgo: 200,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "I want new conversations in our Projects inbox to be automatically assigned round-robin between three teammates. Is that possible, and where do I configure it?",
      },
    ],
  },
  {
    inbox: "support",
    subject: "CSV export missing conversation labels",
    senderName: "Marcus Webb",
    senderEmail: "m.webb@atlasclinics.test",
    status: "waiting",
    priority: "normal",
    assignee: "omar",
    labels: ["Bug"],
    unread: false,
    minutesAgo: 1100,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 240,
        body: "The conversation export CSV has a labels column but it's empty for every row, even though most of our threads are labelled.",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "omar",
        body: "Confirmed — this is a bug on our side affecting exports created after last week's release. A fix is rolling out tomorrow, and I'll re-run your export and send it over as soon as it lands.",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Feature request: snooze conversations",
    senderName: "Sofia Marchetti",
    senderEmail: "sofia@velatravel.test",
    status: "open",
    priority: "normal",
    labels: ["Feature request"],
    unread: false,
    minutesAgo: 1900,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "It would be great to snooze a conversation until a chosen date — half our threads are 'waiting on the customer until next week' and they clutter the open view.",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Can't remove a former teammate from the Support inbox",
    senderName: "Henrik Olsen",
    senderEmail: "henrik.olsen@nordvik.test",
    status: "open",
    priority: "normal",
    assignee: "noah",
    labels: ["Bug"],
    unread: true,
    minutesAgo: 2300,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "One of our agents left the company. I removed her from the workspace, but she still appears in the assignee dropdown for the Support inbox. How do I fully remove her?",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Mobile web: reply box hidden behind keyboard",
    senderName: "Aisha Bello",
    senderEmail: "aisha@kadunacrafts.test",
    status: "open",
    priority: "normal",
    labels: ["Bug"],
    unread: true,
    minutesAgo: 3000,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "On my phone (Safari, iPhone 15), when I tap the reply box the keyboard covers it completely and I can't see what I'm typing. Happens every time.",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Question about data retention after cancellation",
    senderName: "Tom Berger",
    senderEmail: "tom.berger@fieldsetagency.test",
    status: "waiting",
    priority: "normal",
    assignee: "noah",
    labels: [],
    unread: false,
    minutesAgo: 4000,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 100,
        body: "If we cancel, how long do you keep our conversation history, and can we export everything beforehand?",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "noah",
        body: "Hi Tom — you can export all conversations, messages, and contacts as CSV at any time from Settings → Export. After cancellation we retain data for 60 days in case you reactivate, then it's permanently deleted. Full details are in our data retention policy, linked here.",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Search doesn't find older conversations",
    senderName: "Grace Muthoni",
    senderEmail: "grace@savannahtours.test",
    status: "closed",
    priority: "normal",
    assignee: "omar",
    labels: [],
    unread: false,
    minutesAgo: 6500,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 350,
        body: "Searching for a customer's name only returns conversations from the last month or so. Older threads that definitely exist don't show up.",
      },
      {
        direction: "outbound",
        minutesBefore: 200,
        author: "omar",
        body: "Thanks for the report, Grace. Your workspace's search index hadn't finished backfilling after a recent migration. I've re-triggered it — older conversations should be searchable within the hour.",
      },
      {
        direction: "inbound",
        minutesBefore: 0,
        body: "Working now, thank you!",
      },
    ],
  },
  {
    inbox: "support",
    subject: "Feature request: shared draft editing",
    senderName: "Elena Petrova",
    senderEmail: "elena@lumenstudio.test",
    status: "closed",
    priority: "normal",
    assignee: "noah",
    labels: ["Feature request"],
    unread: false,
    minutesAgo: 7800,
    messages: [
      {
        direction: "inbound",
        minutesBefore: 150,
        body: "Could two teammates edit the same reply draft together? We often co-write responses to tricky clients.",
      },
      {
        direction: "outbound",
        minutesBefore: 0,
        author: "noah",
        body: "Love this idea, Elena — logged it with the product team. Closing this thread for now, but you'll be notified if it ships.",
      },
    ],
  },
];

export function isSeedUser(user: Doc<"users">) {
  return (
    user.authProvider === "password" &&
    (user.providerAccountId?.startsWith("seed|") ?? false)
  );
}

/**
 * Idempotently creates the demo teammates as members of the workspace so
 * seeded threads have realistic assignees and reply authors. Seed users are
 * namespaced per workspace and never registered with the auth provider, so
 * they cannot sign in or collide with real accounts.
 */
async function ensureSeedTeammates(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Record<TeammateKey, Id<"users">>> {
  const suffix = workspaceId.slice(-8).toLowerCase();
  const userIds = {} as Record<TeammateKey, Id<"users">>;
  for (const teammate of teammates) {
    const providerAccountId = `seed|${workspaceId}|${teammate.username}`;
    let user = await ctx.db
      .query("users")
      .withIndex("by_authProvider_and_providerAccountId", (q) =>
        q.eq("authProvider", "password").eq("providerAccountId", providerAccountId),
      )
      .unique();
    if (!user) {
      const userId = await ctx.db.insert("users", {
        authProvider: "password",
        providerAccountId,
        username: `${teammate.username}-demo-${suffix}`,
        name: teammate.name,
      });
      user = await ctx.db.get(userId);
    }
    if (!user) throw new Error("Could not create demo teammate");
    userIds[teammate.key] = user._id;
    const membership = await ctx.db
      .query("memberships")
      .withIndex("by_workspaceId_and_userId", (q) =>
        q.eq("workspaceId", workspaceId).eq("userId", user._id),
      )
      .unique();
    if (!membership) {
      await ctx.db.insert("memberships", {
        workspaceId,
        userId: user._id,
        role: "member",
      });
    }
  }
  return userIds;
}

async function ensureLabels(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
): Promise<Map<string, Id<"labels">>> {
  const labelIds = new Map<string, Id<"labels">>();
  for (const label of labelDefs) {
    const existing = await ctx.db
      .query("labels")
      .withIndex("by_workspaceId_and_name", (q) =>
        q.eq("workspaceId", workspaceId).eq("name", label.name),
      )
      .unique();
    labelIds.set(
      label.name,
      existing?._id ??
        (await ctx.db.insert("labels", { workspaceId, ...label })),
    );
  }
  return labelIds;
}

async function ensureCompanyProfiles(
  ctx: MutationCtx,
  workspaceId: Id<"workspaces">,
) {
  const now = Date.now();
  for (const profile of companyProfiles) {
    const existing = await ctx.db
      .query("companyProfiles")
      .withIndex("by_workspaceId_and_domain", (q) =>
        q.eq("workspaceId", workspaceId).eq("domain", profile.domain),
      )
      .unique();
    if (!existing) {
      await ctx.db.insert("companyProfiles", { workspaceId, ...profile, fetchedAt: now });
    }
  }
}

/**
 * Connects a channel to an inbox and backs it with one sample dataset.
 * Conversations belong to the channel, which belongs to the inbox. The caller
 * is responsible for authorization; `actorId` receives read state matching the
 * dataset's unread story.
 */
export async function createSampleChannel(
  ctx: MutationCtx,
  args: {
    workspaceId: Id<"workspaces">;
    actorId: Id<"users">;
    inboxId: Id<"inboxes">;
    provider: ChannelProvider;
    address: string;
    dataset: SampleDataset;
  },
): Promise<{ channelId: Id<"channels">; threadCount: number; messageCount: number }> {
  const { workspaceId, actorId, dataset } = args;
  if (!SAMPLE_DATASETS.some((entry) => entry.key === dataset)) {
    throw new Error("Unknown sample dataset");
  }

  const userIds = await ensureSeedTeammates(ctx, workspaceId);
  const labelIds = await ensureLabels(ctx, workspaceId);
  await ensureCompanyProfiles(ctx, workspaceId);

  const channelId = await ctx.db.insert("channels", {
    workspaceId,
    inboxId: args.inboxId,
    provider: args.provider,
    address: args.address,
    status: "connected",
  });

  const now = Date.now();
  const readerIds = [actorId, ...Object.values(userIds)];
  let threadCount = 0;
  let messageCount = 0;
  for (const spec of threads) {
    if (spec.inbox !== dataset) continue;
    const lastMessageAt = now - spec.minutesAgo * MINUTE;
    const senderDomain = spec.senderEmail.split("@")[1] ?? "";
    const threadId = await ctx.db.insert("threads", {
      workspaceId,
      channelId,
      subject: spec.subject,
      status: spec.status,
      assigneeId: spec.assignee ? userIds[spec.assignee] : undefined,
      priority: spec.priority,
      senderName: spec.senderName,
      senderEmail: spec.senderEmail,
      senderDomain,
      lastMessageAt,
    });
    threadCount += 1;
    for (const message of spec.messages) {
      await ctx.db.insert("messages", {
        workspaceId,
        threadId,
        direction: message.direction,
        authorId: message.author ? userIds[message.author] : undefined,
        senderName: message.direction === "inbound" ? spec.senderName : undefined,
        senderEmail: message.direction === "inbound" ? spec.senderEmail : undefined,
        body: message.body,
        sentAt: lastMessageAt - message.minutesBefore * MINUTE,
      });
      messageCount += 1;
    }
    for (const labelName of spec.labels) {
      const labelId = labelIds.get(labelName);
      if (labelId) await ctx.db.insert("threadLabels", { threadId, labelId });
    }
    if (!spec.unread) {
      for (const readerId of readerIds) {
        await ctx.db.insert("threadReads", {
          workspaceId,
          threadId,
          userId: readerId,
          lastReadAt: lastMessageAt + MINUTE,
        });
      }
    }
  }
  return { channelId, threadCount, messageCount };
}

