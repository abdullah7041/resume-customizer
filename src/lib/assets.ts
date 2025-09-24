// src/lib/assets.ts
const base = import.meta.env.VITE_ASSETS_BASE_URL?.replace(/\/$/, "") ?? "";
const devFallbackBase = import.meta.env.DEV ? "/images" : "";

const normalize = (p: string) => p.replace(/^\//, "");

export const asset = (p: string) => {
  const normalized = normalize(p);
  if (base) {
    return `${base}/${normalized}`;
  }
  if (devFallbackBase) {
    return `${devFallbackBase}/${normalized}`;
  }
  return `/${normalized}`;
};

export const withVersion = (u: string) => {
  const buildId = import.meta.env.VITE_BUILD_ID;
  if (!buildId) {
    return u;
  }
  return `${u}${u.includes("?") ? "&" : "?"}v=${buildId}`;
};

export const skyline = () => {
  // Try .webp, fall back to .jpg automatically
  const webp = withVersion(asset("KAFDHD.webp"));
  const jpg = withVersion(asset("KAFDHD.jpg"));
  // simple runtime webp support sniff (most modern browsers support it)
  const canWebP = typeof document !== "undefined"
    ? document.createElement("canvas").toDataURL?.("image/webp").startsWith("data:image/webp")
    : true;
  return canWebP ? webp : jpg;
};

