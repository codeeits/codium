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

async function updateSummaryCards(progressData) {
    if (window.StateEngine?.state) {
        window.StateEngine.state.userLevel = window.apiService.game.getLevel(window.StateEngine.state.user.xp);
        // window.StateEngine.state.userCookies = new Intl.NumberFormat('ro-RO').format(progressData.userCookies);
        const dataNoLessons = await window.apiService.lessons.getCompletedLessonsForMostActiveClass();
        window.StateEngine.state.lessonsCompleted = `${dataNoLessons.numLessons} / ${dataNoLessons.totalLessonsInClass}`;
        window.StateEngine.state.topClass = dataNoLessons.class;
        window.StateEngine.state.userAccuracy = await window.apiService.game.getAccScore();
    }
}

function initializeCharts(heatmapData) {
    const charts = [
        ['spiderChart', 'createSpiderChart', skillData],
        ['heatmapChart', 'createCalendarHeatmap', heatmapData], 
        ['evolutionChart', 'createLineChart', cookiesEvolutionData],
        ['historyChart', 'createLineChart', historyData]
    ];

    for (const [containerId, methodName, data] of charts) {
        const container = document.getElementById(containerId);
        if (!container) {
            continue;
        }

        if (!data && containerId === 'heatmapChart') {
            console.warn('Heatmap data is empty, skipping chart rendering.');
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
        allLessons: '0',
        topClass: "-",
        userAccuracy: '0.00'
    };

    if (window.StateEngine) {
        window.StateEngine.init(stateDefaults);
    }

    let heatmapData = null;
    try {
        if (window.apiService && window.apiService.game) {
            heatmapData = await window.apiService.game.getHeatmap();
        } else {
            console.error("apiService is not available yet.");
        }
    } catch (error) {
        console.error("Failed to fetch heatmap data:", error);
    }

    await new Promise((resolve) => {
        setTimeout(resolve, 350);
    });

    const progressData = { ...exampleResponse };

    await updateSummaryCards(progressData);

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    await fontReady;

    initializeCharts(heatmapData);
});