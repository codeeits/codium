/*
   __    ____  ____  _   _    __    _  _  ____  __    ____  ____  ___     ____  ___ 
  /__\  (  _ \(_  _)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \/ __)   (_  _)/ __)
 /(__)\  )___/ _)(_  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /\__ \  .-_)(  \__ \
(__)(__)(__)  (____)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)(___/()\____) (___/

Pentru caching mai bun si gestionare mai eficientă.
(pentru my sanity mai tarziu)
tbh this file got way more bloated than I expected, need to start splitting it up.

Type O Negative - I Don't Wanna Be Me
*/

import { UserService } from "./services/userService.js";
import { LessonService } from "./services/lessonService.js";
import { ProblemService } from "./services/problemService.js";

class ApiService {
    constructor() {
        this.baseURL = '';
        this.authToken = null;
        this.refreshToken = null;
        this.refreshInFlight = null;

        this.users = new UserService(this);
        this.lessons = new LessonService(this);
        this.problems = new ProblemService(this);

        this.loadTokens();
    }

    warnDeprecated(methodName, alternative = "users") {
        console.trace(`BRIDGED METHOD: use ${alternative}.${methodName} instead.`);
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

    isDevEnvironment() {
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1';
    }

    debugRefresh(message, toastType = 'info') {
        if (!this.isDevEnvironment()) return;

        console.info(`[Auth Refresh] ${message}`);

        const toast = window.toastsLoader;
        if (toast && typeof toast.showToast === 'function') {
            toast.showToast(message, toastType, 1800);
        }
    }

    async refreshAuthToken() {
        if (!this.refreshToken) {
            throw new ApiError(401, 'Missing refresh token', '/api/refresh');
        }

        if (this.refreshInFlight) {
            return this.refreshInFlight;
        }

        this.refreshInFlight = (async () => {
            const response = await fetch(`${this.baseURL}/api/refresh`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ refresh_token: this.refreshToken })
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(response.status, errorText || 'Failed to refresh token', '/api/refresh');
            }

            const data = await response.json();
            if (!data?.auth_token) {
                throw new ApiError(500, 'Invalid refresh response: missing auth_token', '/api/refresh');
            }

            this.saveTokens(data.auth_token, this.refreshToken);
            this.debugRefresh('Session refreshed successfully.');
            return data.auth_token;
        })();

        try {
            return await this.refreshInFlight;
        } catch (error) {
            this.debugRefresh('Session refresh failed. Please log in again.', 'warning');
            this.clearTokens();
            throw error;
        } finally {
            this.refreshInFlight = null;
        }
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

            let response = await fetch(`${this.baseURL}${url}`, config);

            const shouldTryRefresh = response.status === 401 && options.requiresAuth === true && options.retryOnAuthFailure !== false;
            if (shouldTryRefresh) {
                await this.refreshAuthToken();
                const retryConfig = {
                    ...config,
                    headers: {
                        ...config.headers,
                        'Authorization': `Bearer ${this.authToken}`
                    }
                };
                response = await fetch(`${this.baseURL}${url}`, retryConfig);
            }

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
            headers,
            requiresAuth
        });
    }

    async post(url, data, requiresAuth = false) {
        const headers = requiresAuth ? this.getAuthHeaders() : { 'Content-Type': 'application/json' };
        return this.makeRequest(url, {
            method: 'POST',
            headers,
            body: JSON.stringify(data),
            requiresAuth
        });
    }

    async put(url, data, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'PUT',
            headers: this.getAuthHeaders(),
            body: JSON.stringify(data),
            requiresAuth
        });
    }

    async delete(url, requiresAuth = true) {
        return this.makeRequest(url, {
            method: 'DELETE',
            headers: this.getAuthHeaders(),
            requiresAuth
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

        let response = await fetch(`${this.baseURL}/api/upload?location=${location}`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.authToken}`
            },
            body: formData
        });

        if (response.status === 401) {
            await this.refreshAuthToken();
            response = await fetch(`${this.baseURL}/api/upload?location=${location}`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.authToken}`
                },
                body: formData
            });
        }

        if (!response.ok) {
            const errorText = await response.text();
            throw new ApiError(response.status, errorText, `/api/upload?location=${location}`);
        }

        return await response.json();
    }

    // ===========================================
    // auth endpoints (Bridged)
    // ===========================================

    async login(email, password) {
        this.warnDeprecated('login()');
        return this.users.login(email, password);
    }

    async signup(userData) {
        this.warnDeprecated('signup()');
        return this.users.signup(userData);
    }

    async logout(confirmMessage = false, redirect = true) {
        this.warnDeprecated('logout()');
        return this.users.logout(confirmMessage, redirect);
    }

    // ===========================================
    // management user endpoints (Bridged)
    // ===========================================

    async getCurrentUser() {
        this.warnDeprecated('getCurrentUser()');
        return this.users.getCurrentUser();
    }

    async isCurrentAdmin() {
        this.warnDeprecated('isCurrentAdmin()');
        return this.users.isCurrentAdmin();
    }

    async getUserById(userId) {
        this.warnDeprecated('getUserById()');
        return this.users.getUserById(userId);
    }

    async getCurrentUserUsername() {
        this.warnDeprecated('getCurrentUserUsername()');
        return this.users.getCurrentUserUsername();
    }

    async updateUserField(field, value, pic = false) {
        this.warnDeprecated('updateUserField()');
        return this.users.updateUserField(field, value, pic);
    }

    async updatePassword(oldPassword, newPassword) {
        this.warnDeprecated('updatePassword()');
        return this.users.updatePassword(oldPassword, newPassword);
    }

    async updateEmail(newEmail) {
        this.warnDeprecated('updateEmail()');
        return this.users.updateEmail(newEmail);
    }

    async updateUsername(newUsername) {
        this.warnDeprecated('updateUsername()');
        return this.users.updateUsername(newUsername);
    }

    async updateProfilePicture(fileId) {
        this.warnDeprecated('updateProfilePicture()');
        return this.users.updateProfilePicture(fileId);
    }

    // permissions management (admin only)

    async updateUserPermissions(userId, title) {
        this.warnDeprecated('updateUserPermissions()');
        return this.users.updateUserPermissions(userId, title);
    }

    // danger area

    async deleteAccount(userId = null) {
        this.warnDeprecated('deleteAccount()');
        return this.users.deleteAccount(userId);
    }
    // ===========================================
    // Lesson Management Endpoints (Bridged)
    // ===========================================

    async createLesson(lessonData) {
        this.warnDeprecated('createLesson()', 'lessons');
        return this.lessons.createLesson(lessonData);
    }

    async getLessons(params = {}) {
        this.warnDeprecated('getLessons()', 'lessons');
        return this.lessons.getLessons(params);
    }

    async getLessonById(lessonId) {
        this.warnDeprecated('getLessonById()', 'lessons');
        return this.lessons.getLessonById(lessonId);
    }

    async getLessonsByFlags(classNum = null, section = null, module = null) {
        this.warnDeprecated('getLessonsByFlags()', 'lessons');
        return this.lessons.getLessonsByFlags(classNum, section, module);
    }

    async getLessonsSortedByPrevNext(classNum = null, section = null, module = null, debug = false) {
        this.warnDeprecated('getLessonsSortedByPrevNext()', 'lessons');
        return this.lessons.getLessonsSortedByPrevNext(classNum, section, module, debug);
    }

    async getSectionsForClass(classNum){
        this.warnDeprecated('getSectionsForClass()', 'lessons');
        return this.lessons.getSectionsForClass(classNum);
    }

    async getSections(classNum = null, module = null) {
        this.warnDeprecated('getSections()', 'lessons');
        return this.lessons.getSections(classNum, module);
    }

    async modifyBookmark(lessonId) {
        this.warnDeprecated('modifyBookmark()', 'lessons');
        return this.lessons.modifyBookmark(lessonId);
    }

    async modifyFavorite(lessonId) {
        this.warnDeprecated('modifyFavorite()', 'lessons');
        return this.lessons.modifyFavorite(lessonId);
    }

    async getBookmarks(userId) {
        this.warnDeprecated('getBookmarks()', 'lessons');
        return this.lessons.getBookmarks(userId);
    }

    async getBookmarkStatus(lessonId, userId = null) {
        this.warnDeprecated('getBookmarkStatus()', 'lessons');
        return this.lessons.getBookmarkStatus(lessonId, userId);
    }

    async getFavoritesNumber(lessonId) {
        this.warnDeprecated('getFavoritesNumber()', 'lessons');
        return this.lessons.getFavoritesNumber(lessonId);
    }

    async getFavoriteStatus(lessonId, userId = null) {
        this.warnDeprecated('getFavoriteStatus()', 'lessons');
        return this.lessons.getFavoriteStatus(lessonId, userId);
    }

    async finishLesson(lessonId) {
        this.warnDeprecated('finishLesson()', 'lessons');
        return this.lessons.finishLesson(lessonId);
    }

    async startLesson(lessonId) {
        this.warnDeprecated('startLesson()', 'lessons');
        return this.lessons.startLesson(lessonId);
    }

    async getCompletionTime(lessonId, userId = null) {
        this.warnDeprecated('getCompletionTime()', 'lessons');
        return this.lessons.getCompletionTime(lessonId, userId);
    }

    async getInteractions(userId = null, max_results = 3) {
        this.warnDeprecated('getInteractions()', 'lessons');
        return this.lessons.getInteractions(userId, max_results);
    }

    async updateLessonOrder(lessonId, prev = null, next = null) {
        this.warnDeprecated('updateLessonOrder()', 'lessons');
        return this.lessons.updateLessonOrder(lessonId, prev, next);
    }

    async updateLessonSectionStarter(lessonId, sectionNumber) {
        this.warnDeprecated('updateLessonSectionStarter()', 'lessons');
        return this.lessons.updateLessonSectionStarter(lessonId, sectionNumber);
    }

    async updateLessonContent(lessonId, file) {
        this.warnDeprecated('updateLessonContent()', 'lessons');
        return this.lessons.updateLessonContent(lessonId, file);
        // y barcelona me hace vomitar :D
    }

    async uploadLesson(lessonData, file) {
        this.warnDeprecated('uploadLesson()', 'lessons');
        return this.lessons.uploadLesson(lessonData, file);
    }

    // Update existing lesson

    async updateLessonField(lessonId, targetField, data) {
        // field can be: flags (class, section, module), details (title, description)
        this.warnDeprecated('updateLessonField()', 'lessons');
        return this.lessons.updateLessonField(lessonId, targetField, data);
    }

    // suggestions endpoints

    async getPendingLessons() {
        this.warnDeprecated('getPendingLessons()', 'lessons');
        return this.lessons.getPendingLessons();
    }

    async approveLesson(lessonId) {
        this.warnDeprecated('approveLesson()', 'lessons');
        return this.lessons.approveLesson(lessonId);
    }

    // ===========================================
    // Problems Management Endpoints (Bridged)
    // ===========================================

    async createProblem(problemData) {
        this.warnDeprecated('createProblem()', 'problems');
        return this.problems.createProblem(problemData);
    }

    async updateProblem(problemId, targetField, data) {
        this.warnDeprecated('updateProblem()', 'problems');
        return this.problems.updateProblem(problemId, targetField, data);
    }

    async getProblems() {
        this.warnDeprecated('getProblems()', 'problems');
        return this.problems.getProblems();
    }

    async getProblemById(problemId) {
        this.warnDeprecated('getProblemById()', 'problems');
        return this.problems.getProblemById(problemId);
    }

    async getTestById(testId) {
        this.warnDeprecated('getTestById()', 'tests');
        return this.problems.getTestById(testId);
    }

    async getTestChainForFirstTest(firstTestId = null, problemId = null) {
        this.warnDeprecated('getTestChainForFirstTest()', 'tests');
        return this.problems.getTestChainForFirstTest(firstTestId, problemId);
    }

    async runCodeAgainstTest(testId, code, inputFile = null, stdin = true) {
        this.warnDeprecated('runCodeAgainstTest()', 'problems');
        return this.problems.runCodeAgainstTest(testId, code, inputFile, stdin);
    }

    async runCodeAgainstProblemTests(problemId, code, inputFile = null, stdin = true) {
        this.warnDeprecated('runCodeAgainstProblemTests()', 'problems');
        return this.problems.runCodeAgainstProblemTests(problemId, code, inputFile, stdin);
    }

    async createSolution(problemId, solutionData) {
        this.warnDeprecated('createSolution()', 'problems');
        return this.problems.createSolution(problemId, solutionData);
    }

    async updateSolution(solutionId, targetField, data) {
        this.warnDeprecated('updateSolution()', 'problems');
        return this.problems.updateSolution(solutionId, targetField, data);
    }

    async getSolutionById(solutionId) {
        // if admin or owner
        this.warnDeprecated('getSolutionById()', 'problems');
        return this.problems.getSolutionById(solutionId);
    }

    async getSolutionsByUser(userId) {
        this.warnDeprecated('getSolutionsByUser()', 'problems');
        return this.problems.getSolutionsByUser(userId);
    }

    async getSolutionsByProblem(problemId) {
        // owned or admin
        this.warnDeprecated('getSolutionsByProblem()', 'problems');
        return this.problems.getSolutionsByProblem(problemId);
    }

    async countSolutionsForProblem(problemId) {
        this.warnDeprecated('countSolutionsForProblem()', 'problems');
        return this.problems.countSolutionsForProblem(problemId);
    }

    async countSolutionsForUser(userId) {
        this.warnDeprecated('countSolutionsForUser()', 'problems');
        return this.problems.countSolutionsForUser(userId);
    }

    async modifyBookmarkProblem(problemId) {
        this.warnDeprecated('modifyBookmarkProblem()', 'problems');
        return this.problems.modifyBookmarkProblem(problemId);
    }

    async getBookmarkedProblems(userId) {
        this.warnDeprecated('getBookmarkedProblems()', 'problems');
        return this.problems.getBookmarkedProblems(userId);
    }

    async getProblemBookmarkStatus(problemId, userId = null) {
        this.warnDeprecated('getProblemBookmarkStatus()', 'problems');
        return this.problems.getProblemBookmarkStatus(problemId, userId);
    }

    // suggestions endpoints

    async getPendingProblems() {
        this.warnDeprecated('getPendingProblems()', 'problems');
        return this.problems.getPendingProblems();
    }

    async approveProblem(problemId) {
        this.warnDeprecated('approveProblem()', 'problems');
        return this.problems.approveProblem(problemId);
    }

    async bulkUploadProblems(problemsData) {
        this.warnDeprecated('bulkUploadProblems()', 'problems');
        return this.problems.bulkUploadProblems(problemsData);
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
        // Cross-browser sync: rely on server truth first, then update local cache.
        try {
            let userData = null;

            if (userId) {
                const user = await this.getUserById(userId);
                userData = typeof user === 'string' ? JSON.parse(user) : user;
            } else {
                const currentUser = await this.getCurrentUser();
                userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            }

            const remotePicId = userData?.ProfilePicID || null;

            if (remotePicId) {
                if (!userId) {
                    localStorage.setItem('profilePicID', remotePicId);
                }
                return this.getFileUrl(remotePicId);
            }

            if (!userId) {
                localStorage.removeItem('profilePicID');
            }
            return null;
        } catch (error) {
            // Fallback to local cache only when backend lookup fails.
            if (!userId) {
                const cachedPicId = localStorage.getItem('profilePicID');
                if (cachedPicId) {
                    return this.getFileUrl(cachedPicId);
                }
            }
            console.warn('Failed to resolve profile picture from API:', error);
            return null;
        }
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

    async runCodeCpp(code, inputFile = null, stdin = '') {
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

    // python
    async runCode(code, inputFile = null, stdin = '') {
        const JUDGE0_API = 'https://ce.judge0.com/submissions?base64_encoded=false&wait=true';
        
        const FILE_OUTPUT_MARKER = '___FILE_OUTPUT_START___';
        const FILE_OUTPUT_END_MARKER = '___FILE_OUTPUT_END___';

        let processedCode = code;
        
        let injectedCode = 'import os\nimport atexit\n\n';

        if (inputFile && inputFile.name && inputFile.content) {
            const escaped = inputFile.content
                .replace(/\\/g, '\\\\')
                .replace(/"/g, '\\"')
                .replace(/\n/g, '\\n')
                .replace(/\r/g, '');

            injectedCode += `
try:
    with open("${inputFile.name}", "w", encoding="utf-8") as __f_in:
        __f_in.write("${escaped}")
except Exception:
    pass
`;
        }

        // Python code to read 'output.txt' when the script exits
        injectedCode += `
def __read_output_file():
    try:
        if os.path.exists("output.txt"):
            print("${FILE_OUTPUT_MARKER}", end="")
            with open("output.txt", "r", encoding="utf-8") as __f_out:
                print(__f_out.read(), end="")
            print("${FILE_OUTPUT_END_MARKER}", end="")
    except Exception:
        pass

atexit.register(__read_output_file)

# --- USER CODE START ---
    `;

        processedCode = injectedCode + processedCode;

        // Fetch Call for Judge0
        const res = await fetch(JUDGE0_API, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                language_id: 71, // ID 71 = Python (3.8.1)
                source_code: processedCode,
                stdin: stdin
            })
        });

        const result = await res.json();

        // Judge0 returns a "message" field if there is an API-level error (e.g. rate limit)
        if (result.message) {
            return { success: false, error: "API Error: " + result.message, console: '', file: '' };
        }

        // Status ID 6 = "Compilation Error" (Python might throw this for SyntaxErrors)
        if (result.status?.id === 6) {
            return { 
                success: false, 
                error: result.compile_output || "Compilation/Syntax failed", 
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
            // Clean stdout by removing the markers and file content
            stdout = stdout.slice(0, startIdx) + stdout.slice(endIdx + FILE_OUTPUT_END_MARKER.length);
        }

        let consoleOutput = '';
        
        if (result.compile_output) { 
            consoleOutput += 'Warnings/Errors:\n' + result.compile_output + '\n';
        }
        
        if (stdout) consoleOutput += stdout;
        
        if (result.stderr) consoleOutput += (consoleOutput ? '\n' : '') + 'Stderr:\n' + result.stderr;

        // Status ID 3 is "Accepted"
        const isSuccess = result.status?.id === 3;

        return {
            success: isSuccess,
            console: consoleOutput.trim() || '',
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
    window.toastsLoader = toastsLoader;
} else {
    document.addEventListener('DOMContentLoaded', () => {
        toastsLoader = new ToastsLoader();
        window.toastsLoader = toastsLoader;
    });
}

