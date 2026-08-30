import { v } from "convex/values";

import { internal } from "./_generated/api";
import { mutation } from "./_generated/server";
import { requireWorkspaceContext } from "./authHelpers";
import { getInboxChannels, requireInboxAccess } from "./lib/access";

type DemoSender = {
  senderName: string;
  senderEmail: string;
  domain: string;
  subject: string;
  body: string;
};

/**
 * Fictional operators writing from real company domains, so Context.dev can
 * resolve the sender into a live company profile across varied industries.
 */
const DEMO_SENDERS: DemoSender[] = [
  {
    senderName: "Layla Haddad",
    senderEmail: "layla.haddad@emirates.com",
    domain: "emirates.com",
    subject: "Group desk: shared inbox for charter requests",
    body: "Hello,\n\nOur group-bookings desk handles charter and corporate travel requests across three mailboxes, and handovers between shifts keep dropping threads.\n\nCould you walk us through how assignment and statuses work across teams? A short call this week would be ideal.\n\nRegards,\nLayla Haddad\nGroup Sales Desk, Emirates",
  },
  {
    senderName: "Marcus Bell",
    senderEmail: "marcus.bell@nike.com",
    domain: "nike.com",
    subject: "Wholesale support queue for EMEA retailers",
    body: "Hi there,\n\nWe support several hundred wholesale partners in EMEA and want one queue for order issues instead of personal inboxes.\n\nHow does Reply handle labels and per-inbox permissions? And can we trial it with a small team first?\n\nThanks,\nMarcus Bell\nPartner Support, Nike",
  },
  {
    senderName: "Priya Raman",
    senderEmail: "priya.raman@stripe.com",
    domain: "stripe.com",
    subject: "Routing integration questions from developers",
    body: "Hey team,\n\nOur developer relations group fields integration questions that today get lost between personal inboxes and a support alias.\n\nDoes Reply support assignment rules per inbox, and is there an API for creating conversations programmatically?\n\nBest,\nPriya Raman\nDeveloper Relations, Stripe",
  },
  {
    senderName: "Tomás Ferreira",
    senderEmail: "tomas.ferreira@airbnb.com",
    domain: "airbnb.com",
    subject: "Host escalations pilot for two markets",
    body: "Hello,\n\nWe're piloting a dedicated host-escalations team for two markets and need shared ownership of every conversation with a clear next action.\n\nCan you share pricing for 15 seats and confirm SLA reporting is on the roadmap?\n\nObrigado,\nTomás Ferreira\nHost Operations, Airbnb",
  },
  {
    senderName: "Ingrid Sørensen",
    senderEmail: "ingrid.sorensen@maersk.com",
    domain: "maersk.com",
    subject: "Customer service desk for booking amendments",
    body: "Dear team,\n\nOur booking-amendments desk receives around 400 emails a day and visibility of who owns what is our biggest gap.\n\nDoes Reply show per-conversation ownership and waiting states out of the box? We'd like a demo with our Rotterdam team.\n\nKind regards,\nIngrid Sørensen\nCustomer Experience, Maersk",
  },
  {
    senderName: "Diego Alvarez",
    senderEmail: "diego.alvarez@shopify.com",
    domain: "shopify.com",
    subject: "Plus merchant success team evaluation",
    body: "Hi,\n\nOur merchant success managers share an alias today and reply-collisions are becoming embarrassing.\n\nHow does Reply prevent two people answering the same thread? Also interested in the AI drafting you mention on your site.\n\nCheers,\nDiego Alvarez\nMerchant Success, Shopify",
  },
  {
    senderName: "Hannah Cole",
    senderEmail: "hannah.cole@marriott.com",
    domain: "marriott.com",
    subject: "Events inbox for property RFPs",
    body: "Hello,\n\nWe coordinate event RFPs across four properties and currently forward everything through one coordinator, which doesn't scale.\n\nCould each property get its own inbox with shared visibility for the regional team? Happy to start with a pilot.\n\nBest regards,\nHannah Cole\nEvents & Group Sales, Marriott",
  },
  {
    senderName: "Kenji Watanabe",
    senderEmail: "kenji.watanabe@spotify.com",
    domain: "spotify.com",
    subject: "Label partnerships mailbox consolidation",
    body: "Hi team,\n\nLabel partnership requests arrive across three regional mailboxes and nobody has a single view of open items.\n\nDoes Reply support merging channels into one inbox while keeping the original addresses? What does migration look like?\n\nThanks,\nKenji Watanabe\nLabel Partnerships, Spotify",
  },
  {
    senderName: "Amara Okoye",
    senderEmail: "amara.okoye@tesla.com",
    domain: "tesla.com",
    subject: "Fleet sales enquiries need shared ownership",
    body: "Hello,\n\nOur fleet sales team covers corporate enquiries for three countries and follow-ups slip whenever someone is out of office.\n\nCan conversations be reassigned automatically, and is there reporting on response times? A quick overview call would help.\n\nBest,\nAmara Okoye\nFleet Sales, Tesla",
  },
  {
    senderName: "Sofia Lindqvist",
    senderEmail: "sofia.lindqvist@netflix.com",
    domain: "netflix.com",
    subject: "Production partner support workflow",
    body: "Hi,\n\nWe support external production partners and want their emails triaged with clear owners rather than a rotating on-call inbox.\n\nDoes Reply support internal notes that partners never see? That's our must-have before a trial.\n\nThanks so much,\nSofia Lindqvist\nProduction Partnerships, Netflix",
  },
];

/**
 * Demo helper: delivers a realistic inbound email from a real company domain
 * into the chosen inbox, then schedules Context.dev enrichment so the sender's
 * company profile is ready by the time the operator opens the thread.
 */
export const simulateIncomingEmail = mutation({
  args: { inboxId: v.id("inboxes") },
  returns: v.object({ threadId: v.id("threads") }),
  handler: async (ctx, args) => {
    const context = await requireWorkspaceContext(ctx);
    const inbox = await requireInboxAccess(ctx, context.membership, args.inboxId);

    // Simulated provider: an inbox with no connection gets one on first use.
    const channels = await getInboxChannels(ctx, inbox._id);
    let channelId = channels.find((channel) => channel.status === "connected")?._id;
    channelId ??=
      channels[0]?._id ??
      (await ctx.db.insert("channels", {
        workspaceId: context.workspace._id,
        inboxId: inbox._id,
        provider: "gmail",
        address: `${inbox.name.toLowerCase().replace(/[^a-z0-9]+/g, "-")}@reply.demo`,
        status: "connected",
      }));

    // Prefer a sender whose domain hasn't appeared in this workspace yet so
    // repeated clicks keep showing fresh company profiles.
    const workspaceThreads = await ctx.db
      .query("threads")
      .withIndex("by_workspaceId_and_lastMessageAt", (q) =>
        q.eq("workspaceId", context.workspace._id),
      )
      .collect();
    const usedDomains = new Set(workspaceThreads.map((thread) => thread.senderDomain));
    const unused = DEMO_SENDERS.filter((sender) => !usedDomains.has(sender.domain));
    const pool = unused.length > 0 ? unused : DEMO_SENDERS;
    const sender = pool[Math.floor(Math.random() * pool.length)]!;

    const sentAt = Date.now();
    const threadId = await ctx.db.insert("threads", {
      workspaceId: context.workspace._id,
      channelId,
      subject: sender.subject,
      status: "open",
      priority: "normal",
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
      senderDomain: sender.domain,
      lastMessageAt: sentAt,
    });
    await ctx.db.insert("messages", {
      workspaceId: context.workspace._id,
      threadId,
      direction: "inbound",
      senderName: sender.senderName,
      senderEmail: sender.senderEmail,
      body: sender.body,
      sentAt,
    });

    await ctx.scheduler.runAfter(0, internal.companyContext.enrichDomain, {
      workspaceId: context.workspace._id,
      domain: sender.domain,
    });

    return { threadId };
  },
});
