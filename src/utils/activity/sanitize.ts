const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{30,}/g, // Google API keys
  /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{20,}/g, // GitHub tokens
  /\bsk-[0-9A-Za-z_-]{16,}/g, // OpenAI / Anthropic style keys
  /\bBearer\s+[0-9A-Za-z._~+/=-]{8,}/gi,
  /\b(?:password|passwd|pwd|secret|token|api[_-]?key)\s*[=:]\s*\S+/gi,
];

/** Replaces anything that looks like a key, token or password before text leaves the machine. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((out, re) => out.replace(re, '[redacted]'), text);
}

/** Cuts text to at most `max` characters, ending with an ellipsis when it was shortened. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
