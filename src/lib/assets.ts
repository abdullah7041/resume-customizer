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

  const [withoutHash, hashFragment] = url.split("#", 2);

  if (/[?&]v=/i.test(withoutHash)) {
    return url;
  }

  const version = readBuildId() ?? "__dev__";
  const hasQuery = withoutHash.includes("?");
  const endsWithDelimiter = withoutHash.endsWith("?") || withoutHash.endsWith("&");
  const separator = hasQuery ? (endsWithDelimiter ? "" : "&") : "?";
  const versionedWithoutHash = `${withoutHash}${separator}v=${version}`;
  return hashFragment ? `${versionedWithoutHash}#${hashFragment}` : versionedWithoutHash;
};

const readEnvString = (key: string) => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};

  if (Object.prototype.hasOwnProperty.call(runtimeEnv, key)) {
    const runtimeValue = runtimeEnv[key];
    if (typeof runtimeValue === "string") {
      const trimmed = runtimeValue.trim();
      if (trimmed.length > 0) {
        return trimmed;
      }
    }

    return null;
  }

  const metaValue = metaEnv[key];
  if (typeof metaValue === "string") {
    const trimmed = metaValue.trim();
    if (trimmed) {
      return trimmed;
    }
  }

  return null;
};

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

const HOST_ONLY_PATTERN = /^https?:\/\/[^/]+$/i;
const SUPABASE_HOST_PATTERN = /\.supabase\.(co|in)$/i;

const isDevEnvironment = () => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (metaEnv && typeof metaEnv.DEV === "boolean") {
    return metaEnv.DEV;
  }

  if (typeof process !== "undefined" && typeof process.env?.NODE_ENV === "string") {
    return process.env.NODE_ENV !== "production";
  }

  return false;
};

const warnedMessages = new Set<string>();

const warnHostOnlyEnv = (message: string) => {
  if (!isDevEnvironment()) {
    return;
  }

  const normalizedMessage = message.trim();
  if (warnedMessages.has(normalizedMessage)) {
    return;
  }

  warnedMessages.add(normalizedMessage);
  console.warn(normalizedMessage);
};

type AssetsBaseHost = { origin: string; coerced: boolean } | null;

const ensureHostOnlyUrl = (value: string, sourceKey: string) => {
  const trimmed = value.trim();
  if (!trimmed) {
    throw new Error(`${sourceKey} must be set to a host-only URL (https://host.tld).`);
  }

  let parsed: URL;
  try {
    parsed = new URL(trimmed);
  } catch {
    throw new Error(`${sourceKey} must be an absolute URL.`);
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error(`${sourceKey} must use http or https.`);
  }

  const origin = parsed.origin;
  const trailingSlashNormalized = trimmed.endsWith("/") ? trimmed.slice(0, -1) : trimmed;
  const isAlreadyHostOnly = HOST_ONLY_PATTERN.test(trimmed) || trailingSlashNormalized === origin;

  const hasNonRootPath = parsed.pathname && parsed.pathname !== "/" && parsed.pathname !== "";
  const hasQueryOrHash = (parsed.search && parsed.search !== "") || (parsed.hash && parsed.hash !== "");

  const wasCoerced = !isAlreadyHostOnly || hasNonRootPath || hasQueryOrHash;

  if (wasCoerced) {
    warnHostOnlyEnv(
      `[assets] ${sourceKey} should be host-only (https://host.tld). Using ${origin} instead of ${trimmed}.`,
    );
  }

  return { origin, coerced: wasCoerced };
};

let cachedAssetsBaseHost: AssetsBaseHost | undefined;
let cachedSupabaseAnonKey: string | null | undefined;

const readAssetsBaseHost = () => {
  if (cachedAssetsBaseHost !== undefined) {
    return cachedAssetsBaseHost;
  }

  const warnInvalidEnv = (key: string, error: unknown) => {
    const message = error instanceof Error ? error.message : String(error);
    warnHostOnlyEnv(`[assets] ${key} is invalid: ${message}`);
  };

  const assetsBase = readEnvString("VITE_ASSETS_BASE_URL");
  if (assetsBase) {
    try {
      cachedAssetsBaseHost = ensureHostOnlyUrl(assetsBase, "VITE_ASSETS_BASE_URL");
      return cachedAssetsBaseHost;
    } catch (error) {
      warnInvalidEnv("VITE_ASSETS_BASE_URL", error);
    }
  }

  const supabaseUrl = readEnvString("VITE_SUPABASE_URL");
  if (supabaseUrl) {
    try {
      cachedAssetsBaseHost = ensureHostOnlyUrl(supabaseUrl, "VITE_SUPABASE_URL");
      return cachedAssetsBaseHost;
    } catch (error) {
      warnInvalidEnv("VITE_SUPABASE_URL", error);
    }
  }

  cachedAssetsBaseHost = null;
  return cachedAssetsBaseHost;
};

const readSupabaseAnonKey = () => {
  if (cachedSupabaseAnonKey !== undefined) {
    return cachedSupabaseAnonKey;
  }

  cachedSupabaseAnonKey = readEnvString("VITE_SUPABASE_ANON_KEY");
  return cachedSupabaseAnonKey;
};

const normalizeBucketName = (bucket: string) => {
  if (typeof bucket !== "string") {
    throw new TypeError("Bucket name must be a string.");
  }

  const trimmed = bucket.trim();
  if (!trimmed) {
    throw new Error("Bucket name cannot be empty.");
  }

  const sanitized = trimmed.replace(/^\/+|\/+$/g, "");
  if (!sanitized) {
    throw new Error("Bucket name cannot be empty.");
  }

  if (sanitized.includes("/")) {
    throw new Error("Bucket name must not contain slashes.");
  }

  return sanitized;
};

const normalizeObjectPath = (objectPath: string) => {
  if (typeof objectPath !== "string") {
    throw new TypeError("Object path must be a string.");
  }

  const trimmed = objectPath.trim();
  if (!trimmed) {
    throw new Error("Object path cannot be empty.");
  }

  const segments = trimmed.split("/").map((segment) => segment.trim()).filter(Boolean);
  if (segments.length === 0) {
    throw new Error("Object path cannot be empty.");
  }

  return segments.join("/");
};

const PUBLIC_STORAGE_PREFIX = "/storage/v1/object/public";

export const publicAssetUrl = (bucket: string, objectPath: string) => {
  const baseHost = readAssetsBaseHost();
  if (!baseHost) {
    return "";
  }
  const { origin, coerced } = baseHost;
  const bucketSegment = normalizeBucketName(bucket);
  const objectSegment = normalizeObjectPath(objectPath);
  const pathname = `${PUBLIC_STORAGE_PREFIX}/${bucketSegment}/${objectSegment}`;
  const url = new URL(pathname, origin);

  if (!coerced && SUPABASE_HOST_PATTERN.test(url.hostname)) {
    const anonKey = readSupabaseAnonKey();
    if (anonKey) {
      url.searchParams.set("apikey", anonKey);
    }
  }

  return url.toString();
};

const SKYLINE_BUCKET = "ui-assets";
const SKYLINE_OBJECT_PATH = "KAFDH.webp";

const FALLBACK_SKYLINE_SVG =
  '<svg xmlns="http://www.w3.org/2000/svg" width="1600" height="900" viewBox="0 0 1600 900" fill="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#063F36" stop-opacity="0.85"/><stop offset="0.5" stop-color="#0F766E" stop-opacity="0.82"/><stop offset="1" stop-color="#34D399" stop-opacity="0.72"/></linearGradient></defs><rect width="1600" height="900" fill="url(#g)"/><g opacity="0.32" stroke="#E2F8EE" stroke-width="1.2"><path d="M160 720V420l120-60 120 60v300"/><path d="M520 720V360l140-80 140 80v360"/><path d="M880 720V300l160-90 160 90v420"/><path d="M1240 720V420l120-60 120 60v300"/></g><g opacity="0.18" fill="#E2F8EE"><circle cx="320" cy="240" r="36"/><circle cx="1280" cy="200" r="42"/><circle cx="1040" cy="160" r="24"/></g></svg>';

const FALLBACK_SKYLINE_URL = `data:image/svg+xml,${encodeURIComponent(FALLBACK_SKYLINE_SVG)}`;

let memoizedSkylineUrl: string | null = null;

export const getSkylineUrl = () => {
  if (!memoizedSkylineUrl) {
    try {
      const resolvedUrl = publicAssetUrl(SKYLINE_BUCKET, SKYLINE_OBJECT_PATH);
      memoizedSkylineUrl = resolvedUrl ? withVersion(resolvedUrl) : FALLBACK_SKYLINE_URL;
    } catch (error) {
      warnHostOnlyEnv(
        `[assets] Failed to resolve skyline asset: ${error instanceof Error ? error.message : String(error)
        }`,
      );
      memoizedSkylineUrl = FALLBACK_SKYLINE_URL;
    }
  }

  return memoizedSkylineUrl;
};

export const __internal = {
  resetCache() {
    cachedAssetsBaseHost = undefined;
    cachedSupabaseAnonKey = undefined;
    memoizedSkylineUrl = null;
    warnedMessages.clear();
  },
};



