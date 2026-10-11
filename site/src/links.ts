// Outbound link policy. Every configurable URL passes through here at build time, so a
// typo or an unsafe scheme fails the build instead of shipping.

export type Outbound = {href: string; target?: '_blank'; rel?: string};

/**
 * '' → null (the caller renders a pending state).
 * https:// → new tab with noopener/noreferrer.
 * mailto: → same tab (only when allowMailto).
 * Anything else throws.
 */
export const outbound = (url: string, {allowMailto = false} = {}): Outbound | null => {
  const value = url.trim();
  if (value === '') return null;
  let parsed: URL;
  try {
    parsed = new URL(value);
  } catch {
    throw new Error(`Invalid URL in src/config.ts: ${JSON.stringify(url)}`);
  }
  if (parsed.protocol === 'https:') return {href: parsed.href, target: '_blank', rel: 'noopener noreferrer'};
  if (allowMailto && parsed.protocol === 'mailto:' && parsed.pathname.includes('@')) return {href: value};
  throw new Error(`Unsupported URL in src/config.ts (use https://${allowMailto ? ' or mailto:' : ''}): ${JSON.stringify(url)}`);
};

/** Canonical origin: https, no path, no trailing slash. '' stays ''. */
export const siteOrigin = (url: string): string => {
  const value = url.trim();
  if (value === '') return '';
  const parsed = new URL(value);
  if (parsed.protocol !== 'https:') throw new Error(`siteUrl must use https: ${JSON.stringify(url)}`);
  return parsed.origin;
};
