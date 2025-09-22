// src/lib/assets.ts
const rawBase =
  (import.meta as any).env.VITE_ASSETS_BASE_URL?.trim() || "";

// 1) remove trailing slashes
let base = rawBase.replace(/\/+$/, "");

// 2) if someone accidentally put a file in the base (…/ui-assets/KAFDHD.webp),
//    strip the last path segment when it ends with an image extension
if (/\.(?:avif|webp|jpe?g|png)$/i.test(base.split("/").pop() || "")) {
  base = base.split("/").slice(0, -1).join("/");
}

export const asset = (p: string) => {
  // allow direct absolute URLs
  if (/^https?:\/\//i.test(p)) return p;
  return base ? `${base}/${p.replace(/^\//, "")}` : `/${p.replace(/^\//, "")}`;
};

// Point this to your real file name and (optional) folder
export const skyline = () => asset("KAFDHD.webp");
