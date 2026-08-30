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
import { Input } from "@reply/ui/components/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reply/ui/components/select";
import { Spinner } from "@reply/ui/components/spinner";
import { useAction, useMutation, useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CheckCircle2, Clock3, MailPlus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import { getAvatarTint, getInitials } from "@/features/inbox/utils";
import { errorMessage } from "@/lib/errors";

type Member = FunctionReturnType<typeof api.members.list>[number];

export function MembersSection({ isAdmin }: { isAdmin: boolean }) {
  const members = useQuery(api.members.list, {});

  return (
    <div className="mx-auto flex max-w-2xl flex-col gap-6">
      {isAdmin ? <InvitePanel /> : null}
      <section aria-label="Workspace members" className="flex flex-col gap-2">
        <h2 className="text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
          Members
          {members ? (
            <span className="ml-2 font-normal text-(--inbox-text-muted)">{members.length}</span>
          ) : null}
        </h2>
        {members === undefined ? (
          <div className="flex items-center gap-2 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-4 text-sm text-(--inbox-text-muted)">
            <Spinner />
            Loading members…
          </div>
        ) : (
          <ul className="flex flex-col gap-2">
            {members.map((member) => (
              <MemberRow key={member.userId} member={member} isAdmin={isAdmin} />
            ))}
          </ul>
        )}
      </section>
      {isAdmin ? <InvitationsList /> : null}
    </div>
  );
}

function MemberRow({ member, isAdmin }: { member: Member; isAdmin: boolean }) {
  const setRole = useMutation(api.members.setRole);
  const removeMember = useMutation(api.members.remove);
  const [busy, setBusy] = useState(false);
  const canManage = isAdmin && !member.isSelf;

  const changeRole = async (role: "admin" | "member") => {
    if (role === member.role) return;
    setBusy(true);
    try {
      await setRole({ userId: member.userId as Id<"users">, role });
      toast.success(`${member.name} is now ${role === "admin" ? "an admin" : "a member"}.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  const remove = async () => {
    setBusy(true);
    try {
      await removeMember({ userId: member.userId as Id<"users"> });
      toast.success(`${member.name} was removed from the workspace.`);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setBusy(false);
    }
  };

  return (
    <li className="flex items-center gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-3">
      {member.imageUrl ? (
        <img src={member.imageUrl} alt="" className="size-9 shrink-0 rounded-full object-cover" />
      ) : (
        <span
          className="flex size-9 shrink-0 items-center justify-center rounded-full text-xs font-medium text-(--inbox-text)"
          style={{ backgroundColor: getAvatarTint(member.name) }}
          aria-hidden
        >
          {getInitials(member.name)}
        </span>
      )}
      <div className="min-w-0 flex-1">
        <p className="flex items-center gap-2 text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
          <span className="truncate">{member.name}</span>
          {member.isSelf ? (
            <Badge variant="outline" className="rounded-full! text-[10px]">
              You
            </Badge>
          ) : null}
          {member.isDemo ? (
            <Badge variant="secondary" className="rounded-full! text-[10px]">
              Demo teammate
            </Badge>
          ) : null}
        </p>
        {member.email ? (
          <p className="truncate text-xs text-(--inbox-text-muted)">{member.email}</p>
        ) : null}
      </div>
      {canManage ? (
        <Select
          value={member.role}
          disabled={busy}
          onValueChange={(value) => void changeRole(value as "admin" | "member")}
        >
          <SelectTrigger
            className="h-8 w-28 rounded-lg bg-(--inbox-surface)"
            aria-label={`Role for ${member.name}`}
          >
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="admin">Admin</SelectItem>
            <SelectItem value="member">Member</SelectItem>
          </SelectContent>
        </Select>
      ) : (
        <span className="text-xs font-medium tracking-[-0.1px] text-(--inbox-text-muted) capitalize">
          {member.role}
        </span>
      )}
      {canManage ? (
        <AlertDialog>
          <AlertDialogTrigger
            aria-label={`Remove ${member.name}`}
            disabled={busy}
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-destructive focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <Trash2 className="size-4" aria-hidden />
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Remove {member.name}?</AlertDialogTitle>
              <AlertDialogDescription>
                They lose access to every inbox, their personal inbox is deleted, and their
                assigned conversations return to the shared queue.
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction onClick={() => void remove()}>Remove member</AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      ) : null}
    </li>
  );
}

function InvitePanel() {
  const sendInvitations = useAction(api.invitations.send);
  const [emails, setEmails] = useState("");
  const [sending, setSending] = useState(false);

  async function invite(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const values = emails.split(/[\s,;]+/).filter(Boolean);
    if (values.length === 0) return;
    setSending(true);
    try {
      const result = await sendInvitations({ emails: values });
      setEmails(result.failed.join(", "));
      if (result.sent > 0) {
        toast.success(`${result.sent} invitation${result.sent === 1 ? "" : "s"} sent`);
      }
      if (result.failed.length > 0) {
        toast.error(`Could not invite: ${result.failed.join(", ")}`);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSending(false);
    }
  }

  return (
    <form
      onSubmit={invite}
      className="flex flex-col gap-2 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) p-4"
      aria-label="Invite teammates"
    >
      <label
        htmlFor="settings-invite-emails"
        className="text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)"
      >
        Invite teammates
      </label>
      <div className="flex gap-2">
        <Input
          id="settings-invite-emails"
          value={emails}
          disabled={sending}
          placeholder="maya@example.com, noah@example.com"
          className="h-9 rounded-lg! bg-(--inbox-surface)"
          onChange={(event) => setEmails(event.target.value)}
        />
        <Button
          type="submit"
          className="h-9 shrink-0 rounded-lg! bg-[#202d2a] hover:bg-[#30423e]"
          disabled={sending || emails.trim().length === 0}
        >
          {sending ? <Spinner /> : <MailPlus aria-hidden />}
          {sending ? "Sending…" : "Send invites"}
        </Button>
      </div>
      <p className="text-xs text-(--inbox-text-muted)">
        Separate multiple addresses with commas. Invitations expire after 7 days.
      </p>
    </form>
  );
}

function InvitationsList() {
  const invitations = useQuery(api.invitations.listCurrent);
  if (invitations === undefined || invitations.length === 0) return null;
  return (
    <section aria-label="Invitations" className="flex flex-col gap-2">
      <h2 className="text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)">
        Invitations
      </h2>
      <ul className="flex flex-col gap-2">
        {invitations.slice(0, 8).map((invitation) => {
          const status =
            invitation.status === "pending" && invitation.expiresAt <= Date.now()
              ? "expired"
              : invitation.status;
          return (
            <li
              key={invitation._id}
              className="flex items-center justify-between gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface-elevated) px-4 py-3"
            >
              <span className="min-w-0 truncate text-sm text-(--inbox-text)">
                {invitation.email}
              </span>
              {status === "accepted" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-emerald-700">
                  <CheckCircle2 className="size-3.5" aria-hidden />
                  Joined
                </span>
              ) : status === "pending" ? (
                <span className="flex shrink-0 items-center gap-1 text-xs font-medium text-amber-700">
                  <Clock3 className="size-3.5" aria-hidden />
                  Pending
                </span>
              ) : (
                <span className="shrink-0 text-xs font-medium text-(--inbox-text-muted)">
                  {status === "expired" ? "Expired" : "Replaced"}
                </span>
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}
