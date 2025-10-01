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
    if (!loginButton) return;
    
    const authToken = localStorage.getItem('authToken');
    const username = localStorage.getItem('username');
    
    if (authToken && username) {
        // User is logged in - show username and link to user page
        loginButton.innerHTML = `<i class="fas fa-user"></i> <u>${username}</u>`;
        loginButton.onclick = function() {
            window.location.href = 'user.html';
        };
        loginButton.title = 'Go to profile';
        loginButton.classList.add('user-logged-in');
    } else {
        // User is not logged in - show login link
        loginButton.innerHTML = '<u>Loghează-te</u>';
        loginButton.onclick = function() {
            window.location.href = 'login.html';
        };
        loginButton.title = 'Login';
        loginButton.classList.remove('user-logged-in');
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