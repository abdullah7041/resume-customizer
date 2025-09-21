import { StrictMode } from "react";
import ReactDOM from "react-dom/client";
import { BrowserRouter } from "react-router-dom";
import App from "./App";
import { AuthProvider } from "./hooks/useAuth";
import "./index.css";
import { skyline } from "./lib/assets";

const preloadSkyline = () => {
  if (typeof document === "undefined") return;

  const href = skyline();
  const existing = document.head.querySelector<HTMLLinkElement>(
    'link[data-preload="skyline"]',
  );

  if (existing) {
    existing.href = href;
    return;
  }

  const preloadLink = document.createElement("link");
  preloadLink.rel = "preload";
  preloadLink.as = "image";
  preloadLink.href = href;
  preloadLink.dataset.preload = "skyline";
  document.head.appendChild(preloadLink);
};

preloadSkyline();

ReactDOM.createRoot(document.getElementById("root")!).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>
);
