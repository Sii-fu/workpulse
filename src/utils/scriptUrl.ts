// The Sheets proxy may only call Google Apps Script web apps (S2).
export function isAllowedScriptUrl(url: string): boolean {
  let u: URL;
  try {
    u = new URL(url);
  } catch {
    return false;
  }
  return u.protocol === 'https:' && u.hostname === 'script.google.com' && u.pathname.startsWith('/macros/s/');
}
