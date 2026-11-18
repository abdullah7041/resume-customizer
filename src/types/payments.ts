export interface PaymentConfig {
  enabled: boolean;
  priceSar: 29;
  credits: 100;
  environment: 'sandbox' | 'live';
}

export interface PaymentCheckout {
  paymentId: string;
  sessionId: string;
  environment: 'sandbox' | 'live';
}

export interface PaymentStatus {
  paymentId: string;
  orderId?: string | null;
  status: 'created' | 'pending' | 'succeeded' | 'failed' | 'cancelled' | 'refunded';
  environment: 'sandbox' | 'live';
  creditsGranted: boolean;
  refundedMinor: number;
}
