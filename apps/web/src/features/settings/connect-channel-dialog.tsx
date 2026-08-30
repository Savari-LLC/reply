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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@reply/ui/components/select";
import { Spinner } from "@reply/ui/components/spinner";
import { useMutation } from "convex/react";
import { ArrowLeft, ChevronRight, Plug, ShieldCheck } from "lucide-react";
import { useState, type FormEvent } from "react";
import { toast } from "sonner";

import {
  CHANNEL_PROVIDERS,
  providerMeta,
  type ChannelProvider,
} from "./channel-providers";
import { DATASET_OPTIONS, errorMessage, type SampleDataset } from "./constants";

/**
 * Connecting a channel is how an inbox starts receiving conversations: pick the
 * provider, then authorize the account on that provider's side. Authorization
 * is simulated for now, so the account is backed by a sample dataset.
 */
export function ConnectChannelDialog({
  inbox,
  variant = "button",
}: {
  inbox: { _id: Id<"inboxes">; name: string };
  variant?: "button" | "empty-state";
}) {
  const connect = useMutation(api.channels.connect);
  const [open, setOpen] = useState(false);
  const [provider, setProvider] = useState<ChannelProvider | null>(null);
  const [address, setAddress] = useState("");
  const [dataset, setDataset] = useState<SampleDataset>("sales");
  const [pending, setPending] = useState(false);

  const reset = () => {
    setProvider(null);
    setAddress("");
    setDataset("sales");
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
      await connect({ inboxId: inbox._id, provider, address, dataset });
      toast.success(`${providerMeta(provider).label} connected to ${inbox.name}`);
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setPending(false);
    }
  }

  const meta = provider ? providerMeta(provider) : null;

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
              ? `Authorize the ${meta.label} account that should deliver into ${inbox.name}.`
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

            <div className="flex flex-col gap-2">
              <Label htmlFor="connect-channel-address">{meta.addressLabel}</Label>
              <Input
                id="connect-channel-address"
                value={address}
                disabled={pending}
                type={meta.addressKind === "email" ? "email" : "tel"}
                inputMode={meta.addressKind === "email" ? "email" : "tel"}
                autoComplete="off"
                placeholder={meta.addressPlaceholder}
                autoFocus
                required
                onChange={(event) => setAddress(event.target.value)}
              />
            </div>

            <div className="flex flex-col gap-2">
              <Label htmlFor="connect-channel-dataset">Conversations to import</Label>
              <Select
                value={dataset}
                disabled={pending}
                onValueChange={(value) => setDataset(value as SampleDataset)}
              >
                <SelectTrigger id="connect-channel-dataset" className="w-full rounded-lg">
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

            <p className="flex items-start gap-2 rounded-lg bg-(--inbox-hover) px-3 py-2.5 text-xs leading-5 text-(--inbox-text-muted)">
              <ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden />
              {meta.label} authorization is simulated in this preview. Reply imports the sample
              conversations above so you can work the inbox straight away.
            </p>

            <Button
              type="submit"
              disabled={pending || address.trim().length === 0}
              className="rounded-lg! bg-[#202d2a] hover:bg-[#30423e]"
            >
              {pending ? <Spinner /> : <Plug aria-hidden />}
              {pending ? `Connecting ${meta.label}…` : `Connect ${meta.label}`}
            </Button>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
