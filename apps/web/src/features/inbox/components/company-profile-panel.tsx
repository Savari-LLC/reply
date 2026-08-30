import { Skeleton } from "@reply/ui/components/skeleton";
import { ExternalLink, Globe, X } from "lucide-react";
import { useState } from "react";

import type { CompanyProfile, CompanyStatus, ThreadSummary } from "../types";
import { getAvatarTint, getInitials } from "../utils";

/** Descriptions longer than this get collapsed behind a "Read more" toggle. */
const DESCRIPTION_CLAMP_LENGTH = 220;

function CompanyDescription({ description }: { description: string }) {
  const [expanded, setExpanded] = useState(false);
  const isLong = description.length > DESCRIPTION_CLAMP_LENGTH;

  return (
    <div className="flex flex-col gap-1">
      <p
        className={`text-xs leading-4.5 text-(--inbox-text-muted) ${
          isLong && !expanded ? "line-clamp-4" : ""
        }`}
      >
        {description}
      </p>
      {isLong ? (
        <button
          type="button"
          onClick={() => setExpanded((value) => !value)}
          aria-expanded={expanded}
          className="w-fit rounded-sm text-xs font-medium text-(--inbox-primary-text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
        >
          {expanded ? "Read less" : "Read more"}
        </button>
      ) : null}
    </div>
  );
}

type CompanyProfilePanelProps = {
  /** `undefined` = enrichment unavailable; fall back to thread data. */
  company?: CompanyProfile;
  status: CompanyStatus;
  thread: ThreadSummary;
  onClose: () => void;
};

function DetailRow({ label, value }: { label: string; value: string }) {
  const fullWidth = label === "Email" || label === "Phone";
  return (
    <div className={`flex flex-col gap-0.5 ${fullWidth ? "col-span-2" : ""}`}>
      <dt className="text-xs text-(--inbox-text-muted)">{label}</dt>
      <dd className="text-xs leading-4 break-words text-(--inbox-text)">{value}</dd>
    </div>
  );
}

/** "producthunt" -> "Producthunt"; "x" -> "X". */
function socialLabel(type: string): string {
  if (type === "x") return "X";
  return type.charAt(0).toUpperCase() + type.slice(1);
}

function PanelLoading() {
  return (
    <div className="flex flex-col gap-3" aria-busy="true" aria-label="Loading company details">
      <Skeleton className="size-8 rounded-lg" />
      <Skeleton className="h-5 w-32 rounded-md" />
      <Skeleton className="h-4 w-24 rounded-md" />
      <Skeleton className="h-16 w-full rounded-md" />
      <p className="text-xs leading-4 text-(--inbox-text-muted)">
        Generating this company&rsquo;s profile with Context.dev…
      </p>
    </div>
  );
}

/** Company-context column: everything Context.dev found about the sender. */
export function CompanyProfilePanel({
  company,
  status,
  thread,
  onClose,
}: CompanyProfilePanelProps) {
  const emailDomain = thread.customerEmail.split("@")[1];
  const name = company?.name ?? thread.companyName ?? emailDomain ?? "Unknown company";
  const domain = company?.domain ?? emailDomain;
  const detailRows: [string, string][] = company
    ? (
        [
          ["Industry", company.industry],
          ["Location", company.location],
          ["Email", company.email],
          ["Phone", company.phone],
        ] satisfies [string, string | undefined][]
      ).flatMap(([label, value]) => (value ? [[label, value] as [string, string]] : []))
    : [];

  return (
    <aside className="w-80 shrink-0 py-4 pr-4" aria-labelledby="company-panel-heading">
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

        {status === "loading" ? (
          <PanelLoading />
        ) : (
          <>
            <div className="flex items-start gap-3">
              {company?.logoUrl ? (
                <img
                  src={company.logoUrl}
                  alt=""
                  className="size-10 shrink-0 rounded-lg border border-(--inbox-border-subtle) object-contain p-1"
                />
              ) : (
                <span
                  className="flex size-10 shrink-0 items-center justify-center rounded-lg text-sm font-medium text-(--inbox-text)"
                  style={{ backgroundColor: getAvatarTint(name) }}
                  aria-hidden
                >
                  {getInitials(name)}
                </span>
              )}
              <div className="flex min-w-0 flex-col gap-0.5">
                <p className="text-sm font-semibold tracking-[-0.1px] break-words text-(--inbox-text-strong)">
                  {name}
                </p>
                {company?.slogan ? (
                  <p className="text-xs leading-4 text-(--inbox-text-subtle) italic">
                    {company.slogan}
                  </p>
                ) : null}
              </div>
            </div>

            <div className="flex flex-col gap-0.5">
              {domain ? (
                company?.website ? (
                  <a
                    href={company.website}
                    target="_blank"
                    rel="noreferrer"
                    className="flex w-fit items-center gap-1 rounded-sm text-xs font-medium break-all text-(--inbox-primary-text) outline-none hover:underline focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                  >
                    <Globe className="size-3 shrink-0" aria-hidden />
                    {domain}
                    <ExternalLink className="size-3 shrink-0" aria-hidden />
                  </a>
                ) : (
                  <span className="text-xs font-medium break-words text-(--inbox-primary-text)">
                    {domain}
                  </span>
                )
              ) : null}
            </div>

            {company ? (
              <>
                {company.description ? (
                  <CompanyDescription description={company.description} />
                ) : null}
                {detailRows.length > 0 ? (
                  <dl className="grid grid-cols-2 gap-x-3 gap-y-2.5 border-t border-(--inbox-border-subtle) pt-3">
                    {detailRows.map(([label, value]) => (
                      <DetailRow key={label} label={label} value={value} />
                    ))}
                  </dl>
                ) : null}
                {company.socials && company.socials.length > 0 ? (
                  <div className="flex flex-col gap-1.5 border-t border-(--inbox-border-subtle) pt-3">
                    <p className="text-xs text-(--inbox-text-muted)">Social profiles</p>
                    <ul className="flex flex-wrap gap-1.5">
                      {company.socials.map((social) => (
                        <li key={social.url}>
                          <a
                            href={social.url}
                            target="_blank"
                            rel="noreferrer"
                            className="flex h-6 items-center gap-1 rounded-full border border-(--inbox-border) px-2 text-xs font-medium text-(--inbox-text) outline-none transition-colors hover:bg-(--inbox-hover) focus-visible:ring-2 focus-visible:ring-(--inbox-primary)"
                          >
                            {socialLabel(social.type)}
                            <ExternalLink
                              className="size-2.5 text-(--inbox-text-muted)"
                              aria-hidden
                            />
                          </a>
                        </li>
                      ))}
                    </ul>
                  </div>
                ) : null}
                <p className="border-t border-(--inbox-border-subtle) pt-3 text-[11px] leading-4 text-(--inbox-text-muted)">
                  Profile generated from {domain} by Context.dev
                </p>
              </>
            ) : (
              <p className="text-xs leading-4 text-(--inbox-text-muted)">
                Company details are unavailable for this sender.
              </p>
            )}
          </>
        )}
      </div>
    </aside>
  );
}
