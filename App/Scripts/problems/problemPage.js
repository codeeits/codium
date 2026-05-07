/*
 __    ____  ___  ___  _____  _  _  ___  ____  _  _  ____  ____  ____  ____  __    ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)(_  _)( \( )(_  _)( ___)(  _ \( ___)/__\  / __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ _)(_  )  (   )(   )__)  )   / )__)/(__)\( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_) (__) (____)(_)\_)(__)(__)(__)\___)(____)()\____) (___/

Problem Page Logic
*/

import { renderExternalLibraries, tomarkdown } from '../markdownRenderer.js';
function getDifficultyLabel(difficulty) {
    const labels = {
        0: "Neclasificat",
        1: "difficulty.easy",
        2: "difficulty.medium",
        3: "difficulty.hard"
    };
    return labels[difficulty] || `Dificultate ${difficulty}`;
}

export function setupDragAndDrop(elements, updateFileLabel, onFileAdded) {
    const { dropzone, fileInput } = elements;
    let dragDepth = 0;

    dropzone.addEventListener('click', () => fileInput.click());
    
    dropzone.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileInput.click();
        }
    });

    dropzone.addEventListener('dragenter', (e) => {
        e.preventDefault();
        dragDepth++;
        dropzone.classList.add('dragover');
    });

    dropzone.addEventListener('dragover', (e) => e.preventDefault());

    dropzone.addEventListener('dragleave', (e) => {
        e.preventDefault();
        dragDepth = Math.max(0, dragDepth - 1);
        if (dragDepth === 0) dropzone.classList.remove('dragover');
    });

    dropzone.addEventListener('drop', (e) => {
        e.preventDefault();
        dragDepth = 0;
        dropzone.classList.remove('dragover');
        
        const droppedFiles = e.dataTransfer?.files ? Array.from(e.dataTransfer.files) : [];
        if (droppedFiles.length > 0) {
            const dt = new DataTransfer();
            droppedFiles.forEach(f => dt.items.add(f));
            fileInput.files = dt.files;
            updateFileLabel(fileInput.files);
            
            if (onFileAdded) onFileAdded(); 
        }
    });

    fileInput.addEventListener('change', () => {
        updateFileLabel(fileInput.files);
        
        if (onFileAdded) onFileAdded();
    });
}

document.addEventListener("DOMContentLoaded", async () => {

    const debugMode = true; 
    const baseurl = window.location.href;
    const isAuthenticated = await window.apiService.checkAuthentication(false);

    // --- DOM ELEMENTS ---
    const elements = {
        title: document.getElementById("problem-title"),
        author: document.getElementById("author-name"),
        source: document.getElementById("problem-source"), // Legacy
        sourceContainer: document.getElementById("problem-source-container"), // New UI
        difficulty: document.getElementById("problem-difficulty"),
        module: document.getElementById("problem-module"),
        section: document.getElementById("problem-section"),
        classlabel: document.getElementById("problem-class"),
        thumbnail: document.getElementById("problem-thumbnail"),
        description: document.getElementById("problem-description"),
        testsCount: document.getElementById("tests-count"),
        codeEditor: document.getElementById("code-editor"),
        submitBtn: document.getElementById("submit-code-btn"),
        resultsContainer: document.getElementById("results-container"),
        backBtn: document.getElementById("back-to-problems-btn"),
        solutionsCount: document.getElementById("solutions-count"),
        correctSolutionsCount: document.getElementById("correct-solutions-count"),
        mySolutionsList: document.getElementById("my-solutions-list"),
        noSolutionsMsg: document.getElementById("no-solutions-msg"),
        dropzone: document.querySelector('.input-field.dropzone'),
        fileInput: document.getElementById('file-input'),
        bookmarkBtn: document.getElementById("bookmark-btn"),

    };

    // --- STATE ---
    const state = {
        problemId: baseurl.split("?id=")[1]?.trim(),
        isNewUi: !!elements.sourceContainer,
        problemData: null,
        solutions: [],
        meta: {
            title: '',
            author: '67',
            authorId: null,
            source: '67',
            difficulty: 0,
            module: null,
            section: null,
            classlabel: null,
            thumbnailId: null
        },
        h2Array: []
    };

    // --- HELPERS & UTILS ---

    function getDropzonePlaceholder() {
        return elements.dropzone ? elements.dropzone.querySelector('.input-text') : null;
    }

    function updateFileLabel(files) {
        const placeholder = getDropzonePlaceholder();
        if (!placeholder) return;
        
        if (!files || files.length === 0) {
            placeholder.textContent = 'Apasă pentru a încărca sau drag and drop';
            placeholder.classList.add('placeholder');
            return;
        }
        const fileName = files.length === 1 ? files[0].name : `${files.length} fișiere selectate`;
        placeholder.textContent = fileName;
        placeholder.classList.remove('placeholder');
    }

    function displayResults(result, submitted = false) {
        const { score, total } = result;
        const percentage = total > 0 ? (score / total) * 100 : 0;
        
        let scoreClass = "danger";
        if (percentage === 100) scoreClass = "confirm";
        else if (percentage >= 50) scoreClass = "warning";

        if (!state.isNewUi && elements.resultsContainer) {
            const submittedText = submitted ? '<p><i class="fas fa-check"></i> Soluție trimisă cu succes!</p>' : '';
            elements.resultsContainer.innerHTML = `
                ${submittedText}
                <p class="score ${scoreClass}">Teste trecute: ${score} / ${total} (${percentage.toFixed(2)}%)</p>
            `;
        } else {
            toastsLoader.showToast(`Teste trecute: ${score} / ${total} (${percentage.toFixed(2)}%)`, scoreClass);
        }
    }

    function extractNullableInt(value) {
        if (value == null) return 0;
        if (typeof value === 'number') return value;
        if (typeof value.Int32 === 'number') return value.Int32;
        if (typeof value.int32 === 'number') return value.int32;
        return 0;
    }

    function bookmarkToggle(getStatusOnly = false) {
        if (!elements.bookmarkBtn) return;
        
        if (getStatusOnly) {
            window.apiService.problems.getProblemBookmarkStatus(state.problemId).then(isBookmarked => {
                if (isBookmarked) {
                    elements.bookmarkBtn.classList.remove("secondary");
                    elements.bookmarkBtn.classList.add("primary");
                } else {
                    elements.bookmarkBtn.classList.remove("primary");
                    elements.bookmarkBtn.classList.add("secondary");
                }
            });
            return;
        }

        window.apiService.problems.modifyBookmarkProblem(state.problemId).then(() => {
            // Re-run handler logic to update UI (recursively simple)
            window.apiService.problems.getProblemBookmarkStatus(state.problemId).then(isBookmarked => {
                if (isBookmarked) {
                    elements.bookmarkBtn.classList.remove("secondary");
                    elements.bookmarkBtn.classList.add("primary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    toastsLoader.showToast("Problem bookmarked", "confirm");
                } else {
                    elements.bookmarkBtn.classList.remove("primary");
                    elements.bookmarkBtn.classList.add("secondary");
                    elements.bookmarkBtn.innerHTML = "<i class='fas fa-bookmark'></i>";
                    toastsLoader.showToast("Bookmark removed", "info");
                }
            });
        }).catch(error => {
            if (debugMode) console.error("[DEBUG] Bookmark toggle failed:", error);
            toastsLoader.showToast("Failed to toggle bookmark", "danger");
        });
    }

    // --- FETCH DATA ---

    async function fetchProblemData() {
        if (debugMode) console.log("[DEBUG] Problem ID:", state.problemId);

        if (!state.problemId) {
            if (elements.title) elements.title.textContent = "Eroare: Problemă negăsită";
            if (elements.description) elements.description.textContent = "Nu a fost specificat un ID valid pentru problemă.";
            return;
        }

        try {
            const data = await window.apiService.problems.getProblemById(state.problemId);
            state.problemData = data;

            if (!data || !data.problem) throw new Error("Problem not found");

            const p = data.problem;
            const t = data.tag_translation;

            state.meta.title = p.Title;
            state.meta.source = p.Source && p.Source.Valid ? p.Source.String : "67";
            state.meta.authorId = p.AuthorID;
            state.meta.thumbnailId = p.ThumbnailFileID;
            
            if (t) {
                state.meta.difficulty = t.difficulty;
                state.meta.module = t.module;
                state.meta.section = t.section;
                state.meta.classlabel = t.verification_type; // Assuming 'verification_type' is used as class label, adjust if needed
            }

            document.title = `${state.meta.title} - Codium`;

            // Fetch Author Details
            if (state.meta.authorId) {
                try {
                    const authorData = await window.apiService.users.getUserById(state.meta.authorId);
                    state.meta.author = authorData.Username || "67";
                } catch (e) {
                    if (debugMode) console.warn("Failed to fetch author", e);
                }
            }

            // Fetch Test Counts
            if (p.FirstTest) {
                try {
                    const testChain = await window.apiService.problems.getTestChainForFirstTest(p.FirstTest, null);
                    if (elements.testsCount) elements.testsCount.textContent = testChain.length;
                } catch (e) {
                    if (elements.testsCount) elements.testsCount.textContent = "?";
                }
            } else {
                if (elements.testsCount) elements.testsCount.textContent = "0";
            }

            // Stats
            if (isAuthenticated) {
                loadSolutionStats();
                loadMySolutions();
            }

        } catch (error) {
            if (debugMode) console.error("Failed to load problem:", error);
            if (elements.title) elements.title.textContent = "Eroare la încărcarea problemei";
            if (elements.description) elements.description.textContent = error.message || "A apărut o eroare neașteptată.";
        }
    }

    async function loadSolutionStats() {
        try {
            const countData = await window.apiService.problems.countSolutionsForProblem(state.problemId);
            if (countData) {
                if (elements.solutionsCount) elements.solutionsCount.textContent = countData.count_total || 0;
                if (elements.correctSolutionsCount) elements.correctSolutionsCount.textContent = countData.count_correct || 0;
            }
        } catch (e) {
            if (debugMode) console.warn("Could not load solution stats:", e);
        }
    }

    async function loadMySolutions() {
        try {
            const solutions = await window.apiService.problems.getSolutionsByProblem(state.problemId);
            state.solutions = solutions || [];
            renderMySolutions();
        } catch (e) {
            if (debugMode) console.warn("Could not load my solutions:", e);
        }
    }

    // --- RENDERERS ---

    function renderProblemUI() {
        if (!state.problemData) return;
        const p = state.problemData.problem;

        elements.title.textContent = state.meta.title;
        if (state.isNewUi){ elements.description.innerHTML = tomarkdown(p.Description || "Fără descriere", state); }
        else { elements.description.textContent = p.Description || "Fără descriere"; }


        elements.difficulty.dataset.i18n = getDifficultyLabel(state.meta.difficulty);

        if (elements.module && state.meta.module) elements.module.textContent = `Modul ${state.meta.module}`;
        if (elements.section && state.meta.section){
            //elements.section.textContent = `Secțiunea ${state.meta.section}`;
            elements.section.innerHTML = `<span class="no-style" data-i18n="flags.section"></span> ${state.meta.section}`;
        }
        if (elements.classlabel && state.meta.classlabel){
            elements.classlabel.textContent = `Clasa a ${state.meta.classlabel} a`;
            elements.classlabel.dataset.i18n = `classe.${state.meta.classlabel}`;
        }

        // Author
        if (elements.author) {
            elements.author.textContent = state.meta.author;
            if (state.meta.authorId) elements.author.href = `/app/user.html?id=${state.meta.authorId}`;
        }

        // Thumbnail
        if (state.meta.thumbnailId && elements.thumbnail) {
            elements.thumbnail.src = window.apiService.fileManager.getFileUrl(state.meta.thumbnailId);
            elements.thumbnail.style.display = "block";
        }

        // Source Rendering (Split logic for UI versions)
        if (!state.isNewUi) {
            if (elements.source) elements.source.textContent = state.meta.source;
        } else {
            const sourceText = state.meta.source;
            const parts = sourceText.split(",").map(part => part.trim());
            elements.sourceContainer.innerHTML = "";
            parts.forEach(part => {
                const a = document.createElement("a");
                a.textContent = part.startsWith("#") ? part : `#${part}`;
                a.href = `/app/Probleme/index.html?source=${part}`;
                a.className = "hashtag";
                elements.sourceContainer.appendChild(a);
            });
        }
    }

    function renderMySolutions() {
        if (!elements.mySolutionsList) return;
        
        elements.mySolutionsList.innerHTML = "";

        console.log("My Solutions:", state.solutions);
        
        if (state.solutions.length > 0) {
            if (elements.noSolutionsMsg) elements.noSolutionsMsg.style.display = "none";
            
            state.solutions.forEach(async sol => {
                const item = document.createElement("div");
                item.className = "solution-item";
                
                const date = new Date(sol.CreatedAt.Time || sol.CreatedAt);
                const dateStr = date.toLocaleDateString('ro-RO');
                const passed = sol.TestsPassed.Int32;
                const totalrsp = await window.apiService.problems.getTestChainForFirstTest(null, sol.ProblemID);
                const total = totalrsp.length || sol.TotalTests.Int32 || 0;
                
                const scoreClass = passed === total ? "perfect" : passed > 0 ? "partial" : "fail";
                
                item.innerHTML = `
                    <span class="score ${scoreClass}">${passed}/${total}</span>
                    <span class="date">${dateStr}</span>
                `;
                elements.mySolutionsList.appendChild(item);
            });
        }
    }

    // --- HANDLERS ---

    function setupEventListeners() {
        // Back Button
        if (elements.backBtn) {
            elements.backBtn.addEventListener("click", () => {
                window.location.href = "/app/Probleme/index.html";
            });
        }

        // Bookmark
        if (elements.bookmarkBtn) {
            elements.bookmarkBtn.addEventListener("click", () => bookmarkToggle());
        }

        // Drag & Drop (New UI)
        if (state.isNewUi && elements.dropzone && elements.fileInput) {
            setupDragAndDrop(elements, updateFileLabel);
        }

        // Submit
        if (elements.submitBtn) {
            elements.submitBtn.addEventListener("click", handleSubmission);
        }
    }        

    async function handleSubmission() {
        if (!isAuthenticated) {
            toastsLoader.showToast("Trebuie să fii autentificat pentru a trimite o soluție.", "error");
            return;
        }

        let code = "";

        if (state.isNewUi) {
            // New UI: File Upload
            toastsLoader.showToast("Trimiterea soluțiilor nu este încă disponibilă în noua interfață. Lucrăm la asta!", "info");
            
            const inputFile = elements.fileInput;
            if (!inputFile || inputFile.files.length === 0) {
                toastsLoader.showToast("Te rugăm să selectezi un fișier înainte de a trimite.", "danger");
                return;
            }

            const file = inputFile.files[0];

            if (file.size > 5 * 1024 * 1024) {
                toastsLoader.showToast("Dimensiunea fișierului depășește limita de 5MB.", "danger");
                throw new Error('File size exceeds the 5MB limit');
            }

            const fileName = file.name.toLowerCase();
            const fileType = file.type;

            const validExtensions = ['.py', '.cpp', '.cc', '.cxx'];
            const validMimeTypes = ['text/x-python', 'text/x-c++src', 'text/plain'];

            const hasValidExtension = validExtensions.some(ext => fileName.endsWith(ext));
            const hasValidMimeType = validMimeTypes.includes(fileType);

            if (!hasValidExtension || (fileType !== "" && !hasValidMimeType)) {
                toastsLoader.showToast("Tip de fișier neacceptat. Doar fișiere PY și C++ sunt permise.", "danger");
                throw new Error('Unsupported file type. Only PY and C++ files are allowed.');
            }

            try {
                code = await file.text();
                if (!code) throw new Error("File empty");
            } catch (e) {
                toastsLoader.showToast("A apărut o eroare la citirea fișierului.", "danger");
                return;
            }
        } else {
            // Old UI: Text Area
            code = elements.codeEditor.value.trim();
            if (!code) {
                toastsLoader.showToast("Scrie ceva cod înainte de a trimite.", "error");
                return;
            }
        }

        await processCodeSubmission(code);
    }

    async function processCodeSubmission(code) {
        elements.submitBtn.disabled = true;
        elements.submitBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se trimite...';

        try {
            const runResult = await window.apiService.problems.runCodeAgainstProblemTests(state.problemId, code);
            
            const solutionData = { code: code, language: 'py' };
            const solution = await window.apiService.problems.createSolution(state.problemId, solutionData);
            
            const gradedSolution = await window.apiService.problems.updateSolution(solution.ID, 'tests',
                {
                    given_answers: runResult.response.given_answers || [],
                }
            );

            console.log('Graded Solution:', gradedSolution);
            const score = extractNullableInt(gradedSolution?.TestsPassed);
            const total = extractNullableInt(gradedSolution?.TotalTests) || runResult.response.total;

            displayResults({ score, total }, true);
            loadMySolutions();
            loadSolutionStats();

        } catch (error) {
            toastsLoader.showToast("Eroare: " + (error.message || "A apărut o eroare la trimitere."), "error");
        } finally {
            elements.submitBtn.disabled = false;
            elements.submitBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Trimite';
        }
    }

    // --- INITIALIZATION ---

    async function initApp() {
        if (debugMode) console.log("Initializing Problem Page...");
        if (state.isNewUi) console.log("New UI detected");

        bookmarkToggle(true); // Initialize bookmark state

        setupEventListeners();
        await fetchProblemData();
        renderProblemUI();
        window.applyTranslations?.();
    }

    initApp();
});