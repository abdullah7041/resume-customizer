import type { Handler } from '@netlify/functions';

// The checkout window observes this same-origin return and then asks Geidea to pay.
export const handler: Handler = async () => ({
  statusCode: 200,
  headers: { 'Content-Type': 'text/plain; charset=utf-8', 'Cache-Control': 'no-store', 'Referrer-Policy': 'no-referrer' },
  body: 'عُد إلى صفحة واثق لإكمال الدفع. Return to Watheq to finish your payment.',
});
