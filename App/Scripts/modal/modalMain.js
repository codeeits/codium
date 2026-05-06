export class ModalEngine {
    /**
     * @param {Object} config
     * @param {string} config.title - The title of the modal
     * @param {string|HTMLElement} config.body - HTML string or DOM node for the body
     * @param {Function} [config.onConfirm] - Optional callback for form submission
     * @param {Function} [config.onCancel] - Optional callback for closing the modal
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

        if (titleEl instanceof HTMLElement) {
            modalElement.setAttribute('aria-labelledby', titleEl.id || 'modal-title');
        }

        if (bodyContainer instanceof HTMLElement) {
            modalElement.setAttribute('aria-describedby', bodyContainer.id || 'modal-body');
        }

        titleEl.textContent = finalConfig.title || '{{modal.notice.title}}';
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

        document.body.appendChild(overlay);

        const closeBtn = overlay.querySelector('.close-button');
        if (closeBtn) {
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