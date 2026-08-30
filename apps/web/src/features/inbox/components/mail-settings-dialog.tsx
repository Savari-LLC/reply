import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@reply/ui/components/alert-dialog";
import { Button } from "@reply/ui/components/button";
import { Spinner } from "@reply/ui/components/spinner";
import { useAction, useMutation } from "convex/react";
import { RefreshCw, Unplug } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type MailChannel = {
  _id: Id<"channels">;
  provider: "gmail" | "outlook" | "whatsapp" | "sms";
  address: string;
  status: "connected" | "disconnected";
  mailConnection: {
    syncStatus: "idle" | "syncing" | "error";
    lastSyncedAt: number | null;
    lastSyncError: string | null;
  } | null;
};

function errorMessage(error: unknown) {
  return error instanceof Error
    ? error.message.replace(/^Uncaught (Error: )?/, "").replace(/ at .*$/s, "")
    : "Something went wrong. Please try again.";
}

export function MailChannelControls({
  channel,
  inboxId,
  inboxName,
}: {
  channel: MailChannel;
  inboxId: Id<"inboxes">;
  inboxName: string;
}) {
  const startOauth = useAction(api.mailActions.startOauth);
  const syncNow = useAction(api.mailActions.syncNow);
  const disconnect = useMutation(api.mail.disconnect);
  const [pending, setPending] = useState<"reconnect" | "sync" | "disconnect" | null>(null);
  const provider = channel.provider;
  if (provider !== "gmail" && provider !== "outlook") return null;

  const reconnect = async () => {
    setPending("reconnect");
    try {
      const result = await startOauth({
        inboxId,
        channelId: channel._id,
        provider,
      });
      window.location.assign(result.url);
    } catch (error) {
      toast.error("Could not reconnect mailbox", { description: errorMessage(error) });
      setPending(null);
    }
  };

  const sync = async () => {
    setPending("sync");
    try {
      const result = await syncNow({ channelId: channel._id });
      toast.success("Mailbox synced", {
        description: `${result.threads} conversations checked, ${result.insertedMessages} new messages imported.`,
      });
    } catch (error) {
      toast.error("Could not sync mailbox", { description: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  const disconnectMailbox = async () => {
    setPending("disconnect");
    try {
      await disconnect({ channelId: channel._id });
      toast.success("Mailbox disconnected", {
        description: "Imported conversations remain available in Reply.",
      });
    } catch (error) {
      toast.error("Could not disconnect mailbox", { description: errorMessage(error) });
    } finally {
      setPending(null);
    }
  };

  if (channel.status !== "connected" || !channel.mailConnection) {
    return (
      <Button
        type="button"
        variant="outline"
        size="icon-sm"
        className="rounded-lg"
        disabled={pending !== null}
        aria-label={`Reconnect ${channel.address} to ${inboxName}`}
        title="Reconnect mailbox"
        onClick={() => void reconnect()}
      >
        {pending === "reconnect" ? <Spinner /> : <RefreshCw aria-hidden />}
      </Button>
    );
  }

  return (
    <div className="flex shrink-0 items-center gap-1">
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        className="rounded-lg"
        disabled={pending !== null || channel.mailConnection.syncStatus === "syncing"}
        aria-label={`Sync ${channel.address}`}
        title="Sync mailbox"
        onClick={() => void sync()}
      >
        {pending === "sync" || channel.mailConnection.syncStatus === "syncing" ? (
          <Spinner />
        ) : (
          <RefreshCw aria-hidden />
        )}
      </Button>
      <AlertDialog>
        <AlertDialogTrigger
          aria-label={`Disconnect ${channel.address} from ${inboxName}`}
          disabled={pending !== null}
          className="flex size-7 shrink-0 items-center justify-center rounded-lg text-(--inbox-text-muted) outline-none hover:bg-(--inbox-hover) hover:text-destructive focus-visible:ring-2 focus-visible:ring-(--inbox-primary) disabled:opacity-50"
        >
          {pending === "disconnect" ? (
            <Spinner className="size-3.5" />
          ) : (
            <Unplug className="size-3.5" aria-hidden />
          )}
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Disconnect {channel.address}?</AlertDialogTitle>
            <AlertDialogDescription>
              The mailbox stops syncing into {inboxName}. Imported conversations remain available,
              and you can reconnect later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogCancel
              variant="destructive"
              onClick={() => void disconnectMailbox()}
            >
              Disconnect
            </AlertDialogCancel>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
