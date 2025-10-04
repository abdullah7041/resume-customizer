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

  const hasPath = parsed.pathname && parsed.pathname !== "/";
  if (hasPath || parsed.search || parsed.hash) {
    throw new Error(`${sourceKey} must be a host-only URL (https://host.tld).`);
  }

  return parsed.origin;
};

const readAssetsBaseHost = () => {
  const assetsBase = readEnvString("VITE_ASSETS_BASE_URL");
  if (assetsBase) {
    return ensureHostOnlyUrl(assetsBase, "VITE_ASSETS_BASE_URL");
  }

  const supabaseUrl = readEnvString("VITE_SUPABASE_URL");
  if (supabaseUrl) {
    return ensureHostOnlyUrl(supabaseUrl, "VITE_SUPABASE_URL");
  }

  throw new Error(
    "Missing VITE_ASSETS_BASE_URL or VITE_SUPABASE_URL – required to resolve the skyline asset URL.",
  );
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
  const bucketSegment = normalizeBucketName(bucket);
  const objectSegment = normalizeObjectPath(objectPath);
  const pathname = `${PUBLIC_STORAGE_PREFIX}/${bucketSegment}/${objectSegment}`;
  return new URL(pathname, baseHost).toString();
};

const SKYLINE_BUCKET = "ui-assets";
const SKYLINE_OBJECT_PATH = "KAFDH.webp";

let memoizedSkylineUrl: string | null = null;

export const getSkylineUrl = () => {
  if (!memoizedSkylineUrl) {
    memoizedSkylineUrl = withVersion(publicAssetUrl(SKYLINE_BUCKET, SKYLINE_OBJECT_PATH));
  }

  return memoizedSkylineUrl;
};
