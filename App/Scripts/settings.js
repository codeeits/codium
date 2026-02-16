/*
Settings page
*/

document.addEventListener("DOMContentLoaded", () => {

    const elements = {
        // profile card
        profileCard: document.getElementById('profileCard'),
        profileAvatar: document.querySelector('.profile-avatar'),
        profileName: document.querySelector('.profile-details h2'),
        profileEmail: document.querySelector('.profile-details p'),

        // profile card buttons
        editProfileBtn: document.getElementById('editProfileBtn'),
        logoutBtn: document.getElementById('logoutBtn'),

        // privacy card
        privacyCard: document.getElementById('privacyCard'),
        profileVisibilityToggle: document.getElementById('profile-visibility'),
        requestDataBtn: document.getElementById('requestDataBtn'),

        // appearance card
        appearanceCard: document.getElementById('appearanceCard'),
        darkModeToggle: document.getElementById('dark-mode'), // can't be changed lol
        fontSizeSelect: document.getElementById('font-size-options'),
        colorblindModeToggle: document.getElementById('colorblind-mode'),
        highContrastModeToggle: document.getElementById('contrast-mode'),
        hueSlider: document.getElementById('hue-slider'),

        // other settings
        otherSettingsCard: document.getElementById('otherStuffCard'),
        languageSelect: document.getElementById('language-selector-dropdown'),
        supportBtn: document.getElementById('support-form'),
    };

    // -- STATE --

    let userData = null;
    let languages = [];
    let easterEggClickCount = 0; // Added for Romenglez logic

    // -- FETCH DATA --

    async function fetchUserData(user = null) {

        try {
            const response = await window.apiService.getCurrentUser();
            if (response) {
                userData = response;
                if (userData.ProfilePicID) {
                    try {
                        const imgUrl = await window.apiService.getFileUrl(userData.ProfilePicID);
                        userData.profilePicUrl = imgUrl;
                    } catch (error) {
                        console.error('Error fetching profile picture URL:', error);
                        userData.profilePicUrl = 'https://placehold.co/80/png'; // fallback image
                    }
                }
                console.log('User data fetched successfully:', response);
                renderProfileCard();
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
        }

    }

    async function fetchUserPreferences(user = null) {
        try {
            const response = await window.apiService.getUserPreferences(); // not imlemented yet
            if (response) {
                console.log('User preferences fetched successfully:', response);
            }
        } catch (error) {
            console.error('Error fetching user preferences:', error);
        }
    }

    // for language selector
    async function fetchLanguages() {
        try {
            const langsFolder = await fetch('/app/Lang/');
            
            if (!langsFolder.ok) {
                console.warn('Could not list directory. Ensure Directory Indexing is enabled.');
                return;
            }

            const html = await langsFolder.text();
            const parser = new DOMParser();
            const doc = parser.parseFromString(html, 'text/html');
            const links = Array.from(doc.querySelectorAll('a'));

            const languagePromises = links
                .filter(link => link.getAttribute('href').endsWith('.json'))
                .map(async link => {
                    const href = link.getAttribute('href');
                    const isoName = href.replace('.json', ''); 

                    try {
                        const langResponse = await fetch(`/app/Lang/${href}`);
                        if (langResponse.ok) {
                            const langData = await langResponse.json();
                            if (langData.hidden) {
                                console.log(`Skipping hidden language: ${isoName}`);
                                return null;
                            }
                            return {
                                iso: isoName,
                                displayName: langData.language || isoName
                            };
                        }
                    } catch (error) {
                        console.error(`Error processing ${href}:`, error);
                    }
                    return null;
                });

            languages = (await Promise.all(languagePromises)).filter(l => l !== null);
            
            console.log('Available languages:', languages);
            
        } catch (err) {
            console.error('Fetch operation failed:', err);
        }
    }

    // -- RENDER UI --

    function renderProfileCard() {
        if (!userData) {
            console.warn('No user data available to render profile card.');
            return;
        }

        elements.profileAvatar.src = userData.profilePicUrl || 'https://placehold.co/80/png';
        elements.profileName.textContent = userData.Username || 'N/A';
        elements.profileEmail.textContent = userData.Email || 'N/A';
    }

    function renderLanguageOptions() {
        const dropdown = elements.languageSelect;
        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const itemsContainer = dropdown.querySelector('.dropdown-menu');

        // render current language
        const currLang = localStorage.getItem('lang') || 'ro';
        const currLangData = languages.find(l => l.iso === currLang);
        if (currLangData) {
            toggleBtn.innerHTML = `${currLangData.displayName} <i class="fa-solid fa-chevron-down"></i>`;
        }
        
        itemsContainer.innerHTML = '';

        languages.forEach(lang => {
            const item = document.createElement('div');
            item.classList.add('dropdown-item');
            item.textContent = lang.displayName;
            item.dataset.iso = lang.iso;

            if(lang.iso === currLang) {
                item.classList.add('active');
            }

            itemsContainer.appendChild(item);
        });
        
        initDropdownItems();
    }

    // --- ACTIONS ---

    function triggerEasterEgg() {
        alert('Felicitări! Ai descoperit limba secretă: Romengleză! Acum poți vorbi ca un adevărat codianist!');
        
        const dropdown = elements.languageSelect;
        const itemsContainer = dropdown.querySelector('.dropdown-menu');
        
        const romengOption = document.createElement('div');
        romengOption.classList.add('dropdown-item');
        romengOption.textContent = 'Romengleză';
        romengOption.dataset.iso = 'roen'; // pseudo iso lmao

        romengOption.addEventListener('click', () => {
            const toggleBtn = dropdown.querySelector('.dropdown-toggle');
            
            toggleBtn.innerHTML = `Romengleză <i class="fa-solid fa-chevron-down"></i>`;
            
            dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
            romengOption.classList.add('active');
            
            dropdown.classList.remove('open');
            console.log('Selected language: Romengleză');
            
            setLanguage('roen'); 
        });

        itemsContainer.appendChild(romengOption);
    }

    function initDropdownItems() {
        const dropdown = elements.languageSelect;
        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const items = dropdown.querySelectorAll('.dropdown-item');

        items.forEach(item => {
            const newItem = item.cloneNode(true);
            item.parentNode.replaceChild(newItem, item);
            
            newItem.addEventListener('click', () => {
                const selectedText = newItem.textContent.trim();
                
                toggleBtn.innerHTML = `${selectedText} <i class="fa-solid fa-chevron-down"></i>`;

                dropdown.querySelectorAll('.dropdown-item').forEach(i => i.classList.remove('active'));
                newItem.classList.add('active');

                dropdown.classList.remove('open');
                console.log('Selected language:', selectedText);

                setLanguage(newItem.dataset.iso);
            });
        });
    }

    function initDropdown() {
        const dropdown = elements.languageSelect;
        if (!dropdown) return;

        const toggleBtn = dropdown.querySelector('.dropdown-toggle');

        toggleBtn.onclick = null;

        toggleBtn.addEventListener('click', (e) => {
            e.stopPropagation(); 
            dropdown.classList.toggle('open');

            // --- EASTER EGG LOGIC START ---
            easterEggClickCount++;
            if (easterEggClickCount === 10) {
                triggerEasterEgg();
                easterEggClickCount = 0; 
            }
            // --- EASTER EGG LOGIC END ---
        });

        initDropdownItems();

        document.addEventListener('click', (e) => {
            if (!dropdown.contains(e.target)) {
                dropdown.classList.remove('open');
            }
        });
    }

    function enableHighContrastMode() {
        // Check localStorage for high contrast mode preference
        if (localStorage.getItem('highContrast') === 'true') {
            document.body.classList.add('high-contrast');
            elements.highContrastModeToggle.checked = true;
        }
        elements.highContrastModeToggle.addEventListener('change', () => {
            if (document.body.classList.contains('colorblind')) {
                document.body.classList.remove('colorblind');
                elements.colorblindModeToggle.checked = false;
                localStorage.setItem('colorblind', 'false');
            }
            highContrastMode(); // external function defined in main.js that toggles the class on body
        });
    }

    function enableColorblindMode() {
        // Check localStorage for colorblind mode preference
        if (localStorage.getItem('colorblind') === 'true') {
            document.body.classList.add('colorblind');
            elements.colorblindModeToggle.checked = true;
        }
        elements.colorblindModeToggle.addEventListener('change', () => {
            console.log('Colorblind mode enabled from localStorage');
            if (document.body.classList.contains('high-contrast')) {
                document.body.classList.remove('high-contrast');
                elements.highContrastModeToggle.checked = false;
                localStorage.setItem('highContrast', 'false');
            }
            colorblindMode(); // external function defined in main.js that toggles the class on body
        });
    }

    function setFontSize() {
        const container = elements.fontSizeSelect; 
        
        const updateUI = (activeId) => {
            const currentButtons = container.querySelectorAll('button');

            currentButtons.forEach(btn => {
                if (btn.id === activeId) {
                    btn.classList.add('primary');
                    btn.classList.remove('secondary');
                } else {
                    btn.classList.remove('primary');
                    btn.classList.add('secondary');
                }

                const span = btn.querySelector('span');
                if (span) {
                    if (btn.id === activeId) {
                        span.classList.add('active');
                    } else {
                        span.classList.remove('active');
                    }
                }
            });
        };

        const defaultSizeId = 'font-size-medium';
        const currentSizeId = localStorage.getItem('fontSize') || defaultSizeId;

        const oldButtons = container.querySelectorAll('button');
        
        oldButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const newSizeId = newBtn.id;
                
                localStorage.setItem('fontSize', newSizeId);
                
                updateUI(newSizeId);
                
                if (window.applyStoredFontSize) {
                    window.applyStoredFontSize();
                }
                
                console.log(`Font size set to: ${newSizeId}`);
            });
        });

        updateUI(currentSizeId);
    }

    function slideHue() {
        const hueValue = elements.hueSlider.value;
        document.documentElement.style.setProperty('--rotation', hueValue);
        localStorage.setItem('hueRotation', hueValue);
    }

    function initHueSlider() {
        const savedHue = localStorage.getItem('hueRotation') || 0;
        elements.hueSlider.value = savedHue;
        document.documentElement.style.setProperty('--rotation', savedHue);

        elements.hueSlider.addEventListener('input', () => {
            slideHue();
        });
    }

    // --- HELPER - for custom event to change selected language in dropdown ---

    window.addEventListener('codium:lang-changed', (e) => {
        console.log('Received language changed event with detail:', e.detail);
        const newLangIso = e.detail.iso;
        const dropdown = elements.languageSelect;
        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
        const items = dropdown.querySelectorAll('.dropdown-item');

        const selectedLangData = languages.find(l => l.iso === newLangIso);
        if (selectedLangData) {
            toggleBtn.innerHTML = `${selectedLangData.displayName} <i class="fa-solid fa-chevron-down"></i>`;

            items.forEach(i => {
                if (i.dataset.iso === newLangIso) {
                    i.classList.add('active');
                } else {
                    i.classList.remove('active');
                }
            });
        } else {
            console.warn(`Language with ISO code ${newLangIso} not found in available languages.`);
        }
    });

    // --- innit mate ---
    async function initApp() {
        window.apiService.isAuthenticated(true);
        try {
            const currentUser = await window.apiService.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            
            await fetchLanguages(); 
            await fetchUserData();
            
            renderLanguageOptions();
            initDropdown(); // Initialize dropdown logic

            initHueSlider(); // Initialize hue slider logic
            enableHighContrastMode();
            enableColorblindMode();
            setFontSize();

        } catch (err) {
            console.error('Failed to get current user:', err);
            window.apiService.logout(false);
        }
    }

    initApp();
});