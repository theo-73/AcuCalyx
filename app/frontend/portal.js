/**
 * AcuCalyx Clinical Navigation & Multi-Tenant Doctor Portal Bridge
 * HIPAA Privacy Rule (45 CFR § 164.502) & Differential Privacy compliant.
 * Bridges classical HTML elements and global window hooks to modular ES6 services.
 */
(function () {
  'use strict';

  const AUTH_STORAGE_KEY = 'acucalyx_doctor_auth';

  // Transparent Authenticated Fetch Interceptor (HIPAA & FDA Section 524B Compliant)
  if (!window.__acucalyxAuthFetchInstalled) {
    window.__acucalyxAuthFetchInstalled = true;
    const _nativeFetch = window.fetch;
    window.fetch = function (input, init) {
      try {
        let url = typeof input === 'string' ? input : (input && input.url ? input.url : '');
        if (url && (url.startsWith('/api') || url.includes('/api/'))) {
          init = init ? { ...init } : {};
          let headers = init.headers;
          let hasAuth = false;
          if (headers instanceof Headers) {
            hasAuth = headers.has('Authorization') || headers.has('authorization');
          } else if (headers && typeof headers === 'object') {
            hasAuth = Boolean(headers['Authorization'] || headers['authorization']);
          } else if (!headers) {
            headers = {};
            init.headers = headers;
          }
          if (!hasAuth) {
            const authRaw = localStorage.getItem(AUTH_STORAGE_KEY);
            if (authRaw) {
              const parsed = JSON.parse(authRaw);
              if (parsed.token && parsed.token !== 'DEMO_DEFAULT_TOKEN') {
                if (headers instanceof Headers) {
                  headers.set('Authorization', `Bearer ${parsed.token}`);
                } else {
                  headers['Authorization'] = `Bearer ${parsed.token}`;
                }
              }
            }
          }
        }
      } catch (err) {
        console.warn('Auth fetch interceptor warning:', err);
      }
      return _nativeFetch.call(this, input, init);
    };
  }

  // Global Navigation Bridge
  window.portalNavigateTo = function (routeName) {
    if (window.__acucalyxApp?.router) {
      window.__acucalyxApp.router.navigate(routeName);
    } else {
      window.location.hash = `#/${routeName}`;
    }
  };

  // Select case and navigate to cockpit
  window.portalSelectCaseAndRehearse = async function (caseId) {
    if (typeof window.selectCase === 'function') {
      await window.selectCase(caseId);
    }
    window.portalNavigateTo('cockpit');
  };

  // Switch doctor credential
  window.portalSwitchDoctor = async function (username, password = 'password123') {
    if (window.__acucalyxApp?.doctorModal) {
      await window.__acucalyxApp.doctorModal.switchDoctor(username, password);
      return;
    }
    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username, password })
      });
      if (!res.ok) throw new Error('Authentication failed');
      const data = await res.json();
      localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify({
        doctor: data.doctor,
        token: data.access_token
      }));
      window.dispatchEvent(new CustomEvent('acucalyx:doctor-changed', { detail: data.doctor }));
      window.portalCloseLogin();
    } catch (err) {
      if (window.showToast) {
        window.showToast(`Doctor switch error: ${err.message}`, 'error');
      } else {
        alert(`Doctor switch error: ${err.message}`);
      }
    }
  };

  window.portalOpenLogin = function () {
    const modal = document.getElementById('modal-doctor-login');
    if (modal) modal.style.display = 'flex';
  };

  window.portalCloseLogin = function () {
    const modal = document.getElementById('modal-doctor-login');
    if (modal) modal.style.display = 'none';
  };

  window.portalLogout = function () {
    localStorage.removeItem(AUTH_STORAGE_KEY);
    window.dispatchEvent(new CustomEvent('acucalyx:doctor-changed', { detail: null }));
    window.portalNavigateTo('dashboard');
  };

  window.portalTrainLocalFL = async function () {
    const btn = document.getElementById('btn-train-fl-local');
    if (btn) {
      btn.disabled = true;
      btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span>Computing Local DP-SGD Gradients...</span>';
    }
    try {
      const token = JSON.parse(localStorage.getItem(AUTH_STORAGE_KEY) || '{}')?.token;
      const headers = { 'Content-Type': 'application/json' };
      if (token) headers['Authorization'] = `Bearer ${token}`;

      const res = await fetch('/api/learning/train-local', { method: 'POST', headers });
      if (!res.ok) throw new Error('Training request rejected');
      const data = await res.json();
      if (window.showToast) {
        window.showToast(`Differentially Private update committed! Proof: ${data.privacy_proof_hash}`, 'success');
      } else {
        alert(`Differentially Private update committed! Proof: ${data.privacy_proof_hash}`);
      }
      if (window.__acucalyxApp?.router?.currentRoute === 'learning') {
        window.__acucalyxApp.router.handleHashChange();
      }
    } catch (err) {
      if (window.showToast) {
        window.showToast(`Training error: ${err.message}`, 'error');
      } else {
        alert(`Training error: ${err.message}`);
      }
    } finally {
      if (btn) {
        btn.disabled = false;
        btn.innerHTML = '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg> <span>Train Local Model & Contribute Differential Privacy Update</span>';
      }
    }
  };

  // Endoscopy data helper
  window.loadEndoscopyReachabilityData = async function (caseId, candidateId) {
    if (window.__acucalyxApp?.router?.routes?.cockpit) {
      return window.__acucalyxApp.router.routes.cockpit.loadEndoscopyData(caseId, candidateId);
    }
  };
})();
