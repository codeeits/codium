/*
 __  __    __    _  _    __    ___  ____  __    ____  ___  ___  _____  _  _  ___     ____  ___ 
(  \/  )  /__\  ( \( )  /__\  / __)( ___)(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)   (_  _)/ __)
 )    (  /(__)\  )  (  /(__)\( (_-. )__)  )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \  .-_)(  \__ \
(_/\/\_)(__)(__)(_)\_)(__)(__)\___/(____)(____)(____)(___/(___/(_____)(_)\_)(___/()\____) (___/

tudutudutudutudu rapapapam

Bucovina - Zi Dupa Zi, Noapte De Noapte
*/
document.addEventListener("DOMContentLoaded", async function() {

    const debugMode = true; // SET THIS TO ENABLE LOGS!

    // ------------------------------
    
    const currentUser = await window.apiService.getCurrentUser();

    if (currentUser === null) {
        // Not logged in
        window.location.href = 'login.html';
        return;
    }

    if (!currentUser.IsAdmin) {
        // Logged in but not admin
        window.location.href = 'user.html';
        return;  
    }

    const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
    userId = userData.ID;

    if(debugMode) console.info("[DEBUG] Current User:", userData);

    // ------------------------------
    // DOM ELEMENTS
    // ------------------------------
    
    // Filters
    const classFilter = document.getElementById("lessonClass");
    const moduleFilter = document.getElementById("lessonModule");
    const sectionFilter = document.getElementById("lessonSection");
    classValue = classFilter.value;
    moduleValue = moduleFilter.value;
    sectionValue = sectionFilter.value;

    let newOrder = [];
    let loadLessonsRequestId = 0;

    // ------------------------------

    loadLessons(); // initial load

    // ------------------------------
    // EVENT LISTENERS
    // ------------------------------

    let sections = [];

    sections = await window.apiService.getSections(null, null);
    if(debugMode) console.info("[DEBUG] Available sections:", sections);

    classFilter.addEventListener("change", async function() {
        if (classValue !== this.value) {
            classValue = this.value;
            await populateSections();
        }
    });

    moduleFilter.addEventListener("change", async function() {
        if (moduleValue !== this.value) {
            moduleValue = this.value;
            await populateSections();
        }
    });

    sectionFilter.addEventListener("change", async function() {

        if (sectionValue !== this.value) {
            sectionValue = this.value;
            await loadLessons();
        }

    });

    async function populateSections(){
        if(debugMode) console.log("[DEBUG] Populating sections for class", classValue, "and module", moduleValue);
        if ((!moduleValue || !classValue) || (moduleValue === "" || classValue === "")) {
            return;
        }

        sectionFilter.innerHTML = '<option value="" data-i18n="">toate secțiunile</option>';
        sections.forEach(sectionNum => {
            if(sectionNum.class === parseInt(classValue) && sectionNum.module === parseInt(moduleValue)) {
                const option = document.createElement("option");
                option.value = sectionNum.section;
                option.textContent = "Sectiunea " + sectionNum.section;
                sectionFilter.appendChild(option);
            }
        });
    }

    // Functions load lessons

    async function loadLessons() {

        newOrder = [];

        const currentRequestId = ++loadLessonsRequestId;
        try {
            let response;
            if(classValue && moduleValue && sectionValue) {
                const filterData = {
                    class: parseInt(classValue),
                    module: parseInt(moduleValue),
                    section: parseInt(sectionValue)
                };
                response = await window.apiService.getLessonsSortedByPrevNext(
                    filterData.class,
                    filterData.section,
                    filterData.module,
                    false
                );
            } else {
                // Don't load lessons if not all parameters are provided
                const statusElement = document.getElementById("status-lessons");
                if (statusElement) {
                    statusElement.innerHTML = '[DEBUG] Please select class, module, and section to view lessons.';
                }
                const arrangeLessonsContainer = document.getElementById("arrangeLessonsContainer");
                if (arrangeLessonsContainer) {
                    arrangeLessonsContainer.innerHTML = '<p>Please select all filters to manage lessons.</p>';
                }
                return;
            }

            if (!response) {
                console.error("Failed to load lessons.");
                return;
            }

            if (currentRequestId !== loadLessonsRequestId) {
                console.log('Ignoring stale loadLessons response');
                return;
            }

            const lessons = response;
            console.log("Loaded lessons:", lessons);
            
            if (lessons.length === 0) {
                toastsLoader.showToast('[DEBUG] No lessons found for the selected filters.', 'warning', 1000);
                const statusElement = document.getElementById("status-lessons");
                if (statusElement) {
                    statusElement.innerHTML = '[DEBUG] No lessons found for the selected filters.';
                }
                const arrangeLessonsContainer = document.getElementById("arrangeLessonsContainer");
                if (arrangeLessonsContainer) {
                    arrangeLessonsContainer.innerHTML = '';
                }
                return;
            }
            
            const statusElement = document.getElementById("status-lessons");
            if (statusElement) {
                statusElement.innerHTML = '[DEBUG] Found ' + lessons.length + ' lessons.';
            }
            toastsLoader.showToast(`[DEBUG] Loaded ${lessons.length} lessons.`, 'confirm', 1000);
            
            // Clear existing lessons
            const arrangeLessonsContainer = document.getElementById("arrangeLessonsContainer");
            if (arrangeLessonsContainer) {
                arrangeLessonsContainer.innerHTML = '';
                await renderLessons(lessons);
            }
            } catch (error) {
                if (currentRequestId !== loadLessonsRequestId) return;
                console.error("Failed to load lessons:", error);
        }
    }

    async function renderLessons(lessonsList) {
        try {
            for (const lesson of lessonsList){
                console.log("Rendering lesson:", lesson);
                const currentLessonNameSpan = document.getElementById("current-lesson-name");
                // Create lesson item element
                const lessonItem = document.createElement("div");
                lessonItem.className = "arrange-lesson-item";
                lessonItem.draggable = true;
                lessonItem.dataset.lessonId = lesson.lesson.ID;
                lessonItem.innerHTML = `
                    <span class="lesson-title">${lesson.lesson.Title}</span>
                    <span class="lesson-class">Clasa: ${lesson.flag_translation.class}</span>
                    <span class="lesson-module">Modul: ${lesson.flag_translation.module}</span>
                `;
                lessonItem.addEventListener("dragstart", handleDragStart);
                lessonItem.addEventListener("dragover", handleDragOver);
                lessonItem.addEventListener("drop", handleDrop);
                lessonItem.addEventListener("dragend", handleDragEnd);
                lessonItem.addEventListener("click", handleClick);
                
                // Append to container
                const arrangeLessonsContainer = document.getElementById("arrangeLessonsContainer");
                if (arrangeLessonsContainer) {
                    arrangeLessonsContainer.appendChild(lessonItem);
                }
            }
        } catch (error) {
        }
    }

    let isSavingOrder = false;

    async function updateLessonsOrder(lessonIds) {
        if (!lessonIds || lessonIds.length === 0) {
            console.warn('No lessons to update');
            return;
        }
        
        if (isSavingOrder) {
            console.warn('Save operation already in progress');
            return;
        }
        
        isSavingOrder = true;
        saveOrderBtn.disabled = true;

        try {
            console.log('Updating lessons order:', lessonIds);
            
            // Clear all relationships and remove section starter status
            for (const lessonId of lessonIds) {
                await window.apiService.updateLessonOrder(lessonId, null, "00000000-0000-0000-0000-000000000000");
                await window.apiService.updateLessonSectionStarter(lessonId, false);
            }
            
            const firstLessonId = lessonIds[0];
            await window.apiService.updateLessonSectionStarter(firstLessonId, parseInt(sectionValue));
            
            for (let i = 1; i < lessonIds.length; i++) {
                const currentLessonId = lessonIds[i];
                const prevLessonId = lessonIds[i - 1];
                await window.apiService.updateLessonOrder(currentLessonId, prevLessonId);
                console.log(`Updated lesson ${currentLessonId} to follow ${prevLessonId}`);
            }

            toastsLoader.showToast('Lesson order updated successfully!', 'confirm');
        } catch (error) {
            console.error('Failed to update lessons order:', error);
            toastsLoader.showToast('Failed to update lesson order', 'danger');
        } finally {
            isSavingOrder = false;
            saveOrderBtn.disabled = false;
        }
    };

    // Save Order Button Handler
    
    const saveOrderBtn = document.getElementById("saveOrder");
    if (saveOrderBtn) {
        saveOrderBtn.addEventListener("click", async function() {
            await updateLessonsOrder(newOrder);
        });
    }

    // Drag and Drop Handlers

    let draggedItem = null;
    let currentHighlight = null;

    function handleDragStart(e) {
        draggedItem = this;
        this.style.opacity = '0.5';
    }

    function handleDragOver(e) {
        e.preventDefault();

        if (draggedItem !== this) {
            if (currentHighlight && currentHighlight !== this) {
                currentHighlight.style.border = ''; // remove old highlight
            }

            this.style.border = '2px dashed #000';
            currentHighlight = this;
        }
    }

    function handleDrop(e) {
        e.preventDefault();
        this.style.border = '';
        if (draggedItem !== this) {
            const container = this.parentNode;
            const draggedIndex = Array.from(container.children).indexOf(draggedItem);
            const targetIndex = Array.from(container.children).indexOf(this);

            if (draggedIndex < targetIndex) {
                container.insertBefore(draggedItem, this.nextSibling);
            } else {
                container.insertBefore(draggedItem, this);
            }
            console.log('Dropped item. New order:');
            newOrder = Array.from(container.children).map(item => item.dataset.lessonId);
            console.log(newOrder);
        }
    }

    function handleDragEnd(e) {
        this.style.opacity = '1';
        console.log(newOrder);
        if (currentHighlight) {
            currentHighlight.style.border = '';
            currentHighlight = null;
        }
        draggedItem = null;
    }

    lessonIdClicked = null;
    let previouslyClickedElement = null;

    function handleClick() {
        // Remove border from previously clicked element
        if (previouslyClickedElement && previouslyClickedElement !== this) {
            previouslyClickedElement.style.border = '';
        }
        lessonIdClicked = this.dataset.lessonId;
        previouslyClickedElement = this;
        this.style.border = '2px solid var(--purple-accent)';
        rawButton.classList.add("primary");
        rawButton.classList.remove("secondary");
        mdButton.classList.add("secondary");
        mdButton.classList.remove("primary");
        renderLesson(lessonIdClicked, false, true);
    }

    // preview area

    const previewArea = document.getElementById("lesson-body");
    const rawButton = document.getElementById("rawButton");
    const mdButton = document.getElementById("mdButton");
    const metadataButton = document.getElementById("metadataButton");
    const saveButton = document.getElementById("saveButton");
    let contentData = null;

    let contentDataForLessonId = null;
    let pendingLessonLoad = null;

    async function renderLesson(lessonId, isMarkdown = false, firstCall = false) {
        if (!lessonId) {
            console.warn('No lesson ID provided for rendering');
            return;
        }

        if (firstCall) {
            pendingLessonLoad = lessonId; // mark as loading
            toastsLoader.showToast('Loading lesson preview...', 'info');

            const result = await window.apiService.getLessonById(lessonId);

            if (pendingLessonLoad !== lessonId) {
                console.log('Lesson load superseded by another request');
                return;
            }

            const currentLessonNameSpan = document.getElementById("current-lesson-name");
            const currentLessonIdSpan = document.getElementById("current-lesson-id");
            if (currentLessonIdSpan) {
                currentLessonIdSpan.textContent = lessonId;
            }
            if (currentLessonNameSpan) {
                currentLessonNameSpan.textContent = result.lesson.Title;
            }
            console.log(window.apiService.getFile(result.lesson.ContentID));
            
            window.apiService.getFile(result.lesson.ContentID).then(lessonData => {
                if (lessonIdClicked !== lessonId) {
                    console.warn('Lesson load superseded by another request');
                    return;
                }
                contentData = lessonData;
                contentDataForLessonId = lessonId; // track ownership
                renderLesson(lessonId, isMarkdown);

            }).catch(error => {
                if (lessonIdClicked !== lessonId) return;
                toastsLoader.showToast('Failed to load lesson preview.', 'danger');
                previewArea.innerHTML = '<p class="error">Failed to load lesson content.</p>';
            });
            return;
        }

        if (contentDataForLessonId !== lessonId) {
            console.warn('Content mismatch, skipping render');
            return;
        }

        if (isMarkdown) {
            //const markdownContent = lessonData.Lesson.Content;
            //const htmlContent = window.markdownService.convertMarkdownToHTML(markdownContent);
            //previewArea.innerHTML = htmlContent;
            MarkdownToHtml(contentData);
        } else {
            const textarea = document.createElement('textarea');
            textarea.value = contentData;
            textarea.readOnly = false;
            textarea.id = "preview-lesson-textarea";
            previewArea.innerHTML = '';
            previewArea.appendChild(textarea);

            textarea.addEventListener('input', function() {
                contentData = textarea.value;
                console.log('Content updated:', contentData.length, 'characters');
            });
            
            textarea.addEventListener('blur', function() {
                contentData = textarea.value;
                toastsLoader.showToast('Content saved locally', 'info', 1000);
            });
        }

    }

    // handler buttons

    rawButton.addEventListener("click", function(){
        const lessonId = lessonIdClicked;
        rawButton.classList.add("primary");
        rawButton.classList.remove("secondary");
        mdButton.classList.add("secondary");
        mdButton.classList.remove("primary");
        renderLesson(lessonId, false);
    });

    mdButton.addEventListener("click", function(){
        const lessonId = lessonIdClicked;
        mdButton.classList.add("primary");
        mdButton.classList.remove("secondary");
        rawButton.classList.add("secondary");
        rawButton.classList.remove("primary");
        renderLesson(lessonId, true);
    });

    saveButton.addEventListener("click", async function(){

        const lessonToSave = lessonIdClicked;

        if (!lessonIdClicked) {
            toastsLoader.showToast('No lesson selected to save.', 'warning');
            return;
        }

        if (contentDataForLessonId !== lessonToSave) {
            toastsLoader.showToast('Content mismatch - please reload the lesson.', 'danger');
            return;
        }
        
        saveButton.disabled = true;

        try {
            const file = new File([contentData], 'lesson.md', { type: 'text/markdown' });
            await window.apiService.updateLessonContent(lessonIdClicked, file);
            toastsLoader.showToast('Lesson content saved successfully!', 'confirm');
        } catch (error) {
            console.error('Failed to save lesson content:', error);
            toastsLoader.showToast('Failed to save lesson content.', 'danger');
        } finally {
            saveButton.disabled = false;
        }
    });

    // I was to lazy to make this a uuhhh nvm

    function MarkdownToHtml(markdown) {
        const renderer = {
            heading(token) {
                
                const plain = token.text || '';
                const level = token.depth || 1;
                const slug = plain
                .toLowerCase()
                .normalize("NFD").replace(/[\u0300-\u036f]/g, '') // remove accents
                .replace(/[^\w]+/g, '-')
                .replace(/^-+|-+$/g, '');

                return `<h${level} id="${slug}">${plain}</h${level}>`;
            }
        };

        marked.use({ renderer });

        marked.setOptions({
            highlight: function(code, lang) {
                if (hljs.getLanguage(lang)) {
                    return hljs.highlight(code, { language: lang }).value;
                }
            }
        });

        previewArea.innerHTML = marked.parse(markdown);

        hljs.highlightAll();
        
        // Process MathJax after content is rendered (Safari-compatible)
        if (window.MathJax && window.MathJax.typesetPromise) {
            // Wait a bit for DOM to settle
            setTimeout(() => {
                MathJax.typesetPromise([previewArea]).then(() => {
                    console.log('MathJax processing complete');
                }).catch((err) => {
                    console.error('MathJax typeset failed:', err);
                });
            }, 100);
        } else if (window.MathJax && window.MathJax.Hub) {
            // Fallback for older MathJax versions
            setTimeout(() => {
                MathJax.Hub.Queue(["Typeset", MathJax.Hub, previewArea]);
            }, 100);
        }

        if (window.mermaid) {
            mermaid.initialize({
                startOnLoad: false,
                theme: 'dark',
                themeVariables: {
                    primaryColor: '#9B59BB',
                    primaryTextColor: '#FFFFFF',
                    primaryBorderColor: '#9B59BB',
                    lineColor: '#B380CB',
                    secondaryColor: '#B380CB',
                    tertiaryColor: '#8E44AD',
                }
            });

            setTimeout(() => {
                mermaid.run({
                    querySelector: '#lesson-body .language-mermaid, #lesson-body code[class*="mermaid"]'
                }).then(() => {
                    console.log('Mermaid diagrams rendered');
                }).catch((err) => {
                    console.error('Mermaid rendering failed:', err);
                });
            }, 200);
        }
    }

    // MODAL HANDELING

    const updateModal = document.getElementById("editMetadataModal");
    const form = document.getElementById("editMetadataForm");
    //const fileInput = document.getElementById("lessonFile");
    const fileInfo = document.getElementById("fileInfo") || null; // for silencing errors
    const clearForm = document.getElementById("clearForm");

    let prevLess = null;
    let nextLess = null;

    //clear form funct

    const uploadBtn = document.getElementById("metadataButton");
            
    if (uploadBtn && updateModal) {
        uploadBtn.addEventListener("click", function() {
            updateModal.style.display = "flex";
        });

        // Close modal when clicking outside
        updateModal.addEventListener("click", function(e) {
            if (e.target === updateModal) {
                updateModal.style.display = "none";
            }
        });
    }

    clearForm.addEventListener("click", function(){

        form.reset();
        if (fileInfo) {
            fileInfo.style.display = "none";
        }

    });

    // Show file info when file is selected
    
    /*
    fileInput.addEventListener("change", function(e) {
        const file = e.target.files[0];
        const nameLabel = document.getElementById("fileName");
        const sizeLabel = document.getElementById("fileSize");

        if (file && nameLabel && sizeLabel && fileInfo) {
            nameLabel.textContent = file.name;
            sizeLabel.textContent = `${(file.size / 1024).toFixed(2)} KB`;
            fileInfo.style.display = "block";
        } else if (fileInfo) {
            fileInfo.style.display = "none";
        }
    });
    */

    let isSubmittingForm = false;

    form.addEventListener("submit", async function(e) {
        e.preventDefault();

        if (isSubmittingForm) {
            toastsLoader.showToast('Submission in progress...', 'warning');
            return;
        }

        const lessonToUpdate = lessonIdClicked;  // Capture immediately
        if (!lessonToUpdate) {
            toastsLoader.showToast('No lesson selected.', 'warning');
            return;
        }

        isSubmittingForm = true;

        try {
            const formData = {
            title: document.getElementById("lessonTitle").value || null,
            description: document.getElementById("lessonDescription").value || null,
            class: parseInt(document.getElementById("modalLessonClass").value) || null,
            section: parseInt(document.getElementById("modalLessonSection").value) || null,
            number: 1,
            module: parseInt(document.getElementById("modalLessonModule").value) || null,
        }

        console.warn(formData.class);

        // upload file and create lesson

        /*
        const fileInput = document.getElementById("lessonFile");
        const fileS = fileInput.files[0];
        const fileLength = fileS.size;
        const fileName = fileS.name;

        console.log(`Uploading file: ${fileName} (${fileLength} bytes)`);
        toastsLoader.showToast(`Uploading file: ${fileName}`, 'info');
        */
        // let responseData;

        try {

            // GET LAST LESSON IN SECTION TO SET PREVIOUS LESSON ID
            let lastLesson = await window.apiService.getLessonsByFlags(
                formData.class, 
                formData.section, 
                formData.module
            );

            lastLesson = lastLesson.length > 0 ? lastLesson[lastLesson.length - 1] : null;
            let lastLessonID = lastLesson ? lastLesson.lesson.ID : null;
            if (debugMode) console.log(`Last lesson in section:`, lastLesson);

            // UPDATE THE LESSON

            const detailsToUpdate = {};
            const flagsToUpdate = {};

            for (const [key, value] of Object.entries(formData)) {
                if (value !== null) {
                    if (key === 'title' || key === 'description') {
                        detailsToUpdate[key] = value;
                    } else if (key === 'class' || key === 'section' || key === 'module') {
                        flagsToUpdate[key] = value;
                    }
                }
            }

            if (debugMode) console.log("Updating lesson with data:", {
                details: detailsToUpdate,
                flags: flagsToUpdate
            });

            if (Object.keys(detailsToUpdate).length > 0) {
                await window.apiService.updateLessonField(lessonToUpdate, 'details', detailsToUpdate);
                if (debugMode) console.log("Lesson details updated successfully.");
            }

            if (Object.keys(flagsToUpdate).length > 0) {
                await window.apiService.updateLessonField(lessonToUpdate, 'flags', flagsToUpdate);
                if (debugMode) console.log("Lesson flags updated successfully.");
            }

            if (debugMode) console.log("Lesson updated successfully.");
            toastsLoader.showToast(`Lesson updated successfully. ID: ${lessonToUpdate}`, "confirm");

            /*
            responseData = await window.apiService.uploadLesson(formData, fileS);
            
            if (debugMode) console.log("Lesson uploaded successfully.");
            if (debugMode) console.log(responseData);
            toastsLoader.showToast(`Lesson uploaded successfully. ID: ${responseData.lesson.ID}`, "confirm");
            */

            // Check if this is the first lesson in the section and assign section_starter if needed
            try {
                const existingLessons = await window.apiService.getLessonsByFlags(
                    formData.class, 
                    formData.section, 
                    formData.module
                );
                
                const lessonsData = existingLessons;
                
                if (debugMode) console.log(`Existing lessons in section ${formData.section}:`, lessonsData);
                if (lessonsData.length === 1) {
                    if (debugMode) console.log(`This is the first lesson in section ${formData.section}, setting as section starter`);
                    await window.apiService.updateLessonSectionStarter(lessonToUpdate, formData.section);
                    toastsLoader.showToast(`Lesson set as section ${formData.section} starter`, "confirm");
                } else {
                    // assign PreviousLessonID to current lesson
                    prevLess = lastLessonID;
                    toastsLoader.showToast(`Lesson PreviousLessonID set to ${lastLessonID}`, "info");
                }

            } catch (error) {

                console.error("Failed to check/update section starter:", error);
                toastsLoader.showToast("Warning: Could not check section starter status", "warning");

            }

            // Update UI elements if they exist
            const nameLabel = document.getElementById("fileName");
            if (nameLabel) {
                nameLabel.textContent = fileName;
            }
            
            const sizeLabel = document.getElementById("fileSize");
            if (sizeLabel) {
                sizeLabel.textContent = `${(fileLength / 1024).toFixed(2)} KB`;
            }


            if(fileInfo) {
                fileInfo.style.display = "none";
            }

        } catch (error) {

            console.error("Lesson upload failed:", error);
            toastsLoader.showToast(`Lesson upload failed: ${error.message}`, "danger");
            return;

        }

        try {
            // Get debug form values if they exist
            const debugPrevInput = document.getElementById("debugPrevLesson");
            const debugNextInput = document.getElementById("debugNextLesson");
            
            if (debugPrevInput && debugNextInput) {
                const debugPrev = debugPrevInput.value.trim();
                const debugNext = debugNextInput.value.trim();
                
                // Only override if debug values are provided
                if (debugPrev) prevLess = debugPrev;
                if (debugNext) nextLess = debugNext;
            }
            
            // Convert empty strings to null
            prevLess = prevLess === "" ? null : prevLess;
            nextLess = nextLess === "" ? null : nextLess;
            
            // Check if we need to update lesson order
            if (!prevLess && !nextLess) {
                console.log('No lesson order update needed.');
                toastsLoader.showToast('No lesson order update needed.', 'info');
            } else {
                console.log('Updating lesson order:', {
                    lessonId: lessonToUpdate,
                    prevLess: prevLess,
                    nextLess: nextLess
                });
                
                await window.apiService.updateLessonOrder(lessonToUpdate, prevLess, nextLess);
                toastsLoader.showToast(`Lesson order updated successfully.`, "confirm");
            }
        } catch (error) {
            console.warn("Updating lesson order failed:", error);
            toastsLoader.showToast(`Updating lesson order failed: ${error.message}`, "warning");
            return;
        }
    } finally {
        isSubmittingForm = false;
        form.reset();
    }
    });

});