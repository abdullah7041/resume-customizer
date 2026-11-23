type WalletCallback = (result: unknown) => void;
type ExpressCheckoutConstructor = new () => {
  create(config: { sessionId: string; onSuccess: WalletCallback; onError: WalletCallback; onCancel: WalletCallback }):
    Promise<{ mount(selector: string): void }>;
};

let sdkRequest: Promise<ExpressCheckoutConstructor> | undefined;

export function loadExpressCheckout(): Promise<ExpressCheckoutConstructor> {
  sdkRequest ??= new Promise<ExpressCheckoutConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    script.src = 'https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js';
    script.async = false;
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      reject(new Error('Geidea Checkout did not load'));
    };
    const timeout = window.setTimeout(fail, 12000);
    script.onerror = fail;
    script.onload = () => {
      const checkout = (window as Window & { GeideaExpressCheckout?: ExpressCheckoutConstructor }).GeideaExpressCheckout;
      if (typeof checkout !== 'function') return fail();
      window.clearTimeout(timeout);
      resolve(checkout);
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkRequest = undefined;
    throw error;
  });
  return sdkRequest;
}
