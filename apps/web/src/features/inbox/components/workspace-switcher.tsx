import { Alert, AlertDescription } from "@reply/ui/components/alert";
import { Button } from "@reply/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@reply/ui/components/dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@reply/ui/components/dropdown-menu";
import { Input } from "@reply/ui/components/input";
import { Label } from "@reply/ui/components/label";
import { Spinner } from "@reply/ui/components/spinner";
import { Check, ChevronDown, CircleAlert, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";

import { getAvatarTint } from "../utils";

export type WorkspaceOption = {
  id: string;
  name: string;
  isActive: boolean;
};

export type WorkspaceSwitcherData = {
  /** Active workspace shown in the trigger. */
  name: string;
  /** Every workspace the member belongs to, active one flagged. */
  workspaces: WorkspaceOption[];
  onSwitch: (workspaceId: string) => Promise<void>;
  onCreate: (name: string) => Promise<void>;
};

function WorkspaceIcon({ name, size = "sm" }: { name: string; size?: "sm" | "md" }) {
  return (
    <span
      className={`flex shrink-0 items-center justify-center rounded-md text-[10px] font-semibold uppercase text-(--inbox-text) ${
        size === "sm" ? "size-5" : "size-6"
      }`}
      style={{ backgroundColor: getAvatarTint(name) }}
      aria-hidden
    >
      {name.trim().charAt(0) || "W"}
    </span>
  );
}

/**
 * Workspace name + icon at the top of the inbox sidebar. The dropdown lists
 * every workspace the member belongs to and offers creating a new one, so a
 * member can run several companies from one account.
 */
export function WorkspaceSwitcher({ name, workspaces, onSwitch, onCreate }: WorkspaceSwitcherData) {
  const [createOpen, setCreateOpen] = useState(false);
  const [switchingId, setSwitchingId] = useState<string | null>(null);

  const handleSwitch = async (workspace: WorkspaceOption) => {
    if (workspace.isActive || switchingId !== null) return;
    setSwitchingId(workspace.id);
    try {
      await onSwitch(workspace.id);
    } finally {
      setSwitchingId(null);
    }
  };

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={`Workspace: ${name}. Switch or create workspace`}
          className="flex h-8 w-full items-center gap-2 rounded-lg border border-(--inbox-border) bg-(--inbox-surface) p-2 outline-none hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        >
          <WorkspaceIcon name={name} />
          <span className="min-w-0 flex-1 truncate text-left text-sm tracking-[-0.1px] text-(--inbox-text)">
            {name}
          </span>
          {switchingId !== null ? (
            <Spinner className="size-4 shrink-0 text-(--inbox-text-muted)" />
          ) : (
            <ChevronDown className="size-4 shrink-0 text-(--inbox-text-muted)" aria-hidden />
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent
          side="bottom"
          align="start"
          className="min-w-56 rounded-lg border border-(--inbox-border) bg-(--inbox-surface-elevated) p-1 shadow-lg shadow-black/5"
        >
          <DropdownMenuGroup>
            <DropdownMenuLabel className="text-xs font-medium text-(--inbox-text-muted)">
              Workspaces
            </DropdownMenuLabel>
            {workspaces.map((workspace) => (
              <DropdownMenuItem
                key={workspace.id}
                className="rounded-md text-sm text-(--inbox-text)"
                disabled={switchingId !== null}
                onClick={() => void handleSwitch(workspace)}
              >
                <WorkspaceIcon name={workspace.name} />
                <span className="min-w-0 flex-1 truncate">{workspace.name}</span>
                {workspace.isActive ? (
                  <Check className="size-4 shrink-0 text-(--inbox-text-muted)" aria-hidden />
                ) : switchingId === workspace.id ? (
                  <Spinner className="size-4 shrink-0 text-(--inbox-text-muted)" />
                ) : null}
                {workspace.isActive ? <span className="sr-only">(current)</span> : null}
              </DropdownMenuItem>
            ))}
          </DropdownMenuGroup>
          <DropdownMenuSeparator />
          <DropdownMenuItem
            className="rounded-md text-sm text-(--inbox-text)"
            onClick={() => setCreateOpen(true)}
          >
            <Plus className="size-4" aria-hidden />
            Create workspace
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      <CreateWorkspaceDialog open={createOpen} onOpenChange={setCreateOpen} onCreate={onCreate} />
    </>
  );
}

function CreateWorkspaceDialog({
  open,
  onOpenChange,
  onCreate,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onCreate: (name: string) => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = (next: boolean) => {
    if (pending) return;
    onOpenChange(next);
    if (!next) {
      setName("");
      setError(null);
    }
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setError(null);
    setPending(true);
    try {
      await onCreate(name);
      setPending(false);
      onOpenChange(false);
      setName("");
    } catch (cause) {
      setPending(false);
      setError(cause instanceof Error ? cause.message : "The workspace could not be created.");
    }
  };

  return (
    <Dialog open={open} onOpenChange={close}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Create a workspace</DialogTitle>
          <DialogDescription>
            A workspace keeps a company’s inboxes, conversations, and teammates together. You’ll
            switch into it right away.
          </DialogDescription>
        </DialogHeader>
        <form className="space-y-4" onSubmit={submit}>
          <div className="space-y-2">
            <Label htmlFor="new-workspace-name">Workspace name</Label>
            <Input
              id="new-workspace-name"
              name="new-workspace-name"
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
          {error !== null ? (
            <Alert variant="destructive" aria-live="polite">
              <CircleAlert aria-hidden="true" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          ) : null}
          <DialogFooter>
            <Button type="submit" disabled={pending || name.trim().length < 2}>
              {pending ? <Spinner /> : null}
              {pending ? "Creating…" : "Create workspace"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
