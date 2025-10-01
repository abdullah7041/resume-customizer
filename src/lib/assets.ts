const ENV_VERSION_KEYS = ["VITE_BUILD_TIMESTAMP", "VITE_BUILD_ID", "VITE_BUILD_TAG"] as const;

const readBuildId = () => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};

  for (const key of ENV_VERSION_KEYS) {
    const metaValue = metaEnv[key];
    if (typeof metaValue === "string") {
      const trimmed = metaValue.trim();
      if (trimmed) {
        return trimmed;
      }
    }

    const runtimeValue = runtimeEnv[key];
    if (typeof runtimeValue === "string") {
      const trimmed = runtimeValue.trim();
      if (trimmed) {
        return trimmed;
      }
    }
  }

  return null;
};

export const withVersion = (url: string) => {
  if (typeof url !== "string" || url.length === 0) {
    return url;
  }

  const version = readBuildId() ?? "__dev__";
  const separator = url.includes("?") ? "&" : "?";
  return `${url}${separator}v=${version}`;
};

const readEnvString = (key: string) => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};

  const metaValue = metaEnv[key];
  if (typeof metaValue === "string") {
    const trimmed = metaValue.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  const runtimeValue = runtimeEnv[key];
  if (typeof runtimeValue === "string") {
    const trimmed = runtimeValue.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

export const validatePublicUrl = (url: string) => {
  if (typeof url !== "string") {
    throw new TypeError("Public URL must be a string.");
  }

  const trimmed = url.trim();
  if (trimmed.length === 0) {
    throw new Error("Public URL cannot be empty.");
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`Invalid public URL: ${trimmed}`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`Public URL must use http or https: ${parsed.href}`);
  }

  const normalizedPathname = parsed.pathname.replace(/\/{2,}/g, "/");
  if (normalizedPathname !== parsed.pathname) {
    parsed.pathname = normalizedPathname;
  }

  return parsed.toString();
};

const joinUrlSegments = (...segments: Array<string | null | undefined>) =>
  segments
    .filter((segment): segment is string => typeof segment === "string" && segment.length > 0)
    .map((segment, index) => {
      if (index === 0) {
        return trimTrailingSlashes(segment);
      }

      return trimTrailingSlashes(segment.replace(/^\/+/, ""));
    })
    .join("/");

const getSupabaseBaseUrl = () => {
  const envValue = readEnvString("VITE_SUPABASE_URL");
  if (!envValue) {
    throw new Error(
      "Missing VITE_SUPABASE_URL – required to resolve the skyline asset URL.",
    );
  }

  return envValue;
};

const SKYLINE_OBJECT_PATH = "storage/v1/object/public/ui-assets/KAFDH.webp";
const SKYLINE_FILENAME = "KAFDH.webp";

const hasDuplicateFilename = (pathname: string, file: string) => {
  const re = new RegExp(`/${file}(?=(/|$))`, "g");
  const matches = pathname.match(re);
  return Array.isArray(matches) && matches.length > 1;
};

const looksLikeObjectUrl = (baseUrl: string) => {
  return (
    /\/storage\/v1\/object\/public\//.test(baseUrl) ||
    /\/KAFDH\.webp(?:$|[/?#])/.test(baseUrl)
  );
};

const toProjectBase = (baseUrl: string) => {
  const url = new URL(baseUrl);
  return url.origin;
};

const normalizeSupabaseProjectUrl = (rawBase: string, strictThrow: boolean) => {
  const validated = validatePublicUrl(rawBase);
  const normalized = trimTrailingSlashes(validated);

  if (!looksLikeObjectUrl(normalized)) {
    return normalized;
  }

  const msg =
    "VITE_SUPABASE_URL must be the Supabase *project* URL (e.g. https://xxxx.supabase.co), not a full object URL.";

  console.error(msg);

  if (strictThrow) {
    throw new Error(msg);
  }

  const sanitizedBase = toProjectBase(normalized);
  const sanitizedValidated = validatePublicUrl(sanitizedBase);
  return trimTrailingSlashes(sanitizedValidated);
};

const buildSkylineObjectUrl = (projectBase: string) => {
  const joined = joinUrlSegments(projectBase, SKYLINE_OBJECT_PATH);
  const sanitizedUrlString = validatePublicUrl(joined);
  const sanitizedUrl = new URL(sanitizedUrlString);

  const normalizedPath = sanitizedUrl.pathname.replace(/\/{2,}/g, "/");
  if (normalizedPath !== sanitizedUrl.pathname) {
    sanitizedUrl.pathname = normalizedPath;
  }

  if (!normalizedPath.endsWith(`/${SKYLINE_FILENAME}`)) {
    throw new Error(`Skyline asset segment missing in resolved URL: ${sanitizedUrl.href}`);
  }

  if (hasDuplicateFilename(normalizedPath, SKYLINE_FILENAME)) {
    throw new Error(
      `Skyline asset segment duplicated in resolved URL: ${sanitizedUrl.href}`,
    );
  }

  return sanitizedUrl.toString();
};

let memoizedSkylineUrl: string | null = null;
let hasLoggedSkylineUrl = false;

const readStrictOverride = (): boolean | null => {
  const overrideValue =
    readEnvString("VITE_SUPABASE_STRICT_SKYLINE") ??
    readEnvString("SUPABASE_STRICT_SKYLINE");

  if (!overrideValue) {
    return null;
  }

  const normalized = overrideValue.trim().toLowerCase();
  if (["false", "0", "off", "no"].includes(normalized)) {
    return false;
  }

  if (["true", "1", "on", "yes"].includes(normalized)) {
    return true;
  }

  return null;
};

const isDevEnvironment = () => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  if (typeof metaEnv.DEV === "boolean") {
    return metaEnv.DEV;
  }

  if (typeof metaEnv.DEV === "string") {
    const normalized = metaEnv.DEV.trim().toLowerCase();
    if (normalized === "false" || normalized === "0") {
      return false;
    }
    if (normalized === "true" || normalized === "1") {
      return true;
    }
  }
  
  // Check for MODE as well (Vite uses this)
  if (typeof metaEnv.MODE === "string") {
    return metaEnv.MODE !== "production";
  }

  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};
  if (typeof runtimeEnv.NODE_ENV === "string") {
    return runtimeEnv.NODE_ENV !== "production";
  }

  // Default to development in test environments
  if (typeof runtimeEnv.VITEST === "string" || typeof runtimeEnv.NODE_ENV === "undefined") {
    return true;
  }

  return false;
};

export const getSkylineUrl = () => {
  if (memoizedSkylineUrl) {
    return memoizedSkylineUrl;
  }

  const strictThrow = shouldStrictThrow();
  const rawBaseUrl = getSupabaseBaseUrl();
  const projectBaseUrl = normalizeSupabaseProjectUrl(rawBaseUrl, strictThrow);
  const skylineUrl = buildSkylineObjectUrl(projectBaseUrl);
  const versionedUrl = withVersion(skylineUrl);

  memoizedSkylineUrl = versionedUrl;

  if (!hasLoggedSkylineUrl && isDevEnvironment()) {
    console.info("[skylineUrl]", versionedUrl);
    hasLoggedSkylineUrl = true;
  }

  return versionedUrl;
};

function shouldStrictThrow(): boolean {
  const override = readStrictOverride();
  if (override !== null) {
    return override;
  }

  // Return true in development to throw errors, false in production to sanitize
  return isDevEnvironment();
}

