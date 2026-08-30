import type { SVGProps } from "react";

export type ChannelProvider = "gmail" | "outlook" | "whatsapp" | "sms";

type IconProps = SVGProps<SVGSVGElement>;

/** Gmail's envelope mark (Simple Icons, CC0). */
function GmailIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M24 5.457v13.909c0 .904-.732 1.636-1.636 1.636h-3.819V11.73L12 16.64l-6.545-4.91v9.273H1.636A1.636 1.636 0 0 1 0 19.366V5.457c0-2.023 2.309-3.178 3.927-1.964L5.455 4.64 12 9.548l6.545-4.91 1.528-1.145C21.69 2.28 24 3.434 24 5.457z" />
    </svg>
  );
}

/** Outlook's panelled envelope: the "O" beside the mail body. */
function OutlookIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path
        d="M11.9 4.9h9.6A1.5 1.5 0 0 1 23 6.4v11.2a1.5 1.5 0 0 1-1.5 1.5h-9.6z"
        opacity="0.32"
      />
      <path
        d="m12.9 8.1 4.8 3.4 4.8-3.4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path d="M6.4 4.6C3.4 4.6 1 7.9 1 12s2.4 7.4 5.4 7.4S11.8 16.1 11.8 12 9.4 4.6 6.4 4.6Zm0 3.4c1.3 0 2.3 1.8 2.3 4s-1 4-2.3 4-2.3-1.8-2.3-4 1-4 2.3-4Z" />
    </svg>
  );
}

/** WhatsApp's phone-in-bubble mark (Simple Icons, CC0). */
function WhatsAppIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L.057 24l6.305-1.654a11.882 11.882 0 005.683 1.448h.005c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z" />
    </svg>
  );
}

/** Twilio's ringed four-dot mark, the carrier behind SMS. */
function TwilioSmsIcon(props: IconProps) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden {...props}>
      <path d="M12 1.5a10.5 10.5 0 1 0 0 21 10.5 10.5 0 0 0 0-21Zm0 3.2a7.3 7.3 0 1 1 0 14.6 7.3 7.3 0 0 1 0-14.6Z" />
      <circle cx="9.4" cy="9.4" r="1.6" />
      <circle cx="14.6" cy="9.4" r="1.6" />
      <circle cx="14.6" cy="14.6" r="1.6" />
      <circle cx="9.4" cy="14.6" r="1.6" />
    </svg>
  );
}

export type ChannelProviderMeta = {
  value: ChannelProvider;
  label: string;
  /** What the account is identified by, which drives the input's semantics. */
  addressKind: "email" | "phone";
  blurb: string;
  addressLabel: string;
  addressPlaceholder: string;
  Icon: (props: IconProps) => React.JSX.Element;
  /** Brand colour for the glyph, with a tint for the tile behind it. */
  color: string;
  tint: string;
};

export const CHANNEL_PROVIDERS: ChannelProviderMeta[] = [
  {
    value: "gmail",
    label: "Gmail",
    addressKind: "email",
    blurb: "Google Workspace or personal",
    addressLabel: "Gmail address",
    addressPlaceholder: "sales@yourcompany.com",
    Icon: GmailIcon,
    color: "#EA4335",
    tint: "#EA43351f",
  },
  {
    value: "outlook",
    label: "Outlook",
    addressKind: "email",
    blurb: "Microsoft 365 or Exchange",
    addressLabel: "Outlook address",
    addressPlaceholder: "support@yourcompany.com",
    Icon: OutlookIcon,
    color: "#0F6CBD",
    tint: "#0F6CBD1f",
  },
  {
    value: "whatsapp",
    label: "WhatsApp",
    addressKind: "phone",
    blurb: "WhatsApp Business number",
    addressLabel: "WhatsApp number",
    addressPlaceholder: "+971 50 123 4567",
    Icon: WhatsAppIcon,
    color: "#1DA851",
    tint: "#25D3661f",
  },
  {
    value: "sms",
    label: "SMS",
    addressKind: "phone",
    blurb: "Text messaging via Twilio",
    addressLabel: "Phone number",
    addressPlaceholder: "+1 415 555 0132",
    Icon: TwilioSmsIcon,
    color: "#F22F46",
    tint: "#F22F461f",
  },
];

export function providerMeta(provider: ChannelProvider) {
  return CHANNEL_PROVIDERS.find((entry) => entry.value === provider)!;
}

/** Provider glyph on its tinted tile, used wherever a channel is listed. */
export function ProviderBadge({
  provider,
  size = "md",
}: {
  provider: ChannelProvider;
  size?: "sm" | "md";
}) {
  const meta = providerMeta(provider);
  const tile = size === "sm" ? "size-7 rounded-lg" : "size-9 rounded-xl";
  const glyph = size === "sm" ? "size-3.5" : "size-4.5";
  return (
    <span
      className={`flex shrink-0 items-center justify-center ${tile}`}
      style={{ backgroundColor: meta.tint, color: meta.color }}
    >
      <meta.Icon className={glyph} />
      <span className="sr-only">{meta.label}</span>
    </span>
  );
}
