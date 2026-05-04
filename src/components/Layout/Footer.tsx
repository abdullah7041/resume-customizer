import { useTranslation } from "react-i18next";

export default function Footer() {
  const { t } = useTranslation();

  return (
    <footer className="relative border-t border-[color:var(--hairline-soft)] bg-[color:var(--surface)] py-8 text-center text-[color:var(--ink-muted)]">
      <div className="app-shell w-full space-y-4">
        <nav aria-label={t("footer.linksLabel", "Legal links")} className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-sm">
          <a
            href="/privacy"
            className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            {t("footer.links.privacy")}
          </a>
          <a
            href="mailto:privacy@resumeoptimizer.sa"
            className="font-medium text-emerald-700 transition-colors hover:text-emerald-600 dark:text-emerald-300 dark:hover:text-emerald-200"
          >
            {t("footer.links.contact")}
          </a>
        </nav>
        <p className="text-sm">
          © {new Date().getFullYear()} Watheq — by Abdullah bin Ahmed
        </p>
      </div>
    </footer>
  );
}




