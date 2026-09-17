const strip = (s: string) => {
  let v = s.trim().toLowerCase();
  while (v.endsWith("/")) v = v.slice(0, -1);
  return v;
};

/**
 * Match a request Origin against an allowed pattern.
 * Patterns are exact origins ("https://vertexmanagement.vercel.app") or may contain "*"
 * wildcards ("https://vertex-management-frontend-*.vercel.app"). Case and trailing slashes are ignored.
 */
export function originMatches(origin: string, pattern: string): boolean {
  const p = strip(pattern);
  const o = strip(origin);
  if (!p) return false;
  if (p === "*") return true;
  if (!p.includes("*")) return o === p;

  const parts = p.split("*");
  if (!o.startsWith(parts[0])) return false;
  let pos = parts[0].length;
  for (let i = 1; i < parts.length; i++) {
    const seg = parts[i];
    if (i === parts.length - 1) return o.endsWith(seg) && o.length - seg.length >= pos;
    const idx = o.indexOf(seg, pos);
    if (idx < 0) return false;
    pos = idx + seg.length;
  }
  return true;
}

export function isAllowedOrigin(origin: string, patterns: string[]): boolean {
  return patterns.some((p) => originMatches(origin, p));
}
