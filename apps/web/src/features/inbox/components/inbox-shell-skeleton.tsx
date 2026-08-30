import { Skeleton } from "@reply/ui/components/skeleton";

/**
 * Initial-load skeleton mirroring the ready layout's geometry so the
 * loading-to-ready transition produces no column jump.
 */
export function InboxShellSkeleton() {
  return (
    <div className="flex h-full min-w-0 flex-1" aria-busy="true" aria-label="Loading inbox">
      <div className="flex w-[clamp(300px,25vw,380px)] shrink-0 flex-col border-r border-(--inbox-border-subtle)">
        <div className="flex h-[100px] flex-col justify-center gap-3 px-4">
          <Skeleton className="h-6 w-24 rounded-lg" />
          <div className="flex gap-2">
            <Skeleton className="h-8 w-12 rounded-lg" />
            <Skeleton className="h-8 w-16 rounded-lg" />
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="h-8 w-14 rounded-lg" />
          </div>
        </div>
        <div className="flex flex-col gap-2 px-3">
          {Array.from({ length: 6 }, (_, index) => (
            <ThreadRowSkeleton key={index} />
          ))}
        </div>
      </div>
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex h-16 items-center gap-3 border-b border-(--inbox-border-subtle) px-4">
          <Skeleton className="size-8 rounded-full" />
          <Skeleton className="h-5 w-48 rounded-md" />
          <div className="ml-auto flex gap-2">
            <Skeleton className="h-8 w-20 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
            <Skeleton className="size-8 rounded-lg" />
          </div>
        </div>
        <div className="flex-1 space-y-4 p-4">
          <Skeleton className="h-[152px] w-full rounded-xl" />
          <div className="flex justify-end">
            <Skeleton className="h-11 w-64 rounded-xl" />
          </div>
        </div>
        <div className="p-4 pt-0">
          <Skeleton className="h-[120px] w-full rounded-xl" />
        </div>
      </div>
    </div>
  );
}

export function ThreadRowSkeleton() {
  return (
    <div className="flex shrink-0 items-start gap-3 rounded-xl p-3">
      <Skeleton className="size-8 shrink-0 rounded-full" />
      <div className="flex min-w-0 flex-1 flex-col gap-1">
        <div className="flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-28 rounded-md" />
          <Skeleton className="h-3 w-10 rounded-md" />
        </div>
        <Skeleton className="h-4 w-40 rounded-md" />
        <Skeleton className="h-3 w-full max-w-52 rounded-md" />
        <div className="mt-0.5 flex items-center justify-between gap-2">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="size-5 rounded-full" />
        </div>
      </div>
    </div>
  );
}
