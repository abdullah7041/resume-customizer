import { Linkedin } from "lucide-react";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();
  const [isWorkspaceFooter, setIsWorkspaceFooter] = useState(false);

  useEffect(() => {
    if (typeof document === "undefined") return;

    const updateFooterMode = () => {
      setIsWorkspaceFooter(Boolean(document.querySelector("[data-app-main]")));
    };

    updateFooterMode();
    const timeoutId = window.setTimeout(updateFooterMode, 0);
    const observer = new MutationObserver(updateFooterMode);
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      window.clearTimeout(timeoutId);
      observer.disconnect();
    };
  }, []);

  if (isWorkspaceFooter) {
    return (
      <footer className="relative border-t border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] py-3 text-xs text-[color:var(--ink-muted)] [backdrop-filter:blur(14px)] [-webkit-backdrop-filter:blur(14px)] dark:border-white/10 dark:bg-[#031713]/[0.80]">
        <div className="app-shell mx-auto flex w-full max-w-7xl flex-col items-center justify-between gap-2 px-5 sm:flex-row sm:px-8">
          <p className="text-center sm:text-start">
            © {new Date().getFullYear()} {t("common.appName")} ·{" "}
            <a
              href="https://www.linkedin.com/in/3binahmed/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
            >
              {t("footer.workspace.byLine", "Built by Abdullah Bin Ahmed")}
            </a>
            {" · "}{t("footer.workspace.version", "Version beta")}
            {" · "}{t("footer.workspace.feedback", "Feedback helps shape Watheq")}
          </p>
          <nav aria-label={t("footer.linksLabel", "Legal links")} className="flex flex-wrap items-center justify-center gap-4">
            <a href="/privacy" className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
              {t("footer.links.privacy")}
            </a>
            <a href="/terms" className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
              {t("footer.links.terms")}
            </a>
            <a href="/refund" className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
              {t("footer.links.refund")}
            </a>
            <a href="mailto:support@watheqai.app" className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200">
              {t("footer.links.contact")}
            </a>
          </nav>
        </div>
      </footer>
    );
  }

  return (
    <footer className="relative border-t border-[color:var(--glass-border)] bg-[color:var(--bg)] py-10 text-[color:var(--ink-muted)] dark:border-white/10 dark:bg-[#031713]/80">
      <div className="app-shell mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-8 rounded-2xl border border-[color:var(--glass-border)] bg-[color:var(--surface-glass)] p-5 shadow-sm [backdrop-filter:blur(14px)] [-webkit-backdrop-filter:blur(14px)] sm:grid-cols-2 sm:p-6 lg:grid-cols-3 dark:border-white/10 dark:bg-white/[0.03]">
          {/* Brand */}
          <div className="space-y-4">
            <div className="text-lg font-black text-[color:var(--ink)]">
              {t("common.appName")}
            </div>
            <p className="max-w-xs text-sm leading-6">
              {t("common.appTagline")}
            </p>
          </div>

          {/* Product links */}
          <div className="space-y-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--ink)]">
              {t("footer.columns.product", "Product")}
            </div>
            <nav aria-label={t("footer.productLinksLabel", "Product links")} className="flex flex-col gap-2 text-sm">
              <a
                href="/"
                className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                {t("landing.hero.cta", "Get Started")}
              </a>
              <a
                href="mailto:support@watheqai.app"
                className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                {t("footer.links.contact")}
              </a>
            </nav>
          </div>

          {/* Legal */}
          <div className="space-y-4">
            <div className="text-xs font-black uppercase tracking-[0.14em] text-[color:var(--ink)]">
              {t("footer.columns.legal", "Legal")}
            </div>
            <nav aria-label={t("footer.linksLabel", "Legal links")} className="flex flex-col gap-2 text-sm">
              <a
                href="/privacy"
                className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                {t("footer.links.privacy")}
              </a>
              <a
                href="/terms"
                className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                {t("footer.links.terms")}
              </a>
              <a
                href="/refund"
                className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
              >
                {t("footer.links.refund")}
              </a>
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-6 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--glass-border)] pt-6 sm:flex-row dark:border-white/10">
          <p className="text-sm">
            © {new Date().getFullYear()} {t("common.appName")} — {t("common.byAuthor")}
          </p>
          <a
            href="https://www.linkedin.com/in/3binahmed/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full border border-[color:var(--glass-border)] bg-[color:var(--surface-control)] text-slate-500 transition-colors hover:bg-emerald-500/10 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-[color:var(--focus-ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[color:var(--bg)] dark:border-white/10 dark:bg-white/10 dark:text-white/60 dark:hover:bg-emerald-300/20 dark:hover:text-emerald-300"
            aria-label={t("footer.social.linkedin", "LinkedIn")}
            title={t("footer.social.linkedin", "LinkedIn")}
          >
            <Linkedin className="h-4 w-4" />
          </a>
        </div>
      </div>
    </footer>
  );
}
