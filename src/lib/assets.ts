const buildVersion =
  import.meta.env.VITE_BUILD_ID?.toString().trim() ||
  import.meta.env.VITE_BUILD_TIMESTAMP?.toString().trim() ||
  "";

export const withVersion = (url: string) => {
  if (!buildVersion) return url;

  const [base, hash = ""] = url.split("#");
  const separator = base.includes("?") ? "&" : "?";
  const versioned = `${base}${separator}v=${encodeURIComponent(buildVersion)}`;
  return hash ? `${versioned}#${hash}` : versioned;
};

export const asset = (p: string) => {
  const base = import.meta.env.VITE_ASSETS_BASE_URL?.replace(/\/$/, "");
  const path = p.replace(/^\//, "");
  if (!base) {
    return `/${path}`;
  }
  return `${base}/${path}`;
};

export const skyline = () => withVersion(asset("KAFDH.webp"));
