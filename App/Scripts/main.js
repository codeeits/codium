/*
Pentru cei care citesc codul acesta in viitor, main e un soi de throw-whatever-you-dont-have-a-better-place-for-it.
O melodie caracteristica pentru acest este Lou Bega - Mambo No. 5 (A Little Bit Of...)

aprecieri doamnei stan pentru suportul acordat
*/

// ----------------------------------
// Preferences Management
// ----------------------------------

const PreferencesManager = {
    storageKey: 'profilePreferences',
    defaults: {
        hueRotation: 0,
        fontSize: 'font-size-medium',
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

// ----------------------------------
// Visual Settings & Theme Management
// ----------------------------------

const ThemeManager = {
    toggleHighContrast: () => {
        document.body.classList.toggle('high-contrast');
        document.body.classList.remove('colorblind');
        PreferencesManager.setProperty('highContrast', document.body.classList.contains('high-contrast'));
    },

    toggleColorblind: () => {
        document.body.classList.toggle('colorblind');
        document.body.classList.remove('high-contrast');
        PreferencesManager.setProperty('colorblind', document.body.classList.contains('colorblind'));
    },

    applyStoredSettings: () => {
        // High Contrast
        if (PreferencesManager.getProperty('highContrast') || 
           (window.matchMedia('(prefers-contrast: more)').matches || window.matchMedia('(forced-colors: active)').matches)) {
            document.body.classList.add('high-contrast');
        }

        // Colorblind
        if (PreferencesManager.getProperty('colorblind')) {
            document.body.classList.add('colorblind');
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
window.applyStoredFontSize = ThemeManager.applyStoredSettings;

// prevent FOUC by applying theme settings as early as possible
ThemeManager.applyStoredSettings();

// ----------------------------------
// I18N 
// ----------------------------------

let currentTranslations = {};

async function loadLanguage(langCode = 'ro') {
    try {
        const response = await fetch(`/app/Lang/${langCode}.json`);
        currentTranslations = await response.json();
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

function setLanguage(langCode) {
    localStorage.setItem('lang', langCode);
    window.dispatchEvent(new CustomEvent('codium:lang-changed', { detail: { iso: langCode } }));
    loadLanguage(langCode);
}

// ----------------------------------------
// Async Component Loading (Menu & Sidebar)
// ----------------------------------------

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

            // Admin checks
            if (localStorage.getItem('isAdmin') !== 'true') {
                container.querySelectorAll('.admin-only').forEach(el => el.style.display = 'none');
            }
        }
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
}

// --------------------------------------------
// Authentication State Management & Navigation
// --------------------------------------------

async function updateAuthButton() {
    const els = {
        login: document.getElementById('login-button'),
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
        hardExit: document.getElementById('hard-lessons-exit-btn')
    };

    const auth = {
        token: localStorage.getItem('authToken'),
        username: localStorage.getItem('username')
    };

    // Navigation Event Binding Helper
    const bindNav = (el, path, title) => {
        if (el) {
            el.onclick = () => window.location.href = path;
            if (title) el.title = title;
        }
    };

    bindNav(els.lessons, '/app/Lectii/lessons.html', 'Lessons');
    bindNav(els.problems, '/app/Probleme/index.html', 'Problems');
    bindNav(els.contact, '/app/contact.html', 'Contact');

    if (els.back) {
        els.back.onclick = () => window.history.length > 1 ? window.history.back() : window.location.href = 'lessons.html';
    }

    if (els.hardExit) {
        els.hardExit.onclick = () => window.location.href = 'lessons.html';
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
    if (auth.token && auth.username) {
        // Logged In
        if (els.login) els.login.classList.add('hidden');
        if (els.userInfo) els.userInfo.classList.remove('hidden');
        if (els.lessons) els.lessons.classList.remove('hidden');
        
        if (els.userBtn) {
            els.userBtn.classList.remove('hidden');
            els.userBtn.onclick = () => window.location.href = '/app/user.html';
        }

        if (els.logout) {
            els.logout.classList.remove('hidden');
            els.logout.onclick = () => window.apiService?.logout(true);
        }

        if (els.userName) els.userName.textContent = auth.username;
        if (els.avatar && window.apiService) {
            els.avatar.src = await window.apiService.getProfilePicture();
        }
    } else {
        // Logged Out
        if (els.login) {
            els.login.classList.remove('hidden');
            els.login.onclick = () => {
                loadLanguage(localStorage.getItem('lang') || 'ro');
                window.location.href = '/app/login.html';
            };
        }
        if (els.userBtn) els.userBtn.classList.add('hidden');
        if (els.userInfo) els.userInfo.classList.add('hidden');
        if (els.logout) els.logout.classList.add('hidden');
    }
}

function handleLangChange(e) {
    const sel = document.getElementById('language-selector');
    if (sel && sel.value !== e.detail.iso) sel.value = e.detail.iso;
}

window.refreshAuthButton = updateAuthButton;

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
            toggleBtn.innerHTML = '<span class="no-style" data-i18n="' + i18n + '"></span> ';
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
// innit mate ain't it?
// ----------------------------------

async function initApp() {
    console.log('Initializing Application...');

    InteractionHandler.init();
    setupScrollRestoration();

    setupPreCopy();

    await Promise.all([
        loadTopMenu(),
        loadSidebar()
    ]);

    window.addEventListener('storage', (e) => {
        if (['authToken', 'username'].includes(e.key)) updateAuthButton();
    });
    
    window.addEventListener('focus', updateAuthButton);

    await loadLanguage(localStorage.getItem('lang') || 'ro');
}

// Start
document.addEventListener('DOMContentLoaded', initApp);