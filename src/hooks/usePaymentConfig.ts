import { useEffect, useState } from 'react';
import { getPaymentConfig } from '@/services/payments';
import type { PaymentConfig } from '@/types/payments';

export function usePaymentConfig(active = true) {
  const [config, setConfig] = useState<PaymentConfig | null>(null);
  useEffect(() => {
    if (!active) return;
    let mounted = true;
    void getPaymentConfig().then((value) => { if (mounted) setConfig(value); });
    return () => { mounted = false; };
  }, [active]);
  return config;
}
