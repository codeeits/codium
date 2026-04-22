document.addEventListener('DOMContentLoaded', () => {
    const bookmarkButton = document.querySelector('.section-bookmark');
    const startButton = document.querySelector('.section-start-btn');
    const groups = Array.from(document.querySelectorAll('.resumee-group'));
    const summaryItems = Array.from(document.querySelectorAll('.resumee-element__element'));

    const progressValue = document.getElementById('stat-progress-value');
    const completedValue = document.getElementById('stat-completed-value');
    const progressingValue = document.getElementById('stat-progressing-value');
    const pendingValue = document.getElementById('stat-pending-value');
    const progressFill = document.getElementById('stats-progress-fill');
    const statsHint = document.getElementById('stats-hint');
    const progressbar = document.querySelector('.stats-progress');

    const storageKey = 'section-starter-bookmark';

    function iconForStatus(status) {
        switch (status) {
            case 'done':
                return { classes: 'fa-solid fa-check', label: 'Finalizat' };
            case 'progress':
                return { classes: 'fa-solid fa-hourglass-half', label: 'In desfasurare' };
            default:
                return { classes: 'fa-regular fa-circle', label: 'Neinceput' };
        }
    }

    function inferStatus(item) {
        const icon = item.querySelector('i');
        if (!icon) {
            return 'pending';
        }

        if (icon.classList.contains('fa-check')) {
            return 'done';
        }

        if (icon.classList.contains('fa-hourglass-half')) {
            return 'progress';
        }

        return 'pending';
    }

    function applyStatus(item, status) {
        let icon = item.querySelector('i');

        if (!icon) {
            icon = document.createElement('i');
            icon.setAttribute('aria-hidden', 'false');
            item.appendChild(icon);
        }

        const iconMeta = iconForStatus(status);
        icon.className = iconMeta.classes;
        icon.setAttribute('aria-label', iconMeta.label);
        item.dataset.status = status;
    }

    function nextStatus(status) {
        if (status === 'pending') {
            return 'progress';
        }

        if (status === 'progress') {
            return 'done';
        }

        return 'pending';
    }

    function updateStats() {
        let done = 0;
        let progress = 0;
        let pending = 0;

        summaryItems.forEach((item) => {
            const status = item.dataset.status || inferStatus(item);

            if (status === 'done') {
                done += 1;
                return;
            }

            if (status === 'progress') {
                progress += 1;
                return;
            }

            pending += 1;
        });

        const total = summaryItems.length || 1;
        const percentage = Math.round(((done + progress * 0.5) / total) * 100);

        if (progressValue) {
            progressValue.textContent = `${percentage}%`;
        }

        if (completedValue) {
            completedValue.textContent = String(done);
        }

        if (progressingValue) {
            progressingValue.textContent = String(progress);
        }

        if (pendingValue) {
            pendingValue.textContent = String(pending);
        }

        if (progressFill) {
            progressFill.style.width = `${percentage}%`;
        }

        if (progressbar) {
            progressbar.setAttribute('aria-valuenow', String(percentage));
        }

        if (statsHint) {
            if (pending === 0 && progress === 0) {
                statsHint.textContent = 'Sectiunea este complet finalizata. Excelent!';
            } else if (pending === 0) {
                statsHint.textContent = 'Ai finalizat aproape tot. Mai ramane sa inchei ce este in desfasurare.';
            } else if (done === 0 && progress === 0) {
                statsHint.textContent = 'Porneste prima activitate pentru a incepe progresul.';
            } else {
                statsHint.textContent = 'Continua sectiunea pentru a creste progresul.';
            }
        }
    }

    function activateItemWithKeyboard(item) {
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'button');
        item.setAttribute('aria-label', 'Schimba starea elementului');

        item.addEventListener('keydown', (event) => {
            if (event.key !== 'Enter' && event.key !== ' ' && event.key !== 'Spacebar') {
                return;
            }

            event.preventDefault();
            const currentStatus = item.dataset.status || inferStatus(item);
            applyStatus(item, nextStatus(currentStatus));
            updateStats();
        });

        item.addEventListener('click', () => {
            const currentStatus = item.dataset.status || inferStatus(item);
            applyStatus(item, nextStatus(currentStatus));
            updateStats();
        });
    }

    function applyCollapseState(group, isCollapsed) {
        const header = group.querySelector('.resumee-group__header');
        if (!header) {
            return;
        }

        group.classList.toggle('is-collapsed', isCollapsed);
        header.setAttribute('aria-expanded', String(!isCollapsed));
    }

    function setResponsiveGroupDefaults() {
        const mobileView = window.matchMedia('(max-width: 768px)').matches;

        groups.forEach((group, index) => {
            if (mobileView) {
                applyCollapseState(group, index !== 0);
                return;
            }

            applyCollapseState(group, false);
        });
    }

    function initGroups() {
        groups.forEach((group) => {
            const header = group.querySelector('.resumee-group__header');
            if (!header) {
                return;
            }

            header.addEventListener('click', () => {
                const isExpanded = header.getAttribute('aria-expanded') === 'true';
                applyCollapseState(group, isExpanded);
            });
        });

        setResponsiveGroupDefaults();
        window.addEventListener('resize', setResponsiveGroupDefaults);
    }

    function initBookmark() {
        if (!bookmarkButton) {
            return;
        }

        const storedState = localStorage.getItem(storageKey) === 'true';
        bookmarkButton.setAttribute('aria-pressed', String(storedState));

        bookmarkButton.addEventListener('click', () => {
            const current = bookmarkButton.getAttribute('aria-pressed') === 'true';
            const next = !current;
            bookmarkButton.setAttribute('aria-pressed', String(next));
            localStorage.setItem(storageKey, String(next));
        });
    }

    function initStartButton() {
        if (!startButton) {
            return;
        }

        startButton.addEventListener('click', () => {
            const nextTarget = summaryItems.find((item) => {
                const status = item.dataset.status || inferStatus(item);
                return status !== 'done';
            }) || summaryItems[0];

            if (!nextTarget) {
                return;
            }

            nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextTarget.classList.add('is-highlighted');
            nextTarget.focus({ preventScroll: true });
            window.setTimeout(() => nextTarget.classList.remove('is-highlighted'), 900);
        });
    }

    summaryItems.forEach((item) => {
        applyStatus(item, inferStatus(item));
        activateItemWithKeyboard(item);
    });

    updateStats();
    initGroups();
    initBookmark();
    initStartButton();
});
