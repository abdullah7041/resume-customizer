type CheckoutCallback = (result: unknown) => void;
type CheckoutConstructor = new (success: CheckoutCallback, error: CheckoutCallback, cancel: CheckoutCallback) => {
  startPayment(sessionId: string, options: null, containerId: string): void;
};

let sdkRequest: Promise<CheckoutConstructor> | undefined;

export function loadGeideaCheckout(): Promise<CheckoutConstructor> {
  sdkRequest ??= new Promise<CheckoutConstructor>((resolve, reject) => {
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
      const checkout = (window as Window & { GeideaCheckout?: CheckoutConstructor }).GeideaCheckout;
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
