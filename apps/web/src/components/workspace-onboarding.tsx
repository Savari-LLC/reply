import { api } from "@reply/backend/convex/_generated/api";
import { Alert, AlertDescription } from "@reply/ui/components/alert";
import { Badge } from "@reply/ui/components/badge";
import { Button } from "@reply/ui/components/button";
import { Input } from "@reply/ui/components/input";
import { Label } from "@reply/ui/components/label";
import { Spinner } from "@reply/ui/components/spinner";
import { Textarea } from "@reply/ui/components/textarea";
import { useAuthActions } from "@convex-dev/auth/react";
import { useAction, useMutation, useQuery } from "convex/react";
import {
  ArrowRight,
  Building2,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock3,
  LogOut,
  MailPlus,
  MessageSquareText,
  Users,
} from "lucide-react";
import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { toast } from "sonner";

import { errorMessage } from "@/lib/errors";

function OnboardingShell({
  eyebrow,
  title,
  description,
  step,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  step: 1 | 2;
  children: ReactNode;
}) {
  const { signOut } = useAuthActions();
  const [signingOut, setSigningOut] = useState(false);

  return (
    <main className="grid min-h-svh bg-[#eef0ec] lg:grid-cols-[0.85fr_1.15fr]">
      <section className="relative hidden overflow-hidden bg-[#202d2a] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-24 -right-24 size-80 rounded-full bg-[#ff7a66]/15 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#ff7a66]">
            <MessageSquareText className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <span className="text-lg font-bold tracking-[-0.04em]">reply</span>
        </div>
        <div className="relative">
          <p className="text-xs font-semibold tracking-[0.16em] text-[#f7c95c] uppercase">Set up your shared inbox</p>
          <h1 className="mt-5 max-w-md text-5xl font-bold leading-[1.03] tracking-[-0.055em]">A calm place for the whole team to reply.</h1>
          <div className="mt-10 space-y-5">
            <ProgressItem active={step === 1} complete={step > 1} number={1} title="Create your workspace" />
            <ProgressItem active={step === 2} complete={false} number={2} title="Invite your teammates" />
          </div>
        </div>
        <p className="relative text-xs text-white/35">Workspace access is enforced by Convex on every request.</p>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-xl">
          <header className="mb-6 flex items-center justify-between lg:justify-end">
            <div className="flex items-center gap-2 lg:hidden">
              <div className="flex size-9 items-center justify-center rounded-xl bg-[#ff7a66] text-white">
                <MessageSquareText className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
              </div>
              <span className="font-bold tracking-[-0.04em]">reply</span>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="rounded-lg! text-muted-foreground"
              disabled={signingOut}
              onClick={async () => {
                setSigningOut(true);
                try {
                  await signOut();
                } finally {
                  setSigningOut(false);
                }
              }}
            >
              {signingOut ? <Spinner /> : <LogOut aria-hidden="true" />}
              Sign out
            </Button>
          </header>

          <div className="rounded-[28px] border border-white/80 bg-[#fbfbf8] p-5 shadow-[0_28px_90px_rgba(32,45,42,0.13)] sm:p-8">
            <p className="text-[10px] font-bold tracking-[0.14em] text-[#bc5644] uppercase">{eyebrow}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#202d2a] sm:text-4xl">{title}</h2>
            <p className="mt-3 max-w-lg text-sm leading-6 text-muted-foreground">{description}</p>
            <div className="mt-8">{children}</div>
          </div>
        </div>
      </section>
    </main>
  );
}

function ProgressItem({ active, complete, number, title }: { active: boolean; complete: boolean; number: number; title: string }) {
  return (
    <div className={`flex items-center gap-3 ${active || complete ? "text-white" : "text-white/35"}`}>
      <span className={`flex size-8 items-center justify-center rounded-full border text-xs font-bold ${active ? "border-[#ff7a66] bg-[#ff7a66]" : complete ? "border-[#6b9c74] bg-[#6b9c74]" : "border-white/20"}`}>
        {complete ? <Check className="size-4" aria-hidden="true" /> : number}
      </span>
      <span className="text-sm font-semibold">{title}</span>
    </div>
  );
}

export function CreateWorkspacePage() {
  const createWorkspace = useMutation(api.workspaces.create);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await createWorkspace({ name });
    } catch (cause) {
      setError(errorMessage(cause));
      setPending(false);
    }
  }

  return (
    <OnboardingShell
      eyebrow="Step 1 of 2"
      title="Create your workspace"
      description="Your workspace keeps inboxes, conversations, teammates, and company context together. You can change its name later."
      step={1}
    >
      <form className="space-y-5" onSubmit={submit}>
        <div className="space-y-2">
          <Label htmlFor="workspace-name">Workspace name</Label>
          <div className="relative">
            <Building2 className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
            <Input
              id="workspace-name"
              name="workspace-name"
              className="h-12 rounded-xl! bg-white pr-3 pl-10 text-sm"
              placeholder="Acme Support"
              autoComplete="organization"
              value={name}
              disabled={pending}
              aria-invalid={error !== null}
              minLength={2}
              maxLength={80}
              required
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">We’ll also create Sales, Accounts, and Support inboxes to get you started.</p>
        </div>

        {error !== null ? (
          <Alert variant="destructive" className="rounded-xl!" aria-live="polite">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" size="lg" className="h-12 w-full rounded-xl! bg-[#202d2a] text-sm hover:bg-[#30423e]" disabled={pending || name.trim().length < 2}>
          {pending ? <Spinner /> : <ArrowRight aria-hidden="true" />}
          {pending ? "Creating workspace…" : "Create workspace"}
        </Button>
      </form>
    </OnboardingShell>
  );
}

export function InviteMembersPage({ workspaceName, memberCount }: { workspaceName: string; memberCount: number }) {
  const sendInvitations = useAction(api.invitations.send);
  const completeOnboarding = useMutation(api.workspaces.completeOnboarding);
  const invitations = useQuery(api.invitations.listCurrent);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);
  const [continuing, setContinuing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    const values = emails.split(/[\s,;]+/).filter(Boolean);
    setSending(true);
    try {
      const result = await sendInvitations({ emails: values });
      setEmails(result.failed.join(", "));
      if (result.sent > 0) {
        toast.success(`${result.sent} invitation${result.sent === 1 ? "" : "s"} queued`);
      }
      if (result.failed.length > 0) {
        setError(`Could not send ${result.failed.length === 1 ? "this invitation" : "these invitations"}: ${result.failed.join(", ")}`);
      }
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSending(false);
    }
  }

  async function continueToWorkspace() {
    setContinuing(true);
    setError(null);
    try {
      await completeOnboarding({});
    } catch (cause) {
      setError(errorMessage(cause));
      setContinuing(false);
    }
  }

  return (
    <OnboardingShell
      eyebrow="Step 2 of 2"
      title="Invite your teammates"
      description={`“${workspaceName}” is ready. Invite the people who should share its inboxes, assignments, and replies.`}
      step={2}
    >
      <form className="space-y-4" onSubmit={invite}>
        <div className="space-y-2">
          <Label htmlFor="invite-emails">Email addresses</Label>
          <div className="relative">
            <MailPlus className="absolute top-3.5 left-3 size-4 text-muted-foreground" aria-hidden="true" />
            <Textarea
              id="invite-emails"
              name="invite-emails"
              className="min-h-28 rounded-xl! bg-white pt-3 pr-3 pl-10 text-sm"
              placeholder="maya@example.com, noah@example.com"
              value={emails}
              disabled={sending}
              aria-invalid={error !== null}
              required
              onChange={(event) => setEmails(event.target.value)}
            />
          </div>
          <p className="text-[11px] leading-5 text-muted-foreground">Separate multiple addresses with commas or new lines. Invitations expire after 7 days.</p>
        </div>

        {error !== null ? (
          <Alert variant="destructive" className="rounded-xl!" aria-live="polite">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}

        <Button type="submit" variant="outline" size="lg" className="h-11 w-full rounded-xl! bg-white text-sm" disabled={sending || emails.trim().length === 0}>
          {sending ? <Spinner /> : <MailPlus aria-hidden="true" />}
          {sending ? "Sending invitations…" : "Send invitations"}
        </Button>
      </form>

      <div className="mt-7 border-t border-border/70 pt-6">
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs font-semibold">
            <Users className="size-4 text-muted-foreground" aria-hidden="true" />
            Team access
          </div>
          <Badge variant="outline" className="rounded-full! bg-white text-[10px]">{memberCount} member{memberCount === 1 ? "" : "s"}</Badge>
        </div>

        {invitations === undefined ? (
          <div className="flex items-center gap-2 rounded-xl bg-[#f0f2ee] px-3 py-3 text-xs text-muted-foreground"><Spinner />Loading invitations…</div>
        ) : invitations.length > 0 ? (
          <div className="space-y-2">
            {invitations.slice(0, 5).map((invitation) => (
              <div key={invitation._id} className="flex items-center justify-between gap-3 rounded-xl border bg-white px-3 py-3">
                <span className="min-w-0 truncate text-xs font-medium">{invitation.email}</span>
                <InvitationStatus status={invitation.status === "pending" && invitation.expiresAt <= Date.now() ? "expired" : invitation.status} />
              </div>
            ))}
          </div>
        ) : (
          <div className="rounded-xl bg-[#f0f2ee] px-3 py-3 text-xs leading-5 text-muted-foreground">No invitations sent yet. You can skip this step and continue to your workspace.</div>
        )}
      </div>

      <Button type="button" size="lg" className="mt-6 h-12 w-full rounded-xl! bg-[#202d2a] text-sm hover:bg-[#30423e]" disabled={continuing} onClick={continueToWorkspace}>
        {continuing ? <Spinner /> : <ArrowRight aria-hidden="true" />}
        {continuing ? "Opening workspace…" : "Continue to workspace"}
      </Button>
    </OnboardingShell>
  );
}

function InvitationStatus({ status }: { status: "pending" | "accepted" | "expired" | "revoked" }) {
  if (status === "accepted") {
    return <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-emerald-700"><CheckCircle2 className="size-3.5" aria-hidden="true" />Joined</span>;
  }
  if (status === "pending") {
    return <span className="flex shrink-0 items-center gap-1 text-[10px] font-semibold text-amber-700"><Clock3 className="size-3.5" aria-hidden="true" />Pending</span>;
  }
  return <span className="shrink-0 text-[10px] font-semibold text-muted-foreground">{status === "expired" ? "Expired" : "Replaced"}</span>;
}

export function AcceptInvitationPage({ token, onAccepted, onDismiss }: { token: string; onAccepted: (workspaceName: string) => void; onDismiss: () => void }) {
  const acceptInvitation = useAction(api.invitations.accept);
  const started = useRef(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (started.current) {
      return;
    }
    started.current = true;
    void acceptInvitation({ token })
      .then((result) => onAccepted(result.workspaceName))
      .catch((cause) => setError(errorMessage(cause)));
  }, [acceptInvitation, onAccepted, token]);

  return (
    <OnboardingShell
      eyebrow="Workspace invitation"
      title={error === null ? "Joining your team…" : "We couldn’t accept this invitation"}
      description={error === null ? "We’re securely adding your account to the workspace. This should only take a moment." : "The link may have expired, been replaced, or already been used by another account."}
      step={2}
    >
      {error === null ? (
        <div className="flex items-center gap-3 rounded-xl bg-[#f0f2ee] px-4 py-4 text-sm font-medium text-[#202d2a]" aria-live="polite">
          <Spinner />
          Verifying invitation…
        </div>
      ) : (
        <div className="space-y-4">
          <Alert variant="destructive" className="rounded-xl!">
            <CircleAlert aria-hidden="true" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
          <Button type="button" variant="outline" className="h-11 w-full rounded-xl! bg-white" onClick={onDismiss}>Continue without invitation</Button>
        </div>
      )}
    </OnboardingShell>
  );
}
