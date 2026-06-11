/**
 * Compatibility shim.
 *
 * The "Upgrade to Premium" concept has been replaced by the Pricing Waitlist
 * (paid plans are not live). This file only re-exports the new modal so older
 * imports keep working. New code should import PricingWaitlistModal directly.
 */
export { PricingWaitlistModal, PricingWaitlistModal as UpgradeModal } from './PricingWaitlistModal';
export { default } from './PricingWaitlistModal';
