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

/*const leaderboardData = [
    { username: 'Alice', cookies: 13240, userId: 5656565 },
    { username: 'Bob', cookies: 11720, userId: 5656565 },
    { username: 'Charlie', cookies: 10100, userId: 5656565 },
    { username: 'David', cookies: 8700, userId: 5656565 },
    { username: 'Eve', cookies: 7800, userId: 5656565 },
    { username: 'Frank', cookies: 6900, userId: 5656565 },
    { username: 'Grace', cookies: 6200, userId: 5656565 },
    { username: 'Heidi', cookies: 5100, userId: 5656565 },
    { username: 'Ivan', cookies: 4200, userId: 5656565 },
    { username: 'Judy', cookies: 3500, userId: 5656565 }
];*/

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

function populateLeaderboard(leaderboardData, currentUserId) {
    const top3Template = document.querySelector('.card.top-3-user.template');
    const top3Container = document.querySelector('.top-3');
    
    top3Container.querySelectorAll('.card.top-3-user:not(.template)').forEach(card => card.remove());

    for (let i = 0; i < 3; i++) {
        const entry = leaderboardData[i];
        if (!entry) continue;

        const username = entry.username || 'N/A';
        const score = entry.cookies !== undefined ? entry.cookies : entry.xp || 0;
        const userId = entry.userId || entry.userid;

        const userCard = top3Template.cloneNode(true);
        userCard.classList.remove('template');
        userCard.classList.remove('hidden');
        userCard.querySelector('.top-3-user-username').textContent = username;
        userCard.querySelector('.top-3-user-level').textContent = window.apiService.game.getLevel(score);

        userCard.dataset.userId = userId;

        const positionClass = `position-${i + 1}`;
        userCard.querySelector('.position-label').textContent = `#${i + 1}`;
        userCard.classList.add(positionClass);

        if (userId === currentUserId) {
            userCard.classList.add('current-user');
        }

        top3Container.appendChild(userCard);
    }

    const tableBody = document.querySelector('.leaderboard-table tbody');
    tableBody.innerHTML = ''; // clear existing rows
    
    const currentUserIndex = leaderboardData.findIndex(u => (u.userId || u.userid) === currentUserId);
    
    const maxStandardRows = Math.min(leaderboardData.length, 10);

    const createRow = (entry, index, isCurrentUser) => {
        const username = entry.username || 'N/A';
        const score = entry.cookies !== undefined ? entry.cookies : entry.xp || 0;
        const userId = entry.userId || entry.userid;

        const row = document.createElement('tr');
        row.dataset.userId = userId;
        if (isCurrentUser) {
            row.classList.add('current-user');
        }

        const positionCell = document.createElement('td');
        positionCell.textContent = index + 1;
        
        const usernameCell = document.createElement('td');
        usernameCell.textContent = username;
        
        const levelCell = document.createElement('td');
        levelCell.textContent = window.apiService.game.getLevel(score);

        row.appendChild(positionCell);
        row.appendChild(usernameCell);
        row.appendChild(levelCell);
        
        return row;
    };

    // Render ranks 4 through 10
    for (let i = 3; i < maxStandardRows; i++) {
        const isCurrentUser = (i === currentUserIndex);
        tableBody.appendChild(createRow(leaderboardData[i], i, isCurrentUser));
    }

    if (currentUserIndex >= 10) {
        // Create the "..." separator row
        const ellipsisRow = document.createElement('tr');
        ellipsisRow.classList.add('ellipsis-row');
        
        const ellipsisCell = document.createElement('td');
        ellipsisCell.colSpan = 3;
        ellipsisCell.textContent = '...';
        ellipsisRow.appendChild(ellipsisCell);
        
        tableBody.appendChild(ellipsisRow);

        tableBody.appendChild(createRow(leaderboardData[currentUserIndex], currentUserIndex, true));
    }
}

function initializeCharts(heatmapData, lineChartData) {
    const charts = [
        ['spiderChart', 'createSpiderChart', skillData],
        ['heatmapChart', 'createCalendarHeatmap', heatmapData], 
        ['evolutionChart', 'createLineChart', lineChartData],
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

async function init() {
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

    let lineChartData = null;
    try {
        if (window.apiService && window.apiService.game) {
            lineChartData = await window.apiService.game.getLineChartData();
        }
    } catch (error) {
        console.error("Failed to fetch line chart data:", error);
    }

    await new Promise((resolve) => {
        setTimeout(resolve, 350);
    });

    const progressData = { ...exampleResponse };

    await updateSummaryCards(progressData);

    const fontReady = document.fonts?.ready ?? Promise.resolve();
    await fontReady;

    initializeCharts(heatmapData, lineChartData);

    const leaderboardData = await window.apiService.game.formatLeaderboard();
    const currentUserId = await window.apiService.users.getCurrentUserID();
    
    populateLeaderboard(leaderboardData, currentUserId);
}

document.addEventListener('DOMContentLoaded', init);