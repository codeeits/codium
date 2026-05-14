import { 
    applyStaggeredAnimation, 
    cascadeEntrance,
    animateProgress,
    bouncElement,
    prefersReducedMotion
} from '/app/Scripts/animations/animationUtils.js';

document.addEventListener('DOMContentLoaded', () => {

    document.body.classList.add('is-loading');

    let state = {
        lessonId: null,
        starterLessonData: null,
        allLessonData: null,
        allProblemData: null,
        interactions: null,
        noLessons: 0,
        noProblems: 0,
        noTests: 0,
        noCookies: 0,
        summaryItems: []
    };

    const elements = {

        sectionTitle: document.querySelector('.section-title'),
        sectionDescription: document.querySelector('.section-description'),
        sectionImage: document.querySelector('.section-image'),
        sectionBread: document.querySelector('.section-bread'),

        metaNoLessons: document.querySelector('.section-meta-lessons'),
        metaNoProblems: document.querySelector('.section-meta-probleme'),
        metaNoTests: document.querySelector('.section-meta-tests'),
        metaNoCookies: document.querySelector('.section-meta-reward'),

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
        window.StateEngine.state.sectionStarterData.noLessons = state.noLessons;

        state.noProblems = state.allProblemData.total;
        window.StateEngine.state.sectionStarterData.noProblems = state.noProblems;

        state.noTests = 0; // Placeholder, as we don't have tests yet
        window.StateEngine.state.sectionStarterData.noTests = state.noTests;

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

        if (elements.sectionBread) {
            const module = state.starterLessonData.flag_translation.module;
            const className = state.starterLessonData.flag_translation.class;
            elements.sectionBread.textContent = `{{modules.${module}}} / {{classe.${className}}} /`;
            window.applyTranslations(elements.sectionBread);
        }

        if (elements.sectionDescription) {
            elements.sectionDescription.textContent = Description?.String;
        }

        let image = window.apiService.getPatternUrl(state.starterLessonData.lesson.ID);
        if (ThumbnailID) {
            image = window.apiService.files.getFileUrl(ThumbnailID);
        }

        if (elements.sectionImage && image) {
            elements.sectionImage.src = image;
            elements.sectionImage.alt = `Imagine reprezentativă pentru ${Title}`;
        } else if (elements.sectionImage) {
            //elements.sectionImage.style.display = 'none';
        }

        if (elements.metaNoProblems && window.StateEngine.state.sectionStarterData.noProblems === 0) {
            elements.metaNoProblems.style.display = 'none';
            if(elements.metaNoProblems.previousElementSibling) {
                elements.metaNoProblems.previousElementSibling.style.display = 'none';
            }

            const container = document.querySelector('.resumee-problems');
            if (container) {
                container.style.display = 'none';
            }
        }

        if (elements.metaNoTests && window.StateEngine.state.sectionStarterData.noTests === 0) {
            elements.metaNoTests.style.display = 'none';
            if(elements.metaNoTests.previousElementSibling) {
                elements.metaNoTests.previousElementSibling.style.display = 'none';
            }

            const container = document.querySelector('.resumee-teste');
            if (container) {
                container.style.display = 'none';
            }
        }

        if (elements.metaNoCookies && window.StateEngine.state.sectionStarterData.noCookies === 0) {
            elements.metaNoCookies.style.display = 'none';
            if(elements.metaNoCookies.previousElementSibling) {
                elements.metaNoCookies.previousElementSibling.style.display = 'none';
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
                titleEl.textContent = lesson.Title;
            }

            clone.dataset.lessonId = lesson.ID;

            const interaction = state.interactions.find(i => i.LessonID === lesson.ID);
            const uiStatus = mapParsedStatusToUI(interaction?.ParsedStatus);
            console.log(`Lecția ${lesson.ID} are statusul ${interaction?.ParsedStatus} mapat la UI ca ${uiStatus}`);
            applyStatus(clone, uiStatus);
            
            setupItemNavigation(clone); 
            
            container.appendChild(clone);
        });

        state.summaryItems = Array.from(container.querySelectorAll('.resumee-element__element'));

        if (!prefersReducedMotion() && state.summaryItems.length > 0) {
            applyStaggeredAnimation(state.summaryItems, 'fadeInUp', {
                staggerDelay: 40,
                baseDelay: 200
            });
        }
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

                const status = problem.status || 'not attempted';
                const uiStatus = mapParsedStatusToUI(status);
                console.log(`Problema ${problem.problem.ID} are statusul ${status} mapat la UI ca ${uiStatus}`);

                clone.dataset.problemId = problem.problem.ID;

                applyStatus(clone, uiStatus); 
                setupItemNavigation(clone);
                
                container.appendChild(clone);
            });

            const problemItems = Array.from(container.querySelectorAll('.resumee-element__element'));
            if (!prefersReducedMotion() && problemItems.length > 0) {
                applyStaggeredAnimation(problemItems, 'fadeInUp', {
                    staggerDelay: 40,
                    baseDelay: 350 // Adjusted base delay to come after lessons animation
                });
            }
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
            case 'solved':
                return 'done';

            case 'In Progress':
            case 'attempted':
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

        window.StateEngine.state.sectionStarterData.progressPercentage = percentage;
        window.StateEngine.state.sectionStarterData.completedValue = done;
        window.StateEngine.state.sectionStarterData.progressingValue = progress;
        window.StateEngine.state.sectionStarterData.pendingValue = pending;

        if (elements.progressFill) {
            elements.progressFill.style.width = `${percentage}%`;
        }

        if (elements.progressbar) {
            elements.progressbar.setAttribute('aria-valuenow', String(percentage));
        }

        if (elements.statsHint) {
            let tipKey = '';

            if (pending === 0 && progress === 0) {
                tipKey = 'lessons-page.section-starter.stats.tips.tip-1';
            } else if (pending === 0) {
                tipKey = 'lessons-page.section-starter.stats.tips.tip-2';
            } else if (done === 0 && progress === 0) {
                tipKey = 'lessons-page.section-starter.stats.tips.tip-3';
            } else {
                tipKey = 'lessons-page.section-starter.stats.tips.tip-4';
            }

            elements.statsHint.setAttribute('data-i18n', tipKey);

            window.apiService.resolveTranslation(tipKey, elements.statsHint);
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

    async function initBookmark() {
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

        let currentState = false;

        try {
            elements.bookmarkButton.disabled = true;
            currentState = await window.apiService.lessons.getBookmarkStatus(state.lessonId);
            updateButtonUI(currentState);
        } catch (error) {
            console.error("Failed to load initial bookmark status:", error);
        } finally {
            elements.bookmarkButton.disabled = false;
        }

        elements.bookmarkButton.addEventListener('click', async () => {
            try {
                elements.bookmarkButton.disabled = true;
                
                await window.apiService.lessons.modifyBookmark(state.lessonId);
                
                currentState = !currentState; 
                updateButtonUI(currentState);
                
            } catch (error) {
                console.error("Failed to modify bookmark:", error);
            } finally {
                elements.bookmarkButton.disabled = false;
            }
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

            /* lmao why not */
            if (!prefersReducedMotion()) {
                bouncElement(nextTarget, { duration: 'var(--anim-duration-slow)' });
            }

            nextTarget.focus({ preventScroll: true });
            window.setTimeout(() => nextTarget.classList.remove('is-highlighted'), 900);
        });
    }
    
    function setupEntranceAnimations() {
        if (prefersReducedMotion()) return;

        const leftElements = document.querySelectorAll('.left-meta__1 > *, .section-meta, .section-buttons');
        if (leftElements.length > 0) {
            cascadeEntrance(leftElements, 'fade', { staggerDelay: 80, baseDelay: 100 });
        }

        if (elements.sectionImage) {
            elements.sectionImage.style.animation = 'scaleIn var(--anim-duration-slow) var(--anim-ease-out) backwards';
        }

        const sideCards = document.querySelectorAll('.side-content .card');
        if (sideCards.length > 0) {
            cascadeEntrance(sideCards, 'slide', { staggerDelay: 150, baseDelay: 200 });
        }
    }

    async function init() {

        if (window.StateEngine) {
            window.StateEngine.init({
                sectionStarterData: {
                    noLessons: 0,
                    noProblems: 0,
                    noTests: 0, // Placeholder, as we don't have tests yet
                    noCookies: 0, // since it is random, can't be defined
                    progressPercentage: 0,
                    completedValue: 0,
                    progressingValue: 0,
                    pendingValue: 0
                }
            });
        }

        await getFromURL();
        populateUI();
        updateStats();
        initGroups();
        initBookmark();
        initStartButton();

        document.body.classList.remove('is-loading');
        
        setupEntranceAnimations();
    }
    
    init();
});
