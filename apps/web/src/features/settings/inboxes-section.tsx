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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reply/ui/components/select";
import { Spinner } from "@reply/ui/components/spinner";
import { useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import {
  Cable,
  ChevronDown,
  Database,
  Inbox as InboxIcon,
  Link2,
  Lock,
  Mail,
  Plus,
  Trash2,
  Unlink,
  Users,
} from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

type SettingsInbox = FunctionReturnType<typeof api.inboxes.listSettings>[number];
type SettingsChannel = FunctionReturnType<typeof api.channels.listSettings>[number];
type Member = FunctionReturnType<typeof api.members.list>[number];
type SampleDataset = "sales" | "accounts" | "support";

const DATASET_OPTIONS: Array<{ value: SampleDataset; label: string }> = [
  { value: "sales", label: "Sales conversations" },
  { value: "accounts", label: "Accounts conversations" },
  { value: "support", label: "Support conversations" },
];

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Uncaught (Error: )?/, "").replace(/ at .*$/s, "")
    : "Something went wrong. Please try again.";
}

export function InboxesSection({ isAdmin }: { isAdmin: boolean }) {
  const inboxes = useQuery(api.inboxes.listSettings, {});
  const channels = useQuery(api.channels.listSettings, {});
  const members = useQuery(api.members.list, {});

  if (inboxes === undefined || channels === undefined) {
    return (
      <div className="mx-auto flex max-w-2xl items-center gap-2 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-4 text-sm text-(--inbox-text-muted)">
        <Spinner />
        Loading inboxes and channels…
      </div>
    );
  }
  const personalChannels = channels.filter((channel) => channel.kind === "personal");
  const sharedChannels = channels.filter((channel) => channel.kind === "shared");

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-8">
      <section aria-label="Inboxes" className="flex flex-col gap-3">
        <header className="flex items-center gap-2">
          <h2 className="flex min-w-0 flex-1 items-center gap-1.5 text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
            <InboxIcon className="size-4 text-(--inbox-text-subtle)" aria-hidden />
            Inboxes
          </h2>
          {isAdmin ? <CreateInboxDialog /> : null}
        </header>
        {inboxes.map((inbox) => (
          <InboxCard
            key={inbox._id}
            inbox={inbox}
            isAdmin={isAdmin}
            channels={channels}
            members={members ?? []}
          />
        ))}
      </section>

      <section aria-label="Channels" className="flex flex-col gap-3">
        <header className="flex items-center gap-2">
          <div className="min-w-0 flex-1">
            <h2 className="flex items-center gap-1.5 text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
              <Cable className="size-4 text-(--inbox-text-subtle)" aria-hidden />
              Channels
            </h2>
            <p className="mt-0.5 text-xs text-(--inbox-text-muted)">
              A channel brings conversations in; link it to as many inboxes as you need.
            </p>
          </div>
          <CreateChannelDialog isAdmin={isAdmin} />
        </header>
        {channels.length === 0 ? (
          <p className="rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-4 text-sm text-(--inbox-text-muted)">
            No channels yet. Create one to bring conversations into your inboxes.
          </p>
        ) : (
          <>
            <ChannelGroup
              title="Your channels"
              channels={personalChannels}
              members={members ?? []}
            />
            <ChannelGroup
              title="Shared channels"
              channels={sharedChannels}
              members={members ?? []}
            />
          </>
        )}
      </section>
    </div>
  );
}

function CreateInboxDialog() {
  const createInbox = useMutation(api.inboxes.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await createInbox({ name });
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
      <DialogContent className="sm:max-w-sm">
        <DialogHeader>
          <DialogTitle>Create a shared inbox</DialogTitle>
          <DialogDescription>
            Shared inboxes organize the team's conversations. Link channels to it afterwards.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-3" onSubmit={submit}>
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
          <Button type="submit" disabled={pending || name.trim().length < 2} className="rounded-lg! bg-[#202d2a] hover:bg-[#30423e]">
            {pending ? <Spinner /> : <Plus aria-hidden />}
            {pending ? "Creating…" : "Create inbox"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function InboxCard({
  inbox,
  isAdmin,
  channels,
  members,
}: {
  inbox: SettingsInbox;
  isAdmin: boolean;
  channels: SettingsChannel[];
  members: Member[];
}) {
  const removeInbox = useMutation(api.inboxes.remove);
  const unlink = useMutation(api.channels.unlink);
  const canManage = inbox.kind === "personal" ? inbox.isOwn : isAdmin;
  const linkable = channels.filter(
    (channel) => !inbox.channels.some((linked) => linked._id === channel._id),
  );

  const remove = async () => {
    try {
      await removeInbox({ inboxId: inbox._id });
      toast.success(`Inbox “${inbox.name}” deleted`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  const unlinkChannel = async (channelId: Id<"channels">, name: string) => {
    try {
      await unlink({ inboxId: inbox._id, channelId });
      toast.success(`${name} unlinked from ${inbox.name}`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

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
            {inbox.channels.length} channel{inbox.channels.length === 1 ? "" : "s"}
          </p>
        </div>
        {canManage ? (
          <LinkChannelDialog inbox={inbox} linkable={linkable} />
        ) : null}
        {isAdmin && inbox.kind === "shared" ? (
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
                  The inbox and its links are removed. Channels and their conversations are kept
                  and stay available in other inboxes.
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
      {inbox.channels.length === 0 ? (
        <p className="rounded-lg bg-(--inbox-hover) px-3 py-2.5 text-xs text-(--inbox-text-muted)">
          No channels linked. Link a channel so conversations appear here.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {inbox.channels.map((channel) => (
            <li
              key={channel._id}
              className="flex items-center gap-2.5 rounded-lg border border-(--inbox-border-subtle) bg-(--inbox-surface) px-3 py-2"
            >
              {channel.provider === "demo" ? (
                <Database className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
              ) : (
                <Mail className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
              )}
              <span className="min-w-0 flex-1 truncate text-sm tracking-[-0.1px] text-(--inbox-text)">
                {channel.displayName}
              </span>
              <span className="hidden truncate text-xs text-(--inbox-text-muted) sm:block">
                {channel.emailAddress}
              </span>
              {canManage ? (
                <button
                  type="button"
                  aria-label={`Unlink ${channel.displayName} from ${inbox.name}`}
                  onClick={() => void unlinkChannel(channel._id, channel.displayName)}
                  className="flex size-7 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                >
                  <Unlink className="size-3.5" aria-hidden />
                </button>
              ) : null}
            </li>
          ))}
        </ul>
      )}
      {isAdmin && inbox.kind === "shared" ? (
        <InboxAccessList inbox={inbox} members={members} />
      ) : null}
      {inbox.kind === "personal" ? (
        <p className="flex items-center gap-1.5 text-xs text-(--inbox-text-muted)">
          <Lock className="size-3.5" aria-hidden />
          Only you can see this inbox.
        </p>
      ) : null}
    </section>
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

function LinkChannelDialog({
  inbox,
  linkable,
}: {
  inbox: SettingsInbox;
  linkable: SettingsChannel[];
}) {
  const link = useMutation(api.channels.link);
  const [open, setOpen] = useState(false);
  const [pendingId, setPendingId] = useState<string | null>(null);

  const linkChannel = async (channel: SettingsChannel) => {
    setPendingId(channel._id);
    try {
      await link({ inboxId: inbox._id, channelId: channel._id });
      toast.success(`${channel.displayName} linked to ${inbox.name}`);
      setOpen(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingId(null);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger className="flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)">
        <Link2 className="size-4" aria-hidden />
        Link channel
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Link a channel to {inbox.name}</DialogTitle>
          <DialogDescription>
            The channel's conversations will appear in this inbox. A channel can feed several
            inboxes at once.
          </DialogDescription>
        </DialogHeader>
        {linkable.length === 0 ? (
          <p className="rounded-lg bg-(--inbox-hover) px-3 py-3 text-sm text-(--inbox-text-muted)">
            Every channel you can use is already linked. Create a new channel from the Channels
            list below.
          </p>
        ) : (
          <ul className="flex flex-col gap-2">
            {linkable.map((channel) => (
              <li
                key={channel._id}
                className="flex items-center gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface) p-3"
              >
                {channel.provider === "demo" ? (
                  <Database className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
                ) : (
                  <Mail className="size-4 shrink-0 text-(--inbox-text-subtle)" aria-hidden />
                )}
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
                    {channel.displayName}
                  </p>
                  <p className="truncate text-xs text-(--inbox-text-muted)">
                    {channel.emailAddress}
                  </p>
                </div>
                <Badge
                  variant={channel.kind === "personal" ? "secondary" : "outline"}
                  className="rounded-full! text-[10px]"
                >
                  {channel.kind === "personal" ? "Personal" : "Shared"}
                </Badge>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="rounded-lg!"
                  disabled={pendingId !== null}
                  onClick={() => void linkChannel(channel)}
                >
                  {pendingId === channel._id ? <Spinner /> : <Link2 aria-hidden />}
                  Link
                </Button>
              </li>
            ))}
          </ul>
        )}
      </DialogContent>
    </Dialog>
  );
}

function CreateChannelDialog({ isAdmin }: { isAdmin: boolean }) {
  const create = useMutation(api.channels.create);
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [provider, setProvider] = useState<"gmail" | "outlook" | "demo">("demo");
  const [dataset, setDataset] = useState<SampleDataset>("sales");
  const [kind, setKind] = useState<"shared" | "personal">(isAdmin ? "shared" : "personal");
  const [pending, setPending] = useState(false);
  const comingSoon = provider !== "demo";

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setPending(true);
    try {
      await create({ name, provider, dataset, kind });
      toast.success(`Channel “${name.trim()}” created`);
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
        New channel
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a channel</DialogTitle>
          <DialogDescription>
            Channels bring conversations into Reply. Link them to inboxes after creating.
          </DialogDescription>
        </DialogHeader>
        <form className="flex flex-col gap-4" onSubmit={submit}>
          <div className="flex flex-col gap-2">
            <Label htmlFor="new-channel-name">Channel name</Label>
            <Input
              id="new-channel-name"
              value={name}
              disabled={pending}
              minLength={2}
              maxLength={60}
              placeholder="e.g. Sales mailbox"
              autoFocus
              onChange={(event) => setName(event.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-channel-provider">Provider</Label>
              <Select
                value={provider}
                disabled={pending}
                onValueChange={(value) => setProvider(value as typeof provider)}
              >
                <SelectTrigger id="new-channel-provider" className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="demo">Sample data</SelectItem>
                  <SelectItem value="gmail">Gmail (coming soon)</SelectItem>
                  <SelectItem value="outlook">Outlook (coming soon)</SelectItem>
                </SelectContent>
              </Select>
            </div>
            {isAdmin ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="new-channel-kind">Visibility</Label>
                <Select
                  value={kind}
                  disabled={pending}
                  onValueChange={(value) => setKind(value as typeof kind)}
                >
                  <SelectTrigger id="new-channel-kind" className="w-full rounded-lg">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="shared">Shared with the team</SelectItem>
                    <SelectItem value="personal">Personal (only you)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            ) : (
              <div className="flex flex-col gap-2">
                <Label>Visibility</Label>
                <p className="flex h-9 items-center gap-1.5 rounded-lg border border-(--inbox-border-subtle) bg-(--inbox-hover) px-3 text-sm text-(--inbox-text-muted)">
                  <Lock className="size-3.5" aria-hidden />
                  Personal
                </p>
              </div>
            )}
          </div>
          {provider === "demo" ? (
            <div className="flex flex-col gap-2">
              <Label htmlFor="new-channel-dataset">Sample conversations</Label>
              <Select
                value={dataset}
                disabled={pending}
                onValueChange={(value) => setDataset(value as SampleDataset)}
              >
                <SelectTrigger id="new-channel-dataset" className="w-full rounded-lg">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {DATASET_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <p className="rounded-lg bg-(--inbox-hover) px-3 py-2.5 text-xs text-(--inbox-text-muted)">
              {provider === "gmail" ? "Gmail" : "Outlook"} connections are coming soon. Use a
              sample-data channel to explore Reply today.
            </p>
          )}
          <Button
            type="submit"
            disabled={pending || comingSoon || name.trim().length < 2}
            className="rounded-lg! bg-[#202d2a] hover:bg-[#30423e]"
          >
            {pending ? <Spinner /> : <Cable aria-hidden />}
            {pending ? "Creating…" : "Create channel"}
          </Button>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function ChannelGroup({
  title,
  channels,
  members,
}: {
  title: string;
  channels: SettingsChannel[];
  members: Member[];
}) {
  if (channels.length === 0) return null;
  return (
    <div className="flex flex-col gap-2">
      <h3 className="text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">{title}</h3>
      {channels.map((channel) => (
        <ChannelCard key={channel._id} channel={channel} members={members} />
      ))}
    </div>
  );
}

function ChannelCard({ channel, members }: { channel: SettingsChannel; members: Member[] }) {
  const remove = useMutation(api.channels.remove);
  const [expanded, setExpanded] = useState(false);
  const detailId = `channel-detail-${channel._id}`;

  const removeChannel = async () => {
    try {
      await remove({ channelId: channel._id });
      toast.success(`Channel “${channel.displayName}” deleted`);
    } catch (error) {
      toast.error(errorMessage(error));
    }
  };

  return (
    <section
      aria-label={`${channel.displayName} channel`}
      className="rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated)"
    >
      <button
        type="button"
        aria-expanded={expanded}
        aria-controls={detailId}
        onClick={() => setExpanded((value) => !value)}
        className="flex w-full items-center gap-3 rounded-xl p-4 text-left outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
      >
        <span className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-(--inbox-hover) text-(--inbox-text-subtle)">
          {channel.provider === "demo" ? (
            <Database className="size-4" aria-hidden />
          ) : (
            <Mail className="size-4" aria-hidden />
          )}
        </span>
        <span className="min-w-0 flex-1">
          <span className="flex items-center gap-2 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
            <span className="truncate">{channel.displayName}</span>
            <span
              className={`flex items-center gap-1 text-xs font-medium ${
                channel.status === "connected" ? "text-emerald-700" : "text-(--inbox-text-muted)"
              }`}
            >
              <span
                className={`size-1.5 rounded-full ${
                  channel.status === "connected"
                    ? "bg-(--inbox-success)"
                    : "bg-(--inbox-border-strong)"
                }`}
                aria-hidden
              />
              {channel.status === "connected" ? "Connected" : "Disconnected"}
            </span>
          </span>
          <span className="mt-0.5 block truncate text-xs text-(--inbox-text-muted)">
            {channel.emailAddress} · {channel.threadCount} conversation
            {channel.threadCount === 1 ? "" : "s"} ·{" "}
            {channel.linkedInboxes.length === 0
              ? "not linked"
              : `in ${channel.linkedInboxes.map((inbox) => inbox.name).join(", ")}`}
          </span>
        </span>
        <ChevronDown
          className={`size-4 shrink-0 text-(--inbox-text-muted) transition-transform ${expanded ? "rotate-180" : ""}`}
          aria-hidden
        />
      </button>
      {expanded ? (
        <div id={detailId} className="flex flex-col gap-4 border-t border-(--inbox-border-subtle) p-4">
          {channel.kind === "shared" && channel.canManage ? (
            <ChannelAccessList channel={channel} members={members} />
          ) : channel.kind === "personal" ? (
            <p className="flex items-center gap-1.5 text-xs text-(--inbox-text-muted)">
              <Lock className="size-3.5" aria-hidden />
              Personal channel — only you can see and link it.
            </p>
          ) : null}
          {channel.canManage ? (
            <AlertDialog>
              <AlertDialogTrigger className="flex h-8 w-fit items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) px-3 text-sm font-medium tracking-[-0.1px] text-destructive outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)">
                <Trash2 className="size-4" aria-hidden />
                Delete channel
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Delete {channel.displayName}?</AlertDialogTitle>
                  <AlertDialogDescription>
                    All {channel.threadCount} of its conversations are permanently removed from
                    every linked inbox.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void removeChannel()}>
                    Delete channel
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          ) : null}
        </div>
      ) : null}
    </section>
  );
}

function ChannelAccessList({
  channel,
  members,
}: {
  channel: SettingsChannel;
  members: Member[];
}) {
  const setAccess = useMutation(api.channels.setAccess);
  const [pendingUserId, setPendingUserId] = useState<string | null>(null);

  const toggle = async (member: Member, allowed: boolean) => {
    setPendingUserId(member.userId);
    try {
      await setAccess({ channelId: channel._id, userId: member.userId as Id<"users">, allowed });
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPendingUserId(null);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <h4 className="flex items-center gap-1.5 text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted)">
        <Users className="size-3.5" aria-hidden />
        Who can use this channel
      </h4>
      <ul className="flex flex-col gap-1">
        {members.map((member) => {
          const isAdminMember = member.role === "admin";
          const allowed = isAdminMember || channel.accessUserIds.includes(member.userId);
          return (
            <li
              key={member.userId}
              className="flex h-9 items-center gap-2 rounded-lg px-2 hover:bg-(--inbox-hover)"
            >
              <Checkbox
                id={`channel-access-${channel._id}-${member.userId}`}
                checked={allowed}
                disabled={isAdminMember || pendingUserId === member.userId}
                onCheckedChange={(checked) => void toggle(member, checked === true)}
              />
              <label
                htmlFor={`channel-access-${channel._id}-${member.userId}`}
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
    </div>
  );
}
