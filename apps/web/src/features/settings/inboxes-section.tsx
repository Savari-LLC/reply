import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@reply/ui/components/alert-dialog";
import { Badge } from "@reply/ui/components/badge";
import { Button } from "@reply/ui/components/button";
import { Checkbox } from "@reply/ui/components/checkbox";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@reply/ui/components/dialog";
import { Input } from "@reply/ui/components/input";
import { Label } from "@reply/ui/components/label";
import { Spinner } from "@reply/ui/components/spinner";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  ChevronDown,
  Inbox as InboxIcon,
  Lock,
  Plug,
  Plus,
  Trash2,
  Unplug,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { ProviderBadge, providerMeta } from "./channel-providers";
import { ConnectChannelDialog } from "./connect-channel-dialog";
import { errorMessage } from "./constants";

type SettingsInbox = FunctionReturnType<typeof api.inboxes.listSettings>[number];
type SettingsChannel = SettingsInbox["channels"][number];
type Member = FunctionReturnType<typeof api.members.list>[number];

/**
 * Inboxes are the only container in settings: a channel is connected from the
 * inbox it delivers into, so there is no separate channel list to reconcile.
 */
export function InboxesSection({ isAdmin }: { isAdmin: boolean }) {
  const inboxes = useQuery(api.inboxes.listSettings, {});
  const members = useQuery(api.members.list, {});

  if (inboxes === undefined) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-4 text-sm text-(--inbox-text-muted)">
        <Spinner />
        Loading inboxes…
      </div>
    );
  }

  const personal = inboxes.filter((inbox) => inbox.kind === "personal");
  const shared = inboxes.filter((inbox) => inbox.kind === "shared");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section aria-label="Inboxes" className="flex flex-col gap-3">
        <header className="flex items-start gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
              <InboxIcon className="size-4 text-(--inbox-text-subtle)" aria-hidden />
              Inboxes
            </h2>
            <p className="mt-0.5 text-xs leading-5 text-(--inbox-text-muted)">
              An inbox holds the work. Connect Gmail, Outlook, WhatsApp, or SMS to it and every
              conversation those accounts receive lands here.
            </p>
          </div>
          <CreateInboxDialog isAdmin={isAdmin} />
        </header>

        <InboxGroup
          title="Your inboxes"
          caption="Private to you."
          inboxes={personal}
          isAdmin={isAdmin}
          members={members ?? []}
        />
        <InboxGroup
          title="Shared inboxes"
          caption="Worked by the team."
          inboxes={shared}
          isAdmin={isAdmin}
          members={members ?? []}
        />
      </section>
    </div>
  );
}

function InboxGroup({
  title,
  caption,
  inboxes,
  isAdmin,
  members,
}: {
  title: string;
  caption: string;
  inboxes: SettingsInbox[];
  isAdmin: boolean;
  members: Member[];
}) {
  if (inboxes.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="mt-2 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
        {title} · <span className="font-normal">{caption}</span>
      </h3>
      {inboxes.map((inbox) => (
        <InboxCard key={inbox._id} inbox={inbox} isAdmin={isAdmin} members={members} />
      ))}
    </div>
  );
}

function InboxCard({
  inbox,
  isAdmin,
  members,
}: {
  inbox: SettingsInbox;
  isAdmin: boolean;
  members: Member[];
}) {
  const removeInbox = useMutation(api.inboxes.remove);

  const remove = async () => {
    try {
      await removeInbox({ inboxId: inbox._id });
      toast.success(`Inbox “${inbox.name}” deleted`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const channelCount = inbox.channels.length;

  return (
    <section
      aria-label={`${inbox.name} inbox settings`}
      className="flex flex-col gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) p-4"
    >
      <header className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <p className="flex items-center gap-2 text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
            <span className="truncate">{inbox.name}</span>
            <Badge
              variant={inbox.kind === "personal" ? "secondary" : "outline"}
              className="rounded-full! text-[10px]"
            >
              {inbox.kind === "personal" ? "Personal" : "Shared"}
            </Badge>
          </p>
          <p className="mt-0.5 text-xs text-(--inbox-text-muted)">
            {inbox.threadCount} conversation{inbox.threadCount === 1 ? "" : "s"} ·{" "}
            {channelCount === 0
              ? "no channel connected"
              : `${channelCount} channel${channelCount === 1 ? "" : "s"}`}
          </p>
        </div>
        {inbox.canManage && channelCount > 0 ? <ConnectChannelDialog inbox={inbox} /> : null}
        {inbox.canManage ? (
          <AlertDialog>
            <AlertDialogTrigger
              aria-label={`Delete ${inbox.name}`}
              className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-destructive focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            >
              <Trash2 className="size-4" aria-hidden />
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Delete {inbox.name}?</AlertDialogTitle>
                <AlertDialogDescription>
                  {channelCount === 0
                    ? "This inbox is empty, so nothing else is affected."
                    : `Its ${channelCount} connected channel${
                        channelCount === 1 ? "" : "s"
                      } and all ${inbox.threadCount} conversation${
                        inbox.threadCount === 1 ? "" : "s"
                      } are permanently deleted. This cannot be undone.`}
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancel</AlertDialogCancel>
                <AlertDialogAction onClick={() => void remove()}>Delete inbox</AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        ) : null}
      </header>

      {channelCount === 0 ? (
        <div className="flex flex-col items-start gap-3 rounded-lg border border-dashed border-(--inbox-border) bg-(--inbox-surface) px-4 py-5">
          <div>
            <p className="flex items-center gap-1.5 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
              <Plug className="size-4 text-(--inbox-text-subtle)" aria-hidden />
              No channel connected yet
            </p>
            <p className="mt-1 text-xs leading-5 text-(--inbox-text-muted)">
              {inbox.canManage
                ? "Link Gmail, Outlook, WhatsApp, or SMS to start receiving conversations here."
                : "An admin needs to connect a channel before conversations arrive here."}
            </p>
          </div>
          {inbox.canManage ? (
            <ConnectChannelDialog inbox={inbox} variant="empty-state" />
          ) : null}
        </div>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {inbox.channels.map((channel) => (
            <ChannelRow
              key={channel._id}
              channel={channel}
              inboxName={inbox.name}
              canManage={inbox.canManage}
            />
          ))}
        </ul>
      )}

      {isAdmin && inbox.kind === "shared" ? (
        <InboxAccessList inbox={inbox} members={members} />
      ) : null}
      {inbox.kind === "personal" ? (
        <p className="flex items-center gap-1.5 text-xs text-(--inbox-text-muted)">
          <Lock className="size-3.5" aria-hidden />
          Only you can see this inbox and its channels.
        </p>
      ) : null}
    </section>
  );
}

function ChannelRow({
  channel,
  inboxName,
  canManage,
}: {
  channel: SettingsChannel;
  inboxName: string;
  canManage: boolean;
}) {
  const disconnect = useMutation(api.channels.disconnect);
  const [pending, setPending] = useState(false);
  const meta = providerMeta(channel.provider);
  const connected = channel.status === "connected";

  const remove = async () => {
    setPending(true);
    try {
      await disconnect({ channelId: channel._id });
      toast.success(`${meta.label} disconnected from ${inboxName}`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-lg border border-(--inbox-border-subtle) bg-(--inbox-surface) px-3 py-2.5">
      <ProviderBadge provider={channel.provider} size="sm" />
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm tracking-[-0.1px] text-(--inbox-text)">
          <span className="truncate font-medium">{channel.address}</span>
          <span
            className={`flex shrink-0 items-center gap-1 text-xs font-medium ${
              connected ? "text-emerald-700" : "text-(--inbox-text-muted)"
            }`}
          >
            <span
              className={`size-1.5 rounded-full ${
                connected ? "bg-(--inbox-success)" : "bg-(--inbox-border-strong)"
              }`}
              aria-hidden
            />
            {connected ? "Connected" : "Disconnected"}
          </span>
        </p>
        <p className="mt-0.5 truncate text-xs text-(--inbox-text-muted)">
          {meta.label} · {channel.threadCount} conversation
          {channel.threadCount === 1 ? "" : "s"}
        </p>
      </div>
      {canManage ? (
        <AlertDialog>
          <AlertDialogTrigger
            aria-label={`Disconnect ${channel.address} from ${inboxName}`}
            disabled={pending}
            className="flex size-7 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-destructive focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:opacity-50"
          >
            {pending ? <Spinner className="size-3.5" /> : <Unplug className="size-3.5" aria-hidden />}
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Disconnect {channel.address}?</AlertDialogTitle>
              <AlertDialogDescription>
                {channel.threadCount === 0
                  ? `${meta.label} stops delivering into ${inboxName}.`
                  : `${meta.label} stops delivering into ${inboxName}, and its ${channel.threadCount} conversation${
                      channel.threadCount === 1 ? "" : "s"
                    } are permanently deleted.`}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>Disconnect</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </li>
  );
}

function CreateInboxDialog({ isAdmin }: { isAdmin: boolean }) {
  const createInbox = useMutation(api.inboxes.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [kind, setKind] = useState<"shared" | "personal">(isAdmin ? "shared" : "personal");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await createInbox({ name, kind });
      toast.success(`Inbox “${name.trim()}” created`);
      setName("");
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)">
        <Plus className="size-4" aria-hidden />
        New inbox
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create an inbox</DialogTitle>
          <DialogDescription>
            Name it after the work it holds. You'll connect a channel to it next.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-inbox-name">Inbox name</Label>
            <Input
              id="new-inbox-name"
              value={name}
              disabled={pending}
              minLength={2}
              maxLength={60}
              placeholder="e.g. Partnerships"
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>

          <fieldset className="flex flex-col gap-2" disabled={pending || !isAdmin}>
            <legend className="mb-2 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
              Who works in it
            </legend>
            <div className="grid gap-2 sm:grid-cols-2">
              <KindOption
                value="personal"
                selected={kind === "personal"}
                onSelect={setKind}
                icon={<Lock className="size-4" aria-hidden />}
                title="Personal"
                description="Only you can see it."
                disabled={pending}
              />
              <KindOption
                value="shared"
                selected={kind === "shared"}
                onSelect={setKind}
                icon={<Users className="size-4" aria-hidden />}
                title="Shared"
                description={
                  isAdmin ? "The whole team can work in it." : "Admins only."
                }
                disabled={pending || !isAdmin}
              />
            </div>
            {!isAdmin ? (
              <p className="text-xs text-(--inbox-text-muted)">
                Only workspace admins can create shared inboxes.
              </p>
            ) : null}
          </fieldset>

          <Button
            type="submit"
            disabled={pending || name.trim().length < 2}
            className="rounded-lg! bg-[#202d2a] hover:bg-[#30423e]"
          >
            {pending ? <Spinner /> : <Plus aria-hidden />}
            {pending ? "Creating…" : "Create inbox"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function KindOption({
  value,
  selected,
  onSelect,
  icon,
  title,
  description,
  disabled,
}: {
  value: "shared" | "personal";
  selected: boolean;
  onSelect: (value: "shared" | "personal") => void;
  icon: React.ReactNode;
  title: string;
  description: string;
  disabled: boolean;
}) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={() => onSelect(value)}
      className={`flex flex-col gap-1 rounded-xl border p-3 text-left outline-none transition-colors focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:opacity-50 ${
        selected
          ? "border-(--inbox-text-strong) bg-(--inbox-hover)"
          : "border-(--inbox-border-subtle) bg-(--inbox-surface) hover:bg-(--inbox-hover)"
      }`}
    >
      <span className="flex items-center gap-1.5 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
        <span className="text-(--inbox-text-subtle)">{icon}</span>
        {title}
      </span>
      <span className="text-xs text-(--inbox-text-muted)">{description}</span>
    </button>
  );
}

function InboxAccessList({ inbox, members }: { inbox: SettingsInbox; members: Member[] }) {
  const setAccess = useMutation(api.inboxes.setAccess);
  const [expanded, setExpanded] = useState(false);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);
  const detailId = `inbox-access-${inbox._id}`;

  const toggle = async (member: Member, allowed: boolean) => {
    setPendingUserId(member.userId);
    try {
      await setAccess({ inboxId: inbox._id, userId: member.userId as Id<"users">, allowed });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <div className="flex flex-col gap-1">
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        className="flex h-8 w-fit items-center gap-1.5 rounded-lg px-2 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
      >
        <Users className="size-3.5" aria-hidden />
        Who can see this inbox
        <ChevronDown
          className={`size-3.5 transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <ul id={detailId} className="flex flex-col gap-1">
          {members.map((member) => {
            const isAdminMember = member.role === "admin";
            const allowed = isAdminMember || inbox.accessUserIds.includes(member.userId);
            return (
              <li
                key={member.userId}
                className="flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-(--inbox-hover)"
              >
                <Checkbox
                  id={`inbox-access-${inbox._id}-${member.userId}`}
                  checked={allowed}
                  disabled={isAdminMember || pendingUserId === member.userId}
                  onCheckedChange={(checked) => void toggle(member, checked === true)}
                />
                <label
                  htmlFor={`inbox-access-${inbox._id}-${member.userId}`}
                  className="min-w-0 flex-1 truncate text-sm tracking-[-0.1px] text-(--inbox-text)"
                >
                  {member.name}
                </label>
                {isAdminMember ? (
                  <span className="text-xs text-(--inbox-text-muted)">
                    Admins always have access
                  </span>
                ) : null}
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
