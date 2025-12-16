import { useEffect, useState } from "react";

const THEME_STORAGE_KEY = "theme";

const applyThemeToDocument = () => {
  if (typeof document === "undefined") return;
  
  document.documentElement.classList.add("dark");
  document.documentElement.classList.remove("light");
  document.documentElement.dataset.theme = "dark";
  document.documentElement.setAttribute("data-theme", "dark");
  document.documentElement.style.colorScheme = "dark";
};

export function useTheme() {
  const [theme] = useState("dark");

  useEffect(() => {
    applyThemeToDocument();
  }, []);

  const toggleTheme = () => {
    // Theme is locked to dark mode
  };

  return [theme, toggleTheme];
}

export { THEME_STORAGE_KEY };



