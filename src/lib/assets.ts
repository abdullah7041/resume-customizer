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

const trimTrailingSlashes = (value: string) => value.replace(/\/+$/, "");

const coerceBoolean = (value: unknown): boolean | null => {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    if (["true", "1", "yes", "on"].includes(normalized)) {
      return true;
    }
    if (["false", "0", "no", "off"].includes(normalized)) {
      return false;
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
  // Try VITE_ASSETS_BASE_URL first (for CDN or custom asset hosting)
  // Fall back to VITE_SUPABASE_URL (for direct Supabase storage)
  const assetsUrl = readEnvString("VITE_ASSETS_BASE_URL");
  const supabaseUrl = readEnvString("VITE_SUPABASE_URL");
  const envValue = assetsUrl || supabaseUrl;
  
  if (!envValue) {
    throw new Error(
      "Missing VITE_ASSETS_BASE_URL or VITE_SUPABASE_URL – required to resolve the skyline asset URL.",
    );
  }

  return envValue;
};

const SKYLINE_OBJECT_PATH = "storage/v1/object/public/ui-assets/KAFDH.webp";
const SKYLINE_FILENAME = "KAFDH.webp";

const toProjectBase = (baseUrl: string) => {
  const url = new URL(baseUrl);
  return url.origin;
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
  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};

  const vitestRuntime = coerceBoolean(runtimeEnv.VITEST);
  if (vitestRuntime === true) {
    return true;
  }

  const devMeta = coerceBoolean(metaEnv.DEV);
  if (devMeta !== null) {
    return devMeta;
  }

  if (typeof metaEnv.MODE === "string") {
    return metaEnv.MODE.trim().toLowerCase() !== "production";
  }

  const nodeEnv = typeof runtimeEnv.NODE_ENV === "string"
    ? runtimeEnv.NODE_ENV.trim().toLowerCase()
    : null;
  if (nodeEnv) {
    return nodeEnv !== "production";
  }

  if (vitestRuntime === false) {
    return false;
  }

  return true;
};

function shouldStrictThrow(): boolean {
  const override = readStrictOverride();
  if (override !== null) {
    return override;
  }

  // Return true in development to throw errors, false in production to sanitize
  return isDevEnvironment();
}

// Guard against someone setting VITE_SUPABASE_URL to a *full object URL*.
const looksLikeObjectUrl = (baseUrl: string) => {
  return /\/storage\/v1\/object\/public\//.test(baseUrl) || /\/KAFDH\.webp(?:$|[/?#])/.test(baseUrl);
};

const normalizeSupabaseProjectUrl = (baseUrl: string, strictThrow: boolean) => {
  if (looksLikeObjectUrl(baseUrl)) {
    const msg =
      "VITE_ASSETS_BASE_URL/VITE_SUPABASE_URL must be a base URL (e.g. https://xxxx.supabase.co or https://cdn.example.com), not a full object URL.";
    
    // Always log the error for visibility
    console.error(msg);
    
    if (strictThrow) {
      throw new Error(msg);
    }

    const sanitizedBase = toProjectBase(baseUrl);
    return validatePublicUrl(sanitizedBase);
  }

  return validatePublicUrl(baseUrl);
};

const buildSkylineObjectUrl = (baseUrl: string) => {
  const normalized = joinUrlSegments(baseUrl, SKYLINE_OBJECT_PATH);
  const sanitizedUrlString = validatePublicUrl(normalized);
  const sanitizedUrl = new URL(sanitizedUrlString);

  const normalizedPath = sanitizedUrl.pathname.replace(/\/{2,}/g, "/");
  if (normalizedPath !== sanitizedUrl.pathname) {
    sanitizedUrl.pathname = normalizedPath;
  }

  const pathSegments = sanitizedUrl.pathname.split("/");
  let filenameCount = 0;
  const dedupedSegments = pathSegments.filter((segment) => {
    if (segment === SKYLINE_FILENAME) {
      filenameCount += 1;
      if (filenameCount > 1) {
        return false;
      }
    }
    return true;
  });

  if (filenameCount === 0) {
    throw new Error(`Skyline asset segment missing in resolved URL: ${sanitizedUrl.href}`);
  }

  if (dedupedSegments.length !== pathSegments.length) {
    sanitizedUrl.pathname = dedupedSegments.join("/") || "/";
  }

  if (!sanitizedUrl.pathname.endsWith(`/${SKYLINE_FILENAME}`)) {
    throw new Error(`Skyline asset segment missing in resolved URL: ${sanitizedUrl.href}`);
  }

  return sanitizedUrl.toString();
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
    console.log("[skylineUrl]", versionedUrl);
    hasLoggedSkylineUrl = true;
  }

  return versionedUrl;
};
