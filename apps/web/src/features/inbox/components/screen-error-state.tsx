import { Button } from "@reply/ui/components/button";
import { Spinner } from "@reply/ui/components/spinner";
import { CircleAlert } from "lucide-react";
import { useState } from "react";

type ScreenErrorStateProps = {
  message?: string;
  onRetry: () => Promise<void>;
};

/** Blocking screen error rendered inside the shell so the outer frame stays stable. */
export function ScreenErrorState({ message, onRetry }: ScreenErrorStateProps) {
  const [retrying, setRetrying] = useState(false);

  const handleRetry = async () => {
    setRetrying(true);
    try {
      await onRetry();
    } finally {
      setRetrying(false);
    }
  };

  return (
    <div className="flex h-full min-w-0 flex-1 items-center justify-center" role="alert">
      <div className="flex w-[280px] flex-col items-center text-center">
        <div className="flex size-12 items-center justify-center rounded-full bg-(--inbox-active)">
          <CircleAlert className="size-6 text-(--inbox-text-subtle)" aria-hidden />
        </div>
        <h2 className="mt-4 text-base font-semibold text-(--inbox-text-strong)">
          The inbox could not load
        </h2>
        <p className="mt-1 text-sm leading-5 text-(--inbox-text-muted)">
          Something went wrong while loading your conversations. Check your connection and try
          again.
        </p>
        <Button
          className="mt-5 h-8 rounded-lg bg-(--inbox-primary) px-4 text-sm text-white hover:bg-(--inbox-primary)/90"
          onClick={handleRetry}
          disabled={retrying}
        >
          {retrying ? <Spinner className="size-3.5" /> : null}
          Retry
        </Button>
        {message ? (
          <p className="mt-3 text-xs text-(--inbox-text-muted)">{message}</p>
        ) : null}
      </div>
    </div>
  );
}
