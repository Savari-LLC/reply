import { v } from "convex/values";

/**
 * Where a channel's conversations come from. Email providers are addressed by
 * mailbox, messaging providers by phone number. Connections are simulated: the
 * provider is recorded, and a sample dataset stands in for the real account.
 */
export const channelProviderValidator = v.union(
  v.literal("gmail"),
  v.literal("outlook"),
  v.literal("whatsapp"),
  v.literal("sms"),
);

export type ChannelProvider = "gmail" | "outlook" | "whatsapp" | "sms";

const PROVIDER_LABELS: Record<ChannelProvider, string> = {
  gmail: "Gmail",
  outlook: "Outlook",
  whatsapp: "WhatsApp",
  sms: "SMS",
};

export function providerLabel(provider: ChannelProvider) {
  return PROVIDER_LABELS[provider];
}

/** Email providers are addressed by mailbox, messaging providers by number. */
export function providerAddressKind(provider: ChannelProvider): "email" | "phone" {
  return provider === "gmail" || provider === "outlook" ? "email" : "phone";
}

/**
 * Validates and canonicalizes the account a channel delivers from: a lowercase
 * mailbox for email providers, an E.164-style number for messaging providers.
 */
export function normalizeChannelAddress(provider: ChannelProvider, value: string) {
  const trimmed = value.trim();
  if (providerAddressKind(provider) === "email") {
    const address = trimmed.toLowerCase();
    if (!/^[^\s@]+@[^\s@.]+\.[^\s@]+$/.test(address)) {
      throw new Error(`Enter a valid ${providerLabel(provider)} address`);
    }
    if (address.length > 120) throw new Error("That address is too long");
    return address;
  }
  const number = trimmed.replace(/[\s().-]/g, "");
  if (!/^\+?[0-9]{7,15}$/.test(number)) {
    throw new Error(`Enter a valid ${providerLabel(provider)} phone number`);
  }
  return number.startsWith("+") ? number : `+${number}`;
}
