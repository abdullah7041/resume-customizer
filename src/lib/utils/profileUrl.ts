/**
 * Shared profile/URL link resolution for resume templates and DOCX export.
 *
 * - normalizeUrl: passes http URLs through, prepends https:// for domain-like strings
 *   (containing '.'), null for plain text labels.
 * - resolveProfileUrl: tries url field -> username field (only if it contains a dot,
 *   i.e. looks like a real URL), falling back to constructing a LinkedIn/GitHub URL
 *   from a bare identifier.
 *
 * Handles all data shapes from the AI parser:
 * - url: "https://linkedin.com/in/user" -> direct use
 * - url: "linkedin.com/in/user"         -> prepend https://
 * - url: "LinkedIn Account"             -> plain text (no dot -> can't make a link)
 * - url: "LinkedIn", username: "LinkedIn" -> plain text (neither has a dot)
 * - username: "linkedin.com/in/user"    -> prepend https://
 */
export const normalizeUrl = (url?: string): string | null => {
  if (!url) return null;
  let clean = url.trim();
  if (!clean) return null;

  // Auto-fix internal spaces by returning null if there are spaces without dot, or encoding if dot present
  if (clean.includes(' ') && !clean.includes('.')) return null;
  if (clean.includes(' ')) {
    clean = encodeURI(clean);
  }

  if (clean.startsWith('http')) return clean;
  if (clean.includes('.')) return `https://${clean}`;
  return null;
};

export const resolveProfileUrl = (profile?: { url?: string; username?: string; network?: string }): string | null => {
  if (!profile) return null;
  const fromUrl = normalizeUrl(profile.url);
  if (fromUrl) return fromUrl;

  // Fallback: If no URL was provided, try to build one from the username or text
  const id = (profile.url || profile.username)?.trim();

  // Don't construct URLs blindly if the text contains spaces
  if (id && !id.includes(' ') && !id.toLowerCase().includes(profile.network?.toLowerCase() || 'none')) {
    const net = profile.network?.toLowerCase();
    if (net === 'linkedin') return `https://linkedin.com/in/${id}`;
    if (net === 'github') return `https://github.com/${id}`;
  }

  const fromUsername = normalizeUrl(profile.username);
  if (fromUsername) return fromUsername;
  return null;
};
