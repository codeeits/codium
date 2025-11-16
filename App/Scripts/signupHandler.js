/*
 ___  ____  ___  _  _  __  __  ____  _   _    __    _  _  ____  __    ____  ____     ____  ___ 
/ __)(_  _)/ __)( \( )(  )(  )(  _ \( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \   (_  _)/ __)
\__ \ _)(_( (_-. )  (  )(__)(  )___/ ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /  .-_)(  \__ \
(___/(____)\___/(_)\_)(______)(__)  (_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)()\____) (___/

same thing as loginHandler.js but for signup functionality
*/

document.addEventListener('DOMContentLoaded', function() {

    const form = document.getElementById('signupForm');
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
        const confirmPassword = document.getElementById('confirmPassword').value;
        const username = document.getElementById('username').value.trim();

        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        if (!emailRegex.test(email)) {
            return { valid: false, error: 'Invalid email format' };
        }

        if (username.length < 3) {
            return { valid: false, error: 'Username must be at least 3 characters long' };
        }

        if (password.length < 6) {
            return { valid: false, error: 'Password must be at least 6 characters long' };
        }

        if (password !== confirmPassword) {
            return { valid: false, error: 'Passwords do not match' };
        }

        return { valid: true };
    }

    // Update UI c:
    function setLoadingState(loading) {
        submitButton.disabled = loading;
        submitButton.value = loading ? 'Signing up...' : 'Sign up';
        form.style.opacity = loading ? '0.6' : '1';
    }

    // successful signup
    function handleSignupSuccess() {
        submitButton.value = 'Success!';
        submitButton.style.background = 'var(--purple-accent)';
        toastsLoader.showToast('Signup successful, redirecting...', 'confirm');
        // Redirect to login after a short delay
        setTimeout(() => {
            window.location.href = 'login.html';
        }, 1670);
    }

    form.addEventListener('submit', async function(e) {
        e.preventDefault();
        
        const validation = validateForm();
        if (!validation.valid) {
            //alert(validation.error);
            toastsLoader.showToast(validation.error, 'danger', 3000);
            return;
        }

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const username = document.getElementById('username').value.trim();

        setLoadingState(true);

        try {
            const userData = {
                email: email,
                username: username,
                password: password
            };
            
            const result = await window.apiService.signup(userData);

            handleSignupSuccess();

        } catch (error) {
            if (error.message.includes('Failed to create user') && error.status === 500) {
                //alert('This username or email is already taken. Please try different credentials.');
                toastsLoader.showToast('This username or email is already taken. Please try different credentials.', 'danger', 4000);
                return;
            }
            setLoadingState(false);
        } finally {
            setLoadingState(false);
        }
    });

    // Handle secondary button (go to login)
    const secondaryButton = form.querySelector('button[type="button"]');
    if (secondaryButton) {
        secondaryButton.addEventListener('click', function() {
            window.location.href = 'login.html';
        });
    }
});