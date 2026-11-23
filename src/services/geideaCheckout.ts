type WalletCallback = (result: unknown) => void;
type ExpressCheckoutConstructor = new () => {
  create(config: { sessionId: string; onSuccess: WalletCallback; onError: WalletCallback; onCancel: WalletCallback }):
    Promise<{ mount(selector: string): void }>;
};

type HostedCheckoutConstructor = new (success: WalletCallback, error: WalletCallback, cancel: WalletCallback) => {
  startPayment(sessionId: string, options: null, containerId: string): void;
};
type CheckoutWindow = Window & { GeideaCheckout?: HostedCheckoutConstructor; GeideaExpressCheckout?: ExpressCheckoutConstructor };

let sdkRequest: Promise<void> | undefined;

function loadSdk() {
  sdkRequest ??= new Promise<void>((resolve, reject) => {
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
      if (!(window as CheckoutWindow).GeideaCheckout && !(window as CheckoutWindow).GeideaExpressCheckout) return fail();
      window.clearTimeout(timeout);
      resolve();
    };
    document.head.append(script);
  }).catch((error: unknown) => {
    sdkRequest = undefined;
    throw error;
  });
  return sdkRequest;
}

export async function loadHostedCheckout() {
  await loadSdk();
  const Checkout = (window as CheckoutWindow).GeideaCheckout;
  if (!Checkout) throw new Error('Hosted checkout unavailable');
  return Checkout;
}

export async function loadExpressCheckout() {
  await loadSdk();
  const Checkout = (window as CheckoutWindow).GeideaExpressCheckout;
  if (!Checkout) throw new Error('Express checkout unavailable');
  return Checkout;
}
