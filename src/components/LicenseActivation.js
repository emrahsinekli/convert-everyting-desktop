import React, { useState } from 'react';
import licenseService from '../services/licenseService';
import logo from '../assets/logo.png';
import './LicenseActivation.css';

// Polar hosted checkout link for the Pro (Lifetime) product.
const PURCHASE_URL = 'https://buy.polar.sh/polar_cl_UmwFpfGR5eiY8Hcra5pqnSsZKEYfqz2wiAPBf3t8wni';
const PRICE = '$29.99';

const FEATURES = [
  'All converters: image, video, audio, PDF, documents',
  'AI background removal & live image editor',
  'Speech-to-text transcription & text-to-speech',
  'Batch processing, watched folders & Finder actions',
  '100% offline & private — nothing leaves your Mac',
  'One-time payment · lifetime updates',
];

function LicenseActivation({ onActivated, trialExpired, onClose }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [showKey, setShowKey] = useState(false);

  const handleInputChange = (e) => {
    setLicenseKey(e.target.value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase());
    setError(''); setSuccess('');
  };
  const isKeyComplete = (key) => key.replace(/-/g, '').length >= 8;

  const handleActivate = async () => {
    if (!isKeyComplete(licenseKey)) { setError('Please enter a valid license key'); return; }
    setIsLoading(true); setError(''); setSuccess('');
    try {
      const result = await licenseService.activateLicense(licenseKey);
      if (result.success) {
        setSuccess(result.message || 'Activated! Welcome to Pro 🎉');
        setTimeout(() => onActivated && onActivated(result), 1200);
      } else {
        setError(result.error || 'Activation failed');
      }
    } catch (err) {
      setError('An error occurred: ' + err.message);
    } finally { setIsLoading(false); }
  };

  return (
    <div className="license-activation-overlay">
      <div className="paywall">
        {onClose && (
          <button className="paywall-close" onClick={onClose} title="Continue trial">×</button>
        )}

        <img src={logo} alt="" className="paywall-logo" />
        <h1 className="paywall-title">{trialExpired ? 'Your free trial has ended' : 'Unlock Convert Everything Pro'}</h1>
        <p className="paywall-sub">
          {trialExpired
            ? 'Upgrade to keep converting — one payment, yours forever.'
            : 'Everything unlocked. One payment, yours forever.'}
        </p>

        <ul className="paywall-features">
          {FEATURES.map((f) => <li key={f}><span className="pf-check">✓</span>{f}</li>)}
        </ul>

        <div className="paywall-price">
          <span className="pp-amount">{PRICE}</span>
          <span className="pp-meta">one-time · lifetime</span>
        </div>

        <button className="paywall-cta" onClick={() => licenseService.openExternal(PURCHASE_URL)}>
          Get Pro — {PRICE}
        </button>

        {!showKey ? (
          <button className="paywall-haskey" onClick={() => setShowKey(true)}>I already have a license key</button>
        ) : (
          <div className="paywall-key">
            <input
              type="text" value={licenseKey} onChange={handleInputChange}
              onKeyDown={(e) => e.key === 'Enter' && handleActivate()}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX" maxLength={64}
              disabled={isLoading} className={error ? 'error' : success ? 'success' : ''} autoFocus
            />
            <button className="paywall-activate" onClick={handleActivate} disabled={isLoading || !isKeyComplete(licenseKey)}>
              {isLoading ? 'Verifying…' : 'Activate'}
            </button>
          </div>
        )}

        {error && <div className="paywall-msg error">{error}</div>}
        {success && <div className="paywall-msg success">{success}</div>}

        <div className="paywall-footer">
          After purchase you'll receive a license key by email. Support: <a href="mailto:emrahsinekli@gmail.com">emrahsinekli@gmail.com</a>
        </div>
      </div>
    </div>
  );
}

export default LicenseActivation;
