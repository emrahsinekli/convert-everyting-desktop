import React, { useState } from 'react';
import licenseService from '../services/licenseService';
import logo from '../assets/logo.png';
import './LicenseActivation.css';

// TODO: Set this to your real Polar product/checkout link before release.
// Example: https://polar.sh/emrahsinekli/products/<PRODUCT_ID> or a checkout URL.
const PURCHASE_URL = 'https://polar.sh/emrahsinekli';

function LicenseActivation({ onActivated, trialExpired }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Normalize the key as the user types: uppercase, keep alphanumerics + dashes
  const formatLicenseKey = (value) => {
    return value.replace(/[^A-Za-z0-9-]/g, '').toUpperCase();
  };

  const handleInputChange = (e) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    setError('');
    setSuccess('');
  };

  const isKeyComplete = (key) => key.replace(/-/g, '').length >= 8;

  const handleActivate = async () => {
    if (!isKeyComplete(licenseKey)) {
      setError('Please enter a valid license key');
      return;
    }

    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const result = await licenseService.activateLicense(licenseKey);

      if (result.success) {
        setSuccess(result.message);
        setTimeout(() => {
          onActivated && onActivated(result);
        }, 1500);
      } else {
        setError(result.error || 'Activation failed');
      }
    } catch (err) {
      setError('An error occurred: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleActivate();
    }
  };

  return (
    <div className="license-activation-overlay">
      <div className="license-activation-modal">
        <div className="license-header">
          <div className="license-logo">
            <img src={logo} alt="Convert Everything" className="license-logo-image" />
          </div>
          <h1>Convert Everything</h1>
          <p className="license-subtitle">
            {trialExpired ? 'Deneme süreniz doldu' : 'Pro Lisans'}
          </p>
        </div>

        <div className="license-content">
          {trialExpired && (
            <p className="license-info">
              3 günlük ücretsiz deneme süreniz sona erdi. Tüm özellikleri kullanmaya
              devam etmek için Pro'ya geçin veya lisans anahtarınızı girin.
            </p>
          )}

          <button
            className="activate-btn"
            style={{ marginBottom: 18, background: 'linear-gradient(90deg,#f6ad55,#ed8936)' }}
            onClick={() => licenseService.openExternal(PURCHASE_URL)}
          >
            ⭐ Pro Satın Al
          </button>

          <p className="license-info" style={{ fontSize: 13, opacity: 0.8 }}>
            Lisans anahtarınız varsa aşağıya girin:
          </p>

          <div className="license-input-group">
            <label htmlFor="licenseKey">License Key</label>
            <input
              id="licenseKey"
              type="text"
              value={licenseKey}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="XXXXXXXX-XXXX-XXXX-XXXX-XXXXXXXXXXXX"
              maxLength={64}
              disabled={isLoading}
              className={error ? 'error' : success ? 'success' : ''}
              autoFocus
            />
          </div>

          {error && (
            <div className="license-message error">
              <span className="message-icon">!</span>
              {error}
            </div>
          )}

          {success && (
            <div className="license-message success">
              <span className="message-icon">OK</span>
              {success}
            </div>
          )}

          <button
            className="activate-btn"
            onClick={handleActivate}
            disabled={isLoading || !isKeyComplete(licenseKey)}
          >
            {isLoading ? (
              <>
                <span className="spinner"></span>
                Verifying...
              </>
            ) : (
              'Activate License'
            )}
          </button>
        </div>

        <div className="license-footer">
          <p>For license and support:</p>
          <a href="mailto:emrahsinekli@gmail.com">
            emrahsinekli@gmail.com
          </a>
        </div>
      </div>
    </div>
  );
}

export default LicenseActivation;
