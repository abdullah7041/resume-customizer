import { useTranslation } from 'react-i18next';
import { CreditPack } from '@/components/Credits/CreditPack';
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/shadcn/dialog';

interface UpgradeModalProps {
  isOpen: boolean;
  onClose: () => void;
  dismissKey: string;
}

export function UpgradeModal({ isOpen, onClose, dismissKey }: UpgradeModalProps) {
  const { t, i18n } = useTranslation();

  function dismiss() {
    if (dismissKey) localStorage.setItem(dismissKey, Date.now().toString());
    onClose();
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => { if (!open) dismiss(); }}>
      <DialogContent
        aria-describedby={undefined}
        dir={i18n.dir()}
        showCloseButton
        closeLabel={t('common.closeDialog', 'Close dialog')}
        className="max-h-[90vh] overflow-y-auto rounded-3xl border-line bg-surface text-ink"
      >
        <DialogTitle className="pe-8">{t('pricing.checkout.title', 'Buy credits')}</DialogTitle>
        <CreditPack />
      </DialogContent>
    </Dialog>
  );
}

export default UpgradeModal;
