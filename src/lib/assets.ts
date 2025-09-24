const ABSOLUTE_URL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:/;
const BUILD_VERSION_KEYS = ["VITE_BUILD_ID", "VITE_BUILD_TIMESTAMP"] as const;
const SKYLINE_ASSET_KEY = "VITE_SKYLINE_ASSET" as const;

const readBuildVersion = () => {
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  for (const key of BUILD_VERSION_KEYS) {
    const value = env?.[key];
    if (typeof value === "string" && value.trim().length > 0) {
      return value.trim();
    }
  }
  return null;
};

export const withVersion = (input: string) => {
  if (typeof input !== "string" || input.length === 0) {
    return input;
  }

  const version = readBuildVersion();
  if (!version) {
    return input;
  }

  const trimmed = input.trim();
  const isAbsolute = ABSOLUTE_URL_PATTERN.test(trimmed);

  try {
    const url = isAbsolute
      ? new URL(trimmed)
      : new URL(trimmed, "https://placeholder.local");

    url.searchParams.set("v", version);

    if (isAbsolute) {
      return url.toString();
    }

    const relative = `${url.pathname}${url.search}${url.hash}`;
    return relative.startsWith("/") ? relative : `/${relative}`;
  } catch {
    const [base, hash] = trimmed.split("#", 2);
    const separator = base.includes("?") ? "&" : "?";
    const next = `${base}${separator}v=${encodeURIComponent(version)}`;
    return hash ? `${next}#${hash}` : next;
  }
};

const resolveAssetBase = () => {
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const raw = env?.VITE_ASSETS_BASE_URL;
  if (typeof raw !== "string" || raw.trim().length === 0) {
    return "";
  }
  return raw.trim().replace(/\/$/, "");
};

const ASSET_BASE = resolveAssetBase();

export const asset = (p: string) => {
  const raw = typeof p === "string" ? p.trim() : "";
  if (!raw) {
    return raw;
  }

  if (ABSOLUTE_URL_PATTERN.test(raw)) {
    return raw;
  }

  const normalizedPath = raw.replace(/^\/+/, "");
  if (!ASSET_BASE) {
    return `/${normalizedPath}`;
  }
  return `${ASSET_BASE}/${normalizedPath}`;
};

const resolveSkylineAsset = () => {
  const env = import.meta.env as Record<string, string | undefined> | undefined;
  const configured = env?.[SKYLINE_ASSET_KEY];
  if (typeof configured === "string" && configured.trim().length > 0) {
    return configured.trim();
  }
  return "KAEDHero.webp";
};

export const skyline = () => withVersion(asset(resolveSkylineAsset()));
