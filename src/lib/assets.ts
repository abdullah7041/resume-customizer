const SKYLINE_URL =
  "https://cwcjeujextkwpmzdfzdz.supabase.co/storage/v1/object/public/ui-assets/KAFDH.webp";

const readBuildId = () => {
  const candidates: Array<string | undefined> = [];
  const metaEnv = (import.meta as { env?: Record<string, unknown> }).env;
  if (typeof metaEnv?.VITE_BUILD_ID === "string") {
    candidates.push(metaEnv.VITE_BUILD_ID);
  }
  if (typeof process !== "undefined" && typeof process.env?.VITE_BUILD_ID === "string") {
    candidates.push(process.env.VITE_BUILD_ID);
  }

  for (const candidate of candidates) {
    const trimmed = candidate?.trim();
    if (trimmed && trimmed.length > 0) {
      return trimmed;
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

export const skyline = () => withVersion(SKYLINE_URL);
