/*
Pentru cei care citesc codul acesta in viitor, main e un soi de throw-whatever-you-dont-have-a-better-place-for-it.
O melodie caracteristica pentru acest este Lou Bega - Mambo No. 5 (A Little Bit Of...)

aprecieri doamnei stan pentru suportul acordat
*/

import { ModalEngine } from '/app/Scripts/modal/modalMain.js';
import { ModalHelpers } from "./modal/modalHelpers.js";

// ----------------------------------
// Preferences Management
// ----------------------------------

const PreferencesManager = {
    storageKey: 'profilePreferences',
    defaults: {
        hueRotation: 0,
        fontSize: 'font-size-medium',
        lightMode: false,
        highContrast: false,
        colorblind: false
    },

    get() {
        try {
            const stored = localStorage.getItem(this.storageKey);
            return stored ? JSON.parse(stored) : { ...this.defaults };
        } catch (error) {
            console.error('Error reading preferences:', error);
            return { ...this.defaults };
        }
    },

    set(preferences) {
        try {
            const current = this.get();
            const updated = { ...current, ...preferences };
            localStorage.setItem(this.storageKey, JSON.stringify(updated));
        } catch (error) {
            console.error('Error saving preferences:', error);
        }
    },

    getProperty(property) {
        return this.get()[property] ?? this.defaults[property];
    },

    setProperty(property, value) {
        const current = this.get();
        current[property] = value;
        this.set(current);
    }
};

// Shared across module scripts (e.g. settings.js)
window.PreferencesManager = PreferencesManager;

// ----------------------------------
// Visual Settings & Theme Management
// ----------------------------------

const ThemeManager = {
    toggleHighContrast: () => {
        document.body.classList.toggle('high-contrast');
        document.body.classList.remove('colorblind');
        document.body.classList.remove('light-mode');
        PreferencesManager.setProperty('highContrast', document.body.classList.contains('high-contrast'));
        PreferencesManager.setProperty('colorblind', false);
        PreferencesManager.setProperty('lightMode', false);
    },

    toggleColorblind: () => {
        document.body.classList.toggle('colorblind');
        document.body.classList.remove('high-contrast');
        document.body.classList.remove('light-mode');
        PreferencesManager.setProperty('colorblind', document.body.classList.contains('colorblind'));
        PreferencesManager.setProperty('highContrast', false);
        PreferencesManager.setProperty('lightMode', false);
    },

    toggleLightMode: () => {
        document.body.classList.toggle('light-mode');
        document.body.classList.remove('high-contrast');
        document.body.classList.remove('colorblind');
        PreferencesManager.setProperty('lightMode', document.body.classList.contains('light-mode'));
        PreferencesManager.setProperty('highContrast', false);
        PreferencesManager.setProperty('colorblind', false);
    },

    applyStoredSettings: () => {
        const prefersHighContrast = window.matchMedia('(prefers-contrast: more)').matches || window.matchMedia('(forced-colors: active)').matches;
        const hasStoredHighContrast = PreferencesManager.getProperty('highContrast');
        const hasStoredColorblind = PreferencesManager.getProperty('colorblind');
        const hasStoredLightMode = PreferencesManager.getProperty('lightMode');

        // Prevent conflicting theme classes and keep one active mode at a time.
        document.body.classList.remove('high-contrast', 'colorblind', 'light-mode');

        // High Contrast
        if (hasStoredHighContrast || prefersHighContrast) {
            document.body.classList.add('high-contrast');
        } else if (hasStoredColorblind) {
            // Colorblind
            document.body.classList.add('colorblind');
        } else if (hasStoredLightMode) {
            // Light mode
            document.body.classList.add('light-mode');
        }

        // Hue Rotation
        const hueRotation = PreferencesManager.getProperty('hueRotation');
        if (hueRotation) {
            document.documentElement.style.setProperty('--rotation', hueRotation);
        }

        // Font Size
        const currentSizeId = PreferencesManager.getProperty('fontSize') || 'font-size-medium';
        document.body.classList.remove('font-size-small', 'font-size-medium', 'font-size-large');
        if (currentSizeId !== 'font-size-medium') {
            document.body.classList.add(currentSizeId);
        }
    }
};

window.highContrastMode = ThemeManager.toggleHighContrast;
window.colorblindMode = ThemeManager.toggleColorblind;
window.lightMode = ThemeManager.toggleLightMode;
window.applyStoredFontSize = ThemeManager.applyStoredSettings;

// prevent FOUC by applying theme settings as early as possible
ThemeManager.applyStoredSettings();

// ----------------------------------
// I18N 
// ----------------------------------

let currentTranslations = {};
window.currentTranslations = currentTranslations;

async function loadLanguage(langCode = 'ro') {
    try {
        const response = await fetch(`/app/Lang/${langCode}.json`);
        currentTranslations = await response.json();
        window.currentTranslations = currentTranslations;
        applyTranslations(document);
        
        // Update selector if exists
        const selector = document.getElementById('language-selector');
        if (selector && selector.value !== langCode) selector.value = langCode;
    } catch (e) {
        console.error('Failed to load language:', e);
    }
}

function applyTranslations(root = document) {
    if (!currentTranslations) return;

    const getVal = (key) => key.split('.').reduce((obj, part) => obj?.[part], currentTranslations);

    root.querySelectorAll('[data-i18n]').forEach(el => {
        const val = getVal(el.getAttribute('data-i18n'));
        if (val) el.textContent = val;
    });

    root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
        const val = getVal(el.getAttribute('data-i18n-placeholder'));
        if (val) el.setAttribute('placeholder', val);
    });

    root.querySelectorAll('[data-i18n-title]').forEach(el => {
        const val = getVal(el.getAttribute('data-i18n-title'));
        if (val) el.setAttribute('title', val);
    });
    
    root.querySelectorAll('[data-i18n-value]').forEach(el => {
        const val = getVal(el.getAttribute('data-i18n-value'));
        if (val) el.setAttribute('value', val);
    });
}

// Expose translation helpers for pages loaded as separate module scripts.
window.applyTranslations = applyTranslations;
window.loadLanguage = loadLanguage;

function setLanguage(langCode) {
    localStorage.setItem('lang', langCode);
    window.dispatchEvent(new CustomEvent('codium:lang-changed', { detail: { iso: langCode } }));
    loadLanguage(langCode);
}

// Expose language setter for pages that are separate ES modules.
window.setLanguage = setLanguage;

// ------------------------------------------------
// Async Component Loading (Menu, Sidebar & Footer)
// ------------------------------------------------

async function loadTopMenu() {
    try {
        const variant = document.querySelector('meta[name="menu-variant"]')?.content || 'default';
        const response = await fetch('/app/elements.html');
        const html = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const menu = tempDiv.querySelector(`#top-menu-${variant}`) || tempDiv.querySelector('#top-menu-default');
        
        if (menu) {
            const clone = menu.cloneNode(true);
            clone.id = 'top-menu';
            clone.classList.remove('menu-variant');
            document.getElementById('top-menu-container').innerHTML = clone.outerHTML;
            updateAuthButton(); // Initialize auth state in menu
        }
    } catch (error) {
        console.error('Error loading top menu:', error);
    }
}

async function loadSidebar() {
    const container = document.getElementById('sidebar-container');
    if (!container) return;

    try {
        const activePage = document.querySelector('meta[name="sidebar-active"]')?.content;
        const response = await fetch('/app/elements.html');
        const html = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        const sidebar = tempDiv.querySelector('#sidebar-default');
        
        if (sidebar) {
            const clone = sidebar.cloneNode(true);
            clone.id = 'sidebar';
            clone.classList.remove('sidebar-variant');
            container.innerHTML = clone.outerHTML;

            // Set active state
            if (activePage) {
                container.querySelector(`[data-sidebar="${activePage}"]`)?.classList.add('active');
            }

            container.querySelectorAll('.sidebar-item').forEach(item => {
                const href = item.getAttribute('href');
                if (href && href === '#') {
                    item.onclick = () => {
                        toastsLoader.showToast('Page not implemented yet', 'warning');
                    };
                }
            });

            // Admin checks
            const isAdmin = await window.apiService.users.isCurrentAdmin();
            console.log('Admin status:', isAdmin);
            if (!isAdmin) {
                container.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            }
        }
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
}

async function loadFooter() {
    try {
        const variant = document.querySelector('meta[name="footer-variant"]')?.content || 'default';
        const response = await fetch('/app/elements.html');
        const html = await response.text();
        
        const tempFooter = document.createElement('footer');
        tempFooter.innerHTML = html;
        
        const footer = tempFooter.querySelector(`#footer-${variant}`) || tempFooter.querySelector('#footer-default');
        
        if (footer) {
            const clone = footer.cloneNode(true);
            clone.id = 'footer';
            clone.classList.remove('footer-variant');
            clone.classList.add(variant);
            // insert before the footer-container and if exists, delete the old one to prevent duplicates
            const existingFooter = document.getElementById('footer-container');
            if(existingFooter) existingFooter.replaceWith(clone);
        }
    } catch (error) {
        console.error('Error loading footer:', error);
    }
}

// --------------------------------------------
// Authentication State Management & Navigation
// --------------------------------------------

async function updateAuthButton() {
    const menuVariant = document.querySelector('meta[name="menu-variant"]')?.content || 'default';

    const els = {
        loginOld: document.getElementById('login-button'),
        loginNew: document.getElementById('login-button-new'),
        userBtn: document.getElementById('user-button'),
        logout: document.getElementById('logout-button'),
        userName: document.getElementById('user-name'),
        userInfo: document.getElementById('user-info'),
        avatar: document.getElementById('user-avatar-small'),
        lessons: document.getElementById('teorie-button'),
        problems: document.getElementById('exercises-button'),
        lang: document.getElementById('language-selector'),
        back: document.getElementById('back-btn'),
        contact: document.getElementById('contact-button'),
    };

    let isAuthenticated = false;
    if (window.apiService) {
        try {
            isAuthenticated = await window.apiService.checkAuthentication(false);
        } catch (error) {
            isAuthenticated = false;
        }
    }
    let displayUsername = null;

    if (isAuthenticated) {
        try {
            const currentUser = await window.apiService.users.getCurrentUser();
            displayUsername = currentUser?.Username || null;
        } catch (error) {
            console.warn('Failed to resolve authenticated username for top menu:', error);
        }
    }

    if (els.back) {
        els.back.onclick = () => window.history.length > 1 ? window.history.back() : window.location.href = '/app/Lectii/lessons.html';
    }

    if (els.hardExit) {
        els.hardExit.onclick = () => window.location.href = '/app/Lectii/lessons.html';
    }

    // Language Selector Logic

    if (els.lang) {
        els.lang.value = localStorage.getItem('lang') || 'ro';
        els.lang.onchange = () => setLanguage(els.lang.value);
        // Clean up old listeners to prevent duplicates if function called multiple times
        window.removeEventListener('codium:lang-changed', handleLangChange);
        window.addEventListener('codium:lang-changed', handleLangChange);
    }

    // Auth State Logic
    if (isAuthenticated) {
        // Logged In
        if (els.loginOld) els.loginOld.classList.add('hidden');
        if (els.loginNew) els.loginNew.classList.add('hidden');
        if (els.userInfo) els.userInfo.classList.remove('hidden');
        if (els.lessons) els.lessons.classList.remove('hidden');
        
        if (els.userBtn) {
            els.userBtn.classList.remove('hidden');
            els.userBtn.onclick = () => window.location.href = '/app/user.html';
        }

        if (els.userInfo) {
            els.userInfo.onclick = () => window.location.href = '/app/user.html';
        }

        if (els.logout) {
            els.logout.classList.remove('hidden');
            els.logout.onclick = () => window.apiService?.users.logout(true);
        }

        if (els.userName) els.userName.textContent = displayUsername || 'User';
        if (els.avatar && window.apiService) {
            els.avatar.src = await window.apiService.fileManager.getProfilePicture();
        }
    } else {
        // Logged Out
        if (els.loginOld) {
            els.loginOld.classList.remove('hidden');
            els.loginOld.onclick = (event) => {
                event.preventDefault();
                window.location.href = '/app/login.html';
            };
        }

        if (els.loginNew) {
            els.loginNew.classList.remove('hidden');
            els.loginNew.onclick = (event) => {
                event.preventDefault();
                loadLanguage(localStorage.getItem('lang') || 'ro');
            };
        }

        if (els.userBtn) els.userBtn.classList.add('hidden');
        if (els.userInfo) els.userInfo.classList.add('hidden');
        if (els.userInfo) els.userInfo.onclick = null;
        if (els.logout) els.logout.classList.add('hidden');
    }
}

function handleLangChange(e) {
    const sel = document.getElementById('language-selector');
    if (sel && sel.value !== e.detail.iso) sel.value = e.detail.iso;
}

window.refreshAuthButton = updateAuthButton;

window.addEventListener('codium:profile-updated', () => {
    if (window.refreshAuthButton) {
        window.refreshAuthButton();
    }
});

// ---------------------------------------------
// Interaction Handler (Dropdowns, Modals, etc.)
// ---------------------------------------------

const InteractionHandler = {
    init: () => {
        document.addEventListener('click', InteractionHandler.handleClick);
        document.addEventListener('keydown', InteractionHandler.handleKey);
    },

    handleClick: (e) => {
        // Toggle Logic
        const toggleBtn = e.target.closest('.dropdown-toggle');
        if (toggleBtn) {
            e.stopPropagation();
            const dropdown = toggleBtn.closest('.dropdown');
            const isOpen = dropdown.classList.contains('open');
            
            InteractionHandler.closeAllDropdowns(dropdown);
            
            if (!isOpen) {
                dropdown.classList.add('open');
                toggleBtn.setAttribute('aria-expanded', 'true');
            } else {
                dropdown.classList.remove('open');
                toggleBtn.setAttribute('aria-expanded', 'false');
            }
            return;
        }

        // Selection Logic
        const item = e.target.closest('.dropdown-item');
        if (item) {
            InteractionHandler.handleSelection(item);
            return;
        }
    

        // Click Outside Logic
        InteractionHandler.closeAllDropdowns();
    },

    handleKey: (e) => {
        if (e.key === 'Escape') InteractionHandler.closeAllDropdowns();

        const focused = document.activeElement;
        if (focused?.classList.contains('dropdown-item') && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            InteractionHandler.handleSelection(focused);
        }
    },

    handleSelection: (item) => {
        const dropdown = item.closest('.dropdown');
        if (!dropdown) return;

        // Visual Updates
        dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
        item.classList.add('active');

        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        if (dropdown.dataset.updateText !== 'false' && toggleBtn) {
            const icon = toggleBtn.querySelector('i');
            const i18n = item.getAttribute('data-i18n');
            if (i18n) {
                toggleBtn.innerHTML = '<span class="no-style" data-i18n="' + i18n + '"></span> ';
            } else {
                toggleBtn.innerHTML = '<span class="no-style" data-i18n="">' + item.textContent.trim() + '</span> ';
            }
            applyTranslations(toggleBtn);
            if (icon) toggleBtn.appendChild(icon.cloneNode(true));
        }

        // Event Dispatch
        dropdown.dispatchEvent(new CustomEvent('dropdown-selected', {
            bubbles: true,
            detail: {
                element: item,
                value: item.dataset.value || item.textContent.trim(),
                iso: item.dataset.iso
            }
        }));

        InteractionHandler.closeAllDropdowns();
    },

    closeAllDropdowns: (except = null) => {
        document.querySelectorAll('.dropdown.open').forEach(d => {
            if (d !== except) {
                d.classList.remove('open');
                d.querySelector('.dropdown-toggle')?.setAttribute('aria-expanded', 'false');
            }
        });
    }
};

// -----------------------------------------
// Modal loader (for login button and signup in new ui)
// -----------------------------------------

const engine  = new ModalEngine();

let loginModalBound = false;
let signupModalBound = false;

function openLoginModal() {
    if (loginModalBound) return;

    document.addEventListener('click', async (event) => {
        const loginButton = event.target.closest('#login-button-new');
        if (!loginButton) return;

        event.preventDefault();

        await ModalHelpers.LoginPopup.openModal({
            engine,
            onConfirm: async (formElement) => {
                console.log('Login form submitted:', formElement);
                handleLogin(formElement);
            }
        });
    });

    loginModalBound = true;
}

async function handleLogin(formElement) {
    const formData = new FormData(formElement);
    const data = {
        email: formData.get('email'),
        password: formData.get('password')
    };

    console.log('Form Data:', data);

    ModalHelpers.LoginPopup.performLogin(data, { engine }).then(() => {
        toastsLoader.showToast('Login successful!', 'confirm');
        updateAuthButton();
    }).catch(err => {
        console.error('Login failed:', err);
        toastsLoader.showToast(`Login failed: ${err.message}`, 'danger');
    });

}

function openSignupModal() {
    if (signupModalBound) return;

    document.addEventListener('click', async (event) => {
        const signupButton = event.target.closest('#get-started-btn');
        if (!signupButton) return;

        event.preventDefault();

        await ModalHelpers.SignupPopup.openModal({
            engine,
            onConfirm: async (formElement) => {
                console.log('Signup form submitted');
                handleSignup(formElement);
            }
        })
    });
}

function handleSignup(formElement) {
    const formData = new FormData(formElement);
    const data = {
        email: formData.get('email'),
        password: formData.get('password'),
        username: formData.get('username'),
        confirm_password: formData.get('confirmPassword')
    }

    if (data.password !== data.confirm_password) {
        toastsLoader.showToast('Passwords do not match', 'danger');
        return;
    }

    console.log(data);

    ModalHelpers.SignupPopup.performSignup(data).then(() => {
        toastsLoader.showToast('Signup!', 'confirm', 5000);
        updateAuthButton();
    }).catch(err => {
        console.log(err);
        toastsLoader.showToast(`Signup failed: ${err.message}`, 'danger');
    })
}

// ----------------------------------
// Scroll Restoration Logic
// ----------------------------------

function setupScrollRestoration() {
    window.addEventListener('beforeunload', () => {
        sessionStorage.setItem('scrollY', window.scrollY);
        sessionStorage.setItem('currentPage', window.location.href);
    });

    window.addEventListener('load', () => {
        setTimeout(() => {
            const y = sessionStorage.getItem('scrollY');
            if (y !== null && sessionStorage.getItem('currentPage') === window.location.href) {
                window.scrollTo({ top: parseFloat(y), behavior: 'smooth' });
            }
        }, 200);
    });
}

// ----------------------------------
// Global copy/paste for pre elements
// ----------------------------------

function setupPreCopy() {
    document.addEventListener('click', async (e) => {
        const pre = e.target.closest('pre');
        if (!pre) return;

        const code = pre.querySelector('code');
        const text = code ? code.textContent : pre.textContent;

        try {
            await navigator.clipboard.writeText(text);

            pre.classList.add('copied');
            setTimeout(() => pre.classList.remove('copied'), 800);
        } catch (err) {
            console.error('Copy failed:', err);
        }
    });
}

// ----------------------------------
// devTools trap
// ----------------------------------

function setupDevToolsTrap() {
    // i am testing it so it's active, just in case, but should be only active in production!
    const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
    if (isLocalhost) return; 

    setInterval(() => {
        const before = new Date().getTime();
        debugger;
        const after = new Date().getTime();
        
        if (after - before > 100) {
            document.body.innerHTML = `
                <div style="display:flex;justify-content:center;align-items:center;height:100vh;background:#000;color:#ff3333;font-family:monospace;text-align:center;">
                    <h1>Security Violation<br><br>Developer Tools are not allowed during exercises.</h1>
                </div>
            `;
            setTimeout(() => {
                window.location.replace("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
            }, 2000);
        }
    }, 1000);
}

// ----------------------------------
// innit mate ain't it?
// ----------------------------------

async function initApp() {
    console.log('Initializing Application...');

    //setupDevToolsTrap();

    InteractionHandler.init();
    setupScrollRestoration();

    setupPreCopy();

    await Promise.all([
        loadTopMenu(),
        loadSidebar(),
        loadFooter()
    ]);

    openLoginModal();
    openSignupModal();

    document.addEventListener('codium:request-translation', (e) => {
        if (e.detail && e.detail.element) {
            applyTranslations(e.detail.element);
        }
    });

    window.addEventListener('storage', (e) => {
        if (['profilePicID'].includes(e.key)) updateAuthButton();
    });
    
    window.addEventListener('focus', updateAuthButton);

    document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') {
            updateAuthButton();
        }
    });

    await loadLanguage(localStorage.getItem('lang') || 'ro');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);