// Solution to automatically generate modals so we don't hardcode them. This is more dynamic and maintainable.
// Assuming we have a modal template in our HTML like this:
/*
<div id="modal-template" class="modal hidden" data-modal-type="">
<div class="modal-content">
<span class="close-button">&times;</span>
<h2 class="modal-title"></h2>
<p class="modal-body"></p>
</div>
</div>

all info should be passed in a structured way, for example:
openModal({
type: 'delete-confirmation',
title: 'Confirm Deletion',
body: 'Are you sure you want to delete this item?',
onConfirm: () => { /* deletion logic here *\/ },
onCancel: () => { /* cancellation logic here *\/ }
});

// eg modal for editing profile info:
openModal({
type: 'edit-profile',
title: 'Edit Profile',
body: `
<form id="edit-profile-form">
<label for="username">Username:</label>
<input type="text" id="username" name="username" value="${currentUsername}">
<label for="email">Email:</label>
<input type="email" id="email" name="email" value="${currentEmail}">
<button type="submit">Save Changes</button>
</form>
`,
onConfirm: () => {
const form = document.getElementById('edit-profile-form');
form.addEventListener('submit', (e) => {
e.preventDefault();
const updatedUsername = form.username.value;
const updatedEmail = form.email.value;
// Logic to save profile changes
});
},
onCancel: () => {
// Logic to handle cancellation if needed
}
});
*/
export class ModalEngine {
    /**
     * @param {Object} config
     * @param {string} config.title - The title of the modal
     * @param {string|HTMLElement} config.body - HTML string or DOM node for the body
     * @param {Function} [config.onConfirm] - Optional callback for form submission
     * @param {Function} [config.onCancel] - Optional callback for closing the modal
     */

    constructor() {
        this.templates = {
            'info': {
                title: 'Information',
                body: `<p class="modal-message">This is an informational modal.</p>
                        <div class="modal-actions" style="margin-top: var(--gap-lg);">
                            <button type="button" class="btn secondary flex-1" id="modal-cancel-button">Cancel</button>
                            <button type="button" class="btn danger flex-1" id="modal-confirm-button">Delete</button>
                        </div>
                `
            },

            'edit-profile': {
                title: 'Edit Profile',
                body: `
                <form action="" id="editProfileForm">
                    <div class="modal-field">
                        <label for="editEmail" class="input-label" data-i18n="modal.edit_profile.labels.email">Edit email:</label>
                        <div class="text-container input-field">
                            <input class="input-text" type="email" name="email" id="editEmail" placeholder="e-mail" data-i18n-placeholder="modal.edit_profile.email" minlength="3" maxlength="20">
                            <i class="fa-solid fa-envelope input-icon"></i>
                        </div>
                    </div>
                    <div class="modal-field">
                        <label for="editUsername" class="input-label" data-i18n="modal.edit_profile.labels.username">Edit username:</label>
                        <div class="text-container input-field">
                            <input class="input-text" type="text" name="username" id="editUsername" placeholder="username" data-i18n-placeholder="modal.edit_profile.username" minlength="3" maxlength="20">
                            <i class="fa-solid fa-signature input-icon"></i>
                        </div>
                    </div>
                    <div class="modal-field">
                        <label for="oldPassword" class="input-label" data-i18n="modal.edit_profile.labels.password">Edit password:</label>
                        <div class="text-container input-field">
                            <input class="input-text" type="password" name="password" id="oldPassword" placeholder="actual password" data-i18n-placeholder="modal.edit_profile.current_password" minlength="6">
                            <i class="fa-solid fa-key input-icon"></i>
                        </div>
                    </div>
                    <div class="modal-field">
                        <div class="text-container input-field">
                            <input class="input-text" type="password" name="confirmPassword" id="newPassword" placeholder="new password" data-i18n-placeholder="modal.edit_profile.new_password" minlength="6">
                            <i class="fa-solid fa-key input-icon"></i>
                        </div>
                    </div>
                    <div class="modal-field">
                        <p class="input-label" data-i18n="modal.edit_profile.labels.image">Upload profile picture:</p>
                        
                        <label for="editProfilePicture" class="dropzone input-field" style="cursor: pointer; display: block;">
                            <input class="input-text" type="file" name="profilePicture" id="editProfilePicture" accept="image/*" hidden>
                            
                            <i class="fa-solid fa-image input-icon"></i>
                            <span style="margin-left: 10px;">Click to select an image</span>
                        </label>
                    </div>
                    <div class="modal-actions" style="margin-top: var(--gap-lg);">
                        <button type="button" class="btn secondary flex-1" id="modal-cancel-button" data-i18n="buttons.cancel">Cancel</button>
                        
                        <button type="submit" class="btn primary flex-1" id="saveEditBtn" data-i18n="buttons.save">Save</button>
                    </div>
                </form>
                `,
                footer: 'Leave fields empty if you don\'t want to change them.'
            }
        }
    }

    openModal(config) {

        let finalConfig = { ...config };

        if (config.type && this.templates[config.type]) {
            const template = this.templates[config.type];
            finalConfig.title = config.title || template.title;
            finalConfig.body = config.body || template.body;
            finalConfig.footer = config.footer || template.footer || '';
        }
        

        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay active'; // overlay styles will be eventuslly handled
        
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <i class="modal-icon fa-solid fa-pencil"></i>
                    <h2 class="modal-title">${finalConfig.title}</h2>
                    <i class="modal-icon fa-solid fa-x close-button" style="cursor:pointer; margin-left: auto;"></i>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer"><p class="modal-hint">${finalConfig.footer}</p></div>
            </div>
        `;

        const bodyContainer = overlay.querySelector('.modal-body');
        if (typeof finalConfig.body === 'string') {
            bodyContainer.innerHTML = finalConfig.body;
        } else if (finalConfig.body instanceof HTMLElement) {
            bodyContainer.appendChild(finalConfig.body);
        }

        if (finalConfig.text) {
            const textElement = overlay.querySelector('#modal-dynamic-text');
            if (textElement) textElement.textContent = finalConfig.text;
        }

        document.body.appendChild(overlay);

        // Handle Cleanup
        const destroyModal = () => {
            if (finalConfig.onCancel) finalConfig.onCancel();
            document.body.removeChild(overlay);
        };

        overlay.querySelector('.close-button').addEventListener('click', destroyModal);

        const confirmBtn = overlay.querySelector('#modal-confirm-button');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (finalConfig.onConfirm) finalConfig.onConfirm();
                destroyModal();
            });
        }

        const cancelBtn = overlay.querySelector('#modal-cancel-button');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', destroyModal);
        }

        const form = overlay.querySelector('form');
        if (form && finalConfig.onConfirm) {
            form.addEventListener('submit', (e) => {
                e.preventDefault();
                finalConfig.onConfirm(form);
                destroyModal(); // if needed
            });
        }
    }
}

// USAGE EXAMPLE
/*

const engine = new ModalEngine();

engine.openModal({
    title: 'Edit Profile',
    body: `
        <form id="edit-profile-form">
            <label>Username: <input type="text" name="username" value="CurrentDevUser"></label><br>
            <label>Email: <input type="email" name="email" value="dev@example.com"></label><br><br>
            <button type="submit">Save Changes</button>
        </form>
    `,
    onConfirm: (formElement) => {
        const updatedUsername = formElement.username.value;
        const updatedEmail = formElement.email.value;
        console.log(`Saving... User: ${updatedUsername}, Email: ${updatedEmail}`); // deploy call after testing
    },
    onCancel: () => {
        console.log('User cancelled the modal.');
    }
});
*/