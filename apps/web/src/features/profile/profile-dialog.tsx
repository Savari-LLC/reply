import { api } from "@reply/backend/convex/_generated/api";
import type { Id } from "@reply/backend/convex/_generated/dataModel";
import { Button } from "@reply/ui/components/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@reply/ui/components/dialog";
import { Input } from "@reply/ui/components/input";
import { Spinner } from "@reply/ui/components/spinner";
import { useMutation, useQuery } from "convex/react";
import { ImageUp, Trash2 } from "lucide-react";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { toast } from "sonner";

import { getAvatarTint, getInitials } from "@/features/inbox/utils";
import { errorMessage } from "@/lib/errors";

const MAX_AVATAR_BYTES = 4 * 1024 * 1024;
const ACCEPTED_TYPES = "image/png,image/jpeg,image/webp,image/gif";

type ProfileDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Draft avatar state: keep the current one, upload a new file, or clear it. */
type AvatarDraft =
  | { kind: "unchanged" }
  | { kind: "replace"; file: File; previewUrl: string }
  | { kind: "remove" };

export function ProfileDialog({ open, onOpenChange }: ProfileDialogProps) {
  const profile = useQuery(api.users.getProfile, open ? {} : "skip");
  const generateUploadUrl = useMutation(api.users.generateAvatarUploadUrl);
  const updateProfile = useMutation(api.users.updateProfile);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [name, setName] = useState("");
  const [avatar, setAvatar] = useState<AvatarDraft>({ kind: "unchanged" });
  const [saving, setSaving] = useState(false);

  // Reset the form whenever the dialog opens so a cancelled edit never sticks.
  useEffect(() => {
    if (!open) return;
    setAvatar({ kind: "unchanged" });
    setSaving(false);
  }, [open]);

  useEffect(() => {
    if (open && profile) setName(profile.name);
  }, [open, profile?.name]);

  // Revoke the object URL for a discarded preview to avoid leaking it.
  useEffect(() => {
    if (avatar.kind !== "replace") return;
    const url = avatar.previewUrl;
    return () => URL.revokeObjectURL(url);
  }, [avatar]);

  const previewUrl =
    avatar.kind === "replace"
      ? avatar.previewUrl
      : avatar.kind === "remove"
        ? null
        : (profile?.imageUrl ?? null);
  const displayName = name.trim() || profile?.name || "You";
  const canRemove = avatar.kind === "replace" || (avatar.kind === "unchanged" && previewUrl !== null);

  function pickFile(file: File | undefined) {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast.error("Choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      toast.error("Images must be smaller than 4 MB.");
      return;
    }
    setAvatar({ kind: "replace", file, previewUrl: URL.createObjectURL(file) });
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (name.trim().length === 0) return;
    setSaving(true);
    try {
      let imageStorageId: Id<"_storage"> | null | undefined;
      if (avatar.kind === "remove") imageStorageId = null;
      if (avatar.kind === "replace") {
        const uploadUrl = await generateUploadUrl({});
        const response = await fetch(uploadUrl, {
          method: "POST",
          headers: { "Content-Type": avatar.file.type },
          body: avatar.file,
        });
        if (!response.ok) throw new Error("Uploading your picture failed. Please try again.");
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        imageStorageId = storageId;
      }
      await updateProfile({ name: name.trim(), imageStorageId });
      toast.success("Profile updated.");
      onOpenChange(false);
    } catch (error) {
      toast.error(errorMessage(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-xl sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Edit profile</DialogTitle>
          <DialogDescription>
            Your name and picture are how teammates recognise you across shared inboxes.
          </DialogDescription>
        </DialogHeader>
        {/* Null only happens when the session lapsed; the shell redirects to sign-in. */}
        {!profile ? (
          <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
            <Spinner />
            Loading your profile…
          </div>
        ) : (
          <form onSubmit={save} className="flex flex-col gap-4">
            <div className="flex items-center gap-4">
              {previewUrl ? (
                <img
                  src={previewUrl}
                  alt=""
                  className="size-16 shrink-0 rounded-full object-cover"
                />
              ) : (
                <span
                  className="flex size-16 shrink-0 items-center justify-center rounded-full text-base font-medium text-foreground"
                  style={{ backgroundColor: getAvatarTint(displayName) }}
                  aria-hidden
                >
                  {getInitials(displayName)}
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-2">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    disabled={saving}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    <ImageUp aria-hidden />
                    {previewUrl ? "Change picture" : "Upload picture"}
                  </Button>
                  {canRemove ? (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      disabled={saving}
                      onClick={() => setAvatar({ kind: "remove" })}
                    >
                      <Trash2 aria-hidden />
                      Remove
                    </Button>
                  ) : null}
                </div>
                <p className="text-xs text-muted-foreground">PNG, JPG, or WebP up to 4 MB.</p>
              </div>
              <input
                ref={fileInputRef}
                type="file"
                accept={ACCEPTED_TYPES}
                className="hidden"
                aria-hidden
                tabIndex={-1}
                onChange={(event) => {
                  pickFile(event.target.files?.[0]);
                  event.target.value = "";
                }}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="profile-name" className="text-xs font-medium text-foreground">
                Name
              </label>
              <Input
                id="profile-name"
                value={name}
                maxLength={60}
                required
                disabled={saving}
                autoComplete="name"
                className="h-9 rounded-lg!"
                onChange={(event) => setName(event.target.value)}
              />
              {profile.email ? (
                <p className="text-xs text-muted-foreground">
                  Signed in as {profile.email}. Email cannot be changed here.
                </p>
              ) : null}
            </div>
            <DialogFooter>
              <Button
                type="button"
                variant="outline"
                disabled={saving}
                onClick={() => onOpenChange(false)}
              >
                Cancel
              </Button>
              <Button type="submit" disabled={saving || name.trim().length === 0}>
                {saving ? <Spinner /> : null}
                {saving ? "Saving…" : "Save changes"}
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
