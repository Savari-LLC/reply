import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { Button } from "@reply/ui/components/button";
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
import { useAction, useMutation } from "convex/react";
import { ArrowLeft, ChevronRight, Plug, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  CHANNEL_PROVIDERS,
  providerMeta,
  type ChannelProvider,
} from "./channel-providers";
import { errorMessage } from "./constants";

/**
 * Connecting a channel is how an inbox starts receiving conversations: pick the
 * provider, then authorize it or load the safe demo path. Gmail deliberately
 * imports synthetic mail without requesting access to a Google account.
 */
export function ConnectChannelDialog({
  inbox,
  variant = "button",
}: {
  inbox: { _id: Id<"inboxes">; name: string };
  variant?: "button" | "empty-state";
}) {
  const connect = useMutation(api.channels.connect);
  const startOauth = useAction(api.mailActions.startOauth);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ChannelProvider | null>(null);
  const [address, setAddress] = useState("");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setProvider(null);
    setAddress("");
  };

  const onOpenChange = (next: boolean) => {
    setOpen(next);
    if (!next) reset();
  };

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!provider) return;
    setPending(true);
    try {
      if (provider === "gmail") {
        await connect({
          inboxId: inbox._id,
          provider,
          address: `demo+${inbox._id}@reply.example`,
        });
        toast.success(`30 demo conversations imported into ${inbox.name}`, {
          description:
            "Company senders will gain live Context.dev profiles; personal senders stay ordinary mail.",
        });
        onOpenChange(false);
      } else if (provider === "outlook") {
        const result = await startOauth({ inboxId: inbox._id, provider });
        window.location.assign(result.url);
      } else {
        await connect({ inboxId: inbox._id, provider, address });
        toast.success(`${providerMeta(provider).label} connected to ${inbox.name}`);
        onOpenChange(false);
      }
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const meta = provider ? providerMeta(provider) : null;
  const isEmailProvider = provider === "gmail" || provider === "outlook";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogTrigger
        className={
          variant === "empty-state"
            ? "flex h-9 items-center gap-1.5 rounded-lg bg-[#202d2a] px-3.5 text-sm font-medium tracking-[-0.1px] text-white outline-none hover:bg-[#30423e] focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
            : "flex h-8 shrink-0 items-center gap-1.5 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) px-3 text-sm font-medium tracking-[-0.1px] text-(--inbox-text) outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        }
      >
        <Plug className="size-4" aria-hidden />
        Connect channel
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {meta ? `Connect ${meta.label}` : `Connect a channel to ${inbox.name}`}
          </DialogTitle>
          <DialogDescription>
            {meta
              ? provider === "gmail"
                ? `Load a safe Gmail-style demo inbox into ${inbox.name} without Google account access.`
                : `Authorize the ${meta.label} account that should deliver into ${inbox.name}.`
              : "Choose where these conversations come from. Everything the channel receives lands in this inbox."}
          </DialogDescription>
        </DialogHeader>

        {meta === null ? (
          <ul className="grid gap-2 sm:grid-cols-2">
            {CHANNEL_PROVIDERS.map((entry) => (
              <li key={entry.value}>
                <button
                  type="button"
                  onClick={() => setProvider(entry.value)}
                  className="group flex w-full items-center gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-surface) p-3 text-left outline-none transition-colors hover:border-(--inbox-border-strong) hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                >
                  <span
                    className="flex size-10 shrink-0 items-center justify-center rounded-xl"
                    style={{ backgroundColor: entry.tint, color: entry.color }}
                  >
                    <entry.Icon className="size-5" />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
                      {entry.label}
                    </span>
                    <span className="mt-0.5 block truncate text-xs text-(--inbox-text-muted)">
                      {entry.blurb}
                    </span>
                  </span>
                  <ChevronRight
                    className="size-4 shrink-0 text-(--inbox-text-subtle) transition-transform group-hover:translate-x-0.5"
                    aria-hidden
                  />
                </button>
              </li>
            ))}
          </ul>
        ) : (
          <form className="flex flex-col gap-4" onSubmit={submit}>
            <div className="flex items-center gap-3 rounded-xl border border-(--inbox-border-subtle) bg-(--inbox-hover) p-3">
              <span
                className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-(--inbox-surface)"
                style={{ color: meta.color }}
              >
                <meta.Icon className="size-5" />
              </span>
              <span className="min-w-0 flex-1">
                <span className="block text-sm font-medium tracking-[-0.1px] text-(--inbox-text-strong)">
                  {meta.label}
                </span>
                <span className="mt-0.5 block truncate text-xs text-(--inbox-text-muted)">
                  {meta.blurb}
                </span>
              </span>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                className="rounded-lg!"
                disabled={pending}
                onClick={reset}
              >
                <ArrowLeft aria-hidden />
                Change
              </Button>
            </div>

            {!isEmailProvider ? (
              <div className="flex flex-col gap-2">
                <Label htmlFor="connect-channel-address">{meta.addressLabel}</Label>
                <Input
                  id="connect-channel-address"
                  value={address}
                  disabled={pending}
                  type="tel"
                  inputMode="tel"
                  autoComplete="off"
                  placeholder={meta.addressPlaceholder}
                  autoFocus
                  required
                  onChange={(event) => setAddress(event.target.value)}
                />
              </div>
            ) : null}

            <p className="flex items-start gap-2 rounded-lg bg-(--inbox-hover) px-3 py-2.5 text-xs leading-5 text-(--inbox-text-muted)">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {provider === "gmail"
                ? "No Gmail account is opened or read. Reply imports 30 synthetic conversations: 12 company senders for live Context.dev enrichment and 18 ordinary personal senders."
                : isEmailProvider
                  ? "You will continue to Microsoft to grant read-only mailbox access. Reply never sends mail automatically."
                : `${meta.label} authorization is simulated in this preview. The channel starts empty — use Simulate in the inbox to deliver incoming messages enriched with live company context.`}
            </p>

            <Button
              type="submit"
              disabled={pending || (!isEmailProvider && address.trim().length === 0)}
              className="rounded-lg! bg-[#202d2a] hover:bg-[#30423e]"
            >
              {pending ? <Spinner /> : <Plug aria-hidden />}
              {pending
                ? provider === "gmail"
                  ? "Importing demo conversations…"
                  : `Connecting ${meta.label}…`
                : provider === "gmail"
                  ? "Import 30 demo conversations"
                  : `Connect ${meta.label}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
