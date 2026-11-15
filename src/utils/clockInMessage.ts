import { localTimeStr } from './dates';

export const DEFAULT_CLOCK_IN_MESSAGE = "I've arrived at office at {time}";

/** The message with {time} replaced by the clock-in time as HH:MM (local). An empty template uses the default. */
export function buildClockInMessage(template: string | undefined, atIso: string): string {
  const t = template?.trim() ? template.trim().slice(0, 500) : DEFAULT_CLOCK_IN_MESSAGE;
  return t.split('{time}').join(localTimeStr(new Date(atIso)));
}

/** WhatsApp Web with the text typed in and the chat still to pick (a link cannot name a group). */
export const whatsappUrl = (text: string): string => `https://web.whatsapp.com/send?text=${encodeURIComponent(text)}`;

const INVITE = /^https:\/\/chat\.whatsapp\.com\/[A-Za-z0-9]+\/?$/;

/** What the "Send to" box holds: '' (pick the chat), a group invite link, or a phone number. null = not understood. */
export function parseChatTarget(v: string): { kind: 'none' } | { kind: 'invite'; url: string } | { kind: 'phone'; digits: string } | null {
  const t = v.trim();
  if (!t) return { kind: 'none' };
  if (INVITE.test(t)) return { kind: 'invite', url: t };
  if (/^\+?[\d\s()-]+$/.test(t)) {
    const digits = t.replace(/\D/g, '');
    if (digits.length >= 7 && digits.length <= 15) return { kind: 'phone', digits };
  }
  return null;
}

/**
 * Where to open and what to copy for the clock-in message. A phone number opens that chat with the text typed in;
 * a group invite link opens the group (a link cannot carry text) so the text is copied for pasting; otherwise the chat is picked in WhatsApp.
 */
export function clockInOpenPlan(chat: string | undefined, text: string): { url: string; copy?: string } {
  const target = parseChatTarget(chat ?? '');
  if (target?.kind === 'phone') return { url: `https://web.whatsapp.com/send?phone=${target.digits}&text=${encodeURIComponent(text)}` };
  if (target?.kind === 'invite') return { url: target.url, copy: text };
  return { url: whatsappUrl(text) };
}
