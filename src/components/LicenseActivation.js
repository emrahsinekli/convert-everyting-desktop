import React, { useState } from 'react';
import licenseService from '../firebase/licenseService';
import logo from '../assets/logo.png';
import './LicenseActivation.css';

function LicenseActivation({ onActivated }) {
  const [licenseKey, setLicenseKey] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Format license key as user types (XXXX-XXXX-XXXX-XXXX)
  const formatLicenseKey = (value) => {
    // Remove all non-alphanumeric characters
    const cleaned = value.replace(/[^A-Za-z0-9]/g, '').toUpperCase();

    // Add dashes every 4 characters
    const parts = [];
    for (let i = 0; i < cleaned.length && i < 16; i += 4) {
      parts.push(cleaned.slice(i, i + 4));
    }

    return parts.join('-');
  };

  const handleInputChange = (e) => {
    const formatted = formatLicenseKey(e.target.value);
    setLicenseKey(formatted);
    setError('');
    setSuccess('');
  };

  const handleActivate = async () => {
    if (licenseKey.replace(/-/g, '').length !== 16) {
      setError('Please enter a valid license key (16 characters)');
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
          <p className="license-subtitle">License Activation</p>
        </div>

        <div className="license-content">
          <p className="license-info">
            Enter your license key to use the application.
          </p>

          <div className="license-input-group">
            <label htmlFor="licenseKey">License Key</label>
            <input
              id="licenseKey"
              type="text"
              value={licenseKey}
              onChange={handleInputChange}
              onKeyPress={handleKeyPress}
              placeholder="XXXX-XXXX-XXXX-XXXX"
              maxLength={19}
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
            disabled={isLoading || licenseKey.replace(/-/g, '').length !== 16}
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
