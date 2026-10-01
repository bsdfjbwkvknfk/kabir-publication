/**
 * Kabir Publication - Authentication & Access Gate Module
 * Protects website access with Admin credentials:
 * Username: admin
 * Password: admin@123
 */

(function(window) {
  'use strict';

  const AUTH_STORAGE_KEY = 'kp_auth_logged_in';
  const AUTH_USER_KEY = 'kp_auth_user';
  const AUTH_TIME_KEY = 'kp_auth_time';

  // System Admin Credentials
  const ADMIN_USERNAME = 'admin';
  const ADMIN_PASSWORD = 'admin@123';

  function isAuthenticated() {
    try {
      const sessionAuth = sessionStorage.getItem(AUTH_STORAGE_KEY) === 'true';
      const localAuth = localStorage.getItem(AUTH_STORAGE_KEY) === 'true';
      return sessionAuth || localAuth;
    } catch (e) {
      return false;
    }
  }

  function getLoggedInUser() {
    try {
      return sessionStorage.getItem(AUTH_USER_KEY) || localStorage.getItem(AUTH_USER_KEY) || 'admin';
    } catch (e) {
      return 'admin';
    }
  }

  function validateCredentials(username, password) {
    if (!username || !password) return false;
    const cleanUser = username.trim().toLowerCase();
    const cleanPass = password; // exact match
    return cleanUser === ADMIN_USERNAME && cleanPass === ADMIN_PASSWORD;
  }

  function login(username, password, remember = true) {
    if (!validateCredentials(username, password)) {
      return { 
        success: false, 
        message: 'Invalid username or password! Please check credentials.' 
      };
    }

    try {
      // Always store in session
      sessionStorage.setItem(AUTH_STORAGE_KEY, 'true');
      sessionStorage.setItem(AUTH_USER_KEY, 'admin');
      sessionStorage.setItem(AUTH_TIME_KEY, Date.now().toString());

      if (remember) {
        localStorage.setItem(AUTH_STORAGE_KEY, 'true');
        localStorage.setItem(AUTH_USER_KEY, 'admin');
        localStorage.setItem(AUTH_TIME_KEY, Date.now().toString());
      } else {
        localStorage.removeItem(AUTH_STORAGE_KEY);
        localStorage.removeItem(AUTH_USER_KEY);
        localStorage.removeItem(AUTH_TIME_KEY);
      }
    } catch (err) {
      console.warn('Storage warning:', err);
    }

    return { success: true, user: 'admin' };
  }

  function logout(confirmFirst = false) {
    if (confirmFirst && !confirm('Are you sure you want to log out of Kabir Publication?')) {
      return;
    }

    try {
      sessionStorage.removeItem(AUTH_STORAGE_KEY);
      sessionStorage.removeItem(AUTH_USER_KEY);
      sessionStorage.removeItem(AUTH_TIME_KEY);
      localStorage.removeItem(AUTH_STORAGE_KEY);
      localStorage.removeItem(AUTH_USER_KEY);
      localStorage.removeItem(AUTH_TIME_KEY);
    } catch (e) {}

    // Update DOM classes
    document.documentElement.classList.remove('user-is-authenticated');

    const loginGate = document.getElementById('login-gate');
    const appWrapper = document.getElementById('app-wrapper');
    const passInput = document.getElementById('login-password');
    const userInput = document.getElementById('login-username');
    const errorAlert = document.getElementById('login-error-alert');
    const successAlert = document.getElementById('login-success-alert');

    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';
    if (passInput) passInput.value = '';

    if (appWrapper) appWrapper.style.display = 'none';
    if (loginGate) {
      loginGate.style.display = 'flex';
      loginGate.style.opacity = '1';
    }

    if (userInput) {
      userInput.focus();
      userInput.select();
    }

    if (window.showToast) {
      window.showToast('You have been logged out successfully.', 'info');
    }
  }

  function handleLoginSubmit() {
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');
    const rememberInput = document.getElementById('login-remember-me');
    const errorAlert = document.getElementById('login-error-alert');
    const errorMsg = document.getElementById('login-error-msg');
    const successAlert = document.getElementById('login-success-alert');
    const submitBtn = document.getElementById('btn-login-submit');
    const loginCard = document.querySelector('.login-card');

    if (!userInput || !passInput) return;

    const username = userInput.value;
    const password = passInput.value;
    const remember = rememberInput ? rememberInput.checked : true;

    // Reset alert visibility
    if (errorAlert) errorAlert.style.display = 'none';
    if (successAlert) successAlert.style.display = 'none';

    // Verify
    const result = login(username, password, remember);

    if (!result.success) {
      if (errorAlert) {
        if (errorMsg) {
          errorMsg.innerHTML = '<strong>Galat Credentials!</strong> Username ya Password galat hai. Kripya dobara check karein.';
        }
        errorAlert.style.display = 'flex';
      }

      // Add shake animation
      if (loginCard) {
        loginCard.classList.remove('shake-animation');
        void loginCard.offsetWidth; // trigger reflow
        loginCard.classList.add('shake-animation');
      }

      passInput.focus();
      passInput.select();
      return;
    }

    // Success flow
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.innerHTML = '<span class="login-spinner"></span> Authenticating...';
    }

    if (successAlert) {
      successAlert.style.display = 'flex';
    }

    setTimeout(async () => {
      // Synchronize latest authoritative database data before entering application
      if (window.KPStorage) {
        try {
          if (window.KPStorage.syncSettingsFromServer) await window.KPStorage.syncSettingsFromServer();
          if (window.KPStorage.syncOrdersFromServer) await window.KPStorage.syncOrdersFromServer();
        } catch (e) {
          console.warn('Post-login database sync:', e);
        }
      }

      // Mark as authenticated in DOM
      document.documentElement.classList.add('user-is-authenticated');

      const loginGate = document.getElementById('login-gate');
      const appWrapper = document.getElementById('app-wrapper');

      if (loginGate) {
        loginGate.style.opacity = '0';
        setTimeout(() => {
          loginGate.style.display = 'none';
        }, 350);
      }

      if (appWrapper) {
        appWrapper.style.display = 'flex';
      }

      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.innerHTML = '<span class="btn-text">Log In to System</span> <span class="btn-icon">➔</span>';
      }

      // Initialize or refresh views with latest database content
      if (window.KPApp && window.KPApp.refreshCurrentView) {
        window.KPApp.refreshCurrentView();
      }

      if (window.showToast) {
        const count = window.KPStorage ? window.KPStorage.getOrders().length : 0;
        window.showToast(`Login Successful! Database connected (${count} orders loaded).`, 'success', 3500);
      }
    }, 400);
  }

  function togglePasswordVisibility() {
    const passInput = document.getElementById('login-password');
    const toggleBtn = document.getElementById('btn-toggle-pwd');
    if (!passInput) return;

    if (passInput.type === 'password') {
      passInput.type = 'text';
      if (toggleBtn) toggleBtn.textContent = '🙈';
    } else {
      passInput.type = 'password';
      if (toggleBtn) toggleBtn.textContent = '👁️';
    }
    passInput.focus();
  }

  function fillCredentials() {
    const userInput = document.getElementById('login-username');
    const passInput = document.getElementById('login-password');
    if (userInput) userInput.value = ADMIN_USERNAME;
    if (passInput) passInput.value = ADMIN_PASSWORD;
    if (window.showToast) {
      window.showToast('Admin credentials filled automatically.', 'info', 1800);
    }
    if (passInput) passInput.focus();
  }

  function init() {
    const isAuthed = isAuthenticated();
    const loginGate = document.getElementById('login-gate');
    const appWrapper = document.getElementById('app-wrapper');
    const userInput = document.getElementById('login-username');

    if (isAuthed) {
      document.documentElement.classList.add('user-is-authenticated');
      if (loginGate) loginGate.style.display = 'none';
      if (appWrapper) appWrapper.style.display = 'flex';
    } else {
      document.documentElement.classList.remove('user-is-authenticated');
      if (loginGate) {
        loginGate.style.display = 'flex';
        loginGate.style.opacity = '1';
      }
      if (appWrapper) appWrapper.style.display = 'none';
      if (userInput) {
        setTimeout(() => userInput.focus(), 150);
      }
    }
  }

  // Export module
  window.KPAuth = {
    isAuthenticated,
    getLoggedInUser,
    validateCredentials,
    login,
    logout,
    handleLoginSubmit,
    togglePasswordVisibility,
    fillCredentials,
    init
  };

  // Run on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})(window);
