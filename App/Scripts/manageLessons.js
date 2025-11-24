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
                response = await window.apiService.getLessonsByFlags(
                    filterData.class,
                    filterData.section,
                    filterData.module
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

});
