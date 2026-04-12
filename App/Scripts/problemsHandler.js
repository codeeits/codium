/*

Hiiii!!! :3 
I feel like problemsHandler.js is getting a bit spaghetti.
This code is not supposed to be a shining example of good practices. 
Now updated so it doesnt do fetch calls directly.!!

*/

const api = window.apiService;
const problemsApi = api.problems;

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function showResult(elementId, data, isError = false) {
    const el = document.getElementById(elementId);
    el.style.display = 'block';
    el.classList.remove('error', 'success');
    el.classList.add(isError ? 'error' : 'success');
    el.textContent = typeof data === 'object' ? JSON.stringify(data, null, 2) : data;
}

function getVal(id) {
    const el = document.getElementById(id);
    return el ? el.value.trim() : '';
}

function getIntVal(id) {
    const val = getVal(id);
    return val === '' ? null : parseInt(val, 10);
}

function getUUIDVal(id) {
    const val = getVal(id);
    return val === '' ? null : val;
}

// ===========================================
// PROBLEM CRUD
// ===========================================

async function createProblem() {
    try {
        const data = {
            title: getVal('title'),
            description: getVal('description')
        };

        // Optional fields
        const source = getVal('source');
        if (source) data.source = source;

        const firstTestId = getUUIDVal('first_test_id');
        if (firstTestId) data.first_test_id = firstTestId;

        const thumbnailId = getUUIDVal('thumbnail_id');
        if (thumbnailId) data.thumbnail_id = thumbnailId;

        // Tags (integers)
        const difficulty = getIntVal('difficulty');
        if (difficulty !== null) data.difficulty = difficulty;

        const module = getIntVal('module');
        if (module !== null) data.module = module;

        const solveType = getIntVal('solve_type');
        if (solveType !== null) data.solve_type = solveType;

        const resultType = getIntVal('result_type');
        if (resultType !== null) data.result_type = resultType;

        const verificationType = getIntVal('verification_type');
        if (verificationType !== null) data.verification_type = verificationType;

        const section = getIntVal('section');
        if (section !== null) data.section = section;

        console.log('Creating problem with data:', data);
        const result = await problemsApi.createProblem(data);
        showResult('createProblemResult', result);
    } catch (error) {
        showResult('createProblemResult', error.message || error, true);
    }
}

async function getProblems() {
    try {
        const result = await problemsApi.getProblems();
        showResult('getProblemsResult', result);
    } catch (error) {
        showResult('getProblemsResult', error.message || error, true);
    }
}

async function getProblemById() {
    try {
        const problemId = getVal('get_problem_id');
        if (!problemId) {
            showResult('getProblemResult', 'Please enter a Problem ID', true);
            return;
        }
        const result = await problemsApi.getProblemById(problemId);
        showResult('getProblemResult', result);
    } catch (error) {
        showResult('getProblemResult', error.message || error, true);
    }
}

async function updateProblemTags() {
    try {
        const problemId = getVal('update_problem_id');
        if (!problemId) {
            showResult('updateProblemResult', 'Please enter a Problem ID', true);
            return;
        }

        const data = {};
        const difficulty = getIntVal('upd_difficulty');
        const module = getIntVal('upd_module');
        const solveType = getIntVal('upd_solve_type');
        const resultType = getIntVal('upd_result_type');
        const verificationType = getIntVal('upd_verification_type');
        const section = getIntVal('upd_section');

        if (difficulty !== null) data.difficulty = difficulty;
        if (module !== null) data.module = module;
        if (solveType !== null) data.solve_type = solveType;
        if (resultType !== null) data.result_type = resultType;
        if (verificationType !== null) data.verification_type = verificationType;
        if (section !== null) data.section = section;

        if (Object.keys(data).length === 0) {
            showResult('updateProblemResult', 'Please enter at least one tag value', true);
            return;
        }

        console.log('Updating problem tags:', data);
        const result = await problemsApi.updateProblem(problemId, 'tags', data);
        showResult('updateProblemResult', result);
    } catch (error) {
        showResult('updateProblemResult', error.message || error, true);
    }
}

async function updateProblemDetails() {
    try {
        const problemId = getVal('update_problem_id');
        if (!problemId) {
            showResult('updateProblemResult', 'Please enter a Problem ID', true);
            return;
        }

        const title = getVal('upd_title');
        const description = getVal('upd_description');
        const source = getVal('upd_source');

        if (!title || !description) {
            showResult('updateProblemResult', 'Title and Description are required for details update', true);
            return;
        }

        const data = { title, description };
        if (source) data.source = source;

        console.log('Updating problem details:', data);
        const result = await problemsApi.updateProblem(problemId, 'details', data);
        showResult('updateProblemResult', result);
    } catch (error) {
        showResult('updateProblemResult', error.message || error, true);
    }
}

async function updateProblemFirstTest() {
    try {
        const problemId = getVal('update_problem_id');
        if (!problemId) {
            showResult('updateProblemResult', 'Please enter a Problem ID', true);
            return;
        }

        const firstTestId = getVal('upd_first_test');
        if (!firstTestId) {
            showResult('updateProblemResult', 'Please enter a First Test ID', true);
            return;
        }

        const data = { first_test_id: firstTestId };
        console.log('Updating problem first test:', data);
        const result = await problemsApi.updateProblem(problemId, 'test', data);
        showResult('updateProblemResult', result);
    } catch (error) {
        showResult('updateProblemResult', error.message || error, true);
    }
}

async function updateProblemThumbnail() {
    try {
        const problemId = getVal('update_problem_id');
        if (!problemId) {
            showResult('updateProblemResult', 'Please enter a Problem ID', true);
            return;
        }

        const thumbnailId = getVal('upd_thumbnail');
        if (!thumbnailId) {
            showResult('updateProblemResult', 'Please enter a Thumbnail ID', true);
            return;
        }

        const data = { thumbnail_id: thumbnailId };
        console.log('Updating problem thumbnail:', data);
        const result = await problemsApi.updateProblem(problemId, 'thumbnail', data);
        showResult('updateProblemResult', result);
    } catch (error) {
        showResult('updateProblemResult', error.message || error, true);
    }
}

async function deleteProblem() {
    try {
        const problemId = getVal('delete_problem_id');
        if (!problemId) {
            showResult('deleteProblemResult', 'Please enter a Problem ID', true);
            return;
        }

        if (!confirm('Are you sure you want to delete this problem?')) {
            return;
        }

        console.log('Deleting problem:', problemId);
        await problemsApi.deleteProblem(problemId);
        showResult('deleteProblemResult', 'Problem deleted successfully');
    } catch (error) {
        showResult('deleteProblemResult', error.message || error, true);
    }
}

// ===========================================
// TEST CRUD
// ===========================================

async function createTest() {
    try {
        const data = {};

        const inputText = getVal('test_input_text');
        const inputFile = getUUIDVal('test_input_file');
        const expectedOutput = getVal('test_expected_output');

        if (!inputText && !inputFile) {
            showResult('createTestResult', 'Please provide either Input Text or Input File ID', true);
            return;
        }

        if (!expectedOutput) {
            showResult('createTestResult', 'Expected Output is required', true);
            return;
        }

        if (inputFile) {
            data.input_file = inputFile;
        } else {
            data.input_text = inputText;
        }

        data.expected_output = expectedOutput;

        const prevId = getUUIDVal('test_prev_id');
        const nextId = getUUIDVal('test_next_id');

        if (prevId) data.previous_test_id = prevId;
        if (nextId) data.next_test_id = nextId;

        console.log('Creating test with data:', data);
        const result = await problemsApi.createTest(data);
        showResult('createTestResult', result);
    } catch (error) {
        showResult('createTestResult', error.message || error, true);
    }
}

async function getTestById() {
    try {
        const testId = getVal('get_test_id');
        if (!testId) {
            showResult('getTestResult', 'Please enter a Test ID', true);
            return;
        }

        const result = await problemsApi.getTestById(testId);
        showResult('getTestResult', result);
    } catch (error) {
        showResult('getTestResult', error.message || error, true);
    }
}

async function getTestChainByFirstId() {
    try {
        let testId = getVal('get_test_chain_first_id');
        let problemId = getVal('get_test_chain_problem_id');
        
        if (!testId && !problemId) {
            showResult('getTestChainResult', 'Please enter a First Test ID or a Problem ID', true);
            return;
        }

        if (problemId === '') {
            problemId = null;
        }
        if (testId === '') {
            testId = null;
        }

        console.log('Getting test chain for first test ID:', testId, 'or problem ID:', problemId);

        const result = await problemsApi.getTestChainForFirstTest(testId, problemId);
        showResult('getTestChainResult', result);
    } catch (error) {
        showResult('getTestChainResult', error.message || error, true);
    }
}

async function updateTestInput() {
    try {
        const testId = getVal('update_test_id');
        if (!testId) {
            showResult('updateTestResult', 'Please enter a Test ID', true);
            return;
        }

        const inputText = getVal('upd_test_input_text');
        const inputFile = getUUIDVal('upd_test_input_file');

        if (!inputText && !inputFile) {
            showResult('updateTestResult', 'Please provide either Input Text or Input File ID', true);
            return;
        }

        const data = {};
        if (inputFile) {
            data.input_file = inputFile;
        } else {
            data.input_text = inputText;
        }

        console.log('Updating test input:', data);
        const result = await problemsApi.updateTestInput(testId, data);
        showResult('updateTestResult', result);
    } catch (error) {
        showResult('updateTestResult', error.message || error, true);
    }
}

async function updateTestExpectedOutput() {
    try {
        const testId = getVal('update_test_id');
        if (!testId) {
            showResult('updateTestResult', 'Please enter a Test ID', true);
            return;
        }

        const expectedOutput = getVal('upd_test_expected_output');
        if (!expectedOutput) {
            showResult('updateTestResult', 'Please enter an Expected Output', true);
            return;
        }

        const data = { expected_output: expectedOutput };
        console.log('Updating test expected output:', data);
        const result = await problemsApi.updateTestExpectedOutput(testId, data);
        showResult('updateTestResult', result);
    } catch (error) {
        showResult('updateTestResult', error.message || error, true);
    }
}

async function updateTestPrev() {
    try {
        const testId = getVal('update_test_id');
        if (!testId) {
            showResult('updateTestResult', 'Please enter a Test ID', true);
            return;
        }

        const prevId = getVal('upd_test_prev');
        const data = { prev: prevId || null };

        console.log('Updating test prev:', data);
        const result = await problemsApi.updateTestPrev(testId, data);
        showResult('updateTestResult', result);
    } catch (error) {
        showResult('updateTestResult', error.message || error, true);
    }
}

async function updateTestNext() {
    try {
        const testId = getVal('update_test_id');
        if (!testId) {
            showResult('updateTestResult', 'Please enter a Test ID', true);
            return;
        }

        const nextId = getVal('upd_test_next');
        const data = { next: nextId || null };

        console.log('Updating test next:', data);
        const result = await problemsApi.updateTestNext(testId, data);
        showResult('updateTestResult', result);
    } catch (error) {
        showResult('updateTestResult', error.message || error, true);
    }
}

async function deleteTest() {
    try {
        const testId = getVal('delete_test_id');
        if (!testId) {
            showResult('deleteTestResult', 'Please enter a Test ID', true);
            return;
        }

        if (!confirm('Are you sure you want to delete this test?')) {
            return;
        }

        console.log('Deleting test:', testId);
        await problemsApi.deleteTest(testId);
        showResult('deleteTestResult', 'Test deleted successfully');
    } catch (error) {
        showResult('deleteTestResult', error.message || error, true);
    }
}

// ===========================================
// SOLUTIONS CRUD
// ===========================================

async function createSolution() {
    try {
        const data = {};
        const problemId = getVal('solution_problem_id');
        const code = getVal('solution_code');
        const language = getVal('solution_language');

        if (!problemId) {
            showResult('createSolutionResult', 'Please enter a Problem ID', true);
            return;
        }

        if (!code) {
            showResult('createSolutionResult', 'Please enter the solution code', true);
            return;
        }

        if (!language) {
            showResult('createSolutionResult', 'Please enter the programming language', true);
            return;
        }

        data.code = code;
        data.language = language;
        
        console.log('Creating solution with data:', data);
        const result = await problemsApi.createSolution(problemId, data);
        showResult('createSolutionResult', result);
    } catch (error) {
        showResult('createSolutionResult', error.message || error, true);
    }
}

async function updateSolutionTests() {
    try {
        const data = {};
        const solutionId = getVal('update_solution_id');
        const testsPassed = getIntVal('upd_solution_tests_passed');
        const testsTotal = getIntVal('upd_solution_total_tests');

        if (!solutionId) {
            showResult('updateSolutionResult', 'Please enter a Solution ID', true);
            return;
        }

        console.log(testsPassed, testsTotal);

        if (testsPassed === null || testsTotal === null) {
            showResult('updateSolutionResult', 'Please enter both Tests Passed and Total Tests', true);
            return;
        }

        data.tests_passed = testsPassed;
        data.total_tests = testsTotal;

        console.log('Updating solution with data:', data);
        const result = await problemsApi.updateSolution(solutionId, 'tests', data);
        showResult('updateSolutionResult', result);
    } catch (error) {
        showResult('updateSolutionResult', error.message || error, true);
    }
}

async function getSolutions(targetField = '') {
    try {
        if (targetField === 'problem'){

            const problemId = getVal('get_solutions_problem_id');

            if (!problemId) {
                showResult('getSolutionsResult', 'Please enter a Problem ID', true);
                return;
            }

            console.log('Getting solutions for problem ID:', problemId);
            const result = await problemsApi.getSolutionsByProblem(problemId);
            showResult('getSolutionsResult', result);

        } else if (targetField === 'user') {
            const userId = getVal('get_solutions_user_id');

            if (!userId) {
                showResult('getSolutionsResultUser', 'Please enter a User ID', true);
                return;
            }

            console.log('Getting solutions for user ID:', userId);
            const result = await problemsApi.getSolutionsByUser(userId);
            showResult('getSolutionsResultUser', result);

        } else if (targetField === 'solution') {
            const solutionId = getVal('get_solutions_solution_id');

            if (!solutionId) {
                showResult('getSolutionsResultSolution', 'Please enter a Solution ID', true);
                return;
            }

            console.log('Getting solution by solution ID:', solutionId);
            const result = await problemsApi.getSolutionById(solutionId);
            showResult('getSolutionsResultSolution', result);

        } else {
            showResult('getSolutionsResult', 'Please specify a valid target field (problem, user, or solution)', true);
        }
    } catch (error) {
        showResult('getSolutionsResult', error.message || error, true);
    }
}

async function countSolutions(targetField = '') {
    try {
        if (targetField === 'problem'){

            const problemId = getVal('count_solutions_problem_id');

            if (!problemId) {
                showResult('countSolutionsResult', 'Please enter a Problem ID', true);
                return;
            }

            console.log('Counting solutions for problem ID:', problemId);
            const result = await problemsApi.countSolutionsForProblem(problemId);
            showResult('countSolutionsResult', result);

        } else if (targetField === 'user') {
            const userId = getVal('count_solutions_user_id');

            if (!userId) {
                showResult('countSolutionsResultUser', 'Ba introdu si tu un User ID', true);
                return;
            }

            console.log('Counting solutions for user ID:', userId);
            const result = await problemsApi.countSolutionsForUser(userId);
            showResult('countSolutionsResultUser', result);

        } else {
            showResult('countSolutionsResult', 'Please specify a valid target field (problem or user)', true);
        }
    } catch (error) {
        showResult('countSolutionsResult', error.message || error, true);
    }
}

async function deleteSolution() {
    try {
        const solutionId = getVal('delete_solution_id');
        if (!solutionId) {
            showResult('deleteSolutionResult', 'Please enter a Solution ID', true);
            return;
        }

        if (!confirm('Are you sure you want to delete this solution?')) {
            return;
        }

        console.log('Deleting solution:', solutionId);
        await problemsApi.deleteSolution(solutionId);
        showResult('deleteSolutionResult', 'Solution deleted successfully');
    } catch (error) {
        showResult('deleteSolutionResult', error.message || error, true);
    }
}


// ===========================================
// RUN CODE AGAINST PROBLEM TESTS CRUD
// ===========================================

async function runCodeAgainstProblem(button) {
    try {
        button.disabled = true;
        button.textContent = 'Running...';
        button.style.opacity = '0.5';
        const problemId = getVal('run_problem_id');
        const code = getVal('run_code');
        if (!problemId) {
            showResult('runCodeResult', 'Please enter a Problem ID', true);
            return;
        }
        if (!code) {
            showResult('runCodeResult', 'Please enter the code to run', true);
            return;
        }

        console.log('Running code against problem tests:', problemId);
        const result = await problemsApi.runCodeAgainstProblemTests(problemId, code, null, true);
        
        let data = {};
        data.code = code;
        data.language = 'cpp';

        console.log('Creating solution record with data:', data);
        const solutionResult = await problemsApi.createSolution(problemId, data);
        const solutionId = solutionResult?.ID || solutionResult?.solution?.ID;

        data = {};
        data.total_tests = result.total;
        data.tests_passed = result.score;

        const updateResult = await problemsApi.updateSolution(solutionId, 'tests', data);
        console.log('Updated solution with test results:', updateResult);
        showResult('runCodeResult', result);
    } catch (error) {
        showResult('runCodeResult', error.message || error, true);
    } finally {
        button.disabled = false;
        button.textContent = 'Run Code';
        button.style.opacity = '1';
    }
}

// ===========================================
// MISC OPERATIONS
// ===========================================

async function uploadImage() {
    try {
        const fileInput = document.getElementById('image_file');
        if (fileInput.files.length === 0) {
            showResult('uploadImageResult', 'Please select an image file to upload', true);
            return;
        }

        const file = fileInput.files[0];
        console.log('Uploading image file:', file.name);
        const result = await problemsApi.uploadProblemImage(file);
        showResult('uploadImageResult', result);
    } catch (error) {
        showResult('uploadImageResult', error.message || error, true);
    }
}

// Compatibility aliases for pages still using legacy inline handler names
// CAUTION: These functions rely on the presence of specific input fields and may not work correctly if html structure is changed.
// Caution 2: These functions are not meant to be used as general-purpose handlers and may have limited error handling or flexibility. Use the above functions directly for better control and reliability.

async function getSolutionById() {
    return getSolutions('solution');
}

async function runCode() {
    const button = document.querySelector('button[onclick="runCode()"]');
    return runCodeAgainstProblem(button || { disabled: false, textContent: '', style: { opacity: '1' } });
}

async function submitCode() {
    return runCode();
}

Object.assign(window, {
    createProblem,
    getProblems,
    getProblemById,
    updateProblemTags,
    updateProblemDetails,
    updateProblemFirstTest,
    updateProblemThumbnail,
    deleteProblem,
    createTest,
    getTestById,
    getTestChainByFirstId,
    updateTestInput,
    updateTestExpectedOutput,
    updateTestPrev,
    updateTestNext,
    deleteTest,
    createSolution,
    updateSolutionTests,
    getSolutions,
    getSolutionById,
    countSolutions,
    deleteSolution,
    runCodeAgainstProblem,
    runCode,
    submitCode,
    uploadImage
});

// END OF CAUTIONARY ALIASES

// ===========================================
// AUTH CHECK ON LOAD
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    if (!api.isAuthenticated()) {
        console.warn('Not authenticated - some operations will fail');
        document.body.insertAdjacentHTML('afterbegin', 
            '<div style="background:#a44;color:#fff;padding:10px;text-align:center;margin-bottom:10px;">⚠️ Not authenticated. Please log in first for write operations.</div>'
        );
    } else {
        console.log('Authenticated as user');
        document.body.insertAdjacentHTML('afterbegin', 
            '<div style="background:#4a4;color:#fff;padding:10px;text-align:center;margin-bottom:10px;">✓ Authenticated</div>'
        );
    }
});
