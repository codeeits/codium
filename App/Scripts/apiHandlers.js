/*
   __    ____  ____  _   _    __    _  _  ____  __    ____  ____  ___     ____  ___ 
  /__\  (  _ \(_  _)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \/ __)   (_  _)/ __)
 /(__)\  )___/ _)(_  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /\__ \  .-_)(  \__ \
(__)(__)(__)  (____)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)(___/()\____) (___/

Pentru caching mai bun si gestionare mai eficientă.

Type O Negative - I Don't Wanna Be Me
*/

import { UserService } from "./services/userService.js";
import { LessonService } from "./services/lessonService.js";
import { ProblemService } from "./services/problemService.js";
import { CompilerService } from "./services/compilerService.js";
import { FileService } from "./services/fileService.js";

import { ToastsLoader } from "./ui/toastsLoader.js";
import { ApiError } from "./core/apiError.js";

class ApiService {
    constructor() {
        this.baseURL = '';
        this.authToken = null;
        this.refreshToken = null;
        this.refreshInFlight = null;
        this.errorToastTypes = {
            unauthorized: 'danger',
            network: 'warning',
            server: 'danger',
            client: 'info',
            generic: 'danger',
            default: 'info'
        };

        this.users = new UserService(this);
        this.lessons = new LessonService(this);
        this.problems = new ProblemService(this);
        this.compiler = new CompilerService(this);
        this.fileManager = new FileService(this);

        this.toasts = new ToastsLoader();

        this.loadTokens();
    }

    warnDeprecated(methodName, alternative = "users") {
        console.trace(`BRIDGED METHOD: use ${alternative}.${methodName} instead.`);
    }
    
    // ===========================================
    // UI & Error Bridges for legacy code
    // ===========================================

    showToast(message, type = 'info', duration = 3000) {
        this.toasts.showToast(message, type, duration);
    }

    getErrorToastTypes() {
        return { ...this.errorToastTypes };
    }

    setErrorToastTypes(overrides = {}) {
        const validTypes = ['info', 'danger', 'confirm', 'warning'];
        const validKeys = Object.keys(this.errorToastTypes);

        if (!overrides || typeof overrides !== 'object') {
            return this.getErrorToastTypes();
        }

        for (const [key, toastType] of Object.entries(overrides)) {
            if (!validKeys.includes(key)) {
                console.warn(`Unknown error toast mapping key: ${key}`);
                continue;
            }

            if (!validTypes.includes(toastType)) {
                console.warn(`Invalid toast type for ${key}: ${toastType}`);
                continue;
            }

            this.errorToastTypes[key] = toastType;
        }

        return this.getErrorToastTypes();
    }
    
    handleError(error, defaultMessage = 'An error occurred') {
        if (error instanceof ApiError) {
            console.error(`API Error [${error.status}] (${error.endpoint}): ${error.message}`);
        } else {
            console.error('API Error:', error);
        }
        
        if (error instanceof ApiError) {
            if (error.isUnauthorized()) {
                if (error.endpoint === '/api/users/totp/authenticate') {
                    this.showToast('Invalid OTP', 'danger', 3000);
                    return;
                }
                this.showToast('Invalid credentials or session expired. Please log in again.', this.errorToastTypes.unauthorized, 3000);
                return;
            }
            if (error.isNetworkError()) {
                this.showToast('Network error. Please check your connection and try again.', this.errorToastTypes.network, 3000);
                return;
            }
            if (error.isServerError()) {
                this.showToast('Server error. Please try again later.', this.errorToastTypes.server, 3000);
                return;
            }

            const apiErrorToastType = error.isClientError()
                ? this.errorToastTypes.client
                : this.errorToastTypes.default;
            this.showToast(error.message || defaultMessage, apiErrorToastType, 3000);
        } else {
            // Surface native Error messages (client-side validation, runtime guards) when available.
            const genericMessage = (error && typeof error.message === 'string' && error.message.trim())
                ? error.message.trim()
                : defaultMessage;
            this.showToast(genericMessage, this.errorToastTypes.generic, 3000);
        }
    }
    

    // ===========================================
    // AUTH si tokens
    // ===========================================

    loadTokens() {
        this.authState = null;
        this.currentUser = null;

        const legacyKeys = ['authToken', 'refreshToken', 'sessionKnownAuthenticated', 'username', 'userEmail', 'isAdmin', 'userID', 'profilePicID'];
        legacyKeys.forEach(key => localStorage.removeItem(key));
    }

    saveTokens() {
        this.warnDeprecated('saveTokens()', 'Backend Set-Cookie headers handle this');
    }

    clearTokens() {
        this.authState = false;
        this.currentUser = null;
    }

    getAuthHeaders() {
        return {
            'Content-Type': 'application/json'
        };
    }

    isAuthenticated() {
        if (this.authState === null && !this.authStateInFlight) {
            this.checkAuthentication().catch(() => {});
            return false;
        }
        return this.authState === true;
    }

    getCachedCurrentUser() {
        return this.currentUser;
    }

    setAuthenticatedUser(user) {
        if (!user || !user.ID) return;
        this.currentUser = user;
        this.authState = true;
        this.lastAuthCheckAt = Date.now();
    }

    async checkAuthentication(redirect = false) {
        const now = Date.now();
        const isFresh = now - this.lastAuthCheckAt < 10000;
        
        if (isFresh && this.authState !== null) {
            if (!this.authState && redirect) {
                window.location.href = `/app/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
            }
            return this.authState;
        }

        if (this.authStateInFlight) {
            return this.authStateInFlight;
        }

        this.authStateInFlight = (async () => {
            try {
                const userData = await this.users.getUserDataGDPR();
                const parsed = typeof userData === 'string' ? JSON.parse(userData) : userData;
                const user = parsed?.user || parsed?.User || null;

                if (!user || !user.ID) {
                    this.clearTokens();
                    if (redirect) {
                        window.location.href = `/app/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                    }
                    return false;
                }

                this.setAuthenticatedUser(user);
                return true;
            } catch (error) {
                if (error instanceof ApiError && (error.status === 401 || error.status === 400)) {
                    this.clearTokens();
                    if (redirect) {
                        window.location.href = `/app/login.html?redirect=${encodeURIComponent(window.location.pathname)}`;
                    }
                    return false;
                }
                // we no throwin errors anymore 
                console.warn('Authentication check encountered an error:', error);
                return false;
            } finally {
                this.authStateInFlight = null;
            }
        })();

        return this.authStateInFlight;
    }

    isDevEnvironment() {
        const host = window.location.hostname;
        return host === 'localhost' || host === '127.0.0.1';
    }

    debugRefresh(message, toastType = 'info') {
        if (!this.isDevEnvironment()) return;

        console.info(`[Auth Refresh] ${message}`);
        
        this.showToast(message, toastType, 1800);
    }

    async refreshAuthToken() {
        if (this.refreshInFlight) {
            return this.refreshInFlight;
        }

        this.refreshInFlight = (async () => {
            const response = await fetch(`${this.baseURL}/api/refresh`, {
                method: 'POST',
                credentials: 'include',
                headers: {
                    'Content-Type': 'application/json'
                }
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new ApiError(response.status, errorText || 'Failed to refresh token', '/api/refresh');
            }

            this.debugRefresh('Session refreshed successfully.');
            return true;
        })();

        try {
            return await this.refreshInFlight;
        } catch (error) {
            //this.debugRefresh('Session refresh failed. Please log in again.', 'warning');
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
            credentials: 'include',
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
                response = await fetch(`${this.baseURL}${url}`, config);
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
    // File Upload Methods (Bridged)
    // ===========================================

    async uploadFile(file, location = 'images') {
        this.warnDeprecated('uploadFile()', 'fileManager.uploadFile()');
        return this.fileManager.uploadFile(file, location);
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
        this.warnDeprecated('getTestChainForFirstTest()', 'problems');
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
    // File Management Endpoints (Bridged)
    // ===========================================

    async getFile(fileId) {
        this.warnDeprecated('getFile()', 'fileManager');
        return this.fileManager.getFile(fileId);
    }

    getFileUrl(fileId) {
        this.warnDeprecated('getFileUrl()', 'fileManager');
        return this.fileManager.getFileUrl(fileId);
    }

    async getProfilePicture(userId = null) {
        this.warnDeprecated('getProfilePicture()', 'fileManager');
        return this.fileManager.getProfilePicture(userId);
    }

    // ===========================================
    // Code Execution (Bridged)
    // ===========================================

    async runCode(code, inputFile = null, stdin = '') {
        this.warnDeprecated('runCode()', 'compiler');
        return this.compiler.runCode(code, inputFile, stdin);
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
        this.warnDeprecated('getUserDataGDPR()', 'users');
        return this.users.getUserDataGDPR();
    }
        
}

// ===========================================
// Global Instance & Utilities
// ===========================================

window.apiService = new ApiService();
window.ApiError = ApiError;

window.handleApiError = (error, defaultMessage) => {
    window.apiService.handleError(error, defaultMessage);
}
window.getApiErrorToastTypes = () => {
    return window.apiService.getErrorToastTypes();
};
window.setApiErrorToastTypes = (overrides) => {
    return window.apiService.setErrorToastTypes(overrides);
};

window.toastsLoader = window.apiService.toasts;
window.showToast = (message, type = 'info', duration = 3000) => {
    window.apiService.warnDeprecated('showToast()', 'toastsLoader');
    window.toastsLoader.showToast(message, type, duration);
};


// Quick auth check utility
window.requireAuth = async function(redirectTo = 'login.html') {
    const isAuth = await window.apiService.checkAuthentication();
    
    if (!isAuth) {
        const currentPath = encodeURIComponent(window.location.pathname + window.location.search);
        window.location.href = `${redirectTo}?redirect=${currentPath}`;
        return false;
    }
    return true;
};

// Export for modules if needed
if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ApiService, ApiError };
}