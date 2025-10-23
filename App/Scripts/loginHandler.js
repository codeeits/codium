/*
 __    _____  ___  ____  _  _  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
(  )  (  _  )/ __)(_  _)( \( )( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
 )(__  )(_)(( (_-. _)(_  )  (  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(____)(_____)\___/(____)(_)\_)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

Pentru optimizare si mentabilitate. si pentru a reduce codul duplicat.
*/

document.addEventListener('DOMContentLoaded', function() {
    const form = document.getElementById('loginForm');
    const submitButton = form.querySelector('input[type="submit"]');

    // Redirect daca e auth
    if (window.apiService.isAuthenticated()) {
        window.location.href = 'user.html';
        return;
    }

    // pentru requesturile care ocolesc frontend-ul
    function validateForm() {
        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        if (password.length === 0) {
            return { valid: false, error: 'Password is required' };
        }

        return { valid: true };
    }

    // Update UI c:
    function setLoadingState(loading) {
        submitButton.disabled = loading;
        submitButton.value = loading ? 'Logging in...' : 'Log in';
        form.style.opacity = loading ? '0.6' : '1';
    }

    // successful login
    function handleLoginSuccess() {
        submitButton.value = 'Success!';
        submitButton.style.background = 'var(--purple-accent)';
        
        // Refresh auth button if available
        if (window.refreshAuthButton) {
            window.refreshAuthButton();
        }
        
        setTimeout(() => {
            window.location.href = 'user.html';
        }, 1670);
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const validation = validateForm();
        if (!validation.valid) {
            alert(validation.error);
            return;
        }

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;

        setLoadingState(true);

        try {
            await window.apiService.login(email, password);
            // store remember me preference
            const rememberMe = document.getElementById('rememberMe').checked;
            if (rememberMe) {
                localStorage.setItem('rememberMe', 'true');
                localStorage.setItem('savedEmail', email);
            }
            
            handleLoginSuccess();
            
        } catch (error) {
            window.handleApiError(error, 'Login failed. Please check your credentials.');
        } finally {
            setLoadingState(false);
        }
    });

    // validare email + parola
    document.getElementById('email').addEventListener('input', function() {
        const email = this.value.trim();
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        this.style.borderColor = (email && !emailRegex.test(email)) ? '#ff6b6b' : 'transparent';
    });

    document.getElementById('password').addEventListener('input', function() {
        this.style.borderColor = (this.value.length === 0) ? '#ff6b6b' : 'transparent';
    });

    // Pre-fill saved email
    const savedEmail = localStorage.getItem('savedEmail');
    if (savedEmail) {
        document.getElementById('email').value = savedEmail;
    }

    // Handle secondary button (Sign Up)
    const secondaryButton = form.querySelector('button[type="button"]');
    if (secondaryButton) {
        secondaryButton.addEventListener('click', function() {
            window.location.href = 'signup.html';
        });
    }
});