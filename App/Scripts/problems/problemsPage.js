import { extractCustomBlock } from '../markdownRenderer.js';
import { getHashtagsFromContent } from '../helper/helper.js';

document.addEventListener('DOMContentLoaded', () => {

    const debugMode = true;

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

    const canvas = document.getElementById('confetti-canvas');

    // --- STATE ---
    let problemsData = [];
    let currentFilters = {
        class: 'all',
        sortBy: 'discover',
        difficulty: 'all'
    };
    let currentView = 'grid'; // or 'feed'
    let feedScrollInitialized = false;

    // --- FETCH DATA ---
    async function fetchProblems(classFilter = null, difficultyFilter = null) {
        try {
            const response = await window.apiService.getProblems(); // no implementation for filtering yet
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
            if (badge) badge.textContent = `Clasa ${problem.tag_translation.verification_type || "N/A"}`; // we use verification_type as a temporary class indicator until the API provides a proper field
            
            const title = card.querySelector('.content-card-title');
            if (title) title.textContent = problem.problem.Title;
            
            const desc = card.querySelector('.content-card-description');
            if (desc && problem.problem.Description) desc.textContent = extractCustomBlock(problem.problem.Description, 'short-desc').match || problem.problem.Description;

            // Optional difficulty text update
            const diffText = card.querySelector('.difficulty-text');
            if(diffText && problem.tag_translation.difficulty>=0) diffText.textContent = problem.tag_translation.difficulty;

            card.addEventListener('click', () => {
                window.location.href = `/app/Probleme/problem2.html?id=${problem.problem.ID}`;
            });

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
            if (section) section.textContent = `Secțiunea ${problem.tag_translation.section || "N/A"}`;
            
            const classA = card.querySelector('.feed-card-class-pill');
            if (classA) classA.textContent = `Clasa ${problem.tag_translation.verification_type || "N/A"}`;

            const diffText = card.querySelector('.feed-card-difficulty-pill');
            if(diffText && problem.tag_translation.difficulty>=0) diffText.textContent = problem.tag_translation.difficulty;
            
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
            console.log(hashtagsContainer, problem.problem.Source);
            if (hashtagsContainer && problem.problem.Source) {
                console.log("Extracting hashtags from source:", problem.problem.Source);
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
            
            if (upBtn) upBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scrollToProblem('up');
            });
            
            if (downBtn) downBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                scrollToProblem('down');
            });

            problemsFeedContainer.appendChild(card);
        });
        
        // Initialize feed scroll handlers after rendering (only once)
        if (receivedData.length > 0 && !feedScrollInitialized) {
            initFeedScrollHandlers();
            feedScrollInitialized = true;
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
        const templateBtn = document.createElement('button');
        templateBtn.classList.add('btn', 'template', 'hidden');
        if (!templateBtn) return;

        // Clear container
        filters.class.innerHTML = '';

        const classes = getAvailableClasses();

        // 1. Create "TOATE" Button
        const allBtn = templateBtn.cloneNode(true);
        allBtn.classList.remove('template', 'hidden');
        allBtn.id = ""; // Remove ID to avoid duplicates
        allBtn.textContent = "Toate";
        allBtn.dataset.class = "all";
        
        applyBtnStyle(allBtn, currentFilters.class === 'all');
        
        allBtn.addEventListener('click', () => {
            currentFilters.class = 'all';
            updateAllButtonStyles();
            renderProblems();
        });
        filters.class.appendChild(allBtn);

        // 2. Create CLASS Buttons
        classes.forEach(cls => {
            const btn = templateBtn.cloneNode(true);
            btn.classList.remove('template', 'hidden');
            btn.id = ""; 
            btn.textContent = `Clasa a ${cls}`;
            btn.dataset.class = String(cls);
            
            applyBtnStyle(btn, currentFilters.class === cls);

            btn.addEventListener('click', () => {
                currentFilters.class = cls;
                console.log("Selected class filter:", currentFilters.class);
                updateAllButtonStyles();
                renderProblems();
            });
            filters.class.appendChild(btn);
        });
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
            if (raw <= 1) return 'easy';
            if (raw <= 2) return 'medium';
            return 'hard';
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
            });
        }

        if (filters.diffDropdown) {
            currentFilters.difficulty = getDropdownValue(filters.diffDropdown, currentFilters.difficulty);
            filters.diffDropdown.addEventListener('dropdown-selected', (event) => {
                currentFilters.difficulty = event.detail.value;
                renderProblems();
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

    // --- INITIALIZATION ---
    async function initApp() {

        initDropdownFilters();
        await fetchProblems();

        initSurpriseButton();

        populateClassFilters();
        renderProblems();
    }

    initApp();
});