import { PRIVACY_BANNER } from '../lib/constants';

export function PrivacyBanner() {
  return (
    <footer className="privacy" role="contentinfo">
      {PRIVACY_BANNER} All sample values are synthetic. Planted PII-shaped strings exist only to
      demonstrate client-side redaction.
    </footer>
  );
}
