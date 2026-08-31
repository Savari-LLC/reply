import { cronJobs } from "convex/server";

import { internal } from "./_generated/api";

const crons = cronJobs();

crons.interval(
  "fallback Gmail mailbox sync",
  { minutes: 15 },
  internal.mail.scheduleGmailFallbackSyncs,
  {},
);
crons.interval(
  "renew Gmail mailbox watches",
  { minutes: 15 },
  internal.mail.scheduleGmailWatchRenewals,
  {},
);

export default crons;
