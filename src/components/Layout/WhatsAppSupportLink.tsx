import { useTranslation } from "react-i18next";

export default function WhatsAppSupportLink({ className }: { className?: string }) {
  const { t } = useTranslation();

  return (
    <a href="https://wa.me/966505793091" target="_blank" rel="noopener noreferrer" className={className}>
      {t("footer.links.whatsappSupport", "Technical support on WhatsApp")}
    </a>
  );
}
