/*
 ____  ____  _____  ____  __    ____  __  __  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
(  _ \(  _ \(  _  )(  _ \(  )  ( ___)(  \/  )/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
 )___/ )   / )(_)(  ) _ < )(__  )__)  )    ( \__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
(__)  (_)\_)(_____)(____/(____)(____)(_/\/\_)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 3.
Handle all problem related API calls here, such as fetching problems, submitting solutions, etc.

*/

export class ProblemService {
    constructor(apiClient){
        this.api = apiClient;
    }

    async createProblem(problemData) {
        // title, description, source, first_test_id, thumbnail_id, [TAGS] difficulty, module, solve_type, result_type, verification_type, section
        console.log('Creating problem with data:', problemData);
        return this.api.post('/api/problems', problemData, true);
    }

    async updateProblem(problemId, targetField, data) {
        // targetField: tags, details, test, thumbnail
        return this.api.put(`/api/problems/${problemId}?target_field=${targetField}`, data, true);
    }

    async deleteProblem(problemId) {
        return this.api.delete(`/api/problems/${problemId}`, true);
    }

    async getProblems() {
        return this.api.get('/api/problems', false);
    }

    async getProblemById(problemId) {
        return this.api.get(`/api/problems?search_type=id&problem_id=${problemId}`, false);
    }

    async getTestById(testId) {
        return this.api.get(`/api/tests/${testId}`, false);
    }

    async getTestChainForFirstTest(firstTestId = null, problemId = null) {
        if (!firstTestId && !problemId) {
            throw new Error('No first test ID provided');
        }

        if (firstTestId == null && problemId) {
            console.log('jere');
            const problemResponse = await this.getProblemById(problemId);
            const problemData = typeof problemResponse === 'string' ? JSON.parse(problemResponse) : problemResponse;
            firstTestId = problemData.problem.FirstTest;
            console.log('Derived First Test ID:', firstTestId);
        }

        let tests = [];
        let currentTestId = firstTestId;
        let response = await this.getTestById(currentTestId);
        //console.log('Initial Test Response:', response);

        while (currentTestId) {
            tests.push(currentTestId);
            currentTestId = response.NextTestID;
            if (currentTestId) {
                const nextTestResponse = await this.getTestById(currentTestId);
                //console.log('Next Test Response:', nextTestResponse);
                response = nextTestResponse;
            }
        }
        return tests;
    }

    async runCodeAgainstTest(testId, code, inputFile = null, stdin = true) {
        console.warn('DEPRECATED: use runCodeAgainstProblemTests instead.');
        const testResponse = await this.getTestById(testId);
        const testData = typeof testResponse === 'string' ? JSON.parse(testResponse) : testResponse;

        if (stdin === true) {
            stdin = testData.TxtInput.Valid ? testData.TxtInput.String : '';
        }

        return this.api.runCode(code, inputFile, stdin);
    }

    async runCodeAgainstProblemTests(problemId, code, inputFile = null, stdin = true) {

        if ((await this.api.checkAuthentication(false)) === false) {
            throw new Error('Authentication required to run code against problem tests');
        }
        const problemResponse = await this.getProblemById(problemId);
        const firstTestId = stdin ? problemResponse.problem.FirstTest : null;
        const problemData = typeof problemResponse === 'string' ? JSON.parse(problemResponse) : problemResponse;
        //console.log('Problem Data:', problemData);

        let currentTestId = firstTestId;
        let currentTestResponse = null;

        if (!problemData || !problemData.problem.FirstTest) {
            throw new Error('No tests found for the specified problem');
        }

        const givenAnswers = [];
        // let score = 0;
        let tests = await this.getTestChainForFirstTest(currentTestId);

        // console.warn('Test Chain:', tests);

        while (currentTestId) {
            currentTestResponse = await this.getTestById(currentTestId);
            const testData = typeof currentTestResponse === 'string' ? JSON.parse(currentTestResponse) : currentTestResponse;

            let testStdin = '';
            if (stdin === true) {
                testStdin = testData.TxtInput.Valid ? testData.TxtInput.String : '';
            }

            console.log(`Running code against Test ID: ${currentTestId}`);
            let apiResult = await this.api.compiler.runCode(code, inputFile, testStdin);
            console.log('API Result:', apiResult);
            const consoleOutput = (apiResult?.console ?? '').trim();
            console.log('Console Output:', consoleOutput);
            const expectedOutput = (testData?.ExpectedOutput ?? '').trim();
            console.log('Expected Output:', expectedOutput);

            givenAnswers.push(consoleOutput);
            currentTestId = testData.NextTestID;
        }

        const response = {
            given_answers: givenAnswers,
            // score,
            total: tests.length
        }

        console.warn('Final Response:', response);

        return { response };

        /*
        if (stdin === true) {
            const firstTestId = problemData.problem.FirstTest;
            console.log('First Test ID:', firstTestId);
            const firstTestData = typeof firstTestResponse === 'string' ? JSON.parse(firstTestResponse) : firstTestResponse;
            stdin = firstTestData.TxtInput.Valid ? firstTestData.TxtInput.String : '';
        }

        console.log('Problem Data:', problemData);
        const apiResult = await this.runCode(code, null, stdin);
        console.log('API Result:', apiResult);
        if (apiResult.console === firstTestResponse.ExpectedOutput) {
            return "Success: Output matches expected result." + apiResult.console;
        }
        */
    }

    async createSolution(problemId, solutionData) {
        // problemId, code, language, problem_id
        console.warn("here!!!! :3");
        return this.api.post(`/api/solutions`, { problem_id: problemId, ...solutionData }, true);
    }

    async updateSolution(solutionId, targetField, data) {
        if (targetField === 'tests') {
            console.log(`Updating solution ${solutionId} tests with data:`, data);
            return this.api.put(`/api/solutions/${solutionId}?target_field=tests`, data, true);
        }

        throw new Error('Unsupported target field for solution update');

    }

    async deleteSolution(solutionId) {
        return this.api.delete(`/api/solutions/${solutionId}`, true);
    }

    async getSolutionById(solutionId) {
        // if admin or owner
        return this.api.get(`/api/solutions?search_type=id&solution_id=${solutionId}`, true);
    }

    async getSolutionsByUser(userId) {
        return this.api.get(`/api/solutions?search_type=user&user_id=${userId}`, true);
    }

    async getSolutionsByProblem(problemId) {
        // owned or admin
        return this.api.get(`/api/solutions?search_type=problem&problem_id=${problemId}`, true);
    }

    async countSolutionsForProblem(problemId) {
        return this.api.get(`/api/solutions/count?search_type=problem&problem_id=${problemId}`, true);
    }

    async countSolutionsForUser(userId) {
        return this.api.get(`/api/solutions/count?search_type=user&user_id=${userId}`, true);
    }

    async modifyBookmarkProblem(problemId) {
        return this.api.post(`/api/problems/${problemId}/bookmark`, {}, true);
    }

    async getBookmarkedProblems(userId) {
        return this.api.get(`/api/users/${userId}/bookmarked_problems`, true);
    }

    async getProblemBookmarkStatus(problemId, userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }
        
        const bookmarks = await this.getBookmarkedProblems(userId);
        //console.log('Bookmarked Problems:', bookmarks);
        const isBookmarked = bookmarks.some(bookmark => bookmark.ProblemID === problemId);
        return isBookmarked;
    }

    // suggestions endpoints

    async getPendingProblems() {
        return this.api.get('/admin/problems/suggested', true);
    }

    async approveProblem(problemId) {
        return this.api.post(`/admin/problems/suggested/${problemId}/approve`, {}, true);
    }

    // bulk uploading from json, both problems and tests at the same time
    /* FORMAT:
    {
        "problema": [ // required, at least one problem, can be an array of multiple problems
            {
            "Titlu": "", // string
            "Sursa": "", // optional, can be comma separated if multiple sources (e.g. "Sursa1, Sursa2")
            "Descriere": "", // can be formatted as markdown but is stored as a string
            "Grup TestID": "", // numeric
            "Tags": "{}" // optional, can be missing
            }
        ],
        "test": [ // required, at least one test, can be an array of multiple tests, must have at least one test with Grup TestID matching the problem's Grup TestID
            {
            "Grup TestID": "", // numeric, must match the problem's Grup TestID to be associated with that problem
            "Input": "", // string - convert from number if necessary
            "Expected Output": "" // string - convert from number if necessary
            }
        ]
    }
    */

    async bulkUploadProblems(problemsData) {
        if (!problemsData || typeof problemsData !== 'object') {
            throw new Error('Invalid payload. Expected an object containing "problema" and "test" arrays.');
        }

        const normalizeHeader = (value) => String(value || '').toLowerCase().replace(/[\s_\-]/g, '');

        const getField = (obj, aliases) => {
            const aliasSet = new Set(aliases.map(normalizeHeader));
            for (const [key, value] of Object.entries(obj || {})) {
                if (aliasSet.has(normalizeHeader(key))) {
                    return value;
                }
            }
            return null;
        };

        const toIntOrNull = (value) => {
            if (value === null || value === undefined || value === '') {
                return null;
            }
            const parsed = parseInt(value, 10);
            return Number.isNaN(parsed) ? null : parsed;
        };

        const problems = Array.isArray(problemsData.problema) ? problemsData.problema : [];
        const tests = Array.isArray(problemsData.test) ? problemsData.test : [];

        if (problems.length === 0 || tests.length === 0) {
            throw new Error('Both "problema" and "test" arrays are required and must contain at least one item.');
        }

        const createdProblems = [];

        for (const problem of problems) {
            const parseTagsObject = (value) => {
                if (!value) return null;
                if (typeof value === 'object') return value;
                if (typeof value !== 'string') return null;

                const cleaned = value.trim()
                    .replace(/^'/, '')
                    .replace(/""/g, '"');

                try {
                    return JSON.parse(cleaned);
                } catch (_err) {
                    return null;
                }
            };

            const parsedTags = parseTagsObject(getField(problem, ['Tags', 'tags']));
            if (getField(problem, ['Tags', 'tags']) && !parsedTags) {
                console.warn('Invalid Tags JSON for problem, ignoring tags fallback.');
            }

            // "temporary" convention in this project, class info is stored in verification_type (don't ask why, it is a looong story)

            const readTagInt = (aliases) => {
                if (parsedTags && typeof parsedTags === 'object') {
                    const fromTags = toIntOrNull(getField(parsedTags, aliases));
                    if (fromTags !== null) return fromTags;
                }
                return toIntOrNull(getField(problem, aliases));
            };

            const difficulty = readTagInt(['difficulty']);
            const module = readTagInt(['module']);
            const solveType = readTagInt(['solve_type', 'solve type']);
            const resultType = readTagInt(['result_type', 'result type']);
            const section = readTagInt(['section']);
            const verificationType = readTagInt([
                'verification_type',
                'verification type',
                'preventive',
                'preventiv',
                'class',
                'clasa'
            ]);

            const problemPayload = {
                title: problem.Titlu,
                description: problem.Descriere,
                source: problem.Sursa || '',
                first_test_id: null,
            };

            if (difficulty !== null) problemPayload.difficulty = difficulty;
            if (module !== null) problemPayload.module = module;
            if (solveType !== null) problemPayload.solve_type = solveType;
            if (resultType !== null) problemPayload.result_type = resultType;
            if (section !== null) problemPayload.section = section;
            if (verificationType !== null) problemPayload.verification_type = verificationType;

            const createdProblemResponse = await this.createProblem(problemPayload);
            const createdProblem = typeof createdProblemResponse === 'string'
                ? JSON.parse(createdProblemResponse)
                : createdProblemResponse;
            const createdProblemId = createdProblem?.problem?.ID || createdProblem?.ID;

            if (!createdProblemId) {
                throw new Error('Problem creation succeeded but no problem ID was returned by the API. (not my fault if the API is broken, but still gotta catch this case)');
            }

            createdProblems.push({
                id: createdProblemId,
                grupTestId: String(problem['Grup TestID'] ?? ''),
                firstTestSet: false,
            });
        }

        let testsCreated = 0;
        let testsSkipped = 0;

        // Group tests by Grup TestID so each problem receives a linked test chain

        const testsByGroup = new Map();
        for (const test of tests) {
            const groupId = String(test['Grup TestID'] ?? '');
            if (!testsByGroup.has(groupId)) {
                testsByGroup.set(groupId, []);
            }
            testsByGroup.get(groupId).push(test);
        }

        for (const problem of createdProblems) {
            const groupTests = testsByGroup.get(problem.grupTestId) || [];

            if (groupTests.length === 0) {
                console.warn(`No tests found for problem group ${problem.grupTestId}, skipping this problem's tests.`);
                continue;
            }

            let previousTestId = null;
            let firstCreatedTestId = null;

            for (const test of groupTests) {
                const inputText = String(test.Input ?? '').trim();
                const expectedOutput = String(test['Expected Output'] ?? '').trim();

                if (!inputText || !expectedOutput) {
                    console.warn(`Skipping invalid test in group ${problem.grupTestId}: missing Input or Expected Output.`);
                    testsSkipped += 1;
                    continue;
                }

                const testPayload = {
                    input_text: inputText,
                    expected_output: expectedOutput,
                };

                if (previousTestId) {
                    testPayload.previous_test_id = previousTestId;
                }

                const createdTestResponse = await this.createTest(testPayload);
                const createdTest = typeof createdTestResponse === 'string'
                    ? JSON.parse(createdTestResponse)
                    : createdTestResponse;
                const createdTestId = createdTest?.test?.ID || createdTest?.ID;

                if (!createdTestId) {
                    throw new Error('Test creation succeeded but no test ID was returned by the API. details: ' + JSON.stringify(createdTestResponse));
                }

                if (!firstCreatedTestId) {
                    firstCreatedTestId = createdTestId;
                }

                previousTestId = createdTestId;
                testsCreated += 1;
            }

            // After all tests for this problem are created and linked, set the problem's first_test_id
            if (firstCreatedTestId) {
                try {
                    await this.updateProblem(problem.id, 'test', { first_test_id: firstCreatedTestId });
                } catch (err) {
                    console.error('Failed to set first_test_id for problem', problem.id, err);
                    // don't throw here to allow other problems to continue uploading
                }
            }
        }

        return {
            problems_created: createdProblems.length,
            tests_created: testsCreated,
            tests_skipped: testsSkipped,
        };
    }

    // tests endpoints (ported from problemsHandler)

    async createTest(data) {
        console.log('Creating test with data:', data);
        const result = await this.api.post('/api/tests', data, true);
        return result;
    }

    async updateTestField(testId, targetField, data) {
        console.log(`Updating test ${testId} field ${targetField} with data:`, data);
        const result = await this.api.put(`/api/tests/${testId}?target_field=${targetField}`, data, true);
        return result;
    }

    async updateTestInput(testId, data) {
        console.log('Updating test input:', data);
        const result = await this.updateTestField(testId, 'input', data);
        return result;
    }

    async updateTestExpectedOutput(testId, data) {
        const result = await this.updateTestField(testId, 'expected_output', data);
        return result;
    }

    async updateTestPrev(testId, data) {
        const result = await this.updateTestField(testId, 'prev', data);
        return result;
    }

    async updateTestNext(testId, data) {
        const result = await this.updateTestField(testId, 'next', data);
        return result;
    }

    async deleteTest(testId) {
        return this.api.delete(`/api/tests/${testId}`, true);
    }

    async uploadProblemImage(file) {
        return this.api.fileManager.uploadFile(file);
    }
}