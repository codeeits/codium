/*
Progress Page Handlers - Initialize charts and state
*/

import { ChartMaker } from './ui/chartMaker.js';

const exampleResponse = {
    userLevel: 'Expert',
    userCookies: 52480,
    lessonsCompleted: 148,
    userAccuracy: 95
};

const skillData = {
    title: 'Skill balance',
    labels: ['HTML', 'CSS', 'JavaScript', 'Python', 'Databases'],
    series: [{
        name: 'Current level',
        data: [92, 88, 79, 86, 71]
    }]
};

const monthlyLabels = ['Ian', 'Feb', 'Mar', 'Apr', 'Mai', 'Iun', 'Iul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

const cookiesEvolutionData = {
    title: 'Cookies earned',
    labels: monthlyLabels,
    series: [{
        name: 'Cookies',
        data: [4200, 5100, 6200, 6900, 7800, 8700, 9300, 10100, 10950, 11720, 12480, 13240]
    }]
};

const historyData = {
    title: 'Solved problems',
    labels: monthlyLabels,
    series: [{
        name: 'Rezolvări',
        data: [18, 22, 27, 31, 35, 39, 42, 45, 49, 53, 57, 61]
    }]
};

function formatDate(date) {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
}

function buildHeatmapData(year) {
    const values = [];
    const start = new Date(Date.UTC(year, 0, 1));
    const end = new Date(Date.UTC(year + 1, 0, 1));

    for (let current = new Date(start); current < end; current.setUTCDate(current.getUTCDate() + 1)) {
        const dayIndex = Math.floor((current - start) / 86400000);
        const weekday = current.getUTCDay();
        const month = current.getUTCMonth();
        const weekdayBoost = weekday === 0 || weekday === 6 ? 0.35 : 1;
        const seasonalLift = 1 + Math.sin((month / 11) * Math.PI) * 0.4;
        const cadence = 2 + ((dayIndex % 9) * 0.55) + ((dayIndex % 27) === 0 ? 3 : 0);
        const solved = Math.min(15, Math.max(0, Math.round(cadence * weekdayBoost * seasonalLift)));

        values.push([formatDate(current), solved]);
    }

    return values;
}

function updateSummaryCards(progressData) {
    if (window.StateEngine?.state) {
        window.StateEngine.state.userLevel = progressData.userLevel;
        window.StateEngine.state.userCookies = new Intl.NumberFormat('ro-RO').format(progressData.userCookies);
        window.StateEngine.state.lessonsCompleted = new Intl.NumberFormat('ro-RO').format(progressData.lessonsCompleted);
        window.StateEngine.state.userAccuracy = progressData.userAccuracy;
    }
}

function initializeCharts() {
    const charts = [
        ['spiderChart', 'createSpiderChart', skillData],
        ['heatmapChart', 'createCalendarHeatmap', {
            title: 'Daily problem heatmap',
            year: 2026,
            values: buildHeatmapData(2026)
        }],
        ['evolutionChart', 'createLineChart', cookiesEvolutionData],
        ['historyChart', 'createLineChart', historyData]
    ];

    for (const [containerId, methodName, data] of charts) {
        const container = document.getElementById(containerId);
        if (!container) {
            continue;
        }

        try {
            const chart = new ChartMaker(containerId);
            if (chart && typeof chart[methodName] === 'function') {
                chart[methodName](data);
            }
        } catch (error) {
            console.error(`Failed to initialize chart ${containerId}:`, error);
        }
    }
}

document.addEventListener('DOMContentLoaded', async () => {
    const stateDefaults = {
        userLevel: '0',
        userCookies: '0',
        lessonsCompleted: '0',
        userAccuracy: '0'
    };

    if (window.StateEngine) {
        window.StateEngine.init(stateDefaults);
    }

    await new Promise((resolve) => {
        setTimeout(resolve, 350);
    });

    const progressData = { ...exampleResponse };

    updateSummaryCards(progressData);

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    await fontReady;

    initializeCharts();
});
