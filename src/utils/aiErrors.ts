// Turns what went wrong with an AI request into one plain sentence a colleague can act on.
// The server and the network layer produce technical strings ("Failed to fetch", "429 ...").

export function plainAiMessage(raw: string | undefined, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): string {
  const text = (raw || '').trim();
  if (!online) return 'You are offline, so Gemini cannot be reached.';
  if (/api[ _-]?key.*(missing|provided|not set|configure)|no gemini api key|GEMINI_API_KEY/i.test(text)) {
    return 'No Gemini key is set. Add one in Settings under AI.';
  }
  if (/API_KEY_INVALID|permission|unauthori[sz]ed|forbidden|\b(401|403)\b|key not valid/i.test(text)) {
    return 'Gemini did not accept the key. Check it in Settings under AI.';
  }
  if (/\b429\b|quota|rate.?limit|RESOURCE_EXHAUSTED|too many requests/i.test(text)) {
    return 'Gemini has reached its usage limit for now. Try again in a few minutes.';
  }
  if (/failed to fetch|networkerror|load failed|could not reach|econnrefused/i.test(text)) {
    return 'WorkPulse could not reach its server. Check that it is still running, then try again.';
  }
  if (!text) return 'Gemini did not answer.';
  return text.length > 160 ? `${text.slice(0, 157)}...` : text;
}

/** Same idea for the Google Sheet. */
export function plainSheetMessage(raw: string | undefined, online: boolean = typeof navigator === 'undefined' ? true : navigator.onLine): string {
  const text = (raw || '').trim();
  if (!online) return 'You are offline. The log is saved here and will go to the Sheet when you sync again.';
  if (/failed to fetch|networkerror|load failed|could not reach|econnrefused/i.test(text)) {
    return 'WorkPulse could not reach its server, so nothing was sent.';
  }
  if (/\b(401|403)\b|permission|unauthori[sz]ed|access/i.test(text)) {
    return 'The Sheet script refused the request. Check that it is deployed for "Anyone" and the URL is the latest one.';
  }
  return text || 'The Sheet did not accept the logs.';
}
