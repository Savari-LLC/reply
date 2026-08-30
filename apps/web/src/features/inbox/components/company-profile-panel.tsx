import { X } from "lucide-react";

import type { CompanyProfile, ThreadSummary } from "../types";
import { getAvatarTint, getInitials } from "../utils";

type CompanyProfilePanelProps = {
  /** `undefined` = enrichment unavailable; fall back to thread data. */
  company?: CompanyProfile;
  thread: ThreadSummary;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-0.5">
      <dt className="text-xs text-(--inbox-text-muted)">{label}</dt>
      <dd className="text-xs leading-4 text-(--inbox-text)">{value}</dd>
    </div>
  );
}

/** Optional company-context column, adapted from the reference right panel. */
export function CompanyProfilePanel({ company, thread, onClose }: CompanyProfilePanelProps) {
  const emailDomain = thread.customerEmail.split("@")[1];
  const name = company?.name ?? thread.companyName ?? emailDomain ?? "Unknown company";
  const domain = company?.domain ?? emailDomain;

  return (
    <aside className="w-60 shrink-0 py-4 pr-4" aria-labelledby="company-panel-heading">
      <div className="flex max-h-full flex-col gap-3 overflow-y-auto rounded-xl border border-(--inbox-border) bg-(--inbox-surface-elevated) p-4">
        <div className="flex items-center justify-between">
          <h3
            id="company-panel-heading"
            className="text-sm font-semibold tracking-[-0.1px] text-(--inbox-text-strong)"
          >
            Company
          </h3>
          <button
            type="button"
            aria-label="Close company details"
            onClick={onClose}
            className="flex size-6 items-center justify-center rounded-md text-(--inbox-text-muted) outline-none transition-colors hover:bg-(--inbox-hover) hover:text-(--inbox-text) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
          >
            <X className="size-4" aria-hidden />
          </button>
        </div>

        {company?.logoUrl ? (
          <img src={company.logoUrl} alt="" className="size-8 rounded-lg object-cover" />
        ) : (
          <span
            className="flex size-8 items-center justify-center rounded-lg text-xs font-medium text-(--inbox-text)"
            style={{ backgroundColor: getAvatarTint(name) }}
            aria-hidden
          >
            {getInitials(name)}
          </span>
        )}

        <div className="flex flex-col gap-0.5">
          <p className="text-sm font-semibold tracking-[-0.1px] break-words text-(--inbox-text-strong)">
            {name}
          </p>
          {domain ? (
            <span className="text-xs font-medium break-words text-(--inbox-primary-text)">
              {domain}
            </span>
          ) : null}
        </div>

        {company ? (
          <>
            {company.description ? (
              <p className="text-xs leading-4 text-(--inbox-text-muted)">{company.description}</p>
            ) : null}
            {company.industry || company.location ? (
              <dl className="flex flex-col gap-2 border-t border-(--inbox-border-subtle) pt-3">
                {company.industry ? <DetailRow label="Industry" value={company.industry} /> : null}
                {company.location ? <DetailRow label="Location" value={company.location} /> : null}
              </dl>
            ) : null}
          </>
        ) : (
          <p className="text-xs leading-4 text-(--inbox-text-muted)">
            Company details are unavailable.
          </p>
        )}
      </div>
    </aside>
  );
}
