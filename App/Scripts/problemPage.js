/*
*/

document.addEventListener("DOMContentLoaded", async function() {

    const baseurl = window.location.href;
    const isAuthenticated = window.apiService.isAuthenticated();

    // DOM Elements
    const titleElement = document.getElementById("problem-title");
    const authorElement = document.getElementById("problem-author");
    const sourceElement = document.getElementById("problem-source");
    const difficultyElement = document.getElementById("problem-difficulty");
    const moduleElement = document.getElementById("problem-module");
    const sectionElement = document.getElementById("problem-section");
    const thumbnailElement = document.getElementById("problem-thumbnail");
    const descriptionElement = document.getElementById("problem-description");
    const testsCountElement = document.getElementById("tests-count");
    const codeEditor = document.getElementById("code-editor");
    const submitCodeBtn = document.getElementById("submit-code-btn");
    const resultsContainer = document.getElementById("results-container");
    const resultsPlaceholder = document.getElementById("results-placeholder");
    const backToProblemsBtn = document.getElementById("back-to-problems-btn");
    const solutionsCountElement = document.getElementById("solutions-count");
    const correctSolutionsCountElement = document.getElementById("correct-solutions-count");
    const mySolutionsList = document.getElementById("my-solutions-list");
    const noSolutionsMsg = document.getElementById("no-solutions-msg");

    // Get problem ID from URL
    let problemId = baseurl.split("?id=")[1];
    
    if (!problemId) {
        titleElement.textContent = "Eroare: Problemă negăsită";
        descriptionElement.textContent = "Nu a fost specificat un ID valid pentru problemă.";
        return;
    }

    problemId = problemId.trim();

    // Load problem data
    try {
        const problemData = await window.apiService.getProblemById(problemId);
        console.log("Problem Data:", problemData);

        if (!problemData || !problemData.problem) {
            throw new Error("Problem not found");
        }

        const problem = problemData.problem;
        const tags = problemData.tag_translation;

        document.title = `${problem.Title} - Codium`;
        titleElement.textContent = problem.Title;

        if (problem.Source && problem.Source.Valid) {
            sourceElement.textContent = problem.Source.String;
        } else {
            sourceElement.textContent = "67";
        }

        if (problem.AuthorID) {
            try {
                const authorData = await window.apiService.getUserById(problem.AuthorID);
                authorElement.textContent = authorData.Username || "67";
                authorElement.href = `/app/user.html?id=${problem.AuthorID}`;
            } catch (e) {
                authorElement.textContent = "67";
            }
        } else {
            authorElement.textContent = "67??!!";
        }

        // tags
        if (tags) {
            difficultyElement.textContent = getDifficultyLabel(tags.difficulty);
            moduleElement.textContent = `Modul ${tags.module}`;
            sectionElement.textContent = `Secțiunea ${tags.section}`;
        }

        // thumbnail
        if (problem.ThumbnailFileID) {
            const thumbnailUrl = window.apiService.getFileUrl(problem.ThumbnailFileID);
            thumbnailElement.src = thumbnailUrl;
            thumbnailElement.style.display = "block";
        }

        // description
        descriptionElement.textContent = problem.Description;

        // count tests
        if (problem.FirstTest) {
            try {
                const testChain = await window.apiService.getTestChainForFirstTest(problem.FirstTest, null);
                testsCountElement.textContent = testChain.length;
            } catch (e) {
                testsCountElement.textContent = "?";
            }
        } else {
            testsCountElement.textContent = "0";
        }

        // load solution counts
        if (isAuthenticated) {
            loadSolutionStats(problemId); // <-- this could return all of the users solutions for thus problem (at some pount)
            loadMySolutions(problemId);
        }

    } catch (error) {
        console.error("Failed to load problem:", error);
        titleElement.textContent = "Eroare la încărcarea problemei";
        descriptionElement.textContent = error.message || "A apărut o eroare neașteptată.";
    }

    // el
    if (backToProblemsBtn) {
        backToProblemsBtn.addEventListener("click", function() {
            window.location.href = "/app/Probleme/index.html";
        });
    }

    if (submitCodeBtn) {
        submitCodeBtn.addEventListener("click", async function() {
            if (!isAuthenticated) {
                showResult("Trebuie să fii autentificat pentru a trimite soluția.", "error");
                return;
            }

            const code = codeEditor.value.trim();
            if (!code) {
                showResult("Scrie ceva cod înainte de a trimite.", "error");
                return;
            }

            submitCodeBtn.disabled = true;
            submitCodeBtn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Se trimite...';

            try {
                const runResult = await window.apiService.runCodeAgainstProblemTests(problemId, code);
                
                // create solution record
                const solutionData = {
                    code: code,
                    language: 'cpp'
                };
                const solution = await window.apiService.createSolution(problemId, solutionData);
                
                await window.apiService.updateSolution(solution.ID, 'tests', {
                    tests_passed: runResult.score,
                    total_tests: runResult.total
                });

                displayResults(runResult, true);
                
                loadMySolutions(problemId);

            } catch (error) {
                showResult("Eroare: " + (error.message || "A apărut o eroare la trimitere."), "error");
            } finally {
                submitCodeBtn.disabled = false;
                submitCodeBtn.innerHTML = '<i class="fas fa-paper-plane"></i> Trimite';
            }
        });
    }

    function getDifficultyLabel(difficulty) {
        const labels = {
            0: "Neclasificat",
            1: "Ușor",
            2: "Mediu",
            3: "Greu"
        };
        return labels[difficulty] || `Dificultate ${difficulty}`;
    }

    function showResult(message, type = "info") {
        resultsContainer.innerHTML = `<p class="${type}">${message}</p>`;
    }

    function displayResults(result, submitted = false) {
        const { score, total } = result;
        const percentage = total > 0 ? (score / total) * 100 : 0;
        
        let scoreClass = "fail";
        if (percentage === 100) scoreClass = "perfect";
        else if (percentage >= 50) scoreClass = "partial";

        const submittedText = submitted ? '<p><i class="fas fa-check"></i> Soluție trimisă cu succes!</p>' : '';

        resultsContainer.innerHTML = `
            ${submittedText}
            <p class="result-score ${scoreClass}">${score} / ${total} teste trecute</p>
            <p>Scor: ${percentage.toFixed(0)}%</p>
        `;
    }

    async function loadSolutionStats(problemId) {
        try {
            const countData = await window.apiService.countSolutionsForProblem(problemId);
            if (countData) {
                solutionsCountElement.textContent = countData.count_total || 0;
                correctSolutionsCountElement.textContent = countData.count_correct || 0;
            }
        } catch (e) {
            console.warn("Could not load solution stats:", e);
        }
    }

    async function loadMySolutions(problemId) {
        try {
            const solutions = await window.apiService.getSolutionsByProblem(problemId);
            
            if (solutions && solutions.length > 0) {
                noSolutionsMsg.style.display = "none";
                mySolutionsList.innerHTML = "";
                
                solutions.forEach(sol => {
                    const item = document.createElement("div");
                    item.className = "solution-item";
                    
                    const date = new Date(sol.CreatedAt.Time || sol.CreatedAt);
                    const dateStr = date.toLocaleDateString('ro-RO');
                    
                    const scoreClass = sol.TestsPassed.Int32 === sol.TotalTests.Int32 ? "perfect" : 
                                       sol.TestsPassed.Int32 > 0 ? "partial" : "fail";
                    
                    item.innerHTML = `
                        <span class="score ${scoreClass}">${sol.TestsPassed.Int32}/${sol.TotalTests.Int32}</span>
                        <span class="date">${dateStr}</span>
                    `;
                    mySolutionsList.appendChild(item);
                });
            }
        } catch (e) {
            console.warn("Could not load my solutions:", e);
        }
    }

});
