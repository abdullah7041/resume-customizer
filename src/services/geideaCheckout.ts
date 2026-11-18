type CheckoutCallback = (response: unknown) => void;

interface GeideaCheckout {
  startPayment(sessionId: string, options: null, containerId: string): void;
}

type GeideaCheckoutConstructor = new (
  onSuccess: CheckoutCallback,
  onError: CheckoutCallback,
  onCancel: CheckoutCallback,
) => GeideaCheckout;

const sdkUrl = 'https://www.ksamerchant.geidea.net/hpp/geideaCheckout.min.js';
let loadingSdk: Promise<GeideaCheckoutConstructor> | undefined;

export function loadGeideaCheckout(): Promise<GeideaCheckoutConstructor> {
  const checkoutWindow = window as Window & { GeideaCheckout?: GeideaCheckoutConstructor };
  if (typeof checkoutWindow.GeideaCheckout === 'function') return Promise.resolve(checkoutWindow.GeideaCheckout);

  loadingSdk ??= new Promise<GeideaCheckoutConstructor>((resolve, reject) => {
    const script = document.createElement('script');
    const fail = () => {
      window.clearTimeout(timeout);
      script.remove();
      loadingSdk = undefined;
      reject(new Error('Unable to load the GEIDEA checkout form'));
    };
    const timeout = window.setTimeout(fail, 12000);
    script.src = sdkUrl;
    script.onerror = fail;
    script.onload = () => {
      if (typeof checkoutWindow.GeideaCheckout !== 'function') {
        fail();
        return;
      }
      window.clearTimeout(timeout);
      resolve(checkoutWindow.GeideaCheckout);
    };
    document.head.appendChild(script);
  });

  return loadingSdk;
}
