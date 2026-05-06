/*

*/

document.addEventListener('DOMContentLoaded', () => {

    let state = {
        lessonId: null,
        starterLessonData: null,
        allLessonData: null,
        allProblemData: null,
        interactions: null,
        noLessons: 0,
        noProblems: 0,
        summaryItems: []
    };

    const elements = {

        sectionTitle: document.querySelector('.section-title'),
        sectionDescription: document.querySelector('.section-description'),
        sectionImage: document.querySelector('.section-image'),

        metaNoLessons: document.querySelector('.section-meta-lessons'),
        metaNoProblems: document.querySelector('.section-meta-probleme'),

        bookmarkButton: document.querySelector('.section-bookmark'),
        startButton: document.querySelector('.section-start-btn'),
        groups: Array.from(document.querySelectorAll('.resumee-group')),

        /* */
        //summaryItems: Array.from(document.querySelectorAll('.resumee-element__element')),
        progressValue: document.getElementById('stat-progress-value'),
        completedValue: document.getElementById('stat-completed-value'),
        progressingValue: document.getElementById('stat-progressing-value'),
        pendingValue: document.getElementById('stat-pending-value'),
        /* */

        progressFill: document.getElementById('stats-progress-fill'),
        statsHint: document.getElementById('stats-hint'),
        progressbar: document.querySelector('.stats-progress'),

        storageKey: 'section-starter-bookmark'
    };

    /* FETCH */

    async function getFromURL() {
        const params = new URLSearchParams(window.location.search);
        const lessonId = params.get('id');
        
        if (!lessonId) {
            console.warn('ID-ul lecției nu a fost furnizat în URL.');
            window.location.href = '/app/Lectii/lessons.html';
            return;
        }

        const isSectionStarter = await window.apiService.lessons.isIdSectionStarter(lessonId);
        
        if (!isSectionStarter) {
            console.warn(`ID-ul ${lessonId} nu corespunde unei sectiuni starter valide.`);
            window.location.href = '/app/Lectii/lessonindiv.html?id=' + lessonId;
            return;
        }

        state.lessonId = lessonId;
        state.starterLessonData = await window.apiService.lessons.getLessonById(lessonId);
        state.allLessonData = await window.apiService.lessons.getSectionLessonChain(lessonId);
        state.interactions = await window.apiService.lessons.getInteractionsSection(lessonId);
        state.allProblemData = await window.apiService.problems.getProblemsForSpecificLessonClassAndSectionAndFindAShorterNameForThisMethodOKBYE({
            class: state.starterLessonData.flag_translation.class,
            section: state.starterLessonData.flag_translation.section
        });

        state.noLessons = state.allLessonData.length;
        window.StateEngine.state.noLessons = state.noLessons;

        state.noProblems = state.allProblemData.total;
        window.StateEngine.state.noProblems = state.noProblems;

        console.log(state.allLessonData);

        return {
            id: lessonId,
        };
    }

    function populateUI() {
        if (!state.starterLessonData) {
            return;
        }

        const { Title, Description, ThumbnailID } = state.starterLessonData.lesson;

        if (elements.sectionTitle) {
            elements.sectionTitle.textContent = Title;
        }

        if (elements.sectionDescription) {
            elements.sectionDescription.textContent = Description?.String;
        }

        let image = null;
        if (ThumbnailID) {
            image = window.apiService.files.getFileUrl(ThumbnailID);
        }

        if (elements.sectionImage && image) {
            elements.sectionImage.src = image;
            elements.sectionImage.alt = `Imagine reprezentativă pentru ${Title}`;
        } else if (elements.sectionImage) {
            //elements.sectionImage.style.display = 'none';
        }

        console.warn('Număr probleme în secțiune:', window.StateEngine.state.noProblems);
        if (elements.metaNoProblems && window.StateEngine.state.noProblems === 0) {
            elements.metaNoProblems.style.display = 'none';
            if(elements.metaNoProblems.previousElementSibling) {
                elements.metaNoProblems.previousElementSibling.style.display = 'none';
            }
        }

        populateLessonsSide();
        populateProblemsSide();
    }

    function populateLessonsSide() {
        const temp = document.querySelector('.resumee-element__element');
        const container = temp?.parentElement;
        if (!temp || !container) {
            return;
        }

        const itemsToRemove = container.querySelectorAll('.resumee-element__element');

        itemsToRemove.forEach((item) => { item.remove(); });

        state.allLessonData.forEach((lesson, index) => {
            const clone = temp.cloneNode(true);
            const titleEl = clone.querySelector('span');

            if (titleEl) {
                titleEl.textContent = lesson.lesson.Title;
            }

            clone.dataset.lessonId = lesson.lesson.ID;

            const interaction = state.interactions.find(i => i.LessonID === lesson.lesson.ID);
            const uiStatus = mapParsedStatusToUI(interaction?.ParsedStatus);
            console.log(`Lecția ${lesson.lesson.ID} are statusul ${interaction?.ParsedStatus} mapat la UI ca ${uiStatus}`);
            applyStatus(clone, uiStatus);
            
            setupItemNavigation(clone); 
            
            container.appendChild(clone);
        });

        state.summaryItems = Array.from(container.querySelectorAll('.resumee-element__element'));
    }

    function populateProblemsSide() {
        // Similar to populateLessonsSide but for problems, might combine them later on
        const container = document.querySelector('.resumee-problems');
        const temp = container?.querySelector('.resumee-element__element');

        if (!temp || !container) {
            return;
        }

        const itemsToRemove = container.querySelectorAll('.resumee-element__element');

        itemsToRemove.forEach((item) => { item.remove(); });

        if (state.allProblemData.total !== 0) {
            state.allProblemData.filteredProblems.forEach((problem) => {
            const clone = temp.cloneNode(true);
            const titleEl = clone.querySelector('span');

            if (titleEl) {
                titleEl.textContent = problem.problem.Title;
            }

            clone.dataset.problemId = problem.problem.ID;

            // const interaction = state.problemInteractions.find(i => i.ProblemID === problem.problem.ID);
            // const uiStatus = mapParsedStatusToUI(interaction?.ParsedStatus);
            applyStatus(clone, 'pending'); // No interactions for problems yet, default to pending
            
            setupItemNavigation(clone); // If problems also navigate somewhere
            
            container.appendChild(clone);
        });
        }

    }

    /* */

    function iconForStatus(status) {
        switch (status) {
            case 'done':
                return { classes: 'fa-solid fa-check', label: 'Finalizat' };
            case 'progress':
                return { classes: 'fa-solid fa-hourglass-half', label: 'In desfasurare' };
            default:
                return { classes: 'fa-solid fa-circle', label: 'Neinceput' };
        }
    }

    function mapParsedStatusToUI(parsedStatus) {
        switch (parsedStatus) {
            case 'Completed':
                return 'done';
            case 'In Progress':
                return 'progress';
            case 'Started':
                return 'progress';
            default:
                return 'pending';
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

    function updateStats() {
        let done = 0;
        let progress = 0;
        let pending = 0;

        state.summaryItems.forEach((item) => {
            const status = item.dataset.status || inferStatus(item);

            if (status === 'done') {
                done += 1;
            } else if (status === 'progress') {
                progress += 1;
            } else {
                pending += 1;
            }
        });

        const total = state.summaryItems.length || 1;
        const percentage = Math.round(((done + progress * 0.5) / total) * 100);

        window.StateEngine.state.progressPercentage = percentage;
        window.StateEngine.state.completedValue = done;
        window.StateEngine.state.progressingValue = progress;
        window.StateEngine.state.pendingValue = pending;

        if (elements.progressFill) {
            elements.progressFill.style.width = `${percentage}%`;
        }

        if (elements.progressbar) {
            elements.progressbar.setAttribute('aria-valuenow', String(percentage));
        }

        if (elements.statsHint) {
            if (pending === 0 && progress === 0) {
                elements.statsHint.textContent = 'Sectiunea este complet finalizata. Excelent!';
            } else if (pending === 0) {
                elements.statsHint.textContent = 'Ai finalizat aproape tot. Mai ramane sa inchei ce este in desfasurare.';
            } else if (done === 0 && progress === 0) {
                elements.statsHint.textContent = 'Porneste prima activitate pentru a incepe progresul.';
            } else {
                elements.statsHint.textContent = 'Continua sectiunea pentru a creste progresul.';
            }
        }
    }

    function setupItemNavigation(item) {
        item.setAttribute('tabindex', '0');
        item.setAttribute('role', 'link');
        item.setAttribute('aria-label', 'Deschide pagina lecției');
        item.style.cursor = 'pointer';

        const navigateToLesson = () => {
            const structID = item.dataset.lessonId || item.dataset.problemId;
            if (structID && item.dataset.lessonId) {
                window.location.href = `/app/Lectii/lessonindiv.html?id=${structID}`;
            } else if (structID && item.dataset.problemId) {
                window.location.href = `/app/Probleme/problem2.html?id=${structID}`;
            }
        };

        item.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                navigateToLesson();
            }
        });

        item.addEventListener('click', () => {
            navigateToLesson();
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

        elements.groups.forEach((group, index) => {
            if (mobileView) {
                applyCollapseState(group, index !== 0);
                return;
            }

            applyCollapseState(group, false);
        });
    }

    function initGroups() {
        elements.groups.forEach((group) => {
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
        if (!elements.bookmarkButton) {
            return;
        }

        const updateButtonUI = (isBookmarked) => {
            elements.bookmarkButton.setAttribute('aria-pressed', String(isBookmarked));
            
            if (isBookmarked) {
                elements.bookmarkButton.classList.add('primary');
                elements.bookmarkButton.classList.remove('secondary');
            } else {
                elements.bookmarkButton.classList.add('secondary');
                elements.bookmarkButton.classList.remove('primary');
            }
        };

        let currentState = localStorage.getItem(elements.storageKey) === 'true';
        updateButtonUI(currentState);

        elements.bookmarkButton.addEventListener('click', () => {
            currentState = !currentState; 
            
            localStorage.setItem(elements.storageKey, String(currentState));
            
            updateButtonUI(currentState);
        });
    }

    function initStartButton() {
        if (!elements.startButton) {
            return;
        }

        elements.startButton.addEventListener('click', () => {
            const nextTarget = state.summaryItems.find((item) => {
                const status = item.dataset.status || inferStatus(item);
                return status !== 'done';
            }) || state.summaryItems[0];

            if (!nextTarget) {
                return;
            }

            nextTarget.scrollIntoView({ behavior: 'smooth', block: 'center' });
            nextTarget.classList.add('is-highlighted');
            nextTarget.focus({ preventScroll: true });
            window.setTimeout(() => nextTarget.classList.remove('is-highlighted'), 900);
        });
    }
    
    async function init() {

        if (window.StateEngine) {
            window.StateEngine.init({
                noLessons: 0,
                noProblems: 0,
                progressPercentage: 0,
                completedValue: 0,
                progressingValue: 0,
                pendingValue: 0
            });
        }

        await getFromURL();
        populateUI();
        updateStats();
        initGroups();
        initBookmark();
        initStartButton();
    }
    init();
});
