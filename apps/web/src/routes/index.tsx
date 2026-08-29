import { api } from "@reply/backend/convex/_generated/api";
import { Badge } from "@reply/ui/components/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@reply/ui/components/card";
import { Separator } from "@reply/ui/components/separator";
import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import {
  Bot,
  Boxes,
  Check,
  Database,
  Fingerprint,
  Layers3,
  MessageSquareText,
  Palette,
  Sparkles,
} from "lucide-react";

export const Route = createFileRoute("/")({
  component: StarterHome,
});

const stack = [
  { icon: Layers3, name: "TanStack Start", detail: "React 19, Router, SSR, and Vite" },
  { icon: Database, name: "Convex", detail: "Cloud deployment and generated client" },
  { icon: Fingerprint, name: "Convex Auth v2", detail: "Alpha component and signing keys ready" },
  { icon: Bot, name: "AI Gateway", detail: "Provider and Agent component installed" },
  { icon: Sparkles, name: "Context.dev", detail: "Official Convex component mounted" },
  { icon: Palette, name: "shadcn/ui", detail: "Shared stable component library installed" },
];

const tomorrow = [
  "Agree on the two-minute judging story",
  "Model only the data needed for that story",
  "Seed realistic email content",
  "Wire one Context.dev enrichment moment",
  "Generate one editable AI-assisted draft",
  "Rehearse, record a backup, and stop adding scope",
];

function StarterHome() {
  const health = useQuery(api.healthCheck.get);

  return (
    <main className="min-h-svh bg-[#eef0ec] px-4 py-5 sm:px-6 sm:py-8">
      <div className="mx-auto max-w-6xl overflow-hidden rounded-[28px] border border-white/80 bg-[#fbfbf8] shadow-[0_28px_90px_rgba(32,45,42,0.12)]">
        <header className="flex items-center justify-between border-b border-border/70 px-5 py-4 sm:px-8">
          <div className="flex items-center gap-3">
            <div className="relative flex size-9 items-center justify-center rounded-xl bg-[#ff7a66] text-white shadow-lg shadow-[#ff7a66]/20">
              <MessageSquareText className="size-[18px]" strokeWidth={2.5} />
              <span className="absolute -right-0.5 -bottom-0.5 size-2.5 rounded-full border-2 border-[#fbfbf8] bg-[#f7c95c]" />
            </div>
            <div>
              <p className="text-[17px] font-bold tracking-[-0.04em]">reply</p>
              <p className="text-[10px] text-muted-foreground">Hackathon starter</p>
            </div>
          </div>
          <Badge variant="outline" className="gap-1.5 rounded-full! border-[#d6e4d8] bg-[#f2f8f3] px-3 py-1 text-[10px] text-[#3f6d48]">
            <span className="size-1.5 rounded-full bg-[#55a667]" />
            {health === "OK" ? "Convex connected" : "Connecting"}
          </Badge>
        </header>

        <section className="grid gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1.1fr_0.9fr] lg:px-14 lg:py-20">
          <div className="max-w-2xl">
            <Badge className="mb-5 rounded-full! border-0 bg-[#fff0ed] px-3 py-1 text-[10px] font-semibold text-[#bc5644]">
              Infrastructure ready · product intentionally unbuilt
            </Badge>
            <h1 className="max-w-xl text-4xl font-bold leading-[1.02] tracking-[-0.055em] text-[#202d2a] sm:text-5xl lg:text-[58px]">
              Start the hackathon with a clean runway.
            </h1>
            <p className="mt-6 max-w-xl text-sm leading-7 text-muted-foreground sm:text-base">
              The stack, components, deployment, auth keys, and coding guidance are ready. The Reply product schema and feature implementation stay open for the team to design together tomorrow.
            </p>
            <div className="mt-8 flex flex-wrap gap-3 text-xs">
              <ReadyItem>Bun workspace installed</ReadyItem>
              <ReadyItem>Plan documented</ReadyItem>
              <ReadyItem>Empty schema</ReadyItem>
            </div>
          </div>

          <Card className="rounded-3xl! border-[#dfe3dc] bg-white shadow-[0_18px_50px_rgba(32,45,42,0.07)]">
            <CardHeader className="px-6 pt-6">
              <div className="mb-3 flex size-10 items-center justify-center rounded-xl bg-[#202d2a] text-white"><Boxes className="size-4" /></div>
              <CardTitle className="text-xl tracking-[-0.03em]">Tomorrow’s build order</CardTitle>
              <CardDescription>Keep the first usable loop narrow and demonstrable.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-1 px-6 pb-6">
              {tomorrow.map((item, index) => (
                <div key={item} className="flex items-start gap-3 rounded-xl px-2 py-2.5 text-xs leading-5">
                  <span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-[#f0f2ee] text-[9px] font-bold text-muted-foreground">{index + 1}</span>
                  <span>{item}</span>
                </div>
              ))}
            </CardContent>
          </Card>
        </section>

        <Separator />

        <section className="px-5 py-10 sm:px-8 lg:px-14">
          <div className="mb-6 flex items-end justify-between gap-6">
            <div>
              <p className="text-[10px] font-bold tracking-[0.12em] text-muted-foreground uppercase">Installed foundation</p>
              <h2 className="mt-2 text-2xl font-bold tracking-[-0.035em]">Everything needed to begin</h2>
            </div>
            <p className="hidden max-w-sm text-right text-xs leading-5 text-muted-foreground sm:block">No product tables, sample inboxes, or feature logic have been committed.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {stack.map(({ icon: Icon, name, detail }) => (
              <div key={name} className="group rounded-2xl border border-[#e3e5df] bg-white p-4 transition-all hover:-translate-y-0.5 hover:border-[#f0b0a4] hover:shadow-lg hover:shadow-[#202d2a]/5">
                <div className="mb-4 flex size-9 items-center justify-center rounded-xl bg-[#f0f2ee] text-[#53635e] transition-colors group-hover:bg-[#fff0ed] group-hover:text-[#bd5745]"><Icon className="size-4" /></div>
                <p className="text-sm font-semibold">{name}</p>
                <p className="mt-1 text-[11px] leading-5 text-muted-foreground">{detail}</p>
              </div>
            ))}
          </div>
        </section>

        <footer className="flex flex-col gap-2 border-t border-border/70 bg-[#202d2a] px-5 py-5 text-white sm:flex-row sm:items-center sm:justify-between sm:px-8 lg:px-14">
          <p className="text-xs font-semibold">Reply · Savari hackathon starter</p>
          <p className="text-[10px] text-white/45">Read docs/hackathon-plan.md before feature work.</p>
        </footer>
      </div>
    </main>
  );
}

function ReadyItem({ children }: { children: string }) {
  return (
    <div className="flex items-center gap-2 rounded-xl border bg-white px-3 py-2.5">
      <Check className="size-3.5 text-emerald-600" />
      {children}
    </div>
  );
}
