// License Service - Firebase Firestore based license validation
// Single-use license system: One license = One user
import { db } from './config';
import {
  doc,
  getDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';

class LicenseService {
  constructor() {
    this.licensesCollection = 'licenses';
  }

  // Generate a unique machine ID
  async getMachineId() {
    if (window.electronAPI && window.electronAPI.getMachineId) {
      return await window.electronAPI.getMachineId();
    }

    // Fallback: Generate a pseudo-unique ID from browser fingerprint
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    ctx.textBaseline = 'top';
    ctx.font = '14px Arial';
    ctx.fillText('machine-id', 2, 2);
    const canvasHash = canvas.toDataURL().slice(-50);

    const userAgent = navigator.userAgent;
    const language = navigator.language;
    const platform = navigator.platform;
    const screenRes = `${window.screen.width}x${window.screen.height}`;

    const fingerprint = `${canvasHash}-${userAgent}-${language}-${platform}-${screenRes}`;

    // Simple hash function
    let hash = 0;
    for (let i = 0; i < fingerprint.length; i++) {
      const char = fingerprint.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }

    return Math.abs(hash).toString(16).toUpperCase().padStart(16, '0').slice(0, 16);
  }

  // Collect system information
  async getSystemInfo() {
    // Get detailed info from Electron API if available
    if (window.electronAPI && window.electronAPI.getSystemInfo) {
      return await window.electronAPI.getSystemInfo();
    }

    // Fallback: Browser information
    const platform = navigator.platform;
    let os = 'Unknown';

    if (platform.includes('Win')) os = 'Windows';
    else if (platform.includes('Mac')) os = 'macOS';
    else if (platform.includes('Linux')) os = 'Linux';

    return {
      platform: os,
      osVersion: navigator.userAgent,
      arch: navigator.platform,
      hostname: 'Browser',
      username: 'N/A',
      screenResolution: `${window.screen.width}x${window.screen.height}`,
      language: navigator.language
    };
  }

  // Activate license on this machine
  async activateLicense(licenseKey) {
    try {
      const licenseKeyUpper = licenseKey.toUpperCase();
      const licenseRef = doc(db, this.licensesCollection, licenseKeyUpper);
      const licenseDoc = await getDoc(licenseRef);

      // Check if license exists
      if (!licenseDoc.exists()) {
        return {
          success: false,
          error: 'Invalid license key'
        };
      }

      const licenseData = licenseDoc.data();
      const currentMachineId = await this.getMachineId();

      // Check if license has been used before
      if (licenseData.isUsed === true) {
        // Check if same machine
        if (licenseData.usedBy === currentMachineId) {
          // Same machine, already active
          this.saveLocalLicense(licenseKeyUpper);
          return {
            success: true,
            message: 'This device is already activated!'
          };
        } else {
          // Someone else used it
          return {
            success: false,
            error: 'This license has already been used!'
          };
        }
      }

      // Get system information
      const systemInfo = await this.getSystemInfo();

      // License not used, activate now (with system info)
      await updateDoc(licenseRef, {
        isUsed: true,
        usedBy: currentMachineId,
        usedAt: serverTimestamp(),
        // System information
        deviceInfo: {
          platform: systemInfo.platform,
          osVersion: systemInfo.osVersion,
          arch: systemInfo.arch,
          hostname: systemInfo.hostname,
          username: systemInfo.username,
          screenResolution: systemInfo.screenResolution,
          language: systemInfo.language
        }
      });

      // Save locally
      this.saveLocalLicense(licenseKeyUpper);

      return {
        success: true,
        message: 'License activated successfully!'
      };

    } catch (error) {
      console.error('License activation error:', error);
      return {
        success: false,
        error: 'License activation error: ' + error.message
      };
    }
  }

  // Save license to local storage
  saveLocalLicense(licenseKey) {
    const licenseData = {
      key: licenseKey,
      activatedAt: new Date().toISOString()
    };
    localStorage.setItem('convertEverything_license', JSON.stringify(licenseData));
  }

  // Load license from local storage
  loadLocalLicense() {
    try {
      const stored = localStorage.getItem('convertEverything_license');
      if (stored) {
        return JSON.parse(stored);
      }
    } catch (e) {
      console.error('Error loading local license:', e);
    }
    return null;
  }

  // Check if user has valid license (checks local first, then online)
  async checkLicense() {
    // First check local storage
    const localLicense = this.loadLocalLicense();

    if (!localLicense) {
      return { valid: false, error: 'License not found' };
    }

    // Online verification (every 7 days)
    const lastCheck = localStorage.getItem('convertEverything_lastCheck');
    const now = Date.now();
    const sevenDaysMs = 7 * 24 * 60 * 60 * 1000;

    if (!lastCheck || (now - parseInt(lastCheck)) > sevenDaysMs) {
      try {
        // Online check
        const licenseRef = doc(db, this.licensesCollection, localLicense.key);
        const licenseDoc = await getDoc(licenseRef);

        if (!licenseDoc.exists()) {
          localStorage.removeItem('convertEverything_license');
          return { valid: false, error: 'License not found' };
        }

        const licenseData = licenseDoc.data();
        const currentMachineId = await this.getMachineId();

        // Is this for this machine?
        if (licenseData.usedBy !== currentMachineId) {
          localStorage.removeItem('convertEverything_license');
          return { valid: false, error: 'License belongs to another device' };
        }

        localStorage.setItem('convertEverything_lastCheck', now.toString());
      } catch (error) {
        // If offline, accept local license
        console.log('Offline mode, using local license');
      }
    }

    return {
      valid: true,
      key: this.maskKey(localLicense.key),
      activatedAt: localLicense.activatedAt
    };
  }

  // Remove local license (deactivate)
  deactivateLicense() {
    localStorage.removeItem('convertEverything_license');
    localStorage.removeItem('convertEverything_lastCheck');
    return true;
  }

  // Mask license key for display
  maskKey(key) {
    if (!key || key.length < 8) return '****';
    return key.slice(0, 4) + '-****-****-' + key.slice(-4);
  }
}

export default new LicenseService();
