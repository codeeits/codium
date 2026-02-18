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

    const switchDisplayBtn = document.getElementById('toggle-view-btn');

    // --- STATE ---
    let problemsData = [];
    let currentFilters = {
        class: 'all',
        sortBy: 'discover',
        difficulty: 'all'
    };
    let currentView = 'grid'; // or 'feed'

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

    // --- RENDER PROBLEMS (GRID) ---
    function renderProblems() {
        // Clear current items
        const cards = problemsGridContainer.querySelectorAll('.content-card:not(#grid-template-card)');
        cards.forEach(card => card.remove());

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
            return;
        } else {
            noResultsMessage.classList.add('hidden');
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
        processedData.forEach(problem => {
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
            if (desc) desc.textContent = problem.problem.Description.String;

            // Optional difficulty text update
            const diffText = card.querySelector('.difficulty-text');
            if(diffText && problem.tag_translation.difficulty>=0) diffText.textContent = problem.tag_translation.difficulty;

            card.addEventListener('click', () => {
                window.location.href = `/app/Probleme/problem.html?id=${problem.problem.ID}`;
            });

            problemsGridContainer.appendChild(card);
        });
    }

    // --- FEED STATE ---
    let currentFeedIndex = 0;
    let isAnimating = false;

    // --- HELPER: Get Data (Missing in your code) ---
    function getFilteredData() {
        return problemsData.filter(item => {
            // Class Filter
            if (currentFilters.class !== 'all') {
                const itemClass = String(item.tag_translation?.verification_type ?? '');
                if (itemClass !== String(currentFilters.class)) return false;
            }
            // Difficulty Filter
            if (currentFilters.difficulty !== 'all') {
                const normalized = normalizeDifficulty(item);
                if (normalized !== currentFilters.difficulty) return false;
            }
            return true;
        });
        // You can add sorting here if needed
    }

    // --- RENDER FEED LOGIC ---
    function renderProblemsFeed() {
        const feedData = getFilteredData();
        
        // 1. Handle Empty State
        if (!feedData || feedData.length === 0) {
            // Optional: Show a "No Problems" div
            return;
        }

        // 2. Clamp Index (Safety)
        if (currentFeedIndex >= feedData.length) currentFeedIndex = feedData.length - 1;
        if (currentFeedIndex < 0) currentFeedIndex = 0;

        // 3. Select the 3 Static Containers from DOM
        const aboveContainer = problemsFeedContainer.querySelector('.above-problem-container');
        const mainContainer = problemsFeedContainer.querySelector('.main-problem-container');
        const belowContainer = problemsFeedContainer.querySelector('.bellow-problem-container');

        // 4. Update Content for the Sliding Window
        // PREVIOUS (Index - 1)
        if (currentFeedIndex > 0) {
            updateFeedCardContent(aboveContainer, feedData[currentFeedIndex - 1]);
        } else {
            // Make invisible/empty if no previous
            aboveContainer.style.opacity = '0'; 
        }

        // CURRENT (Index)
        updateFeedCardContent(mainContainer, feedData[currentFeedIndex]);
        mainContainer.style.opacity = '1';

        // NEXT (Index + 1)
        if (currentFeedIndex < feedData.length - 1) {
            updateFeedCardContent(belowContainer, feedData[currentFeedIndex + 1]);
        } else {
            // Make invisible/empty if no next
            belowContainer.style.opacity = '0';
        }
    }

    // --- HELPER: Update Text Inside a Container ---
    // This preserves your HTML structure (buttons, divs) and just swaps text
    function updateFeedCardContent(container, data) {
        if (!container || !data) return;

        // Reset visibility just in case
        container.style.opacity = ''; 

        // Title
        const title = container.querySelector('.feed-card-title');
        if (title) title.textContent = data.problem.Title;

        // Description
        const desc = container.querySelector('.feed-card-description');
        if (desc) desc.textContent = data.problem.Description.String;

        // Badges (Class)
        const classBadge = container.querySelector('.feed-card-class-pill');
        if (classBadge) classBadge.textContent = `Clasa a ${data.tag_translation.verification_type || '?'}`;

        // Badges (Difficulty)
        const diffBadge = container.querySelector('.feed-card-difficulty-pill');
        if (diffBadge) {
            const diff = normalizeDifficulty(data);
            diffBadge.textContent = diff ? diff.toUpperCase() : 'N/A';
            
            // Reset classes and add specific color
            diffBadge.className = 'feed-card-difficulty-pill pill'; 
            if (diff === 'easy') diffBadge.classList.add('success');
            else if (diff === 'medium') diffBadge.classList.add('warning');
            else if (diff === 'hard') diffBadge.classList.add('danger');
        }

        // Disable buttons if at edges
        // Note: Logic handled in navigation, visual disabled state optional here
    }

    // --- NAVIGATION CONTROLLER ---
    function handleFeedNavigation(direction) {
        if (isAnimating) return;
        
        const feedData = getFilteredData();
        const maxIndex = feedData.length - 1;

        // Check Bounds
        if (direction === 'next' && currentFeedIndex >= maxIndex) return;
        if (direction === 'prev' && currentFeedIndex <= 0) return;

        isAnimating = true;

        // 1. Apply CSS Animation Class
        if (direction === 'next') {
            problemsFeedContainer.classList.add('slide-up');
        } else {
            problemsFeedContainer.classList.add('slide-down');
        }

        // 2. Wait for Animation to finish (500ms matches CSS)
        setTimeout(() => {
            // 3. Update Index
            if (direction === 'next') currentFeedIndex++;
            else currentFeedIndex--;

            // 4. Remove Animation Class (Instant Reset)
            problemsFeedContainer.classList.remove('slide-up', 'slide-down');

            // 5. Re-render content (swaps text instantly while DOM is in 'Rest' position)
            renderProblemsFeed();

            isAnimating = false;
        }, 500);
    }

    // --- SETUP LISTENERS ---
    function setupFeedListeners() {
        // Event Delegation: Listen for clicks on the container
        problemsFeedContainer.addEventListener('click', (e) => {
            // Check if clicked element is a button or icon inside a button
            const target = e.target.closest('button');
            if (!target) return;

            // Handle "Down" (Next Problem)
            if (target.querySelector('.fa-chevron-down') || target.classList.contains('fa-chevron-down')) {
                handleFeedNavigation('next');
            }

            // Handle "Up" (Previous Problem)
            if (target.querySelector('.fa-chevron-up') || target.classList.contains('fa-chevron-up')) {
                handleFeedNavigation('prev');
            }
        });
    }

    // --- INITIALIZATION ---
    async function initApp() {
        initDropdownFilters();
        await fetchProblems();
        populateClassFilters();
        
        setupFeedListeners(); // Attach the clicks
        renderProblems(); // Render Grid
        renderProblemsFeed(); // Render Feed (even if hidden initially)
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

    // --- INITIALIZATION ---
    async function initApp() {
        initDropdownFilters();
        await fetchProblems();
        populateClassFilters();
        renderProblems();
    }

    initApp();
});