import React, { useCallback, useEffect, useId, useState } from 'react';
import { Check, Copy, ExternalLink, Loader2 } from 'lucide-react';
import type { AppSettings } from '../../../types';
import type { PhoneSyncStatus } from '../../../hooks/usePhoneSync';
import { getScriptVersion, resetPhoneAccess, sendTestEmail, setEmailSchedule, setPhonePin } from '../../../utils/phoneApi';
import { DEFAULT_EMAIL_TIME, parseEmailTime, phoneLink } from '../../../utils/phoneSettings';
import { GOOGLE_APPS_SCRIPT_CODE } from '../../../utils/googleAppsScriptTemplate';
import { localDateOfIso, localDateStr, localTimeStr } from '../../../utils/dates';
import { dayLabelLong } from '../../../utils/taskSections';

interface PhoneEmailSectionProps {
  settings: AppSettings;
  /** Saves at once (the token, the email choice); the rest of Settings still waits for Save. */
  onSaveSettings(next: AppSettings): void;
  status: PhoneSyncStatus;
  onNotify(msg: string, type?: 'success' | 'error' | 'info'): void;
}

const LABEL = 'block mb-1 text-[length:var(--fs-small)] font-semibold text-[var(--text-muted)]';
const FIELD = 'v2-input w-full h-11 px-3 text-[length:var(--fs-body)]';
const BTN =
  'v2-btn inline-flex items-center justify-center gap-1.5 min-h-11 px-4 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed';
const TEXT_BTN =
  'min-h-8 pointer-coarse:min-h-11 px-1 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 cursor-pointer disabled:opacity-50 disabled:no-underline disabled:cursor-not-allowed';
const HINT = 'text-[length:var(--fs-small)] text-[var(--text-muted)]';
const SUB = 'text-[length:var(--fs-body)] font-bold text-[var(--text-main)]';

// The script and the phone keypad both use exactly 4 digits.
const PIN_RE = /^\d{4}$/;

type PinMode = 'none' | 'set' | 'change' | 'reset';
type Result = { ok: boolean; message: string } | null;

const zone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'UTC';

function when(iso: string): string {
  const d = new Date(iso);
  const date = localDateOfIso(iso);
  return date === localDateStr() ? localTimeStr(d) : `${dayLabelLong(date)} at ${localTimeStr(d)}`;
}

const ResultLine: React.FC<{ result: Result }> = ({ result }) =>
  result ? (
    <p role={result.ok ? 'status' : 'alert'} className={`text-[length:var(--fs-small)] ${result.ok ? 'text-success' : 'text-danger'}`}>
      {result.message}
    </p>
  ) : null;

/** The update steps, shared by the old-script notice and the setup help. */
const SetupSteps: React.FC<{ onCopy(): void; copied: boolean }> = ({ onCopy, copied }) => (
  <ol className="list-decimal pl-5 flex flex-col gap-2 text-[length:var(--fs-small)] text-[var(--text-main)]">
    <li>
      Copy the script and paste it into your Sheet's Apps Script (Extensions &gt; Apps Script), replacing the old code.
      <div className="mt-2">
        <button type="button" onClick={onCopy} className={BTN}>
          {copied ? <Check className="h-4 w-4" aria-hidden="true" /> : <Copy className="h-4 w-4" aria-hidden="true" />}
          <span>{copied ? 'Copied' : 'Copy script'}</span>
        </button>
      </div>
    </li>
    <li>
      Choose <strong>Deploy &gt; Manage deployments</strong>, edit the existing deployment (the pencil), set Version to{' '}
      <strong>New version</strong> and press Deploy. Do not choose New deployment: it changes the link WorkPulse uses.
    </li>
    <li>Allow the permissions Google asks for: your Sheet, sending email to you, and a daily timer.</li>
    <li>Come back here and set the phone PIN.</li>
  </ol>
);

export const PhoneEmailSection: React.FC<PhoneEmailSectionProps> = ({ settings, onSaveSettings, status, onNotify }) => {
  const uid = useId();
  const url = settings.googleScriptUrl || '';
  const token = settings.phoneToken || '';
  const link = phoneLink(url);

  // undefined = checking, null = could not reach
  const [version, setVersion] = useState<number | null | undefined>(undefined);
  const [copied, setCopied] = useState(false);

  const [mode, setMode] = useState<PinMode>('none');
  const [pin, setPin] = useState('');
  const [pin2, setPin2] = useState('');
  const [currentPin, setCurrentPin] = useState('');
  const [pinBusy, setPinBusy] = useState(false);
  const [pinResult, setPinResult] = useState<Result>(null);

  const savedTime = parseEmailTime(settings.emailTime) ? (settings.emailTime as string) : DEFAULT_EMAIL_TIME;
  const [emailOn, setEmailOn] = useState(settings.emailEnabled === true);
  const [emailTime, setEmailTime] = useState(savedTime);
  const [emailBusy, setEmailBusy] = useState<'save' | 'test' | null>(null);
  const [emailResult, setEmailResult] = useState<Result>(null);

  const check = useCallback(() => {
    if (!url) return;
    setVersion(undefined);
    getScriptVersion(url).then(setVersion);
  }, [url]);

  useEffect(check, [check]);

  const copyScript = () => {
    navigator.clipboard?.writeText(GOOGLE_APPS_SCRIPT_CODE).then(
      () => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2500);
      },
      () => onNotify('Could not copy to the clipboard.', 'error'),
    );
  };

  const copyLink = () => {
    if (!link) return;
    navigator.clipboard?.writeText(link).then(
      () => onNotify('Phone link copied', 'success'),
      () => onNotify('Could not copy to the clipboard.', 'error'),
    );
  };

  const openMode = (m: PinMode) => {
    setMode(m);
    setPin('');
    setPin2('');
    setCurrentPin('');
    setPinResult(null);
  };

  const submitPin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === 'reset' && !PIN_RE.test(currentPin)) {
      setPinResult({ ok: false, message: 'Enter your current PIN: 4 digits.' });
      return;
    }
    if (!PIN_RE.test(pin)) {
      setPinResult({ ok: false, message: 'The new PIN must be 4 digits.' });
      return;
    }
    if (pin !== pin2) {
      setPinResult({ ok: false, message: 'The two PINs are not the same. Type them again.' });
      return;
    }
    setPinBusy(true);
    setPinResult(null);
    const r =
      mode === 'reset' ? await resetPhoneAccess(url, currentPin, pin) : await setPhonePin(url, pin, { token: token || undefined });
    setPinBusy(false);
    const newToken = r.ok ? r.data?.token : undefined;
    if (!newToken) {
      setPinResult({ ok: false, message: r.ok ? 'The script did not send back a link key. Update and redeploy the script.' : r.message });
      return;
    }
    // Only the returned token is kept; the PIN itself is never stored here.
    onSaveSettings({ ...settings, phoneToken: newToken, phoneLastError: undefined });
    setMode('none');
    setPin('');
    setPin2('');
    setCurrentPin('');
    setPinResult({ ok: true, message: 'PIN saved. Open the phone link and enter it once.' });
  };

  const saveEmail = async () => {
    const t = parseEmailTime(emailTime);
    if (emailOn && !t) {
      setEmailResult({ ok: false, message: 'Enter a time such as 18:00.' });
      return;
    }
    const time = t ?? parseEmailTime(DEFAULT_EMAIL_TIME)!;
    setEmailBusy('save');
    setEmailResult(null);
    const r = await setEmailSchedule(url, token, { enabled: emailOn, hour: time.hour, minute: time.minute, tz: zone() });
    setEmailBusy(null);
    if (!r.ok) {
      setEmailResult({ ok: false, message: r.message });
      return;
    }
    const hhmm = `${String(time.hour).padStart(2, '0')}:${String(time.minute).padStart(2, '0')}`;
    onSaveSettings({ ...settings, emailEnabled: emailOn, emailTime: hhmm });
    setEmailResult({
      ok: true,
      message: emailOn
        ? `Evening email is on. It arrives around ${hhmm} on days with a log or a clock-in.`
        : 'Evening email is off.',
    });
  };

  const testEmail = async () => {
    setEmailBusy('test');
    setEmailResult(null);
    const r = await sendTestEmail(url, token);
    setEmailBusy(null);
    const to = (r.data as { to?: unknown } | undefined)?.to;
    setEmailResult(
      r.ok ? { ok: true, message: typeof to === 'string' && to ? `Test email sent to ${to}.` : 'Test email sent.' } : { ok: false, message: r.message },
    );
  };

  if (!url) {
    return <p className={HINT}>Connect the Google Sheet above and save, then come back here.</p>;
  }
  if (version === undefined) {
    return (
      <p role="status" className={`${HINT} flex items-center gap-1.5`}>
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Checking your script…
      </p>
    );
  }
  if (version === null) {
    return (
      <div className="flex flex-col items-start gap-2">
        <p className={HINT}>Could not reach your script. Check the URL above with Test connection, then try again.</p>
        <button type="button" onClick={check} className={BTN}>
          Check again
        </button>
      </div>
    );
  }
  if (version < 3) {
    return (
      <div className="flex flex-col gap-3">
        <p className="text-[length:var(--fs-body)] text-[var(--text-main)]">
          Your Sheet runs script version {version}. Log sync still works; the phone page and the evening email need
          version 3.
        </p>
        <SetupSteps onCopy={copyScript} copied={copied} />
        <div>
          <button type="button" onClick={check} className={BTN}>
            Check again
          </button>
        </div>
      </div>
    );
  }

  const pinForm =
    mode === 'none' ? null : (
      <form onSubmit={submitPin} className="flex flex-col gap-3 w-full max-w-sm" aria-label={mode === 'reset' ? 'Reset phone access' : mode === 'change' ? 'Change PIN' : 'Set PIN'}>
        {mode === 'reset' && (
          <div>
            <label htmlFor={`${uid}-cur`} className={LABEL}>
              Current PIN
            </label>
            <input
              id={`${uid}-cur`}
              type="password"
              inputMode="numeric"
              autoComplete="off"
              maxLength={4}
              value={currentPin}
              onChange={(e) => setCurrentPin(e.target.value.replace(/\D/g, ''))}
              className={`${FIELD} num !w-32`}
            />
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          <div>
            <label htmlFor={`${uid}-pin`} className={LABEL}>
              New PIN
            </label>
            <input
              id={`${uid}-pin`}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={pin}
              onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
              aria-describedby={`${uid}-pin-hint`}
              className={`${FIELD} num !w-32`}
            />
          </div>
          <div>
            <label htmlFor={`${uid}-pin2`} className={LABEL}>
              New PIN again
            </label>
            <input
              id={`${uid}-pin2`}
              type="password"
              inputMode="numeric"
              autoComplete="new-password"
              maxLength={4}
              value={pin2}
              onChange={(e) => setPin2(e.target.value.replace(/\D/g, ''))}
              className={`${FIELD} num !w-32`}
            />
          </div>
        </div>
        <p id={`${uid}-pin-hint`} className={HINT}>
          4 digits. You type it on the phone; this computer does not keep it.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <button type="submit" disabled={pinBusy} className={`${BTN} v2-btn-strong`}>
            {pinBusy && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
            <span>{mode === 'reset' ? 'Reset access' : mode === 'change' ? 'Change PIN' : 'Set PIN'}</span>
          </button>
          <button type="button" onClick={() => openMode('none')} className={TEXT_BTN}>
            Cancel
          </button>
        </div>
      </form>
    );

  return (
    <>
      <div className="flex flex-col items-start gap-3">
        <h3 className={SUB}>Phone</h3>
        <p className={HINT}>
          Plan tasks on your phone on the way in; they wait here when you open WorkPulse. Use this on one computer only.
        </p>

        {/* Not a live region: background pushes would announce themselves every few minutes. */}
        <div className="flex flex-col gap-1 text-[length:var(--fs-small)]">
          <p className="text-[var(--text-main)]">
            <span className="font-semibold">{token ? 'Linked' : 'Not linked yet'}</span>
            <span className="text-[var(--text-muted)]">
              {' · '}script version <span className="num">{version}</span>
              {token &&
                (status.lastPushAt ? (
                  <>
                    {' · '}last sent from this computer <span className="num">{when(status.lastPushAt)}</span>
                  </>
                ) : (
                  ' · nothing sent yet'
                ))}
            </span>
          </p>
          {token && status.lastError && <p className="text-danger">The last try failed: {status.lastError}</p>}
          {token && status.deviceChanged && (
            <p className="text-danger">Another computer is also sending data to this Sheet. Only one computer should.</p>
          )}
        </div>

        {token && link && (
          <div className="w-full">
            <label htmlFor={`${uid}-link`} className={LABEL}>
              Phone link
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                id={`${uid}-link`}
                type="text"
                readOnly
                value={link}
                onFocus={(e) => e.target.select()}
                className={`${FIELD} flex-1 font-mono`}
              />
              <div className="flex gap-2 shrink-0">
                <button type="button" onClick={copyLink} className={BTN}>
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  <span>Copy link</span>
                </button>
                <a href={link} target="_blank" rel="noreferrer" className={`${BTN} no-underline`}>
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  <span>Open</span>
                </a>
              </div>
            </div>
            <p className={`${HINT} mt-1`}>Open it on your phone and add it to the home screen. Keep it private.</p>
          </div>
        )}

        {mode === 'none' &&
          (token ? (
            <div className="flex flex-wrap gap-x-4">
              <button type="button" onClick={() => openMode('change')} className={TEXT_BTN}>
                Change PIN
              </button>
              <button type="button" onClick={() => openMode('reset')} className={TEXT_BTN}>
                Reset phone access
              </button>
            </div>
          ) : (
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              <button type="button" onClick={() => openMode('set')} className={`${BTN} v2-btn-strong`}>
                Set PIN
              </button>
              <button type="button" onClick={() => openMode('reset')} className={TEXT_BTN}>
                Already set a PIN? Reset phone access
              </button>
            </div>
          ))}
        {pinForm}
        <ResultLine result={pinResult} />

        <details className="w-full">
          <summary className="min-h-11 cursor-pointer list-none py-2 text-[length:var(--fs-small)] font-semibold text-[var(--accent-text)] underline underline-offset-4 [&::-webkit-details-marker]:hidden">
            How to update the script
          </summary>
          <div className="pt-2">
            <SetupSteps onCopy={copyScript} copied={copied} />
          </div>
        </details>
      </div>

      <div className="flex flex-col items-start gap-3 border-t border-[var(--border-app)] pt-5">
        <h3 className={SUB}>Evening email</h3>
        {!token ? (
          <p className={HINT}>Set the phone PIN first; the email uses the same link to your Sheet.</p>
        ) : (
          <>
            <p className={HINT}>
              A summary of the day (hours, logs by project, tasks done and still open) sent to your Google address. Google
              sends it within about 15 minutes of the time you choose.
            </p>
            <label className="flex items-center gap-2.5 min-h-11 text-[length:var(--fs-body)] text-[var(--text-main)] cursor-pointer">
              <input
                type="checkbox"
                checked={emailOn}
                onChange={(e) => {
                  setEmailOn(e.target.checked);
                  setEmailResult(null);
                }}
                className="w-4 h-4 accent-[var(--accent-text)]"
              />
              <span className="font-semibold">Send me an evening email</span>
            </label>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor={`${uid}-time`} className={LABEL}>
                  Around
                </label>
                <input
                  id={`${uid}-time`}
                  type="time"
                  value={emailTime}
                  disabled={!emailOn}
                  onChange={(e) => {
                    setEmailTime(e.target.value);
                    setEmailResult(null);
                  }}
                  className={`${FIELD} num !w-36 disabled:opacity-50`}
                />
              </div>
              <button type="button" onClick={saveEmail} disabled={emailBusy !== null} className={`${BTN} v2-btn-strong`}>
                {emailBusy === 'save' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>Save</span>
              </button>
              <button type="button" onClick={testEmail} disabled={emailBusy !== null} className={BTN}>
                {emailBusy === 'test' && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
                <span>Send a test email</span>
              </button>
            </div>
            <ResultLine result={emailResult} />
          </>
        )}
      </div>
    </>
  );
};
