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
const trimLeadingSlashes = (value: string) => value.replace(/^\/+/, "");

const joinUrlSegments = (...segments: Array<string | null | undefined>) =>
  segments
    .filter((segment): segment is string => typeof segment === "string" && segment.length > 0)
    .map((segment, index) => {
      if (index === 0) {
        return trimTrailingSlashes(segment);
      }

      return trimLeadingSlashes(trimTrailingSlashes(segment));
    })
    .join("/");

const getSupabaseBaseUrl = () => {
  const envValue = readEnvString("VITE_SUPABASE_URL");
  if (!envValue) {
    throw new Error(
      "Missing VITE_SUPABASE_URL – required to resolve the skyline asset URL.",
    );
  }

  return trimTrailingSlashes(envValue);
};

const SKYLINE_OBJECT_PATH = "storage/v1/object/public/ui-assets/KAFDH.webp";

let memoizedSkylineUrl: string | null = null;
let hasLoggedSkylineUrl = false;

const isDevEnvironment = () => {
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env ?? {};
  if (typeof metaEnv.DEV === "boolean") {
    return metaEnv.DEV;
  }

  const runtimeEnv = typeof process !== "undefined" ? process.env ?? {} : {};
  if (typeof runtimeEnv.NODE_ENV === "string") {
    return runtimeEnv.NODE_ENV !== "production";
  }

  return false;
};

export const getSkylineUrl = () => {
  if (memoizedSkylineUrl) {
    return memoizedSkylineUrl;
  }

  const baseUrl = getSupabaseBaseUrl();
  const normalized = joinUrlSegments(baseUrl, SKYLINE_OBJECT_PATH);
  const versionedUrl = withVersion(normalized);

  memoizedSkylineUrl = versionedUrl;

  if (!hasLoggedSkylineUrl && isDevEnvironment()) {
    console.info("[skylineUrl]", versionedUrl);
    hasLoggedSkylineUrl = true;
  }

  return versionedUrl;
};
