/*
combines signup and login logic, as they are very similar
*/

import { ModalEngine } from '/app/Scripts/modal/modalMain.js';
import { ModalHelpers } from '/app/Scripts/modal/modalHelpers.js';
import { 
    applyStaggeredAnimation, 
    prefersReducedMotion,
    cascadeEntrance
} from '/app/Scripts/animations/animationUtils.js';

document.addEventListener('DOMContentLoaded', async function() {
    const baseurl = window.location.href;

    try {
        if (await window.apiService.checkAuthentication(false)) {
            window.location.href = 'user.html';
            return;
        }
    } catch (error) {
        console.error('Error checking authentication:', error);
    }

    const engine = new ModalEngine();
    const loginForm = document.getElementById('loginForm');
    const signupForm = document.getElementById('signupForm');
    const activeForm = loginForm || signupForm;

    function playAnimations() {
        if (prefersReducedMotion()) return;

        const mainCards = document.querySelectorAll('.main-content-auth > *');
        if (mainCards.length > 0) {
            cascadeEntrance(mainCards, 'fadeInUp', { staggerDelay: 200, baseDelay: 100 });
        }

        const headers = document.querySelectorAll('.auth-header');
        if (headers.length > 0) {
            cascadeEntrance(headers, 'fade', { staggerDelay: 100, baseDelay: 120 });
        }

        if (activeForm) {
            const elementsToAnimate = activeForm.querySelectorAll('.auth-form *');
            if (elementsToAnimate.length > 0) {
                applyStaggeredAnimation(elementsToAnimate, 'fadeInUp', { staggerDelay: 10, baseDelay: 130 });
            }
        }
    }

    document.body.classList.remove('is-loading');
    playAnimations();
    console.log('Auth page loaded, animations initialized');

    function validateForm(formType) {
        const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        const usernameRegex = /^[a-zA-Z0-9_]+$/;

        const email = document.getElementById('email').value.trim();
        const password = document.getElementById('password').value;
        const confirmPassword = document.getElementById('confirmPassword')?.value || null;
        const username = document.getElementById('username')?.value.trim() || null;

        if (!emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };
        if (password.length === 0) return { valid: false, error: 'Password is required' };

        if (formType === 'signup') {
            if (username.length < 3 || username.length > 20) {
                return { valid: false, error: 'Username must be between 3 and 20 characters' };
            }
            if (!usernameRegex.test(username)) {
                return { valid: false, error: 'Username can only contain letters, numbers, and underscores' };
            }
            if (password.length < 6) return { valid: false, error: 'Password must be at least 6 characters long' };
            if (password !== confirmPassword) return { valid: false, error: 'Passwords do not match' };
        }

        return { valid: true };
    }

    function setLoadingState(submitButton, loading) {
        if (!submitButton) return;
        submitButton.disabled = loading;
        const form = submitButton.closest('form');
        if (form) form.style.opacity = loading ? '0.6' : '1';
    }

    function handleAuthSuccess(submitButton, formType) {
        submitButton.style.background = 'var(--purple-accent)';
        const redirectTo = baseurl.split("?redirect=")[1];

        if (redirectTo) {
            window.location.href = decodeURIComponent(redirectTo);
            return;
        }

        toastsLoader.showToast(formType === 'login' ? '{{server_events.toasts.login-success}}' : '{{server_events.toasts.account-created}}', 'confirm');

        setTimeout(() => {
            window.location.href = formType === 'login' ? 'user.html' : 'login.html';
        }, 1670);

        if (formType === 'login' && window.refreshAuthButton) {
            window.refreshAuthButton();
        }
    }

    // --- LOGIN LOGIC ---
    if (loginForm) {
        const savedEmail = localStorage.getItem('savedEmail');
        if (savedEmail) document.getElementById('email').value = savedEmail;

        loginForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const validation = validateForm('login');
            if (!validation.valid) {
                toastsLoader.showToast(validation.error, 'danger');
                return;
            }

            const email = document.getElementById('email').value.trim();
            const password = document.getElementById('password').value;

            setLoadingState(e.submitter, true);

            try {
                await ModalHelpers.LoginPopup.performLogin({ email, password }, { engine });

                localStorage.setItem('codium_session_active', 'true');

                const rememberMe = document.getElementById('rememberMe').checked;
                if (rememberMe) {
                    localStorage.setItem('rememberMe', 'true');
                    localStorage.setItem('savedEmail', email);
                } else {
                    localStorage.removeItem('savedEmail');
                }
                
                handleAuthSuccess(e.submitter, 'login');

            } catch (error) {
                window.handleApiError(error, 'Login failed. Please check your credentials.');
            } finally {
                setLoadingState(e.submitter, false);
            }
        });
    }

    // --- SIGNUP LOGIC ---
    if (signupForm) {
        signupForm.addEventListener('submit', async function(e) {
            e.preventDefault();

            const validation = validateForm('signup');
            if (!validation.valid) {
                toastsLoader.showToast(validation.error, 'danger', 3000);
                return;
            }

            const email = document.getElementById('email').value.trim();
            const username = document.getElementById('username').value.trim();
            const password = document.getElementById('password').value;

            setLoadingState(e.submitter, true);

            try {
                await window.apiService.users.signup({ email, username, password });
                handleAuthSuccess(e.submitter, 'signup');

            } catch (error) {
                if (error.message && error.message.includes('Failed to create user') || error.status === 500) {
                    toastsLoader.showToast('{{server_events.toasts.account-this-info-already-used}}', 'danger', 4000);
                } else {
                    window.handleApiError(error, 'Signup failed. Please try again.');
                }
            } finally {
                setLoadingState(e.submitter, false);
            }
        });
    }

    // --- SECONDARY BUTTON HANDLER ---
    if (activeForm) {
        const secondaryButton = activeForm.querySelector('button[type="button"]');
        if (secondaryButton) {
            secondaryButton.addEventListener('click', function() {
                window.location.href = loginForm ? 'signup.html' : 'login.html';
            });
        }
    }
});