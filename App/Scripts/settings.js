/*
Settings page
*/

import {textToPDF} from './helper/pdfBuilder.js';

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
        requestDataBtn: document.getElementById('request-data'),

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

    // -- PREFERENCES MANAGEMENT --
    
    const PreferencesManager = {
        storageKey: 'profilePreferences',
        defaults: {
            hueRotation: 0,
            fontSize: 'font-size-medium',
            highContrast: false,
            colorblind: false
        },

        get() {
            try {
                const stored = localStorage.getItem(this.storageKey);
                return stored ? JSON.parse(stored) : { ...this.defaults };
            } catch (error) {
                console.error('Error reading preferences:', error);
                return { ...this.defaults };
            }
        },

        set(preferences) {
            try {
                const current = this.get();
                const updated = { ...current, ...preferences };
                localStorage.setItem(this.storageKey, JSON.stringify(updated));
            } catch (error) {
                console.error('Error saving preferences:', error);
            }
        },

        getProperty(property) {
            return this.get()[property] ?? this.defaults[property];
        },

        setProperty(property, value) {
            const current = this.get();
            current[property] = value;
            this.set(current);
        }
    };

    // -- FETCH DATA --

    async function fetchUserData(user = null) {

        try {
            const response = await window.apiService.getCurrentUser();
            if (response) {
                userData = response;
                const bookmarkResponse = await window.apiService.getBookmarks(userData.ID);
                if (bookmarkResponse) {
                    userData.bookmarks = bookmarkResponse;
                } else {
                    userData.bookmarks = [];
                }
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

        // Render current language visual
        const currLang = localStorage.getItem('lang') || 'ro';
        const currLangData = languages.find(l => l.iso === currLang);
        
        // Note: We don't add listeners here anymore. main.js handles clicks!
        if (currLangData) {
            toggleBtn.innerHTML = `${currLangData.displayName} <i class="fa-solid fa-chevron-down"></i>`;
        }
        
        itemsContainer.innerHTML = '';

        languages.forEach(lang => {
            const item = document.createElement('div');
            item.classList.add('dropdown-item');
            item.textContent = lang.displayName;
            item.dataset.iso = lang.iso; // Critical for the event system
            item.setAttribute('role', 'menuitem');
            item.setAttribute('tabindex', '0');

            if(lang.iso === currLang) {
                item.classList.add('active');
            }

            itemsContainer.appendChild(item);
        });
    }

    // --- ACTIONS ---

    function setupEasterEgg() {
        const dropdown = elements.languageSelect;
        const toggleBtn = dropdown.querySelector('.dropdown-toggle');

        // We simply add a listener. It runs alongside the global toggle logic.
        toggleBtn.addEventListener('click', () => {
            easterEggClickCount++;
            if (easterEggClickCount === 10) {
                triggerEasterEgg();
                easterEggClickCount = 0; 
            }
        });
    }

    function triggerEasterEgg() {
        alert('Felicitări! Ai descoperit limba secretă: Romengleză! Acum poți vorbi ca un adevărat codianist!');
        
        const dropdown = elements.languageSelect;
        const itemsContainer = dropdown.querySelector('.dropdown-menu');
        
        const romengOption = document.createElement('div');
        romengOption.classList.add('dropdown-item');
        romengOption.textContent = 'Romengleză';
        romengOption.dataset.iso = 'roen'; 

        // No click listener needed! main.js will catch the click on this new item.
        itemsContainer.appendChild(romengOption);
    }

    function initDropdownLogic() {
        const dropdown = elements.languageSelect;

        // Listen for the custom event dispatched by main.js
        dropdown.addEventListener('dropdown-selected', (e) => {
            const iso = e.detail.iso;
            console.log('Language Selected via Global Controller:', iso);
            
            // Your specific business logic
            setLanguage(iso);
        });

        setupEasterEgg();
    }

    function enableHighContrastMode() {
        // Check preferences for high contrast mode preference
        if (PreferencesManager.getProperty('highContrast')) {
            document.body.classList.add('high-contrast');
            elements.highContrastModeToggle.checked = true;
        }
        elements.highContrastModeToggle.addEventListener('change', () => {
            if (document.body.classList.contains('colorblind')) {
                document.body.classList.remove('colorblind');
                elements.colorblindModeToggle.checked = false;
                PreferencesManager.setProperty('colorblind', false);
            }
            highContrastMode(); // external function defined in main.js that toggles the class on body
        });
    }

    function enableColorblindMode() {
        // Check preferences for colorblind mode preference
        if (PreferencesManager.getProperty('colorblind')) {
            document.body.classList.add('colorblind');
            elements.colorblindModeToggle.checked = true;
        }
        elements.colorblindModeToggle.addEventListener('change', () => {
            console.log('Colorblind mode enabled from preferences');
            if (document.body.classList.contains('high-contrast')) {
                document.body.classList.remove('high-contrast');
                elements.highContrastModeToggle.checked = false;
                PreferencesManager.setProperty('highContrast', false);
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
        const currentSizeId = PreferencesManager.getProperty('fontSize') || defaultSizeId;

        const oldButtons = container.querySelectorAll('button');
        
        oldButtons.forEach(btn => {
            const newBtn = btn.cloneNode(true);
            btn.parentNode.replaceChild(newBtn, btn);
            
            newBtn.addEventListener('click', () => {
                const newSizeId = newBtn.id;
                
                PreferencesManager.setProperty('fontSize', newSizeId);
                
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
        PreferencesManager.setProperty('hueRotation', hueValue);
    }

    function initHueSlider() {
        const savedHue = PreferencesManager.getProperty('hueRotation') || 0;
        elements.hueSlider.value = savedHue;
        document.documentElement.style.setProperty('--rotation', savedHue);

        elements.hueSlider.addEventListener('input', () => {
            slideHue();
        });
    }

    function requestData() {
        elements.requestDataBtn.addEventListener('click', async () => {
            const prefs = PreferencesManager.get();
            const translatedLogoP = `<p data-i18n="welcome" class="logo-p">Learn/ Code/ Compete/</p>`;
            const contentBody = `
            <h1>User Data Request:</h1>
            <p>Username: ${userData.Username}</p>
            <p>User ID: ${userData.ID}</p>
            <p>Email: ${userData.Email || 'N/A'}</p>
            <p>Email verified: ${userData.EmailValidated ? 'Yes' : 'No'}</p>
            <p>Account created: ${new Date(userData.CreatedAt.Time).toLocaleDateString('ro-RO')}</p>
            <p>Last updated profile: ${new Date(userData.UpdatedAt.Time).toLocaleDateString('ro-RO')}</p>
            <p>Profile picture ID: ${userData.ProfilePicID || 'N/A'}</p>
            <p>Profile picture: <img src="${userData.profilePicUrl || 'https://placehold.co/80/png'}" alt="Profile Picture" width="80" height="80" style="object-fit: cover"></p>
            <h2>Preferences:</h2>
            <ul>
                <li>Colorblind mode: ${prefs.colorblind ? 'Enabled' : 'Disabled'}</li>
                <li>High contrast mode: ${prefs.highContrast ? 'Enabled' : 'Disabled'}</li>
                <li>Font size: ${prefs.fontSize || 'Default'}</li>
                <li>Hue rotation: ${prefs.hueRotation || 0} degrees</li>
                <li>Selected language: ${localStorage.getItem('lang') || 'ro'}</li>
            </ul>
            <h2>Lesson bookmarks:</h2>
            <ul>
            ${userData.bookmarks ? userData.bookmarks.map(b => `<li>Lesson ID: ${b.LessonID}</li>`).join('') : '<li>No bookmarks available.</li>'}\n\n
            </ul>
            `;
            const footerData = `
                <p><span data-i18n="pdf_transl.generated_on"></span> ${new Date().toLocaleString('ro-RO')}</p>
                <i data-i18n="pdf_transl.gdpr_notice">This is a request for all personal data associated with this account, in accordance with GDPR regulations.</i>
            `;
            const response = textToPDF(contentBody, "header", false, footerData, translatedLogoP);
            console.log(response);
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
            initDropdownLogic(); // Replaces initDropdown

            initHueSlider(); 
            enableHighContrastMode();
            enableColorblindMode();
            setFontSize();
            requestData();

        } catch (err) {
            console.error('Failed to get current user:', err);
            window.apiService.logout(false);
        }
    }

    initApp();
});