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

    /* constructor to be removed */
    /*
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

            'danger-confirmation': {
                title: 'Logout Confirmation',
                body: `<p class="modal-message">Are you sure you want to logout?</p>
                        <div class="modal-actions" style="margin-top: var(--gap-lg);">
                            <button type="button" class="btn secondary flex-1" id="modal-cancel-button">Cancel</button>
                            <button type="button" class="btn danger flex-1" id="modal-confirm-button">Logout</button>
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
                            <input class="input-text" type="email" name="email" id="editEmail" placeholder="e-mail" data-i18n-placeholder="modal.edit_profile.email" minlength="3" maxlength="20" autocomplete="email">
                            <i class="fa-solid fa-envelope input-icon"></i>
                        </div>
                    </div>
                    <div class="modal-field">
                        <label for="editUsername" class="input-label" data-i18n="modal.edit_profile.labels.username">Edit username:</label>
                        <div class="text-container input-field">
                            <input class="input-text" type="text" name="username" id="editUsername" placeholder="username" data-i18n-placeholder="modal.edit_profile.username" minlength="3" maxlength="20" autocomplete="off" value="">
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
                            <input class="input-text" type="password" name="newPassword" id="newPassword" placeholder="new password" data-i18n-placeholder="modal.edit_profile.new_password" minlength="6">
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
                footer: '<p class="modal-hint" data-i18n="modal.edit_profile.note">Leave fields empty if you don\'t want to change them.</p>'
            }
        }
    }
    */

    constructor(templateUrl = new URL('./modalTemplates.html', import.meta.url).href) {
        this.templatesDoc = null;
        this.initPromise = this.loadTemplates(templateUrl);
        this.activeModalCleanup = null;
    }

    getFocusableElements(container) {
        if (!container) {
            return [];
        }

        const selector = [
            'a[href]',
            'area[href]',
            'input:not([disabled]):not([type="hidden"])',
            'select:not([disabled])',
            'textarea:not([disabled])',
            'button:not([disabled])',
            '[tabindex]:not([tabindex="-1"])',
            '[contenteditable="true"]'
        ].join(',');

        return Array.from(container.querySelectorAll(selector)).filter((el) => {
            if (!(el instanceof HTMLElement)) {
                return false;
            }

            const hiddenByAttribute = el.hasAttribute('hidden') || el.getAttribute('aria-hidden') === 'true';
            const hiddenByStyle = window.getComputedStyle(el).display === 'none' || window.getComputedStyle(el).visibility === 'hidden';
            const hiddenByLayout = el.getClientRects().length === 0;

            return !hiddenByAttribute && !hiddenByStyle && !hiddenByLayout;
        });
    }

    activateFocusLock(overlay, modalElement, onEscape) {
        const previouslyFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null;

        const siblings = Array.from(document.body.children).filter((el) => el !== overlay);
        const siblingStates = siblings.map((el) => ({
            el,
            hadInertAttr: el.hasAttribute('inert'),
            hadInertValue: 'inert' in el ? !!el.inert : false,
            previousAriaHidden: el.getAttribute('aria-hidden')
        }));

        siblingStates.forEach((state) => {
            state.el.setAttribute('aria-hidden', 'true');
            if ('inert' in state.el) {
                state.el.inert = true;
            }
            state.el.setAttribute('inert', '');
        });

        modalElement.setAttribute('role', 'dialog');
        modalElement.setAttribute('aria-modal', 'true');
        if (!modalElement.hasAttribute('tabindex')) {
            modalElement.setAttribute('tabindex', '-1');
        }

        const focusInitialElement = () => {
            const focusable = this.getFocusableElements(modalElement);
            const autoFocusTarget = modalElement.querySelector('[autofocus]');
            if (autoFocusTarget instanceof HTMLElement) {
                autoFocusTarget.focus();
                return;
            }

            if (focusable.length > 0) {
                focusable[0].focus();
                return;
            }

            modalElement.focus();
        };

        const keydownHandler = (event) => {
            if (event.key === 'Escape') {
                event.preventDefault();
                if (typeof onEscape === 'function') {
                    onEscape();
                }
                return;
            }

            if (event.key !== 'Tab') {
                return;
            }

            const focusable = this.getFocusableElements(modalElement);
            if (focusable.length === 0) {
                event.preventDefault();
                modalElement.focus();
                return;
            }

            const first = focusable[0];
            const last = focusable[focusable.length - 1];
            const active = document.activeElement;
            const activeInsideModal = active instanceof HTMLElement && modalElement.contains(active);

            if (!activeInsideModal) {
                event.preventDefault();
                first.focus();
                return;
            }

            if (event.shiftKey && active === first) {
                event.preventDefault();
                last.focus();
                return;
            }

            if (!event.shiftKey && active === last) {
                event.preventDefault();
                first.focus();
            }
        };

        overlay.addEventListener('keydown', keydownHandler);

        requestAnimationFrame(() => {
            focusInitialElement();
        });

        return () => {
            overlay.removeEventListener('keydown', keydownHandler);

            siblingStates.forEach((state) => {
                if (state.previousAriaHidden === null) {
                    state.el.removeAttribute('aria-hidden');
                } else {
                    state.el.setAttribute('aria-hidden', state.previousAriaHidden);
                }

                if (state.hadInertAttr) {
                    state.el.setAttribute('inert', '');
                } else {
                    state.el.removeAttribute('inert');
                }

                if ('inert' in state.el) {
                    state.el.inert = state.hadInertValue;
                }
            });

            if (previouslyFocused && document.contains(previouslyFocused)) {
                previouslyFocused.focus();
            }
        };
    }

    async loadTemplates(url) {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! Status: ${response.status}`);
            }
            const htmlText = await response.text();

            const parser = new DOMParser();
            this.templatesDoc = parser.parseFromString(htmlText, 'text/html');
        } catch (error) {
            console.error('Failed to load modal templates:', error);
        }
    }

    async openModal(config) {

        let finalConfig = { ...config };

        await this.initPromise;

        if (!this.templatesDoc) {
            console.error('Modal templates not loaded!');
            return;
        }

        /*
        if (config.type && this.templates[config.type]) {
            const template = this.templates[config.type];
            finalConfig.title = config.title || template.title;
            finalConfig.body = config.body || template.body;
            finalConfig.footer = config.footer || template.footer || '';
        }
        */
        
        const overlay = document.createElement('div');
        overlay.className = 'modal-overlay';
        
        const baseTemplate = this.templatesDoc.getElementById('modal-base-template');
        if (!baseTemplate) {
            console.error('Modal base template not found!');
            return;
        }

        const baseContent = baseTemplate.content.cloneNode(true);
        const modalElement = baseContent.querySelector('.modal');

        const titleEl = modalElement.querySelector('.modal-title');
        const iconEl = modalElement.querySelector('.modal-icon');
        const bodyContainer = modalElement.querySelector('.modal-body');
        const footerEl = modalElement.querySelector('.modal-footer');

        titleEl.textContent = finalConfig.title || 'Notice';
        iconEl.classList.add(finalConfig.icon || 'fa-info-circle');

        if (finalConfig.type) {
            
            const specificTemplate = this.templatesDoc.getElementById(`modal-tpl-${finalConfig.type}`);
            if (specificTemplate) {
                const specificContent = specificTemplate.content.cloneNode(true);
                bodyContainer.appendChild(specificContent);
            } else {
                console.warn(`No specific template found for type "${finalConfig.type}".`);
            }
        } else if (finalConfig.body instanceof HTMLElement) {
            bodyContainer.appendChild(finalConfig.body);
        } else if (typeof finalConfig.body === 'string') {
            bodyContainer.innerHTML = finalConfig.body;
        }

        if (finalConfig.footer) {
            footerEl.innerHTML = finalConfig.footer;
        }

        overlay.appendChild(modalElement);

        if (typeof finalConfig.onOpen === 'function') {
            await finalConfig.onOpen(modalElement, overlay);
        }

        /*
        overlay.innerHTML = `
            <div class="modal">
                <div class="modal-header">
                    <i class="modal-icon fa-solid ${finalConfig.icon || 'fa-info-circle'}"></i>
                    <h2 class="modal-title">${finalConfig.title}</h2>
                    <i class="modal-icon fa-solid fa-x close-button" style="cursor:pointer; margin-left: auto;"></i>
                </div>
                <div class="modal-body"></div>
                <div class="modal-footer">${finalConfig.footer}</div>
            </div>
        `;
        */

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('.close-button');
        if (closeBtn) {
            closeBtn.setAttribute('role', 'button');
            closeBtn.setAttribute('tabindex', '0');
            closeBtn.setAttribute('aria-label', 'Close modal');
        }

        if (typeof this.activeModalCleanup === 'function') {
            this.activeModalCleanup();
            this.activeModalCleanup = null;
        }

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                overlay.classList.add('active');
            });
        })

        document.dispatchEvent(new CustomEvent('codium:request-translation', {
            detail: { element: overlay }
        }));

        // Handle Cleanup
        let destroyed = false;
        const destroyModal = () => {
            if (destroyed) {
                return;
            }
            destroyed = true;

            if (typeof this.activeModalCleanup === 'function') {
                this.activeModalCleanup();
                this.activeModalCleanup = null;
            }

            overlay.classList.remove('active');

            overlay.addEventListener('transitionend', function handler(e) {
                if (e.target === overlay) {
                    overlay.removeEventListener('transitionend', handler);
                    if (document.body.contains(overlay)) {
                        document.body.removeChild(overlay);
                    }
                }
            });

            // if (finalConfig.onCancel) finalConfig.onCancel();
        };

        this.activeModalCleanup = this.activateFocusLock(overlay, modalElement, () => {
            if (finalConfig.onCancel) {
                finalConfig.onCancel();
            }
            destroyModal();
        });

        overlay.querySelector('.close-button').addEventListener('click', () => {
            if (finalConfig.onCancel) finalConfig.onCancel();
            destroyModal();
        });

        overlay.querySelector('.close-button').addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                if (finalConfig.onCancel) finalConfig.onCancel();
                destroyModal();
            }
        });

        // handle click outside modal to close
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) {
                if (finalConfig.onCancel) finalConfig.onCancel();
                destroyModal();
            }
        });

        const confirmBtn = overlay.querySelector('#modal-confirm-button');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                if (finalConfig.onConfirm) finalConfig.onConfirm(modalElement);
                destroyModal();
            });
        }

        const cancelBtn = overlay.querySelector('#modal-cancel-button');
        if (cancelBtn) {
            cancelBtn.addEventListener('click', () => {
                if (finalConfig.onCancel) finalConfig.onCancel();
                destroyModal();
            });
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