import { Linkedin } from "lucide-react";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="relative border-t border-[color:var(--hairline-soft)] bg-[color:var(--surface)] py-12 text-[color:var(--ink-muted)]">
      <div className="app-shell mx-auto w-full max-w-7xl px-5 sm:px-8">
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
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
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-12 flex flex-col items-center justify-between gap-4 border-t border-[color:var(--hairline-soft)] pt-8 sm:flex-row">
          <p className="text-sm">
            © {new Date().getFullYear()} {t("common.appName")} — {t("common.byAuthor")}
          </p>
          <a
            href="https://www.linkedin.com/in/3binahmed/"
            target="_blank"
            rel="noopener noreferrer"
            className="flex h-9 w-9 items-center justify-center rounded-full bg-slate-100 text-slate-500 transition-colors hover:bg-emerald-100 hover:text-emerald-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2 dark:bg-white/10 dark:text-white/60 dark:hover:bg-emerald-300/20 dark:hover:text-emerald-300"
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
