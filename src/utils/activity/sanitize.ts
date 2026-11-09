const SECRET_PATTERNS: RegExp[] = [
  /AIza[0-9A-Za-z_-]{30,}/g, // Google API keys
  /\b(?:ghp|gho|ghu|ghs|ghr)_[0-9A-Za-z]{20,}/g, // GitHub tokens
  /\bsk-[0-9A-Za-z_-]{16,}/g, // OpenAI / Anthropic style keys
  /\bAKIA[0-9A-Z]{16}\b/g, // AWS access key ids
  /\bxox[abprs]-[0-9A-Za-z-]{10,}/g, // Slack tokens
  /\bglpat-[0-9A-Za-z_-]{16,}/g, // GitLab tokens
  /\beyJ[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}\.[0-9A-Za-z_-]{8,}/g, // JWTs
  /-----BEGIN [A-Z ]*PRIVATE KEY-----[\sA-Za-z0-9+/=-]*/g, // private key blocks
  /\bBearer\s+[0-9A-Za-z._~+/=-]{8,}/gi,
  // "password=x", "token: x" and the spoken forms "my password is x", "the api key is x"
  /\b(?:password|passwd|pwd|secret|token|api[ _-]?key)\s*(?:[=:]|\b(?:is|was)\b)\s*\S+/gi,
];

/** Replaces anything that looks like a key, token or password before text leaves the machine. */
export function redactSecrets(text: string): string {
  return SECRET_PATTERNS.reduce((out, re) => out.replace(re, '[redacted]'), text);
}

/** Cuts text to at most `max` characters, ending with an ellipsis when it was shortened. */
export function clip(text: string, max: number): string {
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
}
