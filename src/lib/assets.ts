// src/lib/assets.ts
const base = (import.meta as any).env.VITE_ASSETS_BASE_URL?.replace(/\/$/, "") || "";

export const asset = (p: string) => (base ? `${base}/${p.replace(/^\//, "")}` : `/images/${p}`);

export const skyline = () => {
  // Try .webp, fall back to .jpg automatically
  const webp = asset("KAFDHD.webp");
  const jpg  = asset("KAFDHD.jpg");
  // simple runtime webp support sniff (most modern browsers support it)
  const canWebP = typeof document !== "undefined" ? document.createElement("canvas")
    .toDataURL?.("image/webp").startsWith("data:image/webp") : true;
  return canWebP ? webp : jpg;
};