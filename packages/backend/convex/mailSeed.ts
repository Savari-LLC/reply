/**
 * Hackathon stand-in for live mailbox access: instead of fetching real mail we
 * seed a fixed set of demo threads. Senders on `ENRICHED_SEED_DOMAINS` use real
 * company domains so Context.dev can resolve live profiles; the rest are
 * ordinary personal senders using public mailbox providers.
 */

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

export const ENRICHED_SEED_DOMAINS = [
  "figma.com",
  "notion.so",
  "atlassian.com",
  "hubspot.com",
  "datadoghq.com",
  "intercom.com",
  "canva.com",
  "linear.app",
  "stripe.com",
  "github.com",
  "vercel.com",
  "cloudflare.com",
];

type SeedMessage = {
  direction: "inbound" | "outbound";
  body: string;
  /** Hours after the thread's first message. */
  hoursAfter?: number;
};

type SeedThread = {
  subject: string;
  senderName: string;
  senderEmail: string;
  daysAgo: number;
  unread: boolean;
  messages: SeedMessage[];
};

const SEED_THREADS: SeedThread[] = [
  {
    subject: "Design review workflow for client feedback",
    senderName: "Elena Rossi",
    senderEmail: "elena.rossi@figma.com",
    daysAgo: 0.2,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nOur design team collects client feedback over email and it scatters across personal inboxes. Could Reply give us one shared queue with clear ownership per thread?\n\nA quick call this week would be great.\n\nBest,\nElena Rossi\nDesign Operations, Figma",
      },
    ],
  },
  {
    subject: "Docs handoff between support shifts",
    senderName: "Jordan Park",
    senderEmail: "jordan.park@notion.so",
    daysAgo: 0.6,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nOur support team hands docs-related questions between three shifts and context keeps getting lost. Does Reply support internal notes on a thread that customers never see?\n\nThanks,\nJordan Park\nCustomer Experience, Notion",
      },
    ],
  },
  {
    subject: "Jira integration questions",
    senderName: "Ravi Menon",
    senderEmail: "ravi.menon@atlassian.com",
    daysAgo: 1.1,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi team,\n\nWe'd like inbound emails to create linked Jira issues automatically. Is there an API or webhook we can build against, and can assignment stay in sync both ways?\n\nRegards,\nRavi Menon\nPlatform Partnerships, Atlassian",
      },
    ],
  },
  {
    subject: "CRM sync for shared inbox",
    senderName: "Claire Dubois",
    senderEmail: "claire.dubois@hubspot.com",
    daysAgo: 1.8,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nWe're evaluating shared inboxes that can log conversations against CRM contacts automatically. How does Reply match senders to companies, and can that data flow into HubSpot?\n\nMerci,\nClaire Dubois\nEcosystem Team, HubSpot",
      },
      {
        direction: "outbound",
        hoursAfter: 3,
        body: "Hi Claire,\n\nThanks for reaching out! Reply enriches each sender's domain into a full company profile automatically. Happy to walk you through the CRM export options on a call — does Thursday work?\n\nBest,\nThe Reply team",
      },
      {
        direction: "inbound",
        hoursAfter: 7,
        body: "Thursday works. Could you also include someone who can speak to the enrichment data sources?\n\nClaire",
      },
    ],
  },
  {
    subject: "Alert triage inbox pilot",
    senderName: "Lucas Meyer",
    senderEmail: "lucas.meyer@datadoghq.com",
    daysAgo: 2.4,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nOur on-call rotation triages alert follow-ups over email and ownership is murky. Can Reply auto-assign threads round-robin within a team? We'd pilot with six engineers.\n\nThanks,\nLucas Meyer\nSRE, Datadog",
      },
    ],
  },
  {
    subject: "Migrating conversations from Intercom",
    senderName: "Aisha Bello",
    senderEmail: "aisha.bello@intercom.com",
    daysAgo: 3.2,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nA partner team here wants to consolidate long-tail email support into one tool. What does importing historical conversations into Reply look like?\n\nBest,\nAisha Bello\nPartnerships, Intercom",
      },
      {
        direction: "outbound",
        hoursAfter: 5,
        body: "Hi Aisha,\n\nWe support CSV and API-based imports with thread history preserved. I'll send over the migration guide — roughly how many conversations are we talking about?\n\nBest,\nThe Reply team",
      },
    ],
  },
  {
    subject: "Brand asset requests queue",
    senderName: "Mia Thompson",
    senderEmail: "mia.thompson@canva.com",
    daysAgo: 4.5,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi there,\n\nOur brand team fields asset requests from across the company via one alias and nothing has an owner. Could each request become an assignable conversation with a status?\n\nCheers,\nMia Thompson\nBrand Studio, Canva",
      },
    ],
  },
  {
    subject: "Bug report triage from email",
    senderName: "Felix Wagner",
    senderEmail: "felix.wagner@linear.app",
    daysAgo: 6,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hey,\n\nCustomers email us bug reports that we manually copy into our tracker. Does Reply have an API for reading threads so we can automate that hand-off?\n\nThanks,\nFelix Wagner\nCustomer Engineering, Linear",
      },
    ],
  },
  {
    subject: "Invoice #2841 — March services",
    senderName: "Sarah Whitfield",
    senderEmail: "sarah.whitfield@gmail.com",
    daysAgo: 0.4,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nPlease find attached invoice #2841 for March consulting services. Payment terms are net 30 as usual.\n\nLet me know if anything needs adjusting.\n\nBest,\nSarah",
      },
    ],
  },
  {
    subject: "Re: Coffee next week?",
    senderName: "Daniel Kim",
    senderEmail: "daniel.kim.dev@gmail.com",
    daysAgo: 0.9,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hey!\n\nTuesday or Wednesday morning both work for me. There's a good place near the station — want to say 9:30?\n\nDaniel",
      },
    ],
  },
  {
    subject: "Question about my order",
    senderName: "Priya Nair",
    senderEmail: "priya.nair88@outlook.com",
    daysAgo: 1.3,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nI placed an order last Friday (confirmation #10382) and haven't received a shipping update yet. Could you check on the status?\n\nThank you,\nPriya",
      },
    ],
  },
  {
    subject: "Freelance writing availability",
    senderName: "Tom Alvarez",
    senderEmail: "tomalvarez.writes@gmail.com",
    daysAgo: 2,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nI saw you're looking for help with product copy. I've worked with several SaaS teams on onboarding flows and docs. Portfolio attached — happy to do a short paid trial.\n\nBest,\nTom",
      },
      {
        direction: "outbound",
        hoursAfter: 6,
        body: "Hi Tom,\n\nThanks for reaching out — the portfolio looks strong. Could you share your rates for a 2-week trial engagement?\n\nBest",
      },
    ],
  },
  {
    subject: "Team offsite — dietary requirements",
    senderName: "Grace Osei",
    senderEmail: "grace.osei@icloud.com",
    daysAgo: 2.7,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nFinal call for dietary requirements for the offsite dinner on the 14th. Reply by Friday so I can confirm numbers with the venue.\n\nThanks!\nGrace",
      },
    ],
  },
  {
    subject: "Refund request — duplicate charge",
    senderName: "Martin Novak",
    senderEmail: "martin.novak75@yahoo.com",
    daysAgo: 3.5,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nI was charged twice on the 3rd — two identical charges of $49. Please refund the duplicate. I can send a bank statement screenshot if needed.\n\nMartin Novak",
      },
    ],
  },
  {
    subject: "Intro: Hannah <> you",
    senderName: "James Porter",
    senderEmail: "jporter.connect@gmail.com",
    daysAgo: 4,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi both,\n\nAs promised — Hannah, meet the team behind Reply. Hannah runs ops at a 40-person agency and is drowning in shared email. I'll let you two take it from here.\n\nJames",
      },
      {
        direction: "outbound",
        hoursAfter: 4,
        body: "Thanks James!\n\nHannah, great to meet you. Would love to hear how your team handles client email today — free for a 20-minute call this week?\n\nBest",
      },
    ],
  },
  {
    subject: "Speaking slot at SaaS meetup",
    senderName: "Lena Fischer",
    senderEmail: "lena.fischer.events@outlook.com",
    daysAgo: 5,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nWe're hosting a SaaS founders meetup on the 22nd and would love a 15-minute talk on customer communication at scale. Interested?\n\nBest regards,\nLena",
      },
    ],
  },
  {
    subject: "Password reset didn't arrive",
    senderName: "Oscar Reyes",
    senderEmail: "oscar.reyes.mx@gmail.com",
    daysAgo: 5.6,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nI've requested a password reset three times and nothing shows up, including in spam. My account email is this one. Can you trigger it manually?\n\nThanks,\nOscar",
      },
    ],
  },
  {
    subject: "Apartment viewing on Saturday",
    senderName: "Nina Bergström",
    senderEmail: "nina.bergstrom@icloud.com",
    daysAgo: 7,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nConfirming the viewing this Saturday at 11:00. The entrance code is 4821 — ring apartment 6B when you arrive.\n\nSee you then,\nNina",
      },
    ],
  },
  {
    subject: "Feedback on the beta",
    senderName: "Ali Hassan",
    senderEmail: "ali.hassan.beta@gmail.com",
    daysAgo: 8.5,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hey team,\n\nBeen using the beta for two weeks. The inbox views are great, but I'd love keyboard shortcuts for assigning threads. Also hit a small bug where the unread count lags.\n\nHappy to jump on a call.\n\nAli",
      },
      {
        direction: "outbound",
        hoursAfter: 8,
        body: "Hi Ali,\n\nThis is exactly the feedback we need — shortcuts are on the roadmap and I've filed the unread-count bug. Would next Tuesday work for a call?\n\nThanks!",
      },
    ],
  },
  {
    subject: "Renewal reminder — domain expires soon",
    senderName: "Rachel Adams",
    senderEmail: "rachel.adams.admin@outlook.com",
    daysAgo: 10,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nHeads up that the team domain registration expires at the end of the month. I can renew for 1 or 3 years — let me know which you'd prefer and I'll sort it.\n\nRachel",
      },
    ],
  },
  {
    subject: "Payment dispute handoff workflow",
    senderName: "Maya Chen",
    senderEmail: "maya.chen@stripe.com",
    daysAgo: 0.3,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi team,\n\nOur operations group needs a cleaner handoff when payment disputes arrive by email. Can Reply route each case to an owner while keeping the full customer history visible?\n\nBest,\nMaya Chen\nOperations, Stripe",
      },
    ],
  },
  {
    subject: "Shared queue for open-source support",
    senderName: "Owen Brooks",
    senderEmail: "owen.brooks@github.com",
    daysAgo: 1.5,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nWe receive open-source program questions across several aliases. Could Reply consolidate them into a shared queue without losing which address each request came through?\n\nThanks,\nOwen Brooks\nDeveloper Relations, GitHub",
      },
    ],
  },
  {
    subject: "Deployment alert follow-ups",
    senderName: "Sofia Martin",
    senderEmail: "sofia.martin@vercel.com",
    daysAgo: 2.2,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nCustomer replies to deployment alerts are landing in individual inboxes. We are looking for a shared workflow with ownership, priority, and an obvious next action. Is that a fit for Reply?\n\nBest,\nSofia Martin\nCustomer Success, Vercel",
      },
      {
        direction: "outbound",
        hoursAfter: 2,
        body: "Hi Sofia,\n\nYes — each incoming conversation can be assigned, prioritized, and moved through a shared status workflow. I would be happy to show you the alert handoff flow.\n\nBest,\nThe Reply team",
      },
    ],
  },
  {
    subject: "Abuse inbox coverage across regions",
    senderName: "Liam Wong",
    senderEmail: "liam.wong@cloudflare.com",
    daysAgo: 3.8,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nOur regional teams need clearer coverage for time-sensitive reports arriving by email. Can Reply show who owns a thread and make the handover visible to the next shift?\n\nRegards,\nLiam Wong\nTrust Operations, Cloudflare",
      },
    ],
  },
  {
    subject: "Shipping address correction",
    senderName: "Nora Ibrahim",
    senderEmail: "nora.ibrahim@proton.me",
    daysAgo: 0.7,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nI just noticed the apartment number is missing from order #10841. Could you update the shipping address before it leaves the warehouse?\n\nThank you,\nNora",
      },
    ],
  },
  {
    subject: "Interview time confirmation",
    senderName: "Yasmin Rahman",
    senderEmail: "yasmin.rahman.careers@gmail.com",
    daysAgo: 1.9,
    unread: true,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nThank you for the invitation. I can confirm the interview for Wednesday at 2:00 PM GST. Please let me know if there is anything I should prepare.\n\nBest,\nYasmin",
      },
    ],
  },
  {
    subject: "Receipt for client dinner",
    senderName: "Ben Carter",
    senderEmail: "ben.carter.ops@yahoo.com",
    daysAgo: 4.2,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi accounts,\n\nAttaching the receipt for Thursday's client dinner. The total was AED 680 and the project code is NS-204.\n\nThanks,\nBen",
      },
    ],
  },
  {
    subject: "Newsletter sponsorship details",
    senderName: "Chloe Evans",
    senderEmail: "chloe.evans.media@outlook.com",
    daysAgo: 6.4,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nCould you send over the audience breakdown and available dates for next month's newsletter sponsorship? We are considering the lead placement.\n\nBest,\nChloe",
      },
    ],
  },
  {
    subject: "Booking change for Friday",
    senderName: "Mateo Silva",
    senderEmail: "mateo.silva@icloud.com",
    daysAgo: 9,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hello,\n\nWould it be possible to move Friday's booking from 6:00 to 7:30 PM? The booking reference is RPL-7712.\n\nMany thanks,\nMateo",
      },
    ],
  },
  {
    subject: "Vendor agreement signature",
    senderName: "Evelyn Moore",
    senderEmail: "evelyn.moore@proton.me",
    daysAgo: 11,
    unread: false,
    messages: [
      {
        direction: "inbound",
        body: "Hi,\n\nThe vendor agreement looks good from our side. Please send the final signature copy and I will return it by end of day.\n\nRegards,\nEvelyn",
      },
    ],
  },
];

const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

export function buildSeedThreads(ownerEmail: string, now: number): ImportedThread[] {
  return SEED_THREADS.map((seed, index) => {
    const firstSentAt = now - Math.round(seed.daysAgo * DAY);
    const messages = seed.messages.map((message, messageIndex) => ({
      externalMessageId: `seed-${index}-m${messageIndex}`,
      direction: message.direction,
      senderName: message.direction === "inbound" ? seed.senderName : ownerEmail,
      senderEmail: message.direction === "inbound" ? seed.senderEmail : ownerEmail,
      body: message.body,
      sentAt: firstSentAt + Math.round((message.hoursAfter ?? 0) * HOUR),
    }));
    const lastMessageAt = messages[messages.length - 1]!.sentAt;
    return {
      externalThreadId: `seed-${index}`,
      subject: seed.subject,
      senderName: seed.senderName,
      senderEmail: seed.senderEmail,
      lastMessageAt,
      unread: seed.unread,
      messages,
    };
  });
}
