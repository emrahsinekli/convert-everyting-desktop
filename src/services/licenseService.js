// License Service - delegates all license operations to the Electron main
// process, which talks to Polar's License Keys API. The renderer never holds
// any Polar credentials.

class LicenseService {
  // Activate license via Electron IPC (Polar activate on the main process)
  async activateLicense(licenseKey) {
    if (window.electronAPI && window.electronAPI.activateLicense) {
      const result = await window.electronAPI.activateLicense(licenseKey);
      if (result.valid) {
        this.saveLocalFlag(licenseKey);
      }
      return {
        success: result.valid,
        message: result.message,
        error: result.error
      };
    }
    return { success: false, error: 'Activation requires the desktop app' };
  }

  // Get free-trial status from the Electron main process
  async getTrialStatus() {
    if (window.electronAPI && window.electronAPI.getTrialStatus) {
      return await window.electronAPI.getTrialStatus();
    }
    // Fallback (browser/dev without Electron): treat as active trial
    return { expired: false, daysLeft: 3, totalDays: 3 };
  }

  // Open an external URL (e.g. Polar checkout) via the main process
  openExternal(url) {
    if (window.electronAPI && window.electronAPI.openExternal) {
      window.electronAPI.openExternal(url);
    } else {
      window.open(url, '_blank');
    }
  }

  // Check license via Electron IPC
  async checkLicense() {
    if (window.electronAPI && window.electronAPI.checkLicense) {
      const result = await window.electronAPI.checkLicense();
      return {
        valid: result.valid,
        key: result.key ? this.maskKey(result.key) : null,
        activatedAt: result.activatedAt
      };
    }
    return { valid: false, error: 'License check requires the desktop app' };
  }

  // Save a local flag (for quick UI check)
  saveLocalFlag(licenseKey) {
    const licenseData = {
      key: licenseKey,
      activatedAt: new Date().toISOString()
    };
    localStorage.setItem('convertEverything_license', JSON.stringify(licenseData));
  }

  // Deactivate
  deactivateLicense() {
    localStorage.removeItem('convertEverything_license');
    localStorage.removeItem('convertEverything_lastCheck');
    if (window.electronAPI && window.electronAPI.removeLicense) {
      window.electronAPI.removeLicense();
    }
    return true;
  }

  // Mask license key for display
  maskKey(key) {
    if (!key || key.length < 8) return '****';
    const parts = key.split('-');
    if (parts.length >= 4) {
      return `${parts[0]}-****-****-${parts[parts.length - 1]}`;
    }
    return key.slice(0, 4) + '-****-****-' + key.slice(-4);
  }
}

export default new LicenseService();
