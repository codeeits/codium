/*
Settings page
*/

import {textToPDF} from './helper/pdfBuilder.js';
import { ModalEngine } from '/app/Scripts/modal/modalMain.js';
import { ModalHelpers } from '/app/Scripts/modal/modalHelpers.js';

const engine = new ModalEngine();

document.addEventListener("DOMContentLoaded", () => {

    const elements = {
        // profile card
        profileCard: document.getElementById('profileCard'),
        profileAvatar: document.querySelector('.profile-avatar'),
        profileName: document.querySelector('.profile-details h2'),
        profileEmail: document.querySelector('.profile-details p'),

        // profile card buttons
        editProfileBtn: document.getElementById('editProfileBtn'),
        logoutBtn: document.getElementById('logOutBtn'),

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
        uiSelect: document.getElementById('ui-selector-dropdown'),
        supportBtn: document.getElementById('support-form'),
    };

    // -- STATE --

    let userData = null;
    let languages = [];
    let easterEggClickCount = 0; // Added for Romenglez logic

    // -- PREFERENCES MANAGEMENT --
    
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
                                console.log(`Adding hidden parameter: ${isoName}`);
                                return {
                                    iso: isoName,
                                    displayName: langData.language || isoName,
                                    hidden: langData.hidden
                                };
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

        const currLang = localStorage.getItem('lang') || 'ro';
        const currLangData = languages.find(l => l.iso === currLang);

        if (currLangData) {
            toggleBtn.innerHTML = `${currLangData.displayName} <i class="fa-solid fa-chevron-down"></i>`;
        }
        
        itemsContainer.innerHTML = '';

        languages.forEach(lang => {
            if (lang.hidden) {
                console.log(`Skipping hidden language in dropdown: ${lang.iso}`);
                return;
            }
            const item = document.createElement('div');
            item.classList.add('dropdown-item');
            item.textContent = lang.displayName;
            item.dataset.iso = lang.iso;
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

        itemsContainer.appendChild(romengOption);
    }

    function initDropdownLogic() {
        const dropdown = elements.languageSelect;

        dropdown.addEventListener('dropdown-selected', (e) => {
            const iso = e.detail.iso;
            console.log('Language Selected via Global Controller:', iso);
            
            setLanguage(iso);
        });

        setupEasterEgg();
    }

    function enableHighContrastMode() {
        if (PreferencesManager.getProperty('highContrast')) {
            document.body.classList.add('high-contrast');
            elements.highContrastModeToggle.checked = true;
        }
        elements.highContrastModeToggle.addEventListener('change', () => {
            if (document.body.classList.contains('colorblind')) {
                elements.colorblindModeToggle.checked = false;
                document.body.classList.remove('colorblind');
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
                elements.highContrastModeToggle.checked = false;
                document.body.classList.remove('high-contrast');
                PreferencesManager.setProperty('highContrast', false);
            }
            colorblindMode(); // external function defined in main.js that toggles the class on body
        });
    }

    function initUiDropdown() {
        const dropdown = elements.uiSelect;

        let currentVersion = '2.1.0'; // This should ideally come from user preferences or a config file

        dropdown.addEventListener('dropdown-selected', (e) => {
            const selectedVersion = e.detail?.element?.dataset?.version || e.detail?.value;

            if (selectedVersion === '1.0.0') {
                engine.openModal({
                    title: 'Legacy Version Warning',
                    body: `
                        <p class="modal-message">Are you sure you want to switch to UI version 1.0.0? This version is outdated and may have issues.</p>
                        <div class="modal-actions" style="margin-top: var(--gap-lg);">
                            <button type="button" class="btn secondary flex-1" id="modal-cancel-button">Cancel</button>
                            <button type="button" class="btn danger flex-1" id="modal-confirm-button">Switch to 1.0.0</button>
                        </div>
                    `,
                    onConfirm: () => {
                        console.log('UI Version Switched to:', selectedVersion);
                        currentVersion = selectedVersion;
                        
                        toastsLoader.showToast('UI version 1.0.0 is a legacy version that is no longer maintained. It may contain bugs and missing features. Use at your own risk!', 'warning', 5000);
                        toastsLoader.showToast(`Selected UI version: ${selectedVersion}. Not implemented yet.`, 'info', 2500);
                        
                    },
                    onCancel: () => {
                        console.log('User cancelled UI switch.');
                        toastsLoader.showToast('UI switch cancelled. You are still on version ' + currentVersion, 'info', 2500);

                        // Reset dropdown selection to current version
                        const toggleBtn = dropdown.querySelector('.dropdown-toggle');
                        const items = dropdown.querySelectorAll('.dropdown-item');

                        toggleBtn.innerHTML = `${currentVersion} <i class="fa-solid fa-chevron-down"></i>`;

                        items.forEach(i => {
                            if (i.dataset.version === currentVersion) {
                                i.classList.add('active');
                            } else {
                                i.classList.remove('active');
                            }
                        });
                    }
                });
            } else {
                console.log('UI Version Switched to:', selectedVersion);
                currentVersion = selectedVersion;
                
                toastsLoader.showToast(`Selected UI version: ${selectedVersion}. Not implemented yet.`, 'info', 2500);
        }
        });
    }

    function initEditProfileModal() {
        elements.editProfileBtn.addEventListener('click', () => {
            engine.openModal({
                type: 'edit-profile',
                onConfirm: (formElement) => {
                    console.log('Profile edit confirmed');
                    handleProfileEdit(formElement); // function to handle profile edit form submission
                },
                onCancel: () => {
                }
            });

            if (userData) {
                const editEmailInput = document.getElementById('editEmail');
                const editUsernameInput = document.getElementById('editUsername');

                if (editUsernameInput && userData.Username) {
                    editUsernameInput.value = userData.Username;
                }

                if (editEmailInput && userData.Email) {
                    editEmailInput.value = userData.Email;
                }
            }

            const fileInput = document.getElementById('editProfilePicture');
            
            if (fileInput) {
                fileInput.addEventListener('change', (event) => {
                    const file = event.target.files[0];
                    
                    if (file && file.type.startsWith('image/')) {
                        const dropzone = fileInput.closest('.dropzone') || fileInput.parentElement;
                        
                        const icon = dropzone.querySelector('.input-icon');
                        if (icon) icon.style.display = 'none';

                        const oldPreview = dropzone.querySelector('.image-preview');
                        if (oldPreview) oldPreview.remove();

                        const img = document.createElement('img');
                        img.src = URL.createObjectURL(file);
                        img.className = 'image-preview';
                                                
                        dropzone.appendChild(img);
                    }
                });
            }

        });
    }

    function initLogoutButton() {
        elements.logoutBtn.addEventListener('click', () => {
            engine.openModal({
                type: 'danger-confirmation',
                onConfirm: () => {
                    window.apiService.logout();
                },
                onCancel: () => {
                    toastsLoader.showToast('Logout cancelled.', 'info', 2500);
                }
            });
        });
    }

    function handleProfileEdit(formElement) {
        const updatedUsername = formElement.elements['username']?.value || null;
        const updatedEmail = formElement.elements['email']?.value || null;
        const oldPassword = formElement.elements['password']?.value || null;
        const newPassword = formElement.elements['newPassword']?.value || null;
        const profilePictureInput = formElement.elements['profilePicture'];
        const profilePictureFile = profilePictureInput?.files?.[0] || null;

        const updateData = {};

        if (updatedUsername) updateData.username = updatedUsername;
        if (updatedEmail) updateData.email = updatedEmail;
        if (oldPassword) updateData.oldPassword = oldPassword;
        if (newPassword) updateData.newPassword = newPassword;
        if (profilePictureFile) updateData.profilePicture = profilePictureFile;

        console.log('Updating profile with data:', updateData);

        ModalHelpers.EditProfile.updateProfileData(updateData).then(() => {
            toastsLoader.showToast('Profile updated successfully!', 'success', 3000);
            fetchUserData(); // Refresh user data to reflect changes
        }).catch(error => { 
            console.error('Error updating profile:', error);
            toastsLoader.showToast(`Error updating profile: ${error.message}`, 'error', 5000);
        });

    }


    function setFontSize() {
        const container = elements.fontSizeSelect; 
        
        const updateUI = (activeId) => {
            console.log(`Updating font size UI. Active ID: ${activeId}`);
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
            const gdprData = await window.apiService.getUserDataGDPR();

            const fileBlob = new Blob([JSON.stringify(gdprData, null, 2)], { type: 'application/json' });
            const fileUrl = URL.createObjectURL(fileBlob);
            const link = document.createElement('a');
            link.href = fileUrl;
            link.download = `codium_user_data_${gdprData.user.ID}.json`;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            URL.revokeObjectURL(fileUrl);

            const currentLang = localStorage.getItem('lang') || 'ro';

            const translatedLogoP = `<p data-i18n="welcome" class="logo-p">Learn/ Code/ Compete/</p>`;

            const emailVerified = gdprData.user.EmailValidated;
            const emailWarning = !emailVerified ? 
                `<p class="security-warning" data-i18n="pdf_transl.email_unverified_warning">Security Warning: This email address is unverified. Please ensure you download this document securely.</p>` : '';

            const contentBody = `
            <div class="gdpr-document">
                <h1 data-i18n="pdf_transl.user_data_request">User Data Request</h1>

                <div class="privacy-minimization-notice">
                    <h3 data-i18n="pdf_transl.privacy_minimization_title">Data Minimization Principle</h3>
                    <p data-i18n="pdf_transl.privacy_minimization_text">In accordance with the GDPR principle of Data Minimization (Article 5), Codium strictly limits data collection to the essential information required to provide our educational and competitive services. We intentionally do not track IP addresses, browser fingerprints, or financial data.</p>
                </div>

                ${emailWarning}

                <p>A JSON file containing your raw data has been downloaded automatically along with this document.</p>

                <h2 data-i18n="pdf_transl.profile_details">Profile Details:</h2>
                <table class="gdpr-table profile-table">
                    <tbody>
                        <tr>
                            <td>Username:</td>
                            <td>${gdprData.user.Username}</td>
                        </tr>
                        <tr>
                            <td>User ID:</td>
                            <td>${gdprData.user.ID}</td>
                        </tr>
                        <tr>
                            <td>Email:</td>
                            <td>${gdprData.user.Email || 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Email verified:</td>
                            <td>${emailVerified ? 'Yes' : '<span style="color: red; font-weight: bold;">No</span>'}</td>
                        </tr>
                        <tr>
                            <td>Account created:</td>
                            <td>${gdprData.user.CreatedAt?.Time ? new Date(gdprData.user.CreatedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Last updated profile:</td>
                            <td>${gdprData.user.UpdatedAt?.Time ? new Date(gdprData.user.UpdatedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                        </tr>
                        <tr>
                            <td>Profile picture:</td>
                            <td>
                                <img class="profile-picture" src="${userData.profilePicUrl || 'https://placehold.co/80/png'}" alt="Profile Picture" width="80" height="80">
                                <br><small>ID: ${gdprData.user.ProfilePicID || 'N/A'}</small>
                            </td>
                        </tr>
                    </tbody>
                </table>

                <h2 data-i18n="preferences">Preferences:</h2>
                <table class="gdpr-table preferences-table">
                    <tbody>
                        <tr>
                            <td data-i18n="pref_colorblind">Colorblind mode:</td>
                            <td>${prefs.colorblind ? 'Enabled' : 'Disabled'}</td>
                        </tr>
                        <tr>
                            <td data-i18n="pref_high_contrast">High contrast mode:</td>
                            <td>${prefs.highContrast ? 'Enabled' : 'Disabled'}</td>
                        </tr>
                        <tr>
                            <td data-i18n="pref_font_size">Font size:</td>
                            <td>${prefs.fontSize || 'Default'}</td>
                        </tr>
                        <tr>
                            <td data-i18n="pref_hue">Hue rotation:</td>
                            <td>${prefs.hueRotation || 0} degrees</td>
                        </tr>
                        <tr>
                            <td data-i18n="pref_language">Selected language:</td>
                            <td>${currentLang}</td>
                        </tr>
                    </tbody>
                </table>

                <h2 data-i18n="learning_history">Learning history:</h2>
                <p><strong data-i18n="lessons_interacted">Lessons Interacted With:</strong> ${gdprData.users_lessons ? gdprData.users_lessons.length : 0}</p>
                <table class="gdpr-table history-table">
                    <thead>
                        <tr>
                            <th data-i18n="th_id">ID</th>
                            <th data-i18n="th_bookmarked">Bookmarked</th>
                            <th data-i18n="th_started">Started at</th>
                            <th data-i18n="th_completed">Completed at</th>
                            <th data-i18n="th_last_interacted">Last interacted</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gdprData.users_lessons && gdprData.users_lessons.length > 0 ? 
                            gdprData.users_lessons.map(ul => `
                            <tr>
                                <td>${ul.LessonID}</td>
                                <td>${ul.Bookmarked ? 'Yes' : 'No'}</td>
                                <td>${ul.StartedAt?.Time ? new Date(ul.StartedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                                <td>${ul.CompletedAt?.Time ? new Date(ul.CompletedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                                <td>${ul.UpdatedAt?.Time ? new Date(ul.UpdatedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                            </tr>`).join('') 
                            : `<tr><td colspan="5" data-i18n="no_lesson_interactions">No lesson interactions recorded.</td></tr>`}
                    </tbody>
                </table>

                <h2 data-i18n="problems_interacted">Problems interacted with:</h2>
                <p><strong data-i18n="problems_interacted_count">Problems Interacted With:</strong> ${gdprData.users_problems ? gdprData.users_problems.length : 0}</p>
                <table class="gdpr-table history-table">
                    <thead>
                        <tr>
                            <th data-i18n="th_id">ID</th>
                            <th data-i18n="th_bookmarked">Bookmarked</th>
                            <th data-i18n="th_solved">Solved at</th>
                            <th data-i18n="th_last_interacted">Last interacted</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${gdprData.users_problems && gdprData.users_problems.length > 0 ? 
                            gdprData.users_problems.map(up => `
                            <tr>
                                <td>${up.ProblemID}</td>
                                <td>${up.Bookmarked?.Bool ? 'Yes' : 'No'}</td>
                                <td>${up.SolvedAt?.Time ? new Date(up.SolvedAt.Time).toLocaleDateString(currentLang) : 'N/A'}</td>
                                <td>${up.UpdatedAt ? new Date(up.UpdatedAt).toLocaleDateString(currentLang) : 'N/A'}</td>
                            </tr>`).join('') 
                            : `<tr><td colspan="4" data-i18n="no_problem_interactions">No problem interactions recorded.</td></tr>`}
                    </tbody>
                </table>

                <h2 data-i18n="submissions_solutions">Submissions (solutions):</h2>
                <p><strong data-i18n="submissions_made">Submissions made:</strong> ${gdprData.user_solutions ? gdprData.user_solutions.length : 0}</p>
                <table class="gdpr-table submissions-table">
                    ${gdprData.user_solutions && gdprData.user_solutions.length > 0 ? 
                        gdprData.user_solutions.map(us => `
                        <tbody class="submission-entry">
                            <tr>
                                <td colspan="4" style="page-break-inside: avoid; break-inside: avoid;">
                                    <strong>Problem ID:</strong> ${us.ProblemID} | 
                                    <strong>Language:</strong> ${us.Language} | 
                                    <strong>Tests:</strong> ${us.TestsPassed?.Int32 || 0} / ${us.TotalTests?.Int32 || 0} | 
                                    <strong>Submitted:</strong> ${us.CreatedAt?.Time ? new Date(us.CreatedAt.Time).toLocaleDateString(currentLang) : 'N/A'}
                                </td>
                            </tr>
                            <tr>
                                <td colspan="4">
                                    <!--<pre class="code-block" style="margin-top: 5px;"><code>${us.SentCode ? us.SentCode.replace(/</g, '&lt;').replace(/>/g, '&gt;') : ''}</code></pre>-->
                                    <pre class="code-block" style="margin-top: 5px;"><code>code for problem id ${us.ProblemID} is included in the json file, under ${us.ID} solution ID</code></pre>
                                </td>
                            </tr>
                        </tbody>
                        `).join('') 
                        : `<tbody><tr><td colspan="4" data-i18n="no_submissions">No submissions recorded.</td></tr></tbody>`}
                </table>
            </div>
            `;

            const footerData = `
                <div class="gdpr-footer">
                    <p><span data-i18n="pdf_transl.generated_on">Generated on</span> ${new Date().toLocaleString(currentLang, { 
                        weekday: 'long', 
                        year: 'numeric', 
                        month: 'long',
                        day: 'numeric', 
                        hour: '2-digit', 
                        minute: '2-digit',
                        second: '2-digit'
                        })}
                    </p>
                    <i data-i18n="pdf_transl.gdpr_notice">This is a formal request for all personal data associated with this account, issued in accordance with the General Data Protection Regulation (GDPR).</i>
                </div>
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
        if (selectedLangData || (newLangIso === 'roen' && selectedLangData === undefined)) {
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
            initUiDropdown(); // UI version selector logic
            initEditProfileModal(); // Edit profile modal logic
            initLogoutButton(); // Logout button logic

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