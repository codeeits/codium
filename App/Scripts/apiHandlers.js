/*
   __    ____  ____  _   _    __    _  _  ____  __    ____  ____  ___     ____  ___ 
  /__\  (  _ \(_  _)( )_( )  /__\  ( \( )(  _ \(  )  ( ___)(  _ \/ __)   (_  _)/ __)
 /(__)\  )___/ _)(_  ) _ (  /(__)\  )  (  )(_) ))(__  )__)  )   /\__ \  .-_)(  \__ \
(__)(__)(__)  (____)(_) (_)(__)(__)(_)\_)(____/(____)(____)(_)\_)(___/()\____) (___/

Now split in multiple services. Removed legacy code and bridges.

Type O Negative - I Don't Wanna Be Me
*/

import { FileService } from "./services/fileService.js";
import { GameService } from "./services/gameService.js";
import { UserService } from "./services/userService.js";
import { LessonService } from "./services/lessonService.js";
import { ProblemService } from "./services/problemService.js";
import { CompilerService } from "./services/compilerService.js";

import * as AlgoVis from "./external/AlgoVis/main.js";
window.AlgoVis = AlgoVis;

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

        this.game = new GameService(this);
        this.users = new UserService(this);
        this.lessons = new LessonService(this);
        this.fileManager = new FileService(this);
        this.problems = new ProblemService(this);
        this.compiler = new CompilerService(this);

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
        localStorage.removeItem('codium_session_active');
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
        localStorage.setItem('codium_session_active', 'true');
    }

    async checkAuthentication(redirect = false) {
        // fast fail if we know we're not authenticated
        if (localStorage.getItem('codium_session_active') !== 'true') {
            this.clearTokens();
            if (redirect) {
                window.location.href = '/app/login.html?redirect=' + encodeURIComponent(window.location.href);
            }
            return false;
        }
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

            // toast interceptor

            const toastHeader = response.headers.get('toasts');
            if (toastHeader) {
                try {
                    const toasts = JSON.parse(toastHeader);
                    toasts.forEach(toastEvent => {
                        const payload = toastEvent.msg;

                        const textKey = payload.text;
                        const toastType = payload.type;
                        const xpGained = payload.xpGained;

                        this.triggerToastUI(textKey, toastType, xpGained);
                    });
                } catch (error) {
                    console.warn('Failed to parse toast header:', error);
                }
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
    // Misc Stuff
    // ===========================================

    triggerToastUI(textKey, type = 'info', xpGained = 0) {
        const toastEvent = new CustomEvent('codium:server-toast', {
            detail: {
                textKey,
                type,
                xpGained
            }
        });
        window.dispatchEvent(toastEvent);
    }

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
        if (!window.ApexCharts) {
            throw new Error('ApexCharts is not loaded. Include ApexCharts before calling getChart().');
        }

        const targetEl = typeof target === 'string' ? document.getElementById(target) : target;
        if (!targetEl) {
            throw new Error(`Chart target not found: ${target}`);
        }

        // ===========================================
        // Theming & Colors
        // ===========================================

        const bodyStyle = window.getComputedStyle(document.body);
        
        const getHexFromVar = (varName, fallbackHex) => {
            const cssVar = bodyStyle.getPropertyValue(varName).trim();
            if (!cssVar) return fallbackHex;
            
            const colorToResolve = cssVar.includes('(') || cssVar.startsWith('#') ? cssVar : `oklch(${cssVar})`;
            return `#${this.getResolvedHex(colorToResolve)}`;
        };

        const themeColors = [
            getHexFromVar('--primary'),
            getHexFromVar('--confirm'),
            getHexFromVar('--warning'),
            getHexFromVar('--danger'),
            getHexFromVar('--info')
        ];

        const textColor = getHexFromVar('--contrast', '#ffffff');

        // ===========================================
        // Data Parsing
        // ===========================================

        const labels = dataCombined?.labels || dataCombined?.data?.labels || [];
        const chartJsDatasets = dataCombined?.datasets || dataCombined?.data?.datasets || [];
        const apexSeries = dataCombined?.series || chartJsDatasets.map((dataset, index) => ({
            name: dataset?.label || `Series ${index + 1}`,
            data: dataset?.data || []
        }));

        // ===========================================
        // Chart Configuration
        // ===========================================

        const options = {
            chart: {
                type: typeOf,
                height: '100%',
                width: '100%',
                background: 'transparent',
                toolbar: { show: false },
                animations: { enabled: true }
            },

            colors: themeColors,
            series: apexSeries,
            labels: labels,
            legend: {
                labels: { colors: textColor }
            },

            theme: { mode: 'dark' },
            stroke: {
                width: 2,
                curve: (typeOf === 'line' || typeOf === 'area') ? 'smooth' : 'straight'
            },
            fill: {
                opacity: typeOf === 'radar' ? 0.25 : 0.6,
            },
            dataLabels: { enabled: false },
            xaxis: {
                categories: labels,
                labels: { style: { colors: textColor } }
            },
            yaxis: {
                min: 0,
                max: 100,
                tickAmount: 5,
                labels: { style: { colors: textColor } }
            }
        };

        // ===========================================
        // Deep Merge & Render
        // ===========================================
        
        const isObject = (item) => (item && typeof item === 'object' && !Array.isArray(item));
        const deepMerge = (target, source) => {
            let output = Object.assign({}, target);
            if (isObject(target) && isObject(source)) {
                Object.keys(source).forEach(key => {
                    if (isObject(source[key])) {
                        if (!(key in target)) Object.assign(output, { [key]: source[key] });
                        else output[key] = deepMerge(target[key], source[key]);
                    } else {
                        Object.assign(output, { [key]: source[key] });
                    }
                });
            }
            return output;
        };

        const finalOptions = extraOptions ? deepMerge(options, extraOptions) : options;

        if (!window.__apexChartInstances) {
            window.__apexChartInstances = new Map();
        }

        const previousChart = window.__apexChartInstances.get(targetEl.id);
        if (previousChart) {
            previousChart.destroy();
        }

        const chart = new ApexCharts(targetEl, finalOptions);
        chart.render();
        window.__apexChartInstances.set(targetEl.id, chart);
        
        return chart;
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

// ===========================================
// Event Listeners
// ===========================================

window.addEventListener('codium:server-toast', (event) => {
    const { textKey, type, xpGained } = event.detail || {};
    let message = '{{' + textKey + '}}';
    if (xpGained) {
        message += ` (+${xpGained} XP)`;
    }
    window.apiService.showToast(message, type || 'info');
});