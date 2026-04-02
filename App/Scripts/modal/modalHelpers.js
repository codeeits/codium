// A class helper for providing modal presets (e. g. edit profile, delete confirmation, etc.) and handling common modal logic.

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

        openModal: async ({ engine, user, onConfirm, title = 'Edit Profile', icon = 'fa-pencil' }) => {
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
                const uploadResult = await window.apiService.uploadFile(data.profilePicture);
                await window.apiService.updateProfilePicture(uploadResult.file_id);
                localStorage.setItem('profilePicID', uploadResult.file_id);
            }
            
            if (data.email) await window.apiService.updateEmail(data.email);
            if (data.username) await window.apiService.updateUsername(data.username);
            
            if (data.newPassword && data.oldPassword) {
                await window.apiService.updatePassword(data.oldPassword, data.newPassword);
            }

            window.dispatchEvent(new CustomEvent('codium:profile-updated', {
                detail: {
                    username: data.username || localStorage.getItem('username'),
                    email: data.email || localStorage.getItem('userEmail'),
                    profilePicID: localStorage.getItem('profilePicID')
                }
            }));

            // everything succeededed yay!!!
            return { success: true };
        }
    };

}

/* USAGE: */