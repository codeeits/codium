async function loadTopMenu(variant = 'default') {
    try {
        const response = await fetch('/app/elements.html');
        const menuHTML = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = menuHTML;
        
        const menuVariant = tempDiv.querySelector(`#top-menu-${variant}`);
        
        if (menuVariant) {
            const menuClone = menuVariant.cloneNode(true);
            menuClone.id = 'top-menu';
            menuClone.classList.remove('menu-variant');
            
            document.getElementById('top-menu-container').innerHTML = menuClone.outerHTML;
            console.log(`Loaded menu variant: ${variant}`);
            
            // Update login button based on authentication status
            updateAuthButton();
            
        } else {
            console.warn(`Menu variant '${variant}' not found, loading default`);
            loadTopMenu('default');
        }
    } catch (error) {
        console.error('Error loading top menu:', error);
    }
}

function updateAuthButton() {
    const loginButton = document.getElementById('login-button');
    const userButton = document.getElementById('user-button');
    const logoutButton = document.getElementById('logout-button');
    const userNameSpan = document.getElementById('user-name');
    const lessonsButton = document.getElementById('teorie-button');
    const languageSelector = document.getElementById('language-selector');
    const hardLessonsExit = document.getElementById('hard-lessons-exit-btn');
    const backButton = document.getElementById('back-btn');
    
    const authToken = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
    if(backButton) {
        backButton.onclick = function() {
            console.log('Back button clicked');
            if(window.history.length > 1) {
                window.history.back();
            } else {
                window.location.href = 'lessons.html';
            }
        };
        backButton.title = 'Back to lessons';
    }

    if(languageSelector) {
        languageSelector.value = localStorage.getItem('lang') || 'ro';
        languageSelector.onchange = function() {
            const selectedLang = languageSelector.value;
            setLanguage(selectedLang);
        };
        languageSelector.title = 'Select language';
    }

    if(hardLessonsExit) {
        hardLessonsExit.onclick = function() {
            window.location.href = 'lessons.html';
            console.log('Exiting hard lessons mode');
        };
        hardLessonsExit.title = 'Exit hard lessons mode';
    }
    
    if(lessonsButton) {
        lessonsButton.onclick = function() {
            window.location.href = 'lessons.html';
            console.log('Navigating to lessons page');
        };
        lessonsButton.title = 'Lessons';
    }
    
    if (authToken && username) {
        // User is logged in - hide login button, show user and logout buttons
        if (loginButton) {
            loginButton.classList.add('hidden');
        }
        
        if (userButton) {
            userButton.classList.remove('hidden');
            userButton.onclick = function() {
                window.location.href = 'user.html';
            };
            userButton.title = 'Go to profile';
        }

        if(lessonsButton) {
            lessonsButton.classList.remove('hidden');
        }
        
        if (logoutButton) {
            logoutButton.classList.remove('hidden');
            logoutButton.onclick = function() {
                window.apiService.logout(true);
            };
            logoutButton.title = 'Logout';
        }
        
        if (userNameSpan) {
            userNameSpan.textContent = username;
        }
    } else {
        // User is not logged in - show login button, hide user and logout buttons
        if (loginButton) {
            loginButton.classList.remove('hidden');
            loginButton.onclick = function() {
                loadLanguage(localStorage.getItem('lang') || 'ro');
                window.location.href = 'login.html';
            };
            loginButton.title = 'Login';
        }
        
        if (userButton) {
            userButton.classList.add('hidden');
        }
        
        if (logoutButton) {
            logoutButton.classList.add('hidden');
        }
    }
}

// Logout function for the navigation menu
/*function handleLogout() {
    if (confirm('Are you sure you want to logout?')) {
        // Clear stored data
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('isAdmin');
        
        // Update the menu immediately
        updateAuthButton();
        
        // Redirect to login or home page
        window.location.href = 'login.html';
    }
}*/

window.refreshAuthButton = updateAuthButton;

function getMenuVariant() {

    const metaTag = document.querySelector('meta[name="menu-variant"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    
    return 'default';
}

document.addEventListener('DOMContentLoaded', function() {
    const variant = getMenuVariant();
    loadTopMenu(variant);
    
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'username') {
            updateAuthButton();
        }
    });
    
    window.addEventListener('focus', function() {
        updateAuthButton();
    });

    loadLanguage(localStorage.getItem('lang') || 'ro');
});

window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('scrollY', window.scrollY);
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const y = sessionStorage.getItem('scrollY');
    if (y !== null) window.scrollTo({ top: parseFloat(y), behavior: 'smooth' });
  }, 200);
});

async function loadLanguage(langCode = 'ro') {
  const response = await fetch(`/app/Lang/${langCode}.json`);
  const translations = await response.json();
  applyTranslations(translations);
}

function getNestedTranslation(key, translations) {
  return key.split('.').reduce((obj, part) => obj?.[part], translations);
}

function applyTranslations(translations) {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedTranslation(key, translations);
    if (value) el.textContent = value;
  });

  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('placeholder', value);
  });

  document.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('title', value);
  });

    document.querySelectorAll('[data-i18n-value]').forEach(el => {
    const key = el.getAttribute('data-i18n-value');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('value', value);
  });
}

function setLanguage(langCode) {
  localStorage.setItem('lang', langCode);
  loadLanguage(langCode);
}