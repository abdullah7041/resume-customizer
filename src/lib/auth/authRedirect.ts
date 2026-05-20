interface AuthRedirectLocation {
  hostname: string;
  origin: string;
  pathname?: string;
}

interface AuthRedirectLogger {
  warn: (message: string, error: unknown) => void;
}

interface ResolveAuthRedirectUrlOptions {
  envRedirectUrl?: string;
  location?: AuthRedirectLocation;
  logger?: AuthRedirectLogger;
}

const isLocalhostLike = (hostname = "") => {
  const normalized = hostname.trim().toLowerCase();
  if (!normalized) return false;

  return (
    normalized === "localhost" ||
    normalized === "127.0.0.1" ||
    normalized === "0.0.0.0" ||
    normalized.endsWith(".local")
  );
};

export const resolveAuthRedirectUrl = ({
  envRedirectUrl,
  location,
  logger = console,
}: ResolveAuthRedirectUrlOptions = {}) => {
  const trimmedOverride = typeof envRedirectUrl === "string" ? envRedirectUrl.trim() : "";

  if (!location) {
    return trimmedOverride || undefined;
  }

  if (trimmedOverride) {
    try {
      const overrideUrl = new URL(trimmedOverride, location.origin);

      if (isLocalhostLike(overrideUrl.hostname) && !isLocalhostLike(location.hostname)) {
        // Ignore localhost overrides when running on a remote tunnel / deployed host.
      } else {
        return overrideUrl.toString();
      }
    } catch (error) {
      logger.warn("Invalid VITE_SUPABASE_REDIRECT_URL, falling back to window origin", error);
    }
  }

  if (location.pathname && location.pathname !== "/") {
    return `${location.origin}${location.pathname}`;
  }

  return location.origin;
};
