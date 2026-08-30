import {
  useOauth,
  useSignInWithGoogle,
  type OauthFlowErrorCode,
} from "@convex-dev/auth/providers/oauth/react";
import {
  useSignInWithPassword,
  useSignUpWithPassword,
} from "@convex-dev/auth/providers/password/react";
import { api } from "@reply/backend/convex/_generated/api";
import { Alert, AlertDescription } from "@reply/ui/components/alert";
import { Button } from "@reply/ui/components/button";
import { Input } from "@reply/ui/components/input";
import { Label } from "@reply/ui/components/label";
import { Separator } from "@reply/ui/components/separator";
import { Spinner } from "@reply/ui/components/spinner";
import { ArrowRight, CircleAlert, LockKeyhole, MessageSquareText } from "lucide-react";
import { useState, type FormEvent } from "react";

const oauthErrorMessages: Record<OauthFlowErrorCode, string> = {
  access_denied: "Google sign-in was cancelled.",
  expired: "That sign-in took too long. Please try again.",
  rejected: "Google sign-in was declined.",
  oauth_error: "Google sign-in failed. Please try again.",
  invalid_flow: "This sign-in cannot be completed here. Please try again.",
};

type PasswordMode = "sign-in" | "sign-up";

export function AuthPanel({ invited = false }: { invited?: boolean }) {
  const [mode, setMode] = useState<PasswordMode>("sign-in");
  const [googlePending, setGooglePending] = useState(false);
  const { signInGoogle } = useSignInWithGoogle(api.auth);
  const { flowError } = useOauth();

  return (
    <main className="grid min-h-svh bg-[#eef0ec] lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden overflow-hidden bg-[#202d2a] p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div className="absolute -top-32 -right-28 size-96 rounded-full bg-[#ff7a66]/15 blur-3xl" />
        <div className="absolute -bottom-32 -left-24 size-80 rounded-full bg-[#f7c95c]/10 blur-3xl" />
        <div className="relative flex items-center gap-3">
          <div className="flex size-10 items-center justify-center rounded-xl bg-[#ff7a66] shadow-lg shadow-black/10">
            <MessageSquareText className="size-5" strokeWidth={2.5} aria-hidden="true" />
          </div>
          <span className="text-lg font-bold tracking-[-0.04em]">reply</span>
        </div>
        <div className="relative max-w-xl">
          <p className="mb-5 text-xs font-semibold tracking-[0.16em] text-[#f7c95c] uppercase">Your focused communication workspace</p>
          <h1 className="text-5xl font-bold leading-[1.02] tracking-[-0.055em] xl:text-6xl">
            Turn context into a thoughtful reply.
          </h1>
          <p className="mt-6 max-w-lg text-sm leading-7 text-white/60">
            Bring the right company context into every conversation and move from research to a polished response without losing your voice.
          </p>
        </div>
        <p className="relative text-xs text-white/35">Secure authentication powered by Convex Auth v2</p>
      </section>

      <section className="flex items-center justify-center px-4 py-8 sm:px-8 lg:px-12">
        <div className="w-full max-w-md rounded-[28px] border border-white/80 bg-[#fbfbf8] p-5 shadow-[0_28px_90px_rgba(32,45,42,0.13)] sm:p-8">
          <div className="mb-8 flex items-center gap-3 lg:hidden">
            <div className="flex size-9 items-center justify-center rounded-xl bg-[#ff7a66] text-white">
              <MessageSquareText className="size-[18px]" strokeWidth={2.5} aria-hidden="true" />
            </div>
            <span className="text-[17px] font-bold tracking-[-0.04em]">reply</span>
          </div>

          <div>
            <p className="text-[10px] font-bold tracking-[0.14em] text-[#bc5644] uppercase">{invited ? "You’re invited" : "Welcome"}</p>
            <h2 className="mt-2 text-3xl font-bold tracking-[-0.045em] text-[#202d2a]">{invited ? "Sign in to join your team" : "Sign in to continue"}</h2>
            <p className="mt-2 text-sm leading-6 text-muted-foreground">{invited ? "Use Google or create a Reply account, then we’ll add you to the workspace." : "Use Google or your Reply username and password."}</p>
          </div>

          <div className="mt-7 space-y-5">
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="h-11 w-full rounded-xl! bg-white text-sm shadow-sm"
              disabled={googlePending}
              onClick={async () => {
                setGooglePending(true);
                try {
                  await signInGoogle({ redirectTo: window.location.href });
                } catch {
                  setGooglePending(false);
                }
              }}
            >
              {googlePending ? <Spinner /> : <span className="text-base font-bold" aria-hidden="true">G</span>}
              {googlePending ? "Opening Google…" : "Continue with Google"}
            </Button>

            {flowError !== null ? (
              <Alert variant="destructive" className="rounded-xl!" aria-live="polite">
                <CircleAlert aria-hidden="true" />
                <AlertDescription>{flowError.message ?? oauthErrorMessages[flowError.code]}</AlertDescription>
              </Alert>
            ) : null}

            <div className="flex items-center gap-3">
              <Separator className="flex-1" />
              <span className="text-[10px] font-semibold tracking-[0.12em] text-muted-foreground uppercase">or use password</span>
              <Separator className="flex-1" />
            </div>

            <div className="grid grid-cols-2 rounded-xl bg-[#eef0ec] p-1" role="group" aria-label="Password authentication mode">
              <button
                type="button"
                aria-pressed={mode === "sign-in"}
                className="h-9 rounded-lg text-xs font-semibold transition-colors aria-pressed:bg-white aria-pressed:text-[#202d2a] aria-pressed:shadow-sm"
                onClick={() => setMode("sign-in")}
              >
                Sign in
              </button>
              <button
                type="button"
                aria-pressed={mode === "sign-up"}
                className="h-9 rounded-lg text-xs font-semibold transition-colors aria-pressed:bg-white aria-pressed:text-[#202d2a] aria-pressed:shadow-sm"
                onClick={() => setMode("sign-up")}
              >
                Create account
              </button>
            </div>

            <PasswordForm mode={mode} />
          </div>

          <div className="mt-7 flex items-start gap-2 rounded-xl bg-[#f0f2ee] px-3 py-3 text-[11px] leading-5 text-muted-foreground">
            <LockKeyhole className="mt-0.5 size-3.5 shrink-0 text-[#53635e]" aria-hidden="true" />
            Passwords are hashed with Argon2id. Your Google password is never shared with Reply.
          </div>
        </div>
      </section>
    </main>
  );
}

function PasswordForm({ mode }: { mode: PasswordMode }) {
  const { signIn, pending: signInPending } = useSignInWithPassword(api.auth.signInWithPassword);
  const { signUp, pending: signUpPending } = useSignUpWithPassword(api.auth.signUpWithPassword);
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const pending = signInPending || signUpPending;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (mode === "sign-in") {
      const result = await signIn({ username, password });
      if (result.success) {
        return;
      }
      switch (result.userError.error) {
        case "USER_NOT_FOUND":
          setError("No account exists with that username.");
          return;
        case "INVALID_CREDENTIALS":
          setError("Incorrect username or password.");
          return;
        case "PASSWORD_TOO_SHORT":
          setError(`Password must be at least ${result.userError.minimumLength} characters.`);
          return;
        case "PASSWORD_TOO_LONG":
          setError(`Password must be at most ${result.userError.maximumLength} characters.`);
          return;
        case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
          setError("Password cannot start or end with whitespace.");
          return;
        case "RATE_LIMITED":
          setError(`Too many attempts. Try again in ${Math.ceil(result.userError.retryAfterMs / 1000)} seconds.`);
          return;
        case "OTHER_ERROR":
          setError("Something went wrong. Please try again.");
          return;
      }
    }

    const result = await signUp({ username, password });
    if (result.success) {
      return;
    }
    switch (result.userError.error) {
      case "USERNAME_TAKEN":
        setError("That username is already taken.");
        return;
      case "USERNAME_TOO_SHORT":
        setError(`Username must be at least ${result.userError.minimumLength} characters.`);
        return;
      case "USERNAME_HAS_SURROUNDING_WHITESPACE":
        setError("Username cannot start or end with whitespace.");
        return;
      case "USERNAME_HAS_INVALID_CHARACTERS":
        setError("Username contains characters that are not allowed.");
        return;
      case "PASSWORD_TOO_SHORT":
        setError(`Password must be at least ${result.userError.minimumLength} characters.`);
        return;
      case "PASSWORD_TOO_LONG":
        setError(`Password must be at most ${result.userError.maximumLength} characters.`);
        return;
      case "PASSWORD_HAS_SURROUNDING_WHITESPACE":
        setError("Password cannot start or end with whitespace.");
        return;
      case "PASSWORD_TOO_COMMON":
        setError("Choose a less common password.");
        return;
      case "OTHER_ERROR":
        setError("Something went wrong. Please try again.");
        return;
    }
  }

  return (
    <form className="space-y-4" onSubmit={handleSubmit}>
      <div className="space-y-2">
        <Label htmlFor="username">Username</Label>
        <Input
          id="username"
          name="username"
          autoComplete="username"
          className="h-11 rounded-xl! bg-white px-3 text-sm"
          value={username}
          disabled={pending}
          aria-invalid={error !== null}
          required
          onChange={(event) => setUsername(event.target.value)}
        />
      </div>
      <div className="space-y-2">
        <Label htmlFor="password">Password</Label>
        <Input
          id="password"
          name="password"
          type="password"
          autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
          className="h-11 rounded-xl! bg-white px-3 text-sm"
          value={password}
          disabled={pending}
          aria-invalid={error !== null}
          required
          onChange={(event) => setPassword(event.target.value)}
        />
      </div>

      {error !== null ? (
        <Alert variant="destructive" className="rounded-xl!" aria-live="polite">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      ) : null}

      <Button type="submit" size="lg" className="h-11 w-full rounded-xl! bg-[#202d2a] text-sm hover:bg-[#30423e]" disabled={pending}>
        {pending ? <Spinner /> : null}
        {pending ? (mode === "sign-in" ? "Signing in…" : "Creating account…") : mode === "sign-in" ? "Sign in" : "Create account"}
        {!pending ? <ArrowRight aria-hidden="true" /> : null}
      </Button>
    </form>
  );
}
