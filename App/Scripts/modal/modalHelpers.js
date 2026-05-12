// A class helper for providing modal presets (e. g. edit profile, delete confirmation, etc.) and handling common modal logic.

import { buildQrSvgDataUri } from '../helper/helper.js';

// Uses qrJS/main.js for QR code generation in the TOTP setup modal.


export class ModalHelpers {
    /**
     * @param {Object} config
     * @param {string} config.type - The type of modal to open (e.g. 'edit-profile', 'delete-confirmation')
     * @param {string} [config.title] - Optional custom title for the modal
     * @param {string|HTMLElement} [config.body] - Optional custom body content (HTML string or DOM node)
     * @param {string} [config.footer] - Optional custom footer content (HTML string)
     * @param {Function} [config.onConfirm] - Optional callback for form submission or confirmation action
     * @param {Function} [config.onCancel] - Optional callback for closing the modal or cancellation action
     */
    
    static EditProfile = {

        openModal: async ({ engine, user, onConfirm, title = '{{modal.edit_profile.title}}', icon = 'fa-pencil' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            await engine.openModal({
                type: 'edit-profile',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {}
            });

            const editEmailInput = document.getElementById('editEmail');
            const editUsernameInput = document.getElementById('editUsername');

            if (editEmailInput && user?.Email) {
                editEmailInput.value = user.Email;
            }

            if (editUsernameInput && user?.Username) {
                editUsernameInput.value = user.Username;
            }

            const fileInput = document.getElementById('editProfilePicture');

            if (fileInput) {
                fileInput.addEventListener('change', (event) => {
                    const file = event.target.files?.[0];

                    if (file && file.type.startsWith('image/')) {
                        const dropzone = fileInput.closest('.dropzone') || fileInput.parentElement;
                        if (!dropzone) {
                            return;
                        }

                        const iconEl = dropzone.querySelector('.input-icon');
                        if (iconEl) {
                            iconEl.style.display = 'none';
                        }

                        const oldPreview = dropzone.querySelector('.image-preview');
                        if (oldPreview) {
                            oldPreview.remove();
                        }

                        const img = document.createElement('img');
                        img.src = URL.createObjectURL(file);
                        img.className = 'image-preview';
                        dropzone.appendChild(img);
                    }
                });
            }
        },
        
        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    email: 'john@example.com',
                    username: 'john_doe',
                    oldPassword: 'old_password',
                    newPassword: 'new_password'
                }
            */
            const { email, username, oldPassword, newPassword } = data;
            
            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (email && !emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };

            // Username validation
            if (username && (username.length < 3 || username.length > 20)) return { valid: false, error: 'Username must be between 3 and 20 characters long' };

            // Password validation
            if (oldPassword || newPassword) {
                if (!oldPassword) return { valid: false, error: 'Please enter your current password to set a new one' };
                if (!newPassword || newPassword.length < 6) return { valid: false, error: 'New password must be at least 6 characters long' };
                if (oldPassword === newPassword) return { valid: false, error: 'New password must be different from old password' };
            }

            return { 
                valid: true, 
            };
        },

        updateProfileData: async (data) => {

            const validation = ModalHelpers.EditProfile.validateForm(data);

            if (!validation.valid) {
                throw new Error(validation.error);
            }

            if (data.profilePicture) {
                const uploadResult = await window.apiService.fileManager.uploadFile(data.profilePicture);
                await window.apiService.users.updateProfilePicture(uploadResult.file_id);
                // localStorage.setItem('profilePicID', uploadResult.file_id);
                                
            }
            
            if (data.email) await window.apiService.users.updateEmail(data.email);
            if (data.username) await window.apiService.users.updateUsername(data.username);
            
            if (data.newPassword && data.oldPassword) {
                await window.apiService.users.updatePassword(data.oldPassword, data.newPassword);
            }

            const user = window.apiService.getCachedCurrentUser();

            window.dispatchEvent(new CustomEvent('codium:profile-updated', {
                detail: {
                    username: user?.Username,
                    email: user?.Email,
                    profilePicID: user?.ProfilePicID
                }
            }));

            // everything succeededed yay!!!
            return { success: true };
        }
    };

    static LoginPopup = {

        openModal: async ({ engine, onConfirm, title = 'Login', icon = 'fa-id-badge' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            await engine.openModal({
                type: 'login',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {}
            });

        },

        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    email: '',
                    password: ''
                }
            */

            const { email, password } = data;

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };

            // Password validation
            if (!password || password.length < 6) return { valid: false, error: 'Password must be at least 6 characters long' };

            return { 
                valid: true, 
            };
        },

        requestTotpCode: async ({ engine, title = 'Two-Factor Authentication', icon = 'fa-shield-halved' } = {}) => {
            if (!engine || typeof engine.openModal !== 'function') {
                const fallback = prompt('Enter your 2FA code (or backup code):');
                if (!fallback || !fallback.trim()) {
                    throw new Error('2FA code is required to complete login.');
                }
                return fallback.trim();
            }

            return await new Promise((resolve, reject) => {
                let settled = false;

                engine.openModal({
                    type: 'totp-auth',
                    title,
                    icon,
                    onConfirm: (formElement) => {
                        const input = formElement?.querySelector('#totpAuthCode');
                        const code = input?.value?.trim() || '';

                        if (!code) {
                            if (!settled) {
                                settled = true;
                                reject(new Error('2FA code is required to complete login.'));
                            }
                            return;
                        }

                        if (!settled) {
                            settled = true;
                            resolve(code);
                        }
                    },
                    onCancel: () => {
                        if (!settled) {
                            settled = true;
                            reject(new Error('2FA verification was cancelled.'));
                        }
                    }
                }).catch((error) => {
                    if (!settled) {
                        settled = true;
                        reject(error);
                    }
                });
            });
        },
        
        performLogin: async (data, { engine } = {}) => {

            const validation = ModalHelpers.LoginPopup.validateForm(data);

            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const loginResult = await window.apiService.users.login(data.email, data.password);
            let finalLoginResult = loginResult;

            if (loginResult?.requiresTotp && loginResult?.validationToken) {
                const otp = await ModalHelpers.LoginPopup.requestTotpCode({ engine });
                finalLoginResult = await window.apiService.users.authenticateWithTOTP(loginResult.validationToken, otp);
            }
            
            if (finalLoginResult) {
                const user = window.apiService.getCachedCurrentUser();
                
                window.dispatchEvent(new CustomEvent('codium:login-success', {
                    detail: {
                        username: user?.Username,
                        email: user?.Email,
                        profilePicID: user?.ProfilePicID
                    }
                }));
            }

            return finalLoginResult;
        }

    };

    static SignupPopup = {

        openModal: async ({ engine, onConfirm, title = 'Sign-up', icon = 'fa-arrow-right-to-bracket' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            await engine.openModal({
                type: 'signup',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {}
            });

        },

        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    email: '',
                    username: '',
                    password: ''
                }
            */

            const { email, username, password } = data;

            // Email validation
            const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
            if (!email || !emailRegex.test(email)) return { valid: false, error: 'Invalid email format' };

            // Password validation
            if (!password || password.length < 6) return { valid: false, error: 'Password must be at least 6 characters long' };

            // Username validation
            if (!username || 3 > username.length || 20 < username.length) return {valid: false, error: 'Username must be between 3 and 20 characters'}

            return { 
                valid: true, 
            };
        },
        
        performSignup: async (data) => {

            const validation = ModalHelpers.LoginPopup.validateForm(data);

            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const signupResult = await window.apiService.users.signup(data);
            
            if (signupResult) {
                const user = window.apiService.getCachedCurrentUser();
                
                window.dispatchEvent(new CustomEvent('codium:signup-success', {
                    detail: {
                        username: user?.Username,
                        email: user?.Email
                    }
                }));
            }

            return signupResult;
        }

    };

    static totpSetup = {

        activeEngine: null,

        openModal: async ({ engine, onConfirm, onOpen, title = '{{settings-page.privacy-section.2fa-notes.title}}', icon = 'fa-shield-alt' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            ModalHelpers.totpSetup.activeEngine = engine;

            await engine.openModal({
                type: 'totp-setup',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {},
                onOpen: (modalElement) => {
                    if (typeof onOpen === 'function') {
                        onOpen(modalElement);
                    }
                }
            });

        },

        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    totpCode: '123456'
                }
            */

            const { totpCode } = data;

            // TOTP code validation (6 digits)
            const totpRegex = /^\d{6}$/;
            if (!totpCode || !totpRegex.test(totpCode)) return { valid: false, error: 'Invalid TOTP code format' };

            return { 
                valid: true, 
            };
        },

        initialization: async (modal) => {
            const { uri } = await window.apiService.users.initiateTOTPSetup();

            const linkCode = modal?.querySelector('#totpUri');
            if (linkCode) {
                linkCode.textContent = uri;
            }

            const qrImage = modal?.querySelector('#totpQrCode');
            if (!qrImage || !uri) {
                return;
            }

            qrImage.src = await buildQrSvgDataUri(uri, {
                width: 200,
                height: 200,
                colorDark: '#000000',
                colorLight: '#ffffff'
            });
        },

        performTotpSetup: async (data) => {
            const validation = ModalHelpers.totpSetup.validateForm(data);
            
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const result = await window.apiService.users.validateTOTPToken(data.totpCode);

            const backupCodes = Array.isArray(result?.backupCodes)
                ? result.backupCodes
                : Array.isArray(result?.BackupCodes)
                    ? result.BackupCodes
                    : [];

            // Backend returns HTTP 200 with backup codes when setup succeeds.
            const isSuccess = (typeof result?.success === 'boolean') ? result.success : true;

            if (isSuccess) {
                window.dispatchEvent(new CustomEvent('codium:totp-setup-success', {
                    detail: { backupCodes }
                }));
                console.log('TOTP setup successful!');

                if (backupCodes.length > 0) {
                    const engine = ModalHelpers.totpSetup.activeEngine;
                    const codesHtml = backupCodes.map(code => `<code style="display:block; font-size: 1rem; line-height: 1.8;">${code}</code>`).join('');
                    const body = `
                        <p class="modal-message" data-i18n="settings-page.privacy-section.2fa-notes.note-4">Save these backup codes in a secure place. Each code can be used once. You won't see these codes EVER again. So be careful!</p>
                        <div style="margin-top: var(--gap-md); padding: var(--gap-md); border: 1px solid var(--color-border); border-radius: var(--border-radius-sm); background: var(--color-surface, #f8fafc);">
                            ${codesHtml}
                        </div>
                        <div class="modal-actions" style="margin-top: var(--gap-lg);">
                            <button type="button" class="btn primary flex-1" id="modal-confirm-button" data-i18n="buttons.i_saved_them">I saved them</button>
                        </div>
                    `;

                    if (engine && typeof engine.openModal === 'function') {
                        await engine.openModal({
                            title: 'Backup Codes',
                            icon: 'fa-key',
                            body
                        });
                    } else {
                        alert(`Backup codes:\n\n${backupCodes.join('\n')}`);
                    }
                }
            }

            console.log('TOTP setup result:', result);
            
            return result;
        }
    }

    static removeTotp = {

        activeEngine: null,

        openModal: async ({ engine, onConfirm, title = 'Disable Two-Factor Authentication', icon = 'fa-shield-alt' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            ModalHelpers.removeTotp.activeEngine = engine;

            await engine.openModal({
                type: 'totp-remove-confirmation',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {}
            });

        },

        validateForm: (data) => {
            /* data syntax example: 
                data = {
                    otp: '123456'
                }
            */

            const { otp } = data;

            // OTP code validation (6 digits)
            const otpRegex = /^\d{6}$/;
            if (!otp || !otpRegex.test(otp)) return { valid: false, error: 'Invalid OTP code format' };

            return { 
                valid: true, 
            };
        },

        performTotpRemoval: async (data) => {
            const validation = ModalHelpers.removeTotp.validateForm(data);
            
            if (!validation.valid) {
                throw new Error(validation.error);
            }

            const result = await window.apiService.users.disableTOTP(data.otp);

            if (result?.success) {
                window.dispatchEvent(new CustomEvent('codium:totp-remove-success'));
                console.log('TOTP disabled successfully!');
            }

            console.log('TOTP disable result:', result);
            
            return result;
        }
    }

    static LessonUpload = {

        openModal: async ({ engine, onConfirm, onClear, title = 'Quick Upload', icon = 'fa-cloud-upload-alt' }) => {
            if (!engine || typeof engine.openModal !== 'function') {
                throw new Error('A valid modal engine instance is required.');
            }

            await engine.openModal({
                type: 'lesson-upload',
                title,
                icon,
                onConfirm: (formElement) => {
                    if (typeof onConfirm === 'function') {
                        onConfirm(formElement);
                    }
                },
                onCancel: () => {},
                onOpen: (modalElement) => {
                    // Hook up the clear form button
                    const clearBtn = modalElement.querySelector('#clearForm');
                    if (clearBtn) {
                        clearBtn.addEventListener('click', () => {
                            const form = modalElement.querySelector('form');
                            if (form) form.reset();
                            
                            const fileInfo = modalElement.querySelector('#fileInfo');
                            if (fileInfo) fileInfo.style.display = 'none';

                            if (typeof onClear === 'function') onClear();
                        });
                    }

                    // Hook up file info preview
                    const fileInput = modalElement.querySelector('#lessonFile');
                    const fileInfo = modalElement.querySelector('#fileInfo');
                    const fileNameSpan = modalElement.querySelector('#fileName');
                    const fileSizeSpan = modalElement.querySelector('#fileSize');

                    if (fileInput) {
                        fileInput.addEventListener('change', (e) => {
                            const file = e.target.files?.[0];
                            if (file) {
                                fileNameSpan.textContent = file.name;
                                fileSizeSpan.textContent = `(${(file.size / 1024).toFixed(2)} KB)`;
                                fileInfo.style.display = 'block';
                            } else {
                                fileInfo.style.display = 'none';
                            }
                        });
                    }
                }
            });
        }
    };

}

/* USAGE: */
/*
ModalHelpers.EditProfile.openModal({
    engine, 
    user: {
        Email: '',
        Username: '',
    },
    onConfirm: (formElement) => {
        const formData = new FormData(formElement);
        const data = {
            email: formData.get('email'),
            username: formData.get('username'),
            oldPassword: formData.get('oldPassword'),
            newPassword: formData.get('newPassword'),
            profilePicture: formData.get('profilePicture') // Assuming the file input has name="profilePicture"
        };

        ModalHelpers.EditProfile.updateProfileData(data)
            .then(result => {
                if (result.success) {
                    alert('Profile updated successfully!');
                }
            })
            .catch(error => {
                alert(`Error updating profile: ${error.message}`);
            });
    }
    on
});
*/