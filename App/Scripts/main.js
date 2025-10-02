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
    
    const authToken = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
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
        
        if (logoutButton) {
            logoutButton.classList.remove('hidden');
            logoutButton.onclick = function() {
                handleLogout();
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
function handleLogout() {
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
}

// Global function to refresh auth button (can be called from other scripts)
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
    
    // Listen for storage changes to update menu when login status changes
    window.addEventListener('storage', function(e) {
        if (e.key === 'authToken' || e.key === 'username') {
            updateAuthButton();
        }
    });
    
    // Also check for auth changes on focus (for same-tab login/logout)
    window.addEventListener('focus', function() {
        updateAuthButton();
    });
});