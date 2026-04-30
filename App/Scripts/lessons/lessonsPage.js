document.addEventListener('DOMContentLoaded', () => {

    const debugMode = true;

    // --- DOM ELEMENTS ---
    const filters = {
        class: document.getElementById('class-filters'),
        sortDropdown: document.getElementById('sort-dropdown'),
    };
    const lessonsContainer = document.getElementById('lessons-container');
    const templateCard = document.getElementById('template-card');

    // --- STATE ---
    let lessonsData = [];
    let sectionStartersData = [];
    let currentFilters = {
        class: 'all',
        sortBy: 'Alfabetic',
        isSectionStarterShown: false
    };

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
    async function fetchLessons(classFilter = null) {
        try {
            const response = await window.apiService.lessons.getLessonsByFlags(classFilter);
            if (response) {
                lessonsData = response;
            }
        } catch (error) {
            console.error('Error fetching lessons:', error);
            if (debugMode) {
                lessonsData = [
                    { id: 1, lesson: { ID: 101, Title: "Intro C++", Description: { String: "Basics" }, imageUrl: "" }, flag_translation: { class: "9" }, difficulty: "Easy" },
                    { id: 2, lesson: { ID: 102, Title: "Arrays", Description: { String: "Lists" }, imageUrl: "" }, flag_translation: { class: "10" }, difficulty: "Medium" },
                    { id: 3, lesson: { ID: 103, Title: "Z-Index Guide", Description: { String: "CSS Styles" }, imageUrl: "" }, flag_translation: { class: "10" }, difficulty: "Hard" }
                ];
            }
        }
    }

    // --- RENDER LESSONS ---
    function renderLessons(typeOfRender = 'full') {
        // Clear current items
        const cards = lessonsContainer.querySelectorAll('.content-card:not(#template-card)');
        cards.forEach(card => card.remove());

        const sourceData = currentFilters.isSectionStarterShown ? sectionStartersData : lessonsData;

        // 1. FILTER
        let processedData = sourceData.filter(item => {
            if (currentFilters.class === 'all') return true;
            const itemClass = String(item.flag_translation?.class ?? '');
            return itemClass === String(currentFilters.class);
        });

        // 2. SORT
        processedData.sort((a, b) => {
            const titleA = a.lesson?.Title || "";
            const titleB = b.lesson?.Title || "";

            switch (currentFilters.sortBy) {
                case 'alphabetical':
                case 'Alfabetic':
                    return titleA.localeCompare(titleB);
                
                case 'newest':
                case 'Cele mai noi':
                    return new Date(b.lesson.CreatedAt.Time) - new Date(a.lesson.CreatedAt.Time); 

                case 'oldest':
                case 'Cele mai vechi':
                    return new Date(a.lesson.CreatedAt.Time) - new Date(b.lesson.CreatedAt.Time);

                case 'difficulty':
                case 'Dificultate':
                    const map = { 'Easy': 1, 'Medium': 2, 'Hard': 3 };
                    const valA = map[a.difficulty] || 0;
                    const valB = map[b.difficulty] || 0;
                    return valA - valB;

                default:
                    return 0;
            }
        });

        if (processedData.length === 0) return;

        // 3. RENDER
        processedData.forEach(lesson => {
            const card = templateCard.cloneNode(true);
            card.id = `lesson-${lesson.lesson.ID}`;
            card.classList.remove('hidden');
            
            const img = card.querySelector('.content-card-image');
            const seed = encodeURIComponent(lesson.lesson.ID || 'codium');

            const patternUrl = window.apiService.getPatternUrl(seed, "shapes"); 

            if (img) img.src = patternUrl;

            if (currentFilters.isSectionStarterShown) {
                card.classList.add('section-starter-card');
            }

            const badge = card.querySelector('.lesson-class-badge');
            if (badge){
                badge.textContent = `Clasa ${lesson.flag_translation.class}`;
                badge.dataset.i18n = `classe.${lesson.flag_translation.class}`;
            }
            
            const title = card.querySelector('.content-card-title');
            if (title) title.textContent = lesson.lesson.Title;
            
            const desc = card.querySelector('.content-card-description');
            if (desc) desc.textContent = lesson.lesson.Description.String;

            const diffText = card.querySelector('.difficulty-text');
            if(diffText && lesson.difficulty){
                diffText.textContent = lesson.difficulty;
                diffText.dataset.i18n = `difficulty.${lesson.difficulty.toLowerCase()}`;
            }

            const openLesson = () => {
                const baseUrl = currentFilters.isSectionStarterShown ? '/app/Lectii/section-starter.html' : '/app/Lectii/lessonindiv.html';
                window.location.href = `${baseUrl}?id=${lesson.lesson.ID}`;
            };

            makeElementKeyboardActivatable(card, openLesson, 'link');

            lessonsContainer.appendChild(card);
        });
    }

    // --- HELPER: GET CLASSES ---
    function getAvailableClasses() {
        const classes = new Set();
        lessonsData.forEach(lesson => {
            if (lesson.flag_translation && lesson.flag_translation.class) {
                classes.add(String(lesson.flag_translation.class));
            }
        });
        return Array.from(classes).sort((a, b) => parseInt(a) - parseInt(b));
    }

    // --- FILTER BUTTONS LOGIC ---
    function populateClassFilters() {
        const templateBtn = filters.class.querySelector('.template');
        if (!templateBtn) return;

        filters.class.innerHTML = '';
        const classes = getAvailableClasses();

        // 1. Create "TOATE" Button
        const allBtn = templateBtn.cloneNode(true);
        allBtn.classList.remove('template', 'hidden');
        allBtn.id = ""; 
        allBtn.textContent = "Toate";
        allBtn.dataset.class = "all";
        
        applyBtnStyle(allBtn, currentFilters.class === 'all');
        
        allBtn.addEventListener('click', async () => {
            currentFilters.class = 'all';
            updateAllButtonStyles();
            
            if (currentFilters.isSectionStarterShown) {
                const response = await window.apiService.lessons.getSectionStarters('all'); 
                if (response) sectionStartersData = response;
            }

            renderLessons();
        });
        filters.class.appendChild(allBtn);

        // 2. Create CLASS Buttons
        classes.forEach(cls => {
            const btn = templateBtn.cloneNode(true);
            btn.classList.remove('template', 'hidden');
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

            btn.addEventListener('click', async () => {
                currentFilters.class = cls;
                updateAllButtonStyles();
                
                if (currentFilters.isSectionStarterShown) {
                    const response = await window.apiService.lessons.getSectionStarters(currentFilters.class);
                    if (response) sectionStartersData = response;
                } 

                renderLessons();
            });
            filters.class.appendChild(btn);
        });
    }

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
    function initDropdown() {
        const dropdown = filters.sortDropdown;
        if (!dropdown) return;

        const activeItem = dropdown.querySelector('.dropdown-item.active');
        if (activeItem) {
            currentFilters.sortBy = activeItem.dataset.value || activeItem.textContent.trim();
        }

        dropdown.addEventListener('dropdown-selected', (event) => {
            const selectedValue = event.detail?.value || event.detail?.element?.textContent?.trim();
            if (!selectedValue) {
                return;
            }

            currentFilters.sortBy = selectedValue;
            renderLessons();
        });
    }

    function initSectionStarterDropdown() {
        const dropdown = document.getElementById('section-starter-dropdown');
        if (!dropdown) return;

        const activeItem = dropdown.querySelector('.dropdown-item.active');
        if (activeItem) {
            currentFilters.isSectionStarterShown = activeItem.dataset.value === 'section-yes';
        }

        dropdown.addEventListener('dropdown-selected', async (event) => {
            const selectedValue = event.detail?.value || event.detail?.element?.textContent?.trim();
            if (!selectedValue) return;

            currentFilters.isSectionStarterShown = (selectedValue === 'section-yes');

            if (currentFilters.isSectionStarterShown) {
                const response = await window.apiService.lessons.getSectionStarters(currentFilters.class);
                if (response) sectionStartersData = response;
            }

            renderLessons();
        });
    }

    // --- INITIALIZATION ---
    async function initApp() {
        initDropdown(); 
        initSectionStarterDropdown();
        await fetchLessons();
        if (currentFilters.isSectionStarterShown) {
            const response = await window.apiService.lessons.getSectionStarters(currentFilters.class);
            if (response) sectionStartersData = response;
        }
        populateClassFilters();
        renderLessons();
    }

    initApp();
});