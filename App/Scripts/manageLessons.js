/*
 __  __    __    _  _    __    ___  ____  __    ____  ___  ___  _____  _  _  ___     ____  ___ 
(  \/  )  /__\  ( \( )  /__\  / __)( ___)(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)   (_  _)/ __)
 )    (  /(__)\  )  (  /(__)\( (_-. )__)  )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \  .-_)(  \__ \
(_/\/\_)(__)(__)(_)\_)(__)(__)\___/(____)(____)(____)(___/(___/(_____)(_)\_)(___/()\____) (___/

tudutudutudutudu rapapapam

Bucovina - Zi Dupa Zi, Noapte De Noapte
*/
document.addEventListener("DOMContentLoaded", async function() {

    const isAdmin = localStorage.getItem('isAdmin') === 'true';
    console.log(`Is Admin: ${isAdmin}`);
    if (!isAdmin) {
        const uploadBtn = document.getElementById("openUploadModal");
        const currentPage = window.location.pathname;
        if (uploadBtn) {
            uploadBtn.style.display = "none";
        } else {
            window.location.href = "user.html";
        }
    } else {
        toastsLoader.showToast('auth!', 'confirm');
    }

    // elements
    
    const classFilter = document.getElementById("lessonClass");
    classValue = classFilter.value;
    const moduleFilter = document.getElementById("lessonModule");
    moduleValue = moduleFilter.value;
    const sectionFilter = document.getElementById("lessonSection");
    sectionValue = sectionFilter.value;

    let newOrder = [];

    // Event listeners for filters

    loadLessons(); // initial load
    classFilter.addEventListener("change", function() {
        if (classValue !== this.value) {
            classValue = this.value;
            loadLessons();
        }
    });

    moduleFilter.addEventListener("change", function() {
        if (moduleValue !== this.value) {
            moduleValue = this.value;
            loadLessons();
        }
    });

    sectionFilter.addEventListener("change", function() {
        if (sectionValue !== this.value) {
            sectionValue = this.value;
            loadLessons();
        }
    });

    const sectionArray = await window.apiService.getSectionsForClass(classValue || null);
    const selectionFilter = document.getElementById("lessonSection");

    for (const sectionNumber of sectionArray) {
        const option = document.createElement("option");
        option.value = sectionNumber;
        option.textContent = `Sectiunea ${sectionNumber}`;
        selectionFilter.appendChild(option);
    }

    // Functions load lessons

    async function loadLessons() {
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
                    true
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

    async function updateLessonsOrder(lessonIds) {
        if (!lessonIds || lessonIds.length === 0) {
            console.warn('No lessons to update');
            return;
        }
        
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
    const saveButton = document.getElementById("saveButton");
    let contentData = null;

    async function renderLesson(lessonId, isMarkdown = false, firstCall = false) {
        if (!lessonId) {
            console.warn('No lesson ID provided for rendering');
            return;
        }
        if (firstCall) {
            toastsLoader.showToast('Loading lesson preview...', 'info');
            const result = await window.apiService.getLessonById(lessonId);
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
                contentData = lessonData;
                renderLesson(lessonId, isMarkdown);
            }).catch(error => {
                console.error('Failed to load lesson for preview:', error);
                toastsLoader.showToast('Failed to load lesson preview.', 'danger');
                previewArea.innerHTML = '<p class="error">Failed to load lesson content.</p>';
            });
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
        if (!lessonIdClicked) {
            toastsLoader.showToast('No lesson selected to save.', 'warning');
            return;
        }
        try {
            const file = new File([contentData], 'lesson.md', { type: 'text/markdown' });
            await window.apiService.updateLessonContent(lessonIdClicked, file);
            toastsLoader.showToast('Lesson content saved successfully!', 'confirm');
        } catch (error) {
            console.error('Failed to save lesson content:', error);
            toastsLoader.showToast('Failed to save lesson content.', 'danger');
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


});
