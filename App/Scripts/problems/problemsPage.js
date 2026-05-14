import { extractCustomBlock } from '/app/Scripts/markdownRenderer.js';
import { getHashtagsFromContent } from '../helper/helper.js';
import { setupDragAndDrop } from './problemPage.js';
import { 
    applyStaggeredAnimation, 
    cascadeEntrance,
    prefersReducedMotion
} from '/app/Scripts/animations/animationUtils.js';

document.addEventListener('DOMContentLoaded', async () => {

    let isAuthenticated = false;
    const debugMode = true;

    document.body.classList.add('is-loading');

    // --- DOM ELEMENTS ---
    const filters = {
        class: document.getElementById('filters-list-left'),
        sortDropdown: document.getElementById('sort-dropdown'),
        diffDropdown: document.getElementById('difficulty-dropdown'),
    };

    const problemsGridContainer = document.getElementById('problems-grid-container');
    const problemsFeedContainer = document.getElementById('problems-feed-container');

    const gridTemplateCard = document.getElementById('grid-template-card');
    const feedTemplateCard = document.getElementById('feed-template-card');
    const noResultsMessage = document.getElementById('noResultsMessage');
    const noResultsM2 = document.getElementById('noResultsMessage2');

    const switchDisplayBtn = document.getElementById('toggle-view-btn');
    const supriseBtn = document.getElementById('surprise-btn');
    const removeSourceBtn = document.getElementById('remove-source');

    const canvas = document.getElementById('confetti-canvas');

    // --- STATE ---
    let problemsData = [];
    let currentFilters = {
        class: 'all',
        sortBy: 'discover',
        difficulty: 'all',
        source: null
    };
    let currentView = 'grid'; // or 'feed'
    let feedScrollInitialized = false;

    function makeElementKeyboardActivatable(element, onActivate, role = 'link') {
        if (!element || typeof onActivate !== 'function') {
            return;
        }

        element.setAttribute('tabindex', '0');
        element.setAttribute('role', role);
        element.style.cursor = 'pointer';

        element.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
                event.preventDefault();
                onActivate(event);
            }
        });

        element.addEventListener('click', onActivate);
    }

    // --- FETCH DATA ---
    async function fetchProblems(classFilter = null, difficultyFilter = null, sourceFilter = null) {
        if (!sourceFilter) {
            try {
                const response = await window.apiService.problems.getProblems(); // no implementation for filtering yet
                if (response) {
                    problemsData = response;
                }
            } catch (error) {
                console.error('Error fetching problems:', error);
                if (debugMode) {
                    problemsData = [
                        { id: 1, problem: { ID: 101, Title: "Eureni", Description: { String: "Problema eurenilor" }, imageUrl: "" }, tag_translation: { class: "9" }, difficulty: "Easy" },
                        { id: 2, problem: { ID: 102, Title: "Arrays", Description: { String: "Lists" }, imageUrl: "" }, tag_translation: { class: "10" }, difficulty: "Medium" },
                        { id: 3, problem: { ID: 103, Title: "Z-Index Guide", Description: { String: "CSS Styles" }, imageUrl: "" }, tag_translation: { class: "10" }, difficulty: "Hard" }
                    ];
                }
            }
        } else {
            try {
                const response = await window.apiService.problems.getProblemsBySource(sourceFilter);
                if (response) {
                    problemsData = response;
                    window.StateEngine.state.problemsIndex.source = sourceFilter; // Update state with the applied source filter
                    document.querySelector('.source-info').classList.remove('hidden');
                }
            } catch (error) {
                console.error('Error fetching problems with source filter:', error);
            }
        }
    }

    function renderProblems() {
        // Clear current items
        const gridCards = problemsGridContainer.querySelectorAll('.content-card:not(#grid-template-card)');
        gridCards.forEach(card => card.remove());

        const feedCards = problemsFeedContainer.querySelectorAll('.main-problem-container:not(#feed-template-card)');
        feedCards.forEach(card2 => card2.remove());

        // 1. FILTER
        let processedData = problemsData.filter(item => {
            if (currentFilters.class !== 'all') {
                const itemClass = String(item.tag_translation?.verification_type ?? '');
                if (itemClass !== String(currentFilters.class)) return false;
            }

            if (currentFilters.difficulty !== 'all') {
                const normalized = normalizeDifficulty(item);
                if (normalized !== currentFilters.difficulty) return false;
            }

            return true;
        });

        if (processedData.length === 0) {
            noResultsMessage.classList.remove('hidden');
            noResultsM2.classList.remove('hidden');
            return;
        } else {
            noResultsMessage.classList.add('hidden');
            noResultsM2.classList.add('hidden');
        }

        // 2. SORT
        processedData.sort((a, b) => {
            // Safety check in case Title is missing
            const titleA = a.problem?.Title || "";
            const titleB = b.problem?.Title || "";

            switch (currentFilters.sortBy) {
                case 'discover':
                    return 0; // No sorting, rely on API order

                case 'alpha':
                    return titleA.localeCompare(titleB);

                case 'random':
                    return Math.random() - 0.5;

                case 'newest':
                    return getProblemDate(b) - getProblemDate(a);

                default:
                    return 0;
            }
        });

        if (processedData.length === 0) return;

        // 3. RENDER
        renderProblemsGrid(processedData);
        renderProblemsFeed(processedData);
    }

    // --- RENDER PROBLEMS (GRID) ---
    function renderProblemsGrid(receivedData) {
        receivedData.forEach(problem => {
            const card = gridTemplateCard.cloneNode(true);
            card.id = `problem-${problem.problem.ID}`;
            card.classList.remove('hidden');
            
            const img = card.querySelector('.content-card-image');
            const seed = encodeURIComponent(problem.problem.ID || 'codium');

            const patternUrl = window.apiService.getPatternUrl(seed, "shapes"); // "Glass" is just a pattern type, can be changed to others if needed

            if (img) img.src = patternUrl;

            const badge = card.querySelector('.problem-class-badge');
            if (badge){
                badge.textContent = `Clasa ${problem.tag_translation.verification_type || "N/A"}`; // we use verification_type as a temporary class indicator until the API provides a proper field
                badge.dataset.i18n = `classe.${problem.tag_translation.verification_type || "N/A"}`;
            }
            const title = card.querySelector('.content-card-title');
            if (title) title.textContent = problem.problem.Title;
            
            const desc = card.querySelector('.content-card-description');
            if (desc && problem.problem.Description) desc.textContent = extractCustomBlock(problem.problem.Description, 'short-desc').match || problem.problem.Description;

            // Optional difficulty text update
            const diffText = card.querySelector('.difficulty-text');
            if(diffText && problem.tag_translation.difficulty >= 0) {
                diffText.dataset.i18n = `difficulty.${normalizeDifficulty(problem)}`;
            }

            const openProblem = () => {
                window.location.href = `/app/Probleme/problem2.html?id=${problem.problem.ID}`;
            };

            makeElementKeyboardActivatable(card, openProblem, 'link');

            if (typeof window.applyTranslations === 'function') {
                window.applyTranslations(card);
            }

            problemsGridContainer.appendChild(card);
        });
    }

    // --- RENDER PROBLEMS (FEED) ---
    function renderProblemsFeed(receivedData) {
        receivedData.forEach(problem => {
            const card = feedTemplateCard.cloneNode(true);
            card.id = `problem-${problem.problem.ID}`;
            card.classList.remove('hidden');
            
            const section = card.querySelector('.feed-card-section-pill');
            if (section){
                section.textContent = ""; // Clear existing content
                const spanI18n = document.createElement('span');
                const textContent = document.createElement('span');

                spanI18n.dataset.i18n = `flags.section`;
                spanI18n.classList.add('no-style');

                textContent.textContent = ` ${problem.tag_translation.section || "N/A"}`;
                textContent.classList.add('no-style');

                section.appendChild(spanI18n);
                section.appendChild(textContent);
            }
            
            const classA = card.querySelector('.feed-card-class-pill');
            if (classA){
                classA.textContent = `Clasa ${problem.tag_translation.verification_type || "N/A"}`;
                classA.dataset.i18n = `classe.${problem.tag_translation.verification_type || "N/A"}`;
            }

            const diffText = card.querySelector('.feed-card-difficulty-pill');
            if(diffText && problem.tag_translation.difficulty>=0) {
                diffText.dataset.i18n = `difficulty.${normalizeDifficulty(problem)}`;
            }
            
            const title = card.querySelector('.feed-card-title');
            if (title) title.textContent = problem.problem.Title;
            
            const desc = card.querySelector('.feed-card-description');
            if (desc) desc.textContent = (extractCustomBlock(problem.problem.Description, 'short-desc', false).match || problem.problem.Description) + ' ';

            const linkToProblem = document.createElement('a');
            linkToProblem.href = `/app/Probleme/problem2.html?id=${problem.problem.ID}`;
            linkToProblem.textContent = "Vezi detalii";
            linkToProblem.className = "see-details link";
            desc.appendChild(linkToProblem);


            const hashtagsContainer = card.querySelector('.feed-card-hashtags');
            //console.log(hashtagsContainer, problem.problem.Source);
            if (hashtagsContainer && problem.problem.Source) {
                //console.log("Extracting hashtags from source:", problem.problem.Source);
                getHashtagsFromContent(problem.problem.Source.String, hashtagsContainer);
            }

            const ioExample = card.querySelector('.example-block');
            if (ioExample) {
                const inputContent = extractCustomBlock(problem.problem.Description, 'input', false).match;
                const outputContent = extractCustomBlock(problem.problem.Description, 'output', false).match;

                if (inputContent) {
                    ioExample.innerHTML = ''; // Clear placeholder text
                    const inputDiv = document.createElement('div');
                    inputDiv.classList.add('example-input');
                    inputDiv.innerHTML = `<p>Intrare:</p><pre><code>${inputContent}</code></pre>`;
                    ioExample.appendChild(inputDiv);
                }

                if (outputContent) {
                    const outputDiv = document.createElement('div');
                    outputDiv.classList.add('example-output');
                    outputDiv.innerHTML = `<p>Ieșire:</p><pre><code>${outputContent}</code></pre>`;
                    ioExample.appendChild(outputDiv);
                }
            }
            // Hook up navigation buttons
            const upBtn = card.querySelector('.right-buttons .fa-chevron-up')?.closest('button');
            const downBtn = card.querySelector('.right-buttons .fa-chevron-down')?.closest('button');
            const fileInput = card.querySelector('.file-input');
            
            if (upBtn) upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scrollToProblem('up');
            });
            
            if (downBtn) downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scrollToProblem('down');
            });

            if (fileInput) {
                const elements = {
                    dropzone: fileInput.closest('.dropzone'),
                    fileInput: fileInput
                };
                function updateFileLabel(files) {
                    const display = elements.dropzone.querySelector('.input-text');
                    if (files.length > 0) {
                        display.textContent = files[0].name;
                    }
                }
                
                setupDragAndDrop(elements, updateFileLabel, () => {
                    handleSubmission(fileInput, problem.problem.ID);
                });
            }

            if (typeof window.applyTranslations === 'function') {
                window.applyTranslations(card);
            }

            problemsFeedContainer.appendChild(card);
        });
        
        // Initialize feed scroll handlers after rendering (only once)
        if (receivedData.length > 0 && !feedScrollInitialized) {
            initFeedScrollHandlers();
            feedScrollInitialized = true;
        }
    }

    async function handleSubmission(inputFile, problemId) {
                if (!isAuthenticated) {
                    toastsLoader.showToast("{{server_events.toasts.you-need-to-be-authenticated-to-do-that}}", "danger");
                    return;
                }
                    
                if (!inputFile || inputFile.files.length === 0) {
                    toastsLoader.showToast("{{server_events.toasts.please-select-a-file}}", "danger");
                    return;
                }

                let code = "";
                const file = inputFile.files[0];

                if (file.size > 5 * 1024 * 1024) {
                    toastsLoader.showToast("{{server_events.toasts.file-too-large}}", "danger");
                    throw new Error('File size exceeds the 5MB limit');
                }

                const fileName = file.name.toLowerCase();
                const fileType = file.type;

                const validExtensions = ['.py', '.cpp', '.cc', '.cxx'];
                const validMimeTypes = ['text/x-python', 'text/x-c++src', 'text/plain'];

                const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
                const hasValidMimeType = validMimeTypes.includes(fileType);

                if (!hasValidExtension) {
                    toastsLoader.showToast("{{server_events.toasts.file-type-not-allowed}}", "danger");
                    throw new Error('Unsupported file type. Only PY and C++ files are allowed.');
                }

                try {
                    code = await file.text();
                    if (!code) throw new Error("File empty");
                } catch (e) {
                    toastsLoader.showToast("{{server_events.toasts.file-reading-error}}", "danger");
                    return;
                }

                if (!problemId) {
                    toastsLoader.showToast("{{server_events.toasts.problem-id-missing}}", "danger");
                    return;
                }

                try {
                    toastsLoader.showToast("{{server_events.toasts.grading-solution}}", "info");

                    const runResult = await window.apiService.problems.runCodeAgainstProblemTests(problemId, code);
                    
                    const solutionData = { code: code, language: 'py' };
                    const solution = await window.apiService.problems.createSolution(problemId, solutionData);
                    
                    const gradedSolution = await window.apiService.problems.updateSolution(solution.ID, 'tests', {
                        given_answers: runResult.given_answers,
                        tests_passed: runResult.score,
                        total_tests: runResult.total
                    });

                    // Extract values directly since extractNullableInt isn't in this file
                    const passed = gradedSolution?.TestsPassed?.Int32 ?? gradedSolution?.TestsPassed ?? runResult.score;
                    const total = gradedSolution?.TotalTests?.Int32 ?? gradedSolution?.TotalTests ?? runResult.total;

                    // Display results via toast
                    const percentage = total > 0 ? (passed / total) * 100 : 0;
                    let scoreClass = "danger";
                    if (percentage === 100) scoreClass = "confirm";
                    else if (percentage >= 50) scoreClass = "warning";

                    toastsLoader.showToast(`{{server_events.toasts.passed-tests}}${passed} / ${total} (${percentage.toFixed(2)}%)`, scoreClass);

                } catch (error) {
                    toastsLoader.showToast("{{server_events.toasts.sending-error}}" + (error.message || "A apărut o eroare la trimitere."), "danger");
                }
            }

    // --- HELPER: GET CLASSES ---
    function getAvailableClasses() {
        const classes = new Set();
        problemsData.forEach(problem => {
            if (problem.tag_translation && problem.tag_translation.verification_type) {
                classes.add(String(problem.tag_translation.verification_type));
            }
        });
        return Array.from(classes).sort((a, b) => parseInt(a) - parseInt(b));
    }

    // --- FILTER BUTTONS LOGIC ---
    function populateClassFilters() {
        const templateBtn = filters.class.querySelector('.template');
        if (!templateBtn) return;

        // Clear container
        filters.class.innerHTML = '';

        const classes = getAvailableClasses();

        // 1. Create "TOATE" Button
        const allBtn = templateBtn.cloneNode(true);
        allBtn.classList.remove('template', 'hidden');
        allBtn.classList.add('anim-stagger'); // Tag for animation
        allBtn.id = ""; 
        allBtn.dataset.class = "all";
        
        applyBtnStyle(allBtn, currentFilters.class === 'all');
        
        allBtn.addEventListener('click', () => {
            currentFilters.class = 'all';
            updateAllButtonStyles();
            renderProblems();
            reAnimateCards();
        });
        filters.class.appendChild(allBtn);

        // 2. Create CLASS Buttons
        classes.forEach(cls => {
            const btn = templateBtn.cloneNode(true);
            btn.classList.remove('template', 'hidden');
            btn.classList.add('anim-stagger');
            btn.id = ""; 
            btn.textContent = `Clasa a ${cls}`;
            if (parseInt(cls) == 67) {
                btn.dataset.i18n = 'classe.67';
            } else if (parseInt(cls) > 12) {
                btn.dataset.i18n = ''; 
                btn.textContent = `Clasa ${cls}`;
            } else {
                btn.dataset.i18n = `classe.${cls}`; 
            }
            btn.dataset.class = String(cls);
            
            applyBtnStyle(btn, currentFilters.class === cls);

            btn.addEventListener('click', () => {
                currentFilters.class = cls;
                updateAllButtonStyles();
                renderProblems();
                reAnimateCards();
            });
            filters.class.appendChild(btn);
        });

        window.applyTranslations(filters.class);
    }

    // Helper to style a single button
    function applyBtnStyle(btn, isActive) {
        if (isActive) {
            btn.classList.add('primary', 'active');
            btn.classList.remove('secondary');
        } else {
            btn.classList.add('secondary');
            btn.classList.remove('primary', 'active');
        }
    }

    function updateAllButtonStyles() {
        const buttons = filters.class.querySelectorAll('button');
        buttons.forEach(btn => {
            const isTarget = btn.dataset.class === currentFilters.class;
            applyBtnStyle(btn, isTarget);
        });
    }

    // --- DROPDOWN LOGIC ---
    function normalizeDifficulty(problem) { // implemented this way to be resilient to any kind of weirdness in the API data
        const raw = problem.tag_translation?.difficulty ?? problem.difficulty;
        if (raw == null) return null;

        if (typeof raw === 'number') {
            if (raw <= 0) return 'unknown';
            if (raw <= 1) return 'easy';
            if (raw <= 2) return 'medium';
            if (raw <= 3) return 'hard';
            if (raw <= 4) return 'competition';
            return 'dark-souls';
        }

        if (typeof raw === 'string') {
            const lowered = raw.toLowerCase();
            if (['easy', 'usor', 'usoare', 'ușoare'].includes(lowered)) return 'easy';
            if (['medium', 'mediu', 'medii'].includes(lowered)) return 'medium';
            if (['hard', 'greu', 'grele'].includes(lowered)) return 'hard';

            const numeric = Number.parseInt(lowered, 10);
            if (!Number.isNaN(numeric)) {
                if (numeric <= 1) return 'easy';
                if (numeric <= 2) return 'medium';
                return 'hard';
            }
        }

        return null;
    }

    function getProblemDate(problem) {
        const rawDate = problem.problem?.CreatedAt?.Time;
        const parsed = rawDate ? new Date(rawDate) : null;
        return parsed && !Number.isNaN(parsed.valueOf()) ? parsed : new Date(0);
    }

    function getDropdownValue(dropdown, fallback) {
        const active = dropdown?.querySelector('.dropdown-item.active');
        if (!active) return fallback;
        return active.dataset.value || active.textContent.trim();
    }

    function initDropdownFilters() {
        if (!filters.sortDropdown && !filters.diffDropdown) return;

        if (filters.sortDropdown) {
            currentFilters.sortBy = getDropdownValue(filters.sortDropdown, currentFilters.sortBy);
            filters.sortDropdown.addEventListener('dropdown-selected', (event) => {
                currentFilters.sortBy = event.detail.value;
                renderProblems();
                reAnimateCards();
            });
        }

        if (filters.diffDropdown) {
            currentFilters.difficulty = getDropdownValue(filters.diffDropdown, currentFilters.difficulty);
            filters.diffDropdown.addEventListener('dropdown-selected', (event) => {
                currentFilters.difficulty = event.detail.value;
                renderProblems();
                reAnimateCards();
            });
        }
    }

    function initSurpriseButton() {
        if (!supriseBtn) return;

        const ctx = canvas.getContext('2d');
        let particles = [];

        function resizeCanvas() {
            canvas.width = window.innerWidth;
            canvas.height = window.innerHeight;
        }

        window.addEventListener('resize', resizeCanvas);
        resizeCanvas();

        const bodyStyle = window.getComputedStyle(document.body);

        const colors = [
            bodyStyle.getPropertyValue('--primary').trim(),
            bodyStyle.getPropertyValue('--border2-solid').trim(),
            bodyStyle.getPropertyValue('--danger').trim(),
            bodyStyle.getPropertyValue('--confirm').trim(),
            bodyStyle.getPropertyValue('--warning').trim(),
            bodyStyle.getPropertyValue('--fundal').trim()
        ];
        
        class Particle {
            constructor(x, y, color) {
                this.x = x;
                this.y = y;
                this.color = color;
                
                this.size = Math.random() * 5 + 5;
                
                const angle = Math.random() * Math.PI * 2;
                const speed = Math.random() * 10 + 2; 
                this.speedX = Math.cos(angle) * speed;
                this.speedY = Math.sin(angle) * speed;

                this.gravity = 0.2; 
                this.friction = 0.96;
                this.rotation = Math.random() * 360;
                this.rotationSpeed = (Math.random() - 0.5) * 10;
                this.opacity = 1;
                this.decay = Math.random() * 0.015 + 0.005;
            }

            update() {
                this.speedY += this.gravity;
                this.speedX *= this.friction;
                this.speedY *= this.friction;
                
                this.x += this.speedX;
                this.y += this.speedY;
                
                this.rotation += this.rotationSpeed;
                this.opacity -= this.decay;
            }

            draw() {
                ctx.save();
                ctx.translate(this.x, this.y);
                ctx.rotate((this.rotation * Math.PI) / 180);
                ctx.globalAlpha = this.opacity;
                ctx.fillStyle = this.color;
                ctx.fillRect(-this.size / 2, -this.size / 2, this.size, this.size);
                ctx.restore();
            }
        }

        function animate() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            for (let i = 0; i < particles.length; i++) {
                particles[i].update();
                particles[i].draw();

                if (particles[i].opacity <= 0) {
                    particles.splice(i, 1);
                    i--;
                }
            }

            if (particles.length > 0) {
                requestAnimationFrame(animate);
            }
        }

        function triggerConfetti(x, y, customColor) {
            for (let i = 0; i < 100; i++) {
                const color = customColor || colors[Math.floor(Math.random() * colors.length)];
                particles.push(new Particle(x, y, color));
            }
            if (particles.length <= 100) { 
                animate();
            }
        }

        supriseBtn.addEventListener('click', (e) => {
            const rect = supriseBtn.getBoundingClientRect();
            const x = rect.left + rect.width / 2;
            const y = rect.top + rect.height / 2;
            triggerConfetti(x, y);

            if (problemsData.length === 0) return;
            const randomIndex = Math.floor(Math.random() * problemsData.length);
            const randomProblem = problemsData[randomIndex];
            
            setTimeout(() => {
                window.location.href = `/app/Probleme/problem2.html?id=${randomProblem.problem.ID}`;
            }, 500);
        });
    }

    // --- FEED SCROLL MECHANICS ---
    function scrollToProblem(direction) {
        const containers = Array.from(problemsFeedContainer.querySelectorAll('.main-problem-container:not(.hidden)'));
        if (containers.length === 0) return;

        // Find currently visible container
        const containerHeight = problemsFeedContainer.clientHeight;
        const scrollTop = problemsFeedContainer.scrollTop;
        
        let currentIndex = 0;
        for (let i = 0; i < containers.length; i++) {
            const offsetTop = containers[i].offsetTop - problemsFeedContainer.offsetTop;
            if (Math.abs(scrollTop - offsetTop) < containerHeight / 2) {
                currentIndex = i;
                break;
            }
        }

        let targetIndex = currentIndex;
        if (direction === 'down') {
            targetIndex = Math.min(currentIndex + 1, containers.length - 1);
        } else if (direction === 'up') {
            targetIndex = Math.max(currentIndex - 1, 0);
        }

        if (targetIndex !== currentIndex) {
            containers[targetIndex].scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }

    function initFeedScrollHandlers() {
        if (!problemsFeedContainer) return;

        // Keyboard shortcuts for navigation
        document.addEventListener('keydown', (e) => {
            // Only handle if feed is visible
            if (problemsFeedContainer.hidden) return;
            
            if (e.key === 'ArrowDown' || e.key === 'PageDown') {
                e.preventDefault();
                scrollToProblem('down');
            } else if (e.key === 'ArrowUp' || e.key === 'PageUp') {
                e.preventDefault();
                scrollToProblem('up');
            }
        });
    }

    const toggleViewBtn = document.getElementById('toggle-view-btn');
    const gridContainer = document.querySelector('.problems-grid-container');
    const feedContainer = document.querySelector('.problems-feed-container');
    const toggleBtnText = toggleViewBtn.querySelector('span');
    const toggleBtnIcon = toggleViewBtn.querySelector('i');

    let isFeedMode = false; // don't start in feed mode

    function applyDisplayMode(feedMode) {
        if (feedMode) {
            gridContainer.hidden = true;
            feedContainer.hidden = false;
            toggleBtnText.dataset.i18n = 'problems-page.disable-feed-mode';
            toggleBtnIcon.className = 'fa-solid fa-grip';
            toggleViewBtn.className = 'btn secondary danger anim-stagger';
        } else {
            gridContainer.hidden = false;
            feedContainer.hidden = true;
            toggleBtnText.dataset.i18n = 'problems-page.enable-feed-mode';
            toggleBtnIcon.className = 'fa-solid fa-scroll';
            toggleViewBtn.className = 'btn secondary confirm anim-stagger';
        }
        
        if (typeof applyTranslations === 'function') {
            applyTranslations(toggleViewBtn);
        }
    }

    function playAllAnimations() {
        if (prefersReducedMotion()) return;

        const headers = document.querySelectorAll('.content-area h1, .content-area .page-description');
        cascadeEntrance(headers, 'fade', { staggerDelay: 100, baseDelay: 100 });

        const filterElements = document.querySelectorAll('.anim-stagger');
        applyStaggeredAnimation(filterElements, 'scaleIn', { staggerDelay: 40, baseDelay: 250 });

        const gridCardsContainer = document.querySelector('.problems-grid-container');
        if (gridCardsContainer && !gridCardsContainer.hidden) {
            const gridCards = gridCardsContainer.querySelectorAll('.content-card:not(.hidden)');
            cascadeEntrance(gridCards, 'fade', { staggerDelay: 60, baseDelay: 400 });
        }
    }

    function reAnimateCards() {
        if (prefersReducedMotion()) return;
        
        const activeContainer = isFeedMode ? problemsFeedContainer : problemsGridContainer;
        const cardSelector = isFeedMode ? '.main-problem-container:not(#feed-template-card)' : '.content-card:not(#grid-template-card)';
        
        const newCards = activeContainer.querySelectorAll(cardSelector);
        
        newCards.forEach(card => card.style.animation = 'none');
        
        void document.body.offsetHeight; 
        
        cascadeEntrance(newCards, 'fade', { staggerDelay: 40, baseDelay: 50 });
    }

    applyDisplayMode(isFeedMode);

    toggleViewBtn.addEventListener('click', function() {
        isFeedMode = !isFeedMode;
        applyDisplayMode(isFeedMode);
    });

    removeSourceBtn.addEventListener('click', function() {
        const url = new URL(window.location);
        url.searchParams.delete('source');
        window.history.replaceState({}, '', url);
        location.reload();
    })

    // --- INITIALIZATION ---
    async function initApp() {

        try {
            isAuthenticated = await window.apiService.checkAuthentication(false).catch(err => {
                console.error("Authentication check failed:", err);
                return false; // Treat as not authenticated on error
            });

            if (window.StateEngine) {
                window.StateEngine.init({
                    problemsIndex: {
                        source: 'none'
                    }
                })
            }

            // GET '?source=xx' param to pre-filter by source
            const urlParams = new URLSearchParams(window.location.search);
            const sourceFilter = urlParams.get('source');
            if (sourceFilter) {
                currentFilters.source = sourceFilter;
                await fetchProblems(null, null, sourceFilter);
            } else {
                await fetchProblems();
            }

            initDropdownFilters();

            initSurpriseButton();

            populateClassFilters();
            renderProblems();

            window.applyTranslations(document.body);
            await new Promise(resolve => setTimeout(resolve, 50));
            document.body.classList.remove('is-loading');
            playAllAnimations();

        } catch (error) {
            console.error("Error during initialization:", error);
        } finally {
            document.body.classList.remove('is-loading');
        }
    }

    initApp();
});