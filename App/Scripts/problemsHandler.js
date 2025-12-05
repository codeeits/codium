
const problemsApi = new ApiService();

// ===========================================
// HELPER FUNCTIONS
// ===========================================

function showResult(elementId, data, isError = false) {
    const el = document.getElementById(elementId);
    el.style.display = 'block';
    el.className = 'result ' + (isError ? 'error' : 'success');
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
        await problemsApi.delete(`/api/problems/${problemId}`, true);
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
        const result = await problemsApi.post('/api/tests', data, true);
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
        const result = await problemsApi.put(`/api/tests/${testId}?target_field=input`, data, true);
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
        const result = await problemsApi.put(`/api/tests/${testId}?target_field=expected_output`, data, true);
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
        const result = await problemsApi.put(`/api/tests/${testId}?target_field=prev`, data, true);
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
        const result = await problemsApi.put(`/api/tests/${testId}?target_field=next`, data, true);
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
        await problemsApi.delete(`/api/tests/${testId}`, true);
        showResult('deleteTestResult', 'Test deleted successfully');
    } catch (error) {
        showResult('deleteTestResult', error.message || error, true);
    }
}

// ===========================================
// RUN CODE AGAINST PROBLEM TESTS CRUD
// ===========================================

async function runCodeAgainstProblem() {
    try {
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
        showResult('runCodeResult', result);
    } catch (error) {
        showResult('runCodeResult', error.message || error, true);
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
        const result = await problemsApi.uploadFile(file);
        showResult('uploadImageResult', result);
    } catch (error) {
        showResult('uploadImageResult', error.message || error, true);
    }
}
// ===========================================
// AUTH CHECK ON LOAD
// ===========================================

document.addEventListener('DOMContentLoaded', () => {
    if (!problemsApi.isAuthenticated()) {
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
