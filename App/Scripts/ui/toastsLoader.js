export class ToastsLoader {
    constructor() {
        this.toastsContainer = null;
        this.init();
    }

    init() {
        if(document.body) {
            this.createContainer();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                this.createContainer();
            });
        }
    }

    createContainer() {
        if(!this.toastsContainer) {
            this.toastsContainer = document.createElement('div');
            this.toastsContainer.className = 'toast-container';
            document.body.appendChild(this.toastsContainer);
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const validTypes = ['info', 'danger', 'confirm', 'warning'];
        if (!validTypes.includes(type)) {
            console.warn(`Invalid toast type: ${type}. Defaulting to 'info'.`);
            type = 'info';
        }
        if (!message || typeof message !== 'string') {
            console.warn('Invalid toast message');
            return;
        }
        if (!this.toastsContainer) {
            console.warn('Toasts container not ready yet');
            return;
        }
        if (duration <= 0) {
            duration = 3000;
        }
        
        const toast = document.createElement('div');
        const bodyEl = document.createElement('p');
        const iconEl = document.createElement('i');
        bodyEl.textContent = message;
        toast.appendChild(bodyEl);

        toast.className = `card-t toast toast-${type}`;

        const iconMap = {
            info: 'fas fa-info-circle',
            danger: 'fas fa-exclamation-triangle',
            confirm: 'fas fa-check-circle',
            warning: 'fas fa-exclamation-circle'
        };

        iconEl.className = iconMap[type];
        toast.appendChild(iconEl);

        this.toastsContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');

            const removeToast = () => {
                toast.remove();
            };

            toast.addEventListener('animationend', removeToast, { once: true });

            setTimeout(removeToast, duration + 500);
        }, duration);
        //toast.remove(); --- IGNORE ---
    }
}