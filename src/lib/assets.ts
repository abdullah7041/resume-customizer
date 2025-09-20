export const asset = (p: string) =>
  `${import.meta.env.VITE_ASSETS_BASE_URL?.replace(/\/$/, "")}/${p.replace(/^\//, "")}`;

export const skyline = () => asset("KAFDHD.webp");