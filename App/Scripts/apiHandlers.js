/*
   __    ____  ____  _   _    __    _  _  ____  __    ____  ____  ___     ____  ___ 
  /__\  (  _ \(_  _)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \/ __)   (_  _)/ __)
 /(__)\  )___/ _)(_  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /\__ \  .-_)(  \__ \
(__)(__)(__)  (____)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)(___/()\____) (___/

Pentru caching mai bun si gestionare mai eficientă.
(pentru my sanity mai tarziu)

Type O Negative - I Don't Wanna Be Me
*/

class ApiService {
    constructor() {
        this.baseURL = '';
        this.authToken = null;
        this.refreshToken = null;
        this.loadTokens();
    }

    // ===========================================
    // AUTH si tokens
    // ===========================================

    loadTokens() {
        this.authToken = localStorage.getItem('authToken');
        this.refreshToken = localStorage.getItem('refreshToken');
    }

    saveTokens(authToken, refreshToken) {
        this.authToken = authToken;
        this.refreshToken = refreshToken;
        localStorage.setItem('authToken', authToken);
        if (refreshToken) {
            localStorage.setItem('refreshToken', refreshToken);
        }
    }

    clearTokens() {
        this.authToken = null;
        this.refreshToken = null;
        localStorage.removeItem('authToken');
        localStorage.removeItem('refreshToken');
        localStorage.removeItem('username');
        localStorage.removeItem('userEmail');
        localStorage.removeItem('isAdmin');
        localStorage.removeItem('userID');
        localStorage.removeItem('profilePicID');
    }

    getAuthHeaders() {
        if (!this.authToken) {
            throw new Error('No authentication token available');
        }
        return {
            'Authorization': `Bearer ${this.authToken}`,
            'Content-Type': 'application/json'
        };
    }

    isAuthenticated(redirect = false) {
        const isAuth = !!this.authToken;
        if (!isAuth && redirect) {
            window.location.href = '/app/login.html?redirect=' + encodeURIComponent(window.location.pathname);
        }
        return isAuth;
    }

    // ===========================================
    // Requests!
    // ===========================================

    async makeRequest(url, options = {}) {
        const config = {

            ...options,
            headers: {
                'Content-Type': 'application/json',
                ...options.headers
            }

        };

        try {

            const response = await fetch(`${this.baseURL}${url}`, config);
            
            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(response.status, errorText, url);
            }

            const contentLength = response.headers.get('Content-Length');
            const contentType = response.headers.get('Content-Type');
            
            if (contentLength === '0' || response.status === 204) {
                return null;
            }

            if (contentType && contentType.includes('application/json')) {
                return await response.json();
            }

            return await response.text();

        } catch (error) {

            if (error instanceof ApiError) {
                throw error;
            }

            throw new ApiError(0, `Network error: ${error.message}`, url);

        }
    }

    async get(url, requiresAuth = false) {
        const headers = requiresAuth ? this.getAuthHeaders() : {};
        return this.makeRequest(url, {
            method: 'GET',
            headers
        });
    }

    async post(url, data, requiresAuth = false) {
        const headers = requiresAuth ? this.getAuthHeaders() : { 'Content-Type': 'application/json' };
        return this.makeRequest(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data)
        });
    }

    async put(url, data, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data)
        });
    }

    async delete(url, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'DELETE',
            headers: this.getAuthHeaders()
        });
    }

    // ===========================================
    // File Upload Methods
    // ===========================================

    async uploadFile(file, location = 'images') {

        if (!this.authToken) {
            throw new Error('Authentication required for file upload');
        }

        const formData = new FormData();
        formData.append('file', file);

        const response = await fetch(`${this.baseURL}/api/upload?location=${location}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            },
            body: formData
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(response.status, errorText, `/api/upload?location=${location}`);
        }

        return await response.json();
    }

    // ===========================================
    // auth endpoints
    // ===========================================

    async login(email, password) {
        let response = await this.post('/api/login', {
            email: email.trim(),
            password: password
        });

        // Parse JSON string if needed
        if (typeof response === 'string') {
            response = JSON.parse(response);
        }

        if (response.auth_token) {
            this.saveTokens(response.auth_token, response.refresh_token);
            
            if (response.user) {
                localStorage.setItem('username', response.user.Username);
                localStorage.setItem('userEmail', response.user.Email);
                localStorage.setItem('isAdmin', response.user.Permissions === 61);
                localStorage.setItem('userID', response.user.ID);
                if (response.user.ProfilePicID) {
                    localStorage.setItem('profilePicID', response.user.ProfilePicID);
                }
            }
        }

        return response;
    }

    async signup(userData) {
        return this.post('/api/create_user', userData);
    }

    async logout(confirmMessage = false, redirect = true) {
        if (confirmMessage ? confirm('Are you sure you want to log out?') : true) {
            this.clearTokens();
            if (redirect) {
                window.location.href = '/app/login.html?redirect=' + encodeURIComponent(window.location.href);
            }
            // Trigger auth button update if available
            if (window.refreshAuthButton) {
                window.refreshAuthButton();
            }
        }
    }

    // ===========================================
    // management user endpoints
    // ===========================================

    async getCurrentUser() {
        const userId = localStorage.getItem('userID');
        if (!userId) {
            return null;
        }
        return this.get(`/api/users/${userId}`, true);
    }

    async isCurrentAdmin() {
        const currentUser = await this.getCurrentUser();
        const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
        return userData.Permissions === 61;
    }

    async getUserById(userId) {
        return this.get(`/api/users/${userId}`);
    }

    async getCurrentUserUsername() {
        const userID = localStorage.getItem('userID');
        if (!userID) {
            throw new Error('No user ID found');
        }
        let userData = await this.get(`/api/users/${userID}`, true);
        userData = typeof userData === 'string' ? JSON.parse(userData) : userData;
        return userData.Username;
    }

    async updateUserField(field, value, pic = false) {
        const data = {};
        data[field] = value;
        return this.put(`/api/users?target_field=${pic ? 'pfp' : field}`, data);
    }

    async updatePassword(oldPassword, newPassword) {
        const data = {
            old_password: oldPassword,
            new_password: newPassword
        };
        return this.put(`/api/users?target_field=password`, data);
    }

    async updateEmail(newEmail) {
        return this.updateUserField('email', newEmail);
    }

    async updateUsername(newUsername) {
        localStorage.setItem('username', newUsername);
        return this.updateUserField('username', newUsername);
    }

    async updateProfilePicture(fileId) {
        return this.updateUserField('image_id', fileId, true);
    }

    // permissions management (admin only)

    async updateUserPermissions(userId, title) {
        const approvedTitles = ['admin', 'basic', 'teacher', 'moderator'];
        if (!approvedTitles.includes(title)) {
            throw new Error(`Invalid title. Approved titles are: ${approvedTitles.join(', ')}`);
        }
        return this.post('/admin/users/account_status', { userID: userId, title }, true);
    }

    // ===========================================
    // Lesson Management Endpoints
    // ===========================================

    async createLesson(lessonData) {
        return this.post('/api/lessons', lessonData, true);
    }

    async getLessons(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `/api/lessons?${queryString}` : '/api/lessons';
        return this.get(url, false);
    }

    async getLessonById(lessonId) {
        return this.get(`/api/lessons?search_type=id&lesson_id=${lessonId}`, false);
    }

    async getLessonsByFlags(classNum = null, section = null, module = null) {
        return this.get(`/api/lessons?search_type=flags&class=${classNum}&section=${section}&module=${module}`, false);
    }

    async getLessonsSortedByPrevNext(classNum = null, section = null, module = null, debug = false) {
        console.log(`[DEBUG] getLessonsSortedByPrevNext called with:`, { classNum, section, module, debug });

        const response = await this.getLessonsByFlags(classNum, section, module);
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        console.log(`[DEBUG] lessonsData:`, lessonsData);

        if (!Array.isArray(lessonsData) || lessonsData.length === 0) {
            console.warn("[WARN] No lessons found for given flags.");
            return [];
        }

        let lessons = [];
        let startLesson = null;
        let nextId = null;

        // attempt to find a section starter (if not in debug mode)

        if (!debug) {
            const sectionStarter = lessonsData.find(lesson => {
                const starter = lesson.lesson.SectionStarter;
                let valid = false;

                if (typeof starter === 'boolean') {
                    valid = starter === true;
                } else if (starter && typeof starter === 'object') {
                    valid = starter.Valid && starter.Int32 === section;
                }

                console.log(`[DEBUG] Checking lesson ${lesson.lesson.ID} for section starter:`, {
                    sectionStarter: starter,
                    valid,
                    targetSection: section
                });

                return valid;
            });

            if (sectionStarter) {
                console.log(`[DEBUG] Found section starter:`, sectionStarter);
                startLesson = sectionStarter;
            } else {
                console.log(`[DEBUG] No section starter found for section ${section}, falling back to first lesson in chain.`);
            }
        }

        // fallback (also used when debug === true)
        if (!startLesson) {
            startLesson = lessonsData.find(lesson =>
                !lesson.lesson.PrevLessonID || lesson.lesson.PrevLessonID === ""
            );
            console.log(`[DEBUG] Fallback - found first lesson:`, startLesson);
        }

        // if still no valid starting point, just return lessons sorted by creation time
        if (!startLesson) {
            console.log(`[DEBUG] No valid chain start found, sorting by CreatedAt`);
            return lessonsData.sort((a, b) => {
                const dateA = new Date(a.lesson.CreatedAt.Time);
                const dateB = new Date(b.lesson.CreatedAt.Time);
                return dateA - dateB;
            });
        }

        // build chain
        lessons.push(startLesson);
        nextId = startLesson.lesson.NextLessonID;

        while (nextId) {
            // avoid circular reference exists
            if (lessons.some(l => l.lesson.ID === nextId)) {
                console.warn(`[WARN] Circular reference detected at lesson ${nextId}.`);
                break;
            }

            const nextLesson = lessonsData.find(l => l.lesson.ID === nextId);
            if (nextLesson) {
                lessons.push(nextLesson);
                nextId = nextLesson.lesson.NextLessonID;
            } else {
                nextId = null; // chain ends
            }
        }

        console.log(`[DEBUG] Final sorted lessons:`, lessons);
        return lessons;
    }

    async getSectionsForClass(classNum){
        console.warn("getSectionsForClass is DEPRECATED. Use getSections instead.");
        const result = await this.getSections(classNum, null);
        for (let i = 0; i < result.length; i++) {
            result[i] = result[i].section;
        }
        return result;
    }

    async getSections(classNum = null, module = null) {
        const response = await this.getLessonsByFlags(classNum, null, module);
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        const sectionsMap = new Map();

        lessonsData.forEach(lesson => {
            const key = `${lesson.flag_translation.class}-${lesson.flag_translation.section}`;
            sectionsMap.set(key, {
                section: lesson.flag_translation.section,
                class: lesson.flag_translation.class,
                module: lesson.flag_translation.module
            });

        })
        
        const result = Array.from(sectionsMap.values());
        // Sort by class first, then by section
        result.sort((a, b) => {
            if (a.class !== b.class) return a.class - b.class;
            return a.section - b.section;
        });
        return result;
    }

    async modifyBookmark(lessonId) {
        return this.post(`/api/lessons/${lessonId}/bookmark`, {}, true);
    }

    async modifyFavorite(lessonId) {
        return this.post(`/api/lessons/${lessonId}/favorite`, {}, true);
    }

    async getBookmarks(userId) {
        return this.get(`/api/users/${userId}/bookmarks`);
    }

    async getBookmarkStatus(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }
        
        const bookmarks = await this.getBookmarks(userId);
        console.log('Bookmarks:', bookmarks);
        const isBookmarked = bookmarks.some(bookmark => bookmark.LessonID === lessonId);
        return isBookmarked;
    }

    async getFavoritesNumber(lessonId) {
        return this.get(`/api/lessons/${lessonId}/faves`);
    }

    async getFavoriteStatus(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }
        
        try {
            const response = await this.get(`/api/lessons/${lessonId}/users/${userId}`, true);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            return data.Favorited;
        } catch (error) {
            console.error('Failed to get favorite status:', error);
            return false;
        }
    }

    async finishLesson(lessonId) {
        return this.post(`/api/lessons/${lessonId}/complete`, {}, true);
    }

    async startLesson(lessonId) {
        return this.post(`/api/lessons/${lessonId}/start`, {}, true);
    }

    async getCompletionTime(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }

        const response = await this.get(`/api/lessons/${lessonId}/users/${userId}`, true);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        const startTime = new Date(data.StartedAt.Time);
        const finishTime = new Date(data.CompletedAt.Time);
        const durationMs = finishTime - startTime;
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const dataFormatted = `${minutes} minute(s) and ${seconds} second(s)`;
        return dataFormatted;
    }

    async getInteractions(userId = null, max_results = 3) {

        if (!userId) {
            const currentUser = await this.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }

        let response = await this.get(`/api/users/${userId}/interactions`);
        // sort by UpdatedAt descending
        response.sort((a, b) => {
            const dateA = new Date(a.UpdatedAt.Time);
            const dateB = new Date(b.UpdatedAt.Time);
            return dateB - dateA;
        });
        response = response.slice(0, max_results);
        console.log("User interactions:", response);
        return response;

    }

    async updateLessonOrder(lessonId, prev = null, next = null) {
        // Validate lesson ID
        if (!lessonId || lessonId.trim() === '') {
            throw new Error('Invalid lesson ID: lesson ID cannot be empty');
        }

        if (prev != null) {
            return await this.put(`/api/lessons/${lessonId}?target_field=prev`, { prev: prev }, true);
        }
        if (next != null) {
            return await this.put(`/api/lessons/${lessonId}?target_field=next`, { next: next }, true);
        }
    }

    async updateLessonSectionStarter(lessonId, sectionNumber) {
        return this.put(`/api/lessons/${lessonId}?target_field=section_starter`, { section: sectionNumber }, true);
    }

    async updateLessonContent(lessonId, file) {
        // First upload the file
        const fileResponse = await this.uploadFile(file, 'lessons');
        // here we could also delete the old file :D
        return this.put(`/api/lessons/${lessonId}?target_field=content`, { content_id: fileResponse.file_id }, true);
    }

    async uploadLesson(lessonData, file) {
        // First upload the file
        const fileResponse = await this.uploadFile(file, 'lessons');
        
        const lessonPayload = {
            ...lessonData,
            content_id: fileResponse.file_id
        };
        
        return this.createLesson(lessonPayload);
    }

    // Update existing lesson

    async updateLessonField(lessonId, targetField, data) {
        // field can be: flags (class, section, module), details (title, description)
        return this.put(`/api/lessons/${lessonId}?target_field=${targetField}`, data, true);
    }

    // suggestions endpoints

    async getPendingLessons() {
        return this.get('/admin/lessons/suggested', true);
    }

    async approveLesson(lessonId) {
        return this.post(`/admin/lessons/suggested/${lessonId}/approve`, {}, true);
    }

    // ===========================================
    // Problems Management Endpoints
    // ===========================================

    async createProblem(problemData) {
        // title, description, source, first_test_id, thumbnail_id, [TAGS] difficulty, module, solve_type, result_type, verification_type, section
        return this.post('/api/problems', problemData, true);
    }

    async updateProblem(problemId, targetField, data) {
        // targetField: tags, details, test, thumbnail
        return this.put(`/api/problems/${problemId}?target_field=${targetField}`, data, true);
    }

    async getProblems() {
        return this.get('/api/problems', false);
    }

    async getProblemById(problemId) {
        return this.get(`/api/problems?search_type=id&problem_id=${problemId}`, false);
    }

    async getTestById(testId) {
        return this.get(`/api/tests/${testId}`, false);
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

        return this.runCode(code, inputFile, stdin);

        //298662bc-7e90-4568-8ec7-325a76f0eded
    }

    async runCodeAgainstProblemTests(problemId, code, inputFile = null, stdin = true) {

        if (this.isAuthenticated() === false) {
            throw new Error('Authentication required to run code against problem tests');
        }
        const problemResponse = await this.getProblemById(problemId);
        const firstTestId = stdin ? problemResponse.problem.FirstTest : null;
        const problemData = typeof problemResponse === 'string' ? JSON.parse(problemResponse) : problemResponse;
        console.log('Problem Data:', problemData);

        let currentTestId = firstTestId;
        let currentTestResponse = null;

        if (!problemData || !problemData.problem.FirstTest) {
            throw new Error('No tests found for the specified problem');
        }

        let score = 0;
        let tests = await this.getTestChainForFirstTest(currentTestId);

        console.warn('Test Chain:', tests);

        while (currentTestId) {
            currentTestResponse = await this.getTestById(currentTestId);
            const testData = typeof currentTestResponse === 'string' ? JSON.parse(currentTestResponse) : currentTestResponse;

            let testStdin = '';
            if (stdin === true) {
                testStdin = testData.TxtInput.Valid ? testData.TxtInput.String : '';
            }

            console.log(`Running code against Test ID: ${currentTestId}`);
            let apiResult = await this.runCode(code, inputFile, testStdin);
            console.log('API Result:', apiResult);

            if (apiResult.console.trim() === testData.ExpectedOutput.trim()) {
                score += 1;
            }

            if (apiResult.console.trim() !== testData.ExpectedOutput.trim()) {
                score += 0;
            }
            currentTestId = testData.NextTestID;
        }

        console.log(`Final Score: ${score} out of ${tests.length}`);
        return { score, total: tests.length };

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
        return this.post(`/api/solutions`, { problem_id: problemId, ...solutionData }, true);
    }

    async updateSolution(solutionId, targetField, data) {
        // targetField: tests
        if (targetField === 'tests') {
            // tests_passed, total_tests
            return this.put(`/api/solutions/${solutionId}?target_field=tests`, data, true);
        }

        throw new Error('Unsupported target field for solution update');

    }

    async getSolutionById(solutionId) {
        // if admin or owner
        return this.get(`/api/solutions?search_type=id&solution_id=${solutionId}`, true);
    }

    async getSolutionsByUser(userId) {
        return this.get(`/api/solutions?search_type=user&user_id=${userId}`, true);
    }

    async getSolutionsByProblem(problemId) {
        // owned or admin
        return this.get(`/api/solutions?search_type=problem&problem_id=${problemId}`, true);
    }

    async countSolutionsForProblem(problemId) {
        return this.get(`/api/solutions/count?search_type=problem&problem_id=${problemId}`, true);
    }

    async countSolutionsForUser(userId) {
        return this.get(`/api/solutions/count?search_type=user&user_id=${userId}`, true);
    }

    async modifyBookmarkProblem(problemId) {
        return this.post(`/api/problems/${problemId}/bookmark`, {}, true);
    }

    async getBookmarkedProblems(userId) {
        return this.get(`/api/users/${userId}/bookmarked_problems`, true);
    }

    async getProblemBookmarkStatus(problemId, userId = null) {
        if (!userId) {
            const currentUser = await this.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }
        
        const bookmarks = await this.getBookmarkedProblems(userId);
        console.log('Bookmarked Problems:', bookmarks);
        const isBookmarked = bookmarks.some(bookmark => bookmark.ProblemID === problemId);
        return isBookmarked;
    }

    // suggestions endpoints

    async getPendingProblems() {
        return this.get('/admin/problems/suggested', true);
    }

    async approveProblem(problemId) {
        return this.post(`/admin/problems/suggested/${problemId}/approve`, {}, true);
    }
    // ===========================================
    // File Management Endpoints
    // ===========================================

    async getFile(fileId) {
        return this.get(`/api/files/${fileId}`, false);
    }

    getFileUrl(fileId) {
        return `${this.baseURL}/api/files/${fileId}`;
    }

    async getProfilePicture(userId = null) {
        if (!userId) {
            const profilePicId = localStorage.getItem('profilePicID');
            if (profilePicId) {
                return this.getFileUrl(profilePicId);
            }
            return null;
        }
        
        const user = await this.getUserById(userId);
        const userData = typeof user === 'string' ? JSON.parse(user) : user;
        if (userData.ProfilePicID) {
            return this.getFileUrl(userData.ProfilePicID);
        }
        return null;
    }

    // ===========================================
    // Code Execution (Piston API) WE ARE USING JUDGE0 UNTIL WE CAN SELF HOST PISTON
    // ===========================================

    async runCodePiston(code, inputFile = null, stdin = '') {
        const PISTON_API = 'https://cpp-runner.fly.dev/api/v2/piston/execute';
        const FILE_OUTPUT_MARKER = '___FILE_OUTPUT_START___';
        const FILE_OUTPUT_END_MARKER = '___FILE_OUTPUT_END___';

        let processedCode = code;
        let injectedCode = '';

        if (inputFile && inputFile.name && inputFile.content) {
            const escaped = inputFile.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n');

            injectedCode += `
                #include <fstream>
                void __create_input_file() {
                std::ofstream f("${inputFile.name}");
                f << "${escaped}";
                f.close();
                }
                struct __FileCreator { __FileCreator() { __create_input_file(); } } __fc;
            `;
        }

        injectedCode += `
            #include <fstream>
            #include <iostream>
            #include <string>
            struct __FileReader {
            ~__FileReader() {
                std::ifstream f("output.txt");
                if (f.good()) {
                std::cout << "${FILE_OUTPUT_MARKER}";
                std::string line;
                while (std::getline(f, line)) {
                    std::cout << line << "\\n";
                }
                std::cout << "${FILE_OUTPUT_END_MARKER}";
                f.close();
                }
            }
            } __fr;
        `;

        const includeMatch = processedCode.match(/^((?:#include\s*<[^>]+>\s*\n|#include\s*"[^"]+"\s*\n|using\s+namespace\s+\w+;\s*\n)*)/);
        if (includeMatch) {
            const includes = includeMatch[1];
            const rest = processedCode.slice(includes.length);
            processedCode = includes + injectedCode + rest;
        } else {
            processedCode = injectedCode + processedCode;
        }

        const res = await fetch(PISTON_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language: 'c++',
                version: '10.2.0',
                files: [{ name: 'main.cpp', content: processedCode }],
                stdin: stdin
            })
        });

        const result = await res.json();

        if (result.message) {
            return { success: false, error: result.message, console: '', file: '' };
        }

        if (result.compile?.stderr && !result.run) {
            return { success: false, error: result.compile.stderr, console: '', file: '' };
        }

        let stdout = result.run?.stdout || '';
        let fileOutput = '';

        const startIdx = stdout.indexOf(FILE_OUTPUT_MARKER);
        const endIdx = stdout.indexOf(FILE_OUTPUT_END_MARKER);
        if (startIdx !== -1 && endIdx !== -1) {
            fileOutput = stdout.slice(startIdx + FILE_OUTPUT_MARKER.length, endIdx);
            stdout = stdout.slice(0, startIdx) + stdout.slice(endIdx + FILE_OUTPUT_END_MARKER.length);
        }

        let consoleOutput = '';
        if (result.compile?.stderr) {
            consoleOutput += 'Warnings:\n' + result.compile.stderr + '\n';
        }
        if (stdout) consoleOutput += stdout;
        if (result.run?.stderr) consoleOutput += '\nStderr:\n' + result.run.stderr;

        return {
            success: !result.run?.stderr,
            console: consoleOutput || '',
            file: fileOutput,
            error: result.run?.stderr || null
        };
    }

    async runCode(code, inputFile = null, stdin = '') {
        const JUDGE0_API = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
        
        const FILE_OUTPUT_MARKER = '___FILE_OUTPUT_START___';
        const FILE_OUTPUT_END_MARKER = '___FILE_OUTPUT_END___';

        let processedCode = code;
        let injectedCode = '';

        if (inputFile && inputFile.name && inputFile.content) {
            const escaped = inputFile.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n');

            injectedCode += `
                #include <fstream>
                void __create_input_file() {
                std::ofstream f("${inputFile.name}");
                f << "${escaped}";
                f.close();
                }
                struct __FileCreator { __FileCreator() { __create_input_file(); } } __fc;
            `;
        }

        injectedCode += `
            #include <fstream>
            #include <iostream>
            #include <string>
            struct __FileReader {
            ~__FileReader() {
                std::ifstream f("output.txt");
                if (f.good()) {
                std::cout << "${FILE_OUTPUT_MARKER}";
                std::string line;
                while (std::getline(f, line)) {
                    std::cout << line << "\\n";
                }
                std::cout << "${FILE_OUTPUT_END_MARKER}";
                f.close();
                }
            }
            } __fr;
        `;

        const includeMatch = processedCode.match(/^((?:#include\s*<[^>]+>\s*\n|#include\s*"[^"]+"\s*\n|using\s+namespace\s+\w+;\s*\n)*)/);
        if (includeMatch) {
            const includes = includeMatch[1];
            const rest = processedCode.slice(includes.length);
            processedCode = includes + injectedCode + rest;
        } else {
            processedCode = injectedCode + processedCode;
        }

        // 2. Updated Fetch Call for Judge0
        const res = await fetch(JUDGE0_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language_id: 54, // ID 54 = C++ (GCC 9.2.0)
                source_code: processedCode,
                stdin: stdin
            })
        });

        const result = await res.json();

        // Judge0 returns a "message" field if there is an API-level error (e.g. rate limit)
        if (result.message) {
            return { success: false, error: "API Error: " + result.message, console: '', file: '' };
        }

        // Status ID 6 = "Compilation Error" (Judge0 specific)
        if (result.status?.id === 6) {
            return { 
                success: false, 
                error: result.compile_output || "Compilation failed", 
                console: '', 
                file: '' 
            };
        }

        let stdout = result.stdout || '';
        let fileOutput = '';

        // --- OUTPUT EXTRACTION LOGIC ---
        const startIdx = stdout.indexOf(FILE_OUTPUT_MARKER);
        const endIdx = stdout.indexOf(FILE_OUTPUT_END_MARKER);
        if (startIdx !== -1 && endIdx !== -1) {
            fileOutput = stdout.slice(startIdx + FILE_OUTPUT_MARKER.length, endIdx);
            stdout = stdout.slice(0, startIdx) + stdout.slice(endIdx + FILE_OUTPUT_END_MARKER.length);
        }

        let consoleOutput = '';
        
        // Judge0 provides compile output in a different field, and it's only present if there are warnings (not just errors)
        if (result.compile_output) { 
            consoleOutput += 'Warnings:\n' + result.compile_output + '\n';
        }
        
        if (stdout) consoleOutput += stdout;
        
        if (result.stderr) consoleOutput += '\nStderr:\n' + result.stderr;

        // Status ID 3 is "Accepted"
        const isSuccess = result.status?.id === 3;

        return {
            success: isSuccess,
            console: consoleOutput || '',
            file: fileOutput,
            error: result.stderr || null
        };
    }

    // ===========================================
    // Misc Stuff
    // ===========================================

    getResolvedHex(cssColor) {
        const canvas = document.createElement('canvas');
        canvas.width = 1;
        canvas.height = 1;
        const ctx = canvas.getContext('2d');
        
        ctx.fillStyle = cssColor;
        ctx.fillRect(0, 0, 1, 1);
        
        const [r, g, b] = ctx.getImageData(0, 0, 1, 1).data;
        
        const toHex = (v) => v.toString(16).padStart(2, '0');
        return `${toHex(r)}${toHex(g)}${toHex(b)}`;
    }

    getPatternUrl(seed, type = 'shapes') {
        const bodyStyle = window.getComputedStyle(document.body);
        
        // 1. Get the raw variable strings
        const color1 = bodyStyle.getPropertyValue('--primary').trim() || 
                        bodyStyle.getPropertyValue('--base-primary').trim();
        const color2 = bodyStyle.getPropertyValue('--contrast').trim() || "#ffffff";
        const color3 = bodyStyle.getPropertyValue('--fundal').trim() || "#ffffff";
        const color4 = bodyStyle.getPropertyValue('--confirm').trim() || "#ffffff";
        const color5 = bodyStyle.getPropertyValue('--danger').trim() || "#ffffff";
        const color6 = bodyStyle.getPropertyValue('--warning').trim() || "#ffffff";

        let color1Hex = "000000"; 
        if (color1) {
            const colorToResolve = color1.includes('(') ? color1 : `oklch(${color1})`;
            color1Hex = this.getResolvedHex(colorToResolve);
        }

        const color2Hex = this.getResolvedHex(color2);
        const color3Hex = this.getResolvedHex(color3);
        const color4Hex = this.getResolvedHex(color4);
        const color5Hex = this.getResolvedHex(color5);
        const color6Hex = this.getResolvedHex(color6);

        const selectedShapes = 'circle,square,triangle'; 
        return `https://api.dicebear.com/9.x/
        shapes/svg?
        seed=${seed}&
        shape1Color=${color6Hex}&
        shape2Color=${color4Hex}&
        shape3Color=${color3Hex},${color5Hex}&
        backgroundColor=${color1Hex}&
        randomizeIds=true`
        .replace(/\s/g, '');
    }

    getChart(target, typeOf = 'radar', dataCombined = {}, extraOptions = {}) {
        let dataExtracted = dataCombined.data || {};
        const config = {
            type: typeOf,
            data: dataExtracted,
            options: {
                responsive: true,
                maintainAspectRatio: false, 
                plugins: {
                    title: {
                        display: false,
                        text: dataCombined.title || '',
                        color: '#ffffff'
                    },
                    legend: {
                        labels: { color: '#ffffff' }
                    }
                },
                scales: {
                    r: { 
                        beginAtZero: true,
                        suggestedMax: 100,
                        grid: { color: 'rgba(255, 255, 255, 0.1)' },
                        angleLines: { color: 'rgba(255, 255, 255, 0.2)' },
                        pointLabels: {
                            color: '#ffffff', 
                            font: { size: 14 }
                        },
                        ticks: {
                            color: '#a0aec0', 
                            backdropColor: 'transparent', 
                            stepSize: 20 
                        }
                    }
                }
            }
        };

        if (extraOptions && typeof extraOptions === 'object') {
            config.options = { ...config.options, ...extraOptions };
        }

        return new Chart(target, config);
    }

    getUserDataGDPR() {
        return this.get('/api/users/gdpr', true);
    }
        
}
// ===========================================
// Toasts Loader
// ===========================================

class ToastsLoader {
    constructor() {
        this.toastsContainer = null;
        this.init();
    }

    init() {
        if(document.body) {
            this.createContainer();
        } else {
            document.addEventListener('DOMContentLoaded', () => {
                this.createContainer();
            });
        }
    }

    createContainer() {
        if(!this.toastsContainer) {
            this.toastsContainer = document.createElement('div');
            this.toastsContainer.className = 'toast-container';
            document.body.appendChild(this.toastsContainer);
        }
    }

    showToast(message, type = 'info', duration = 3000) {
        const validTypes = ['info', 'danger', 'confirm', 'warning'];
        if (!validTypes.includes(type)) {
            console.warn(`Invalid toast type: ${type}. Defaulting to 'info'.`);
            type = 'info';
        }
        if (!message || typeof message !== 'string') {
            console.warn('Invalid toast message');
            return;
        }
        if (!this.toastsContainer) {
            console.warn('Toasts container not ready yet');
            return;
        }
        if (duration <= 0) {
            duration = 3000;
        }
        
        const toast = document.createElement('div');
        toast.className = `card-t toast toast-${type}`;
        if(type === validTypes[0]) { // info
            toast.innerHTML = `<i class="fas fa-info-circle"></i><p>${message}</p>`;
        } else if(type === validTypes[1]) { // danger
            toast.innerHTML = `<i class="fas fa-exclamation-triangle"></i><p>${message}</p>`;
        } else if(type === validTypes[2]) { // confirm
            toast.innerHTML = `<i class="fas fa-check-circle"></i><p>${message}</p>`;
        } else if(type === validTypes[3]) { // warning
            toast.innerHTML = `<i class="fas fa-exclamation-circle"></i><p>${message}</p>`;
        }
        this.toastsContainer.appendChild(toast);

        setTimeout(() => {
            toast.classList.add('fade-out');
            toast.addEventListener('animationend', () => {
                toast.remove();
            });
        }, duration);
        //toast.remove();

    }
}

// ===========================================
// Error Handling
// ===========================================

class ApiError extends Error {
    constructor(status, message, url) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.url = url;
    }

    isNetworkError() {
        return this.status === 0;
    }

    isServerError() {
        return this.status >= 500;
    }

    isClientError() {
        return this.status >= 400 && this.status < 500;
    }

    isUnauthorized() {
        return this.status === 401;
    }

    isForbidden() {
        return this.status === 403;
    }

    isNotFound() {
        return this.status === 404;
    }
}

// ===========================================
// Global Instance & Utilities
// ===========================================

window.apiService = new ApiService();

window.handleApiError = function(error, defaultMessage = 'An error occurred') {
    console.error('API Error:', error);
    toastsLoader.showToast('An error occurred while processing your request.', 'info', 3000);
    //alert(error);
    if (error instanceof ApiError) {
        if (error.isUnauthorized()) {
            toastsLoader.showToast('Invalid credentials or session expired. Please log in again.', 'danger', 3000);
            //window.apiService.logout();
            //window.location.href = 'login.html';
            return;
        }
        
        if (error.isNetworkError()) {
            toastsLoader.showToast('Network error. Please check your connection and try again.', 'warning', 3000);
            return;
        }
        
        if (error.isServerError()) {
            toastsLoader.showToast('Server error. Please try again later.', 'danger', 3000);
            return;
        }
        
        // Show the actual error message for client errors
        toastsLoader.showToast(error.message || defaultMessage, 'info', 3000);
    } else {
        toastsLoader.showToast(defaultMessage, 'info', 3000);
    }
};

// Quick auth check utility
window.requireAuth = function(redirectTo = 'login.html') {
    if (!window.apiService.isAuthenticated()) {
        window.location.href = redirectTo;
        return false;
    }
    return true;
};

// Export for modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiService, ApiError };
}

let toastsLoader;
if(document.body) {
    toastsLoader = new ToastsLoader();
} else {
    document.addEventListener('DOMContentLoaded', () => {
        toastsLoader = new ToastsLoader();
    });
}

