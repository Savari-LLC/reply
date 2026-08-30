import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { ArrowRight, Check, Sparkles } from "lucide-react";
import type { CSSProperties } from "react";

import { ReplyLogoFull, ReplyLogoMark } from "@/components/reply-logo";

type HomeSearchParams = { invite?: string };

export const Route = createFileRoute("/")({
  validateSearch: (search: Record<string, unknown>): HomeSearchParams => ({
    invite: typeof search.invite === "string" ? search.invite : undefined,
  }),
  beforeLoad: ({ search }) => {
    // Invitation links land on `/?invite=…`; send them straight to sign-in.
    if (search.invite) {
      throw redirect({ to: "/auth", search: { invite: search.invite } });
    }
  },
  component: HomeRoute,
});

const EASE = "transition-all duration-500 ease-[cubic-bezier(0.32,0.72,0,1)]";

const PRIMARY_CTA = `group inline-flex h-12 items-center gap-3 rounded-full bg-[#0d9488] pr-1.5 pl-6 text-sm font-semibold text-white shadow-lg shadow-[#0d9488]/25 outline-none hover:bg-[#0b7268] focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 active:scale-[0.98] ${EASE}`;

const SECONDARY_CTA = `inline-flex h-12 items-center rounded-full border border-[#202d2a]/15 bg-white px-6 text-sm font-semibold text-[#202d2a] shadow-sm outline-none hover:border-[#202d2a]/30 hover:bg-[#fbfbf8] focus-visible:ring-2 focus-visible:ring-[#0d9488] focus-visible:ring-offset-2 active:scale-[0.98] ${EASE}`;

function CtaIcon() {
  return (
    <span
      className={`flex size-9 items-center justify-center rounded-full bg-white/15 group-hover:translate-x-0.5 group-hover:bg-white/25 ${EASE}`}
      aria-hidden="true"
    >
      <ArrowRight className="size-4" />
    </span>
  );
}

/** Senders from the live demo dataset; Context.dev resolves each domain. */
const SENDER_LOGOS = ["stripe", "shopify", "airbnb", "spotify", "nike", "netflix"];

const PREVIEW_THREADS = [
  {
    logo: "shopify",
    sender: "Diego Alvarez",
    subject: "Plus merchant success team evaluation",
    preview: "Reply-collisions are becoming embarrassing. How does Reply prevent two people answering the same thread?",
    time: "2m",
    unread: true,
    urgent: true,
    label: null,
  },
  {
    logo: "stripe",
    sender: "Priya Raman",
    subject: "Routing integration questions from developers",
    preview: "Does Reply support assignment rules per inbox, and is there an API for creating conversations?",
    time: "38m",
    unread: true,
    urgent: false,
    label: "New lead",
  },
  {
    logo: "bookingdotcom",
    sender: "Elena Petrova",
    subject: "Booking confirmation emails stopped arriving",
    preview: "Bookings appear in the dashboard, but no confirmation goes out, and guests keep calling to ask.",
    time: "3h",
    unread: false,
    urgent: false,
    label: null,
  },
];

/** Real mini-version of the inbox thread list, framed as the hero visual. */
function InboxPreview() {
  return (
    <div className="relative">
      <div className="rounded-[2rem] bg-linear-to-br from-[#043f38] via-[#0b7268] to-[#0d9488] p-2 shadow-2xl shadow-[#043f38]/30 ring-1 ring-white/15">
        <div className="rounded-[1.55rem] bg-[#fbfbf8] shadow-[inset_0_1px_0_rgba(255,255,255,0.9)]">
          <div className="flex items-center justify-between border-b border-[#202d2a]/8 px-5 py-3.5">
            <p className="text-sm font-semibold tracking-[-0.1px] text-[#202d2a]">Sales</p>
            <span className="flex items-center gap-1.5 rounded-full bg-[#0d9488]/10 px-2.5 py-1 text-[11px] font-medium text-[#0b7268]">
              <span className="size-1.5 rounded-full bg-[#0d9488]" aria-hidden="true" />
              2 viewing
            </span>
          </div>
          <ul className="divide-y divide-[#202d2a]/6">
            {PREVIEW_THREADS.map((thread) => (
              <li key={thread.subject} className="flex items-start gap-3 px-5 py-3.5">
                <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-full bg-white ring-1 ring-[#202d2a]/10">
                  <img
                    src={`https://cdn.simpleicons.org/${thread.logo}`}
                    alt=""
                    className="size-4"
                    loading="lazy"
                  />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={`truncate text-[13px] tracking-[-0.1px] ${thread.unread ? "font-semibold text-[#202d2a]" : "font-medium text-[#53635e]"}`}
                    >
                      {thread.sender}
                    </span>
                    {thread.urgent ? (
                      <span className="shrink-0 rounded-full bg-[#bc5644]/10 px-1.5 py-px text-[10px] font-semibold text-[#bc5644]">
                        Urgent
                      </span>
                    ) : null}
                    {thread.label ? (
                      <span className="shrink-0 rounded-full bg-[#0d9488]/10 px-1.5 py-px text-[10px] font-semibold text-[#0b7268]">
                        {thread.label}
                      </span>
                    ) : null}
                    <span className="ml-auto shrink-0 text-[11px] text-[#53635e]/80">{thread.time}</span>
                  </span>
                  <span
                    className={`mt-0.5 block truncate text-[13px] tracking-[-0.1px] ${thread.unread ? "font-medium text-[#202d2a]" : "text-[#53635e]"}`}
                  >
                    {thread.subject}
                  </span>
                  <span className="mt-0.5 block truncate text-xs leading-5 text-[#53635e]/90">
                    {thread.preview}
                  </span>
                </span>
                {thread.unread ? (
                  <span className="mt-2 size-2 shrink-0 rounded-full bg-[#0d9488]" aria-hidden="true" />
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      </div>

      <div className="home-float absolute -bottom-28 left-5 w-64 rounded-2xl border border-white/70 bg-white/90 p-4 shadow-xl shadow-[#043f38]/15 backdrop-blur-sm sm:left-8">
        <p className="flex items-center gap-1.5 text-xs font-semibold text-[#202d2a]">
          <Sparkles className="size-3.5 text-[#b58a1f]" aria-hidden="true" />
          Copilot draft
        </p>
        <p className="mt-2 text-xs leading-5 text-[#53635e]">
          Hi Diego, Reply gives every thread one owner, so two replies to the same
          customer can't happen.
        </p>
      </div>
    </div>
  );
}

function HomeRoute() {
  return (
    <main className="min-h-svh bg-[#eef0ec] text-[#202d2a]">
      <header className="mx-auto flex h-18 w-full max-w-6xl items-center justify-between px-5 sm:px-8">
        <ReplyLogoFull className="h-7 w-auto text-[#0d9488]" aria-label="Reply" />
        <nav className="flex items-center gap-2">
          <Link
            to="/auth"
            search={{}}
            className={`inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-[#53635e] hover:bg-[#202d2a]/5 hover:text-[#202d2a] ${EASE}`}
          >
            Sign in
          </Link>
          <Link to="/auth" search={{}} className={`${PRIMARY_CTA} h-10 pl-5 [&>span]:size-7`}>
            Get started
            <CtaIcon />
          </Link>
        </nav>
      </header>

      {/* Hero: asymmetric split, copy left, live product preview right. */}
      <section className="mx-auto grid w-full max-w-6xl items-center gap-14 px-5 pt-12 pb-24 sm:px-8 lg:grid-cols-[1.02fr_0.98fr] lg:gap-10 lg:pt-20">
        <div className="min-w-0">
          <p
            className="home-rise text-[11px] font-bold tracking-[0.16em] text-[#bc5644] uppercase"
            style={{ "--rise-delay": "0s" } as CSSProperties}
          >
            The shared inbox that does its homework
          </p>
          <h1
            className="home-rise mt-5 max-w-xl text-[2.6rem] leading-[1.04] font-bold tracking-[-0.045em] sm:text-5xl lg:text-[3.35rem]"
            style={{ "--rise-delay": "0.08s" } as CSSProperties}
          >
            Turn context into a thoughtful reply.
          </h1>
          <p
            className="home-rise mt-6 max-w-md text-base leading-7 text-[#53635e]"
            style={{ "--rise-delay": "0.16s" } as CSSProperties}
          >
            Reply gives every conversation an owner, live company context, and a
            Copilot that drafts in your team's voice.
          </p>
          <div
            className="home-rise mt-9 flex flex-wrap items-center gap-3"
            style={{ "--rise-delay": "0.24s" } as CSSProperties}
          >
            <Link to="/auth" search={{}} className={PRIMARY_CTA}>
              Get started
              <CtaIcon />
            </Link>
            <Link to="/inbox" search={{}} className={SECONDARY_CTA}>
              Open inbox
            </Link>
          </div>
        </div>
        <div className="home-rise min-w-0 pb-20" style={{ "--rise-delay": "0.2s" } as CSSProperties}>
          <InboxPreview />
        </div>
      </section>

      {/* Enrichment strip: real sender domains resolved by Context.dev. */}
      <section className="border-y border-[#202d2a]/8 bg-[#fbfbf8]/60">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center gap-6 px-5 py-10 sm:px-8 lg:flex-row lg:justify-between">
          <p className="text-sm text-[#53635e]">
            Live company profiles for senders writing from
          </p>
          <ul className="flex flex-wrap items-center justify-center gap-x-9 gap-y-5">
            {SENDER_LOGOS.map((slug) => (
              <li key={slug}>
                <img
                  src={`https://cdn.simpleicons.org/${slug}/6b7a75`}
                  alt={slug}
                  className="h-5 w-auto opacity-80"
                  loading="lazy"
                />
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature bento: one dark showcase cell, two supporting cells. */}
      <section className="mx-auto w-full max-w-6xl px-5 py-24 sm:px-8">
        <h2 className="max-w-lg text-3xl font-bold tracking-[-0.035em] sm:text-4xl">
          Research, ownership, and drafting in one place.
        </h2>
        <div className="mt-12 grid gap-5 lg:grid-cols-5">
          <div className="flex flex-col justify-between gap-10 rounded-[2rem] bg-linear-to-br from-[#043f38] via-[#0b7268] to-[#0d9488] p-8 text-white shadow-xl shadow-[#043f38]/20 lg:col-span-3">
            <div>
              <h3 className="text-xl font-semibold tracking-[-0.02em]">Live company context</h3>
              <p className="mt-2 max-w-sm text-sm leading-6 text-white/75">
                Context.dev resolves every sender's domain into a company profile
                that sits beside the thread.
              </p>
            </div>
            <div className="max-w-sm rounded-2xl bg-white/95 p-5 shadow-lg shadow-black/10">
              <div className="flex items-center gap-3">
                <span className="flex size-10 items-center justify-center rounded-xl bg-[#eef0ec]">
                  <img src="https://cdn.simpleicons.org/bookingdotcom" alt="" className="size-5" loading="lazy" />
                </span>
                <span>
                  <span className="block text-sm font-semibold text-[#202d2a]">Booking.com</span>
                  <span className="block text-xs text-[#53635e]">Travel · Amsterdam, Netherlands</span>
                </span>
              </div>
              <p className="mt-3 text-xs leading-5 text-[#53635e]">
                Online travel platform connecting millions of travellers with stays
                in more than 220 countries.
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-5 lg:col-span-2">
            <div className="flex-1 rounded-[2rem] border border-white/80 bg-[#fbfbf8] p-8 shadow-lg shadow-[#202d2a]/5">
              <h3 className="text-xl font-semibold tracking-[-0.02em]">Owned threads</h3>
              <p className="mt-2 text-sm leading-6 text-[#53635e]">
                One owner and a clear status per conversation, so nothing sits
                unanswered.
              </p>
              <div className="mt-5 flex flex-wrap gap-2">
                <span className="rounded-full bg-[#0d9488]/10 px-3 py-1 text-xs font-medium text-[#0b7268]">Open</span>
                <span className="rounded-full bg-[#b58a1f]/12 px-3 py-1 text-xs font-medium text-[#8a6a1a]">Waiting</span>
                <span className="flex items-center gap-1 rounded-full bg-[#0d9488] px-3 py-1 text-xs font-medium text-white">
                  <Check className="size-3" aria-hidden="true" />
                  Done
                </span>
              </div>
            </div>
            <div className="flex-1 rounded-[2rem] bg-[#f7c95c]/25 p-8 ring-1 ring-[#b58a1f]/15">
              <h3 className="flex items-center gap-2 text-xl font-semibold tracking-[-0.02em]">
                <Sparkles className="size-4.5 text-[#b58a1f]" aria-hidden="true" />
                Copilot replies
              </h3>
              <p className="mt-2 text-sm leading-6 text-[#53635e]">
                Drafts grounded in the conversation and the company beside it, in
                your voice.
              </p>
              <div className="mt-5 space-y-2" aria-hidden="true">
                <div className="h-2 w-4/5 rounded-full bg-[#202d2a]/12" />
                <div className="h-2 w-3/5 rounded-full bg-[#202d2a]/12" />
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Closing CTA */}
      <section className="mx-auto w-full max-w-6xl px-5 pb-24 sm:px-8">
        <div className="flex flex-col items-center gap-7 rounded-[2rem] bg-linear-to-br from-[#043f38] via-[#0b7268] to-[#0d9488] px-8 py-16 text-center text-white shadow-xl shadow-[#043f38]/25 sm:py-20">
          <h2 className="max-w-xl text-3xl font-bold tracking-[-0.035em] text-balance sm:text-4xl">
            Ready when your inbox is.
          </h2>
          <p className="max-w-md text-sm leading-6 text-white/75">
            Create a workspace, connect an inbox, and send your first
            context-aware reply in minutes.
          </p>
          <Link
            to="/auth"
            search={{}}
            className={`group inline-flex h-12 items-center gap-3 rounded-full bg-white pr-1.5 pl-6 text-sm font-semibold text-[#043f38] shadow-lg shadow-black/15 outline-none hover:bg-[#eef0ec] focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#0b7268] active:scale-[0.98] ${EASE}`}
          >
            Get started
            <span
              className={`flex size-9 items-center justify-center rounded-full bg-[#043f38]/10 group-hover:translate-x-0.5 group-hover:bg-[#043f38]/15 ${EASE}`}
              aria-hidden="true"
            >
              <ArrowRight className="size-4" />
            </span>
          </Link>
        </div>
      </section>

      <footer className="border-t border-[#202d2a]/8">
        <div className="mx-auto flex w-full max-w-6xl flex-col items-center justify-between gap-4 px-5 py-8 sm:flex-row sm:px-8">
          <span className="flex items-center gap-2">
            <ReplyLogoMark className="h-5 w-auto text-[#0d9488]" aria-hidden="true" />
            <span className="text-sm font-semibold tracking-[-0.1px]">Reply</span>
          </span>
          <p className="text-xs text-[#53635e]">
            Secure authentication powered by Convex Auth v2
          </p>
        </div>
      </footer>
    </main>
  );
}
