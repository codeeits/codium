/*
Pentru cei care citesc codul acesta in viitor, main e un soi de throw-whatever-you-dont-have-a-better-place-for-it.
O melodie caracteristica pentru acest este Lou Bega - Mambo No. 5 (A Little Bit Of...)

in memoriam doamna stan.
*/

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

async function loadSidebar(activePage = null) {
    const container = document.getElementById('sidebar-container');
    if (!container) {
        return; // No sidebar container on this page
    }

    try {
        const response = await fetch('/app/elements.html');
        const html = await response.text();
        
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        
        const sidebar = tempDiv.querySelector('#sidebar-default');
        
        if (sidebar) {
            const sidebarClone = sidebar.cloneNode(true);
            sidebarClone.id = 'sidebar';
            sidebarClone.classList.remove('sidebar-variant');
            
            container.innerHTML = sidebarClone.outerHTML;
            console.log('Loaded sidebar');
            
            // Set active page
            if (activePage) {
                const activeItem = container.querySelector(`[data-sidebar="${activePage}"]`);
                if (activeItem) {
                    activeItem.classList.add('active');
                }
            }
            
            // Hide admin-only items if not admin
            const isAdmin = localStorage.getItem('isAdmin') === 'true';
            if (!isAdmin) {
                container.querySelectorAll('.admin-only').forEach(el => {
                    el.style.display = 'none';
                });
            }
            
        } else {
            console.warn('Sidebar template not found');
        }
    } catch (error) {
        console.error('Error loading sidebar:', error);
    }
}

async function updateAuthButton() {
    const loginButton = document.getElementById('login-button');
    const userButton = document.getElementById('user-button');
    const logoutButton = document.getElementById('logout-button');
    const userNameSpan = document.getElementById('user-name');
    const lessonsButton = document.getElementById('teorie-button');
    const problemsButton = document.getElementById('exercises-button');
    const languageSelector = document.getElementById('language-selector');
    const hardLessonsExit = document.getElementById('hard-lessons-exit-btn');
    const backButton = document.getElementById('back-btn');
    const contactButton = document.getElementById('contact-button');


    const userInfoContainer = document.getElementById('user-info');
    const userAvatarSmall = document.getElementById('user-avatar-small');


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

        // event listener

        window.addEventListener('codium:lang-changed', (e) => {
            const newLang = e.detail.iso;
            console.log('Received codium:lang-changed event with detail:', newLang);
            if (languageSelector.value !== newLang) {
                languageSelector.value = newLang;
            }
        });

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
            window.location.href = '/app/Lectii/lessons.html';
            console.log('Navigating to lessons page');
        };
        lessonsButton.title = 'Lessons';
    }

    if(problemsButton) {
        problemsButton.onclick = function() {
            window.location.href = '/app/Probleme/index.html';
            console.log('Navigating to problems page');
        };
        problemsButton.title = 'Problems';
    }

    if(contactButton) {
        contactButton.onclick = function() {
            window.location.href = '/app/contact.html';
            console.log('Navigating to contact page');
        };
        contactButton.title = 'Contact';
    }

    if (authToken && username) {
        // User is logged in - hide login button, show user and logout buttons
        if (loginButton) {
            loginButton.classList.add('hidden');
        }

        if (userInfoContainer) {
            userInfoContainer.classList.remove('hidden');
        }
        
        if (userButton) {
            userButton.classList.remove('hidden');
            userButton.onclick = function() {
                window.location.href = '/app/user.html';
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

        if(userAvatarSmall) {
            const imgUrl = await window.apiService.getProfilePicture();
            userAvatarSmall.src = imgUrl;
        }
    } else {
        // User is not logged in - show login button, hide user and logout buttons
        if (loginButton) {
            loginButton.classList.remove('hidden');
            loginButton.onclick = function() {
                loadLanguage(localStorage.getItem('lang') || 'ro');
                window.location.href = '/app/login.html';
            };
            loginButton.title = 'Login';
        }
        
        if (userButton) {
            userButton.classList.add('hidden');
        }

        if (userInfoContainer) {
            userInfoContainer.classList.add('hidden');
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

function getActiveSidebarPage() {
    const metaTag = document.querySelector('meta[name="sidebar-active"]');
    if (metaTag) {
        return metaTag.getAttribute('content');
    }
    return null;
}

document.addEventListener('DOMContentLoaded', async function() {
    const variant = getMenuVariant();
    await loadTopMenu(variant);
    
    const activeSidebarPage = getActiveSidebarPage();
    await loadSidebar(activeSidebarPage);
    
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'username') {
            updateAuthButton();
        }
    });
    
    window.addEventListener('focus', function() {
        updateAuthButton();
    });

    await loadLanguage(localStorage.getItem('lang') || 'ro');
});

window.addEventListener('beforeunload', () => {
  sessionStorage.setItem('scrollY', window.scrollY);
  sessionStorage.setItem('currentPage', window.location.href);
});

window.addEventListener('load', () => {
  setTimeout(() => {
    const y = sessionStorage.getItem('scrollY');
    const savedPage = sessionStorage.getItem('currentPage');
    if (y !== null && savedPage === window.location.href) {
      window.scrollTo({ top: parseFloat(y), behavior: 'smooth' });
    }
  }, 200);
});

let currentTranslations = {};

async function loadLanguage(langCode = 'ro') {
  const response = await fetch(`/app/Lang/${langCode}.json`);
  currentTranslations = await response.json(); // store globally
  applyTranslations(currentTranslations);
}

function getNestedTranslation(key, translations) {
  return key.split('.').reduce((obj, part) => obj?.[part], translations);
}

function applyTranslations(translations, root = document) {
  root.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const value = getNestedTranslation(key, translations);
    if (value) el.textContent = value;
  });

  root.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('placeholder', value);
  });

  root.querySelectorAll('[data-i18n-title]').forEach(el => {
    const key = el.getAttribute('data-i18n-title');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('title', value);
  });

  root.querySelectorAll('[data-i18n-value]').forEach(el => {
    const key = el.getAttribute('data-i18n-value');
    const value = getNestedTranslation(key, translations);
    if (value) el.setAttribute('value', value);
  });
}

function applyTranslationsToElement(element) {
  if (!currentTranslations || Object.keys(currentTranslations).length === 0) {
    console.warn('No translations loaded yet.');
    return;
  }
  applyTranslations(currentTranslations, element);
}

function setLanguage(langCode) {
  localStorage.setItem('lang', langCode);
  // fire custom event for other components to react to language change
  window.dispatchEvent(new CustomEvent('codium:lang-changed', { detail: { iso: langCode } }));
  console.log('Language changed event dispatched with detail:', langCode);
  loadLanguage(langCode);
}
