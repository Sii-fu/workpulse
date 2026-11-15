process.env.TZ = 'Asia/Dhaka';
import { describe, expect, it } from 'vitest';
import { buildClockInMessage, clockInOpenPlan, parseChatTarget, whatsappUrl } from './clockInMessage';

describe('clock-in message', () => {
  it('fills {time} with the local clock-in time', () => {
    expect(buildClockInMessage("I've arrived at {time}", '2026-11-12T03:12:00Z')).toBe("I've arrived at 09:12");
  });
  it('uses the default when the template is empty', () => {
    expect(buildClockInMessage('  ', '2026-11-12T03:12:00Z')).toBe("I've arrived at office at 09:12");
  });
  it('encodes the text in the link', () => {
    expect(whatsappUrl('a b&c')).toBe('https://web.whatsapp.com/send?text=a%20b%26c');
  });

  it('opens a phone number with the text, a group invite with the text copied, or lets you pick', () => {
    expect(clockInOpenPlan('+880 1712-345678', 'hi')).toEqual({ url: 'https://web.whatsapp.com/send?phone=8801712345678&text=hi' });
    expect(clockInOpenPlan('https://chat.whatsapp.com/AbC123xyz', 'hi there')).toEqual({ url: 'https://chat.whatsapp.com/AbC123xyz', copy: 'hi there' });
    expect(clockInOpenPlan('', 'hi')).toEqual({ url: whatsappUrl('hi') });
    expect(clockInOpenPlan('nonsense', 'hi')).toEqual({ url: whatsappUrl('hi') });
  });
  it('understands only numbers of 7 to 15 digits and WhatsApp invite links', () => {
    expect(parseChatTarget('  ')).toEqual({ kind: 'none' });
    expect(parseChatTarget('12345')).toBeNull();
    expect(parseChatTarget('https://evil.example/AbC')).toBeNull();
    expect(parseChatTarget('https://chat.whatsapp.com/AbC123')).toMatchObject({ kind: 'invite' });
  });
});
