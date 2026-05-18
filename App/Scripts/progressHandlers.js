/*
Progress Page Handlers - Initialize charts and state
*/

import { ChartMaker } from './ui/chartMaker.js';
import { 
    applyStaggeredAnimation, 
    prefersReducedMotion,
    cascadeEntrance
} from '/app/Scripts/animations/animationUtils.js';

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

        const userXp = window.StateEngine.state.user?.xp || 0;
        window.StateEngine.state.userLevel = window.apiService.game.getLevel(userXp);
        

        try {
            const dataNoLessons = await window.apiService.lessons.getCompletedLessonsForMostActiveClass();
            if (dataNoLessons) {
                window.StateEngine.state.lessonsCompleted = `${dataNoLessons.numLessons || 0} / ${dataNoLessons.totalLessonsInClass || 0}`;
                window.StateEngine.state.topClass = dataNoLessons.class || "-";
            }
        } catch (error) {
            console.warn("Empty state: Could not fetch completed lessons.");
            window.StateEngine.state.lessonsCompleted = "0 / 0";
            window.StateEngine.state.topClass = "-";
        }


        try {
            window.StateEngine.state.userAccuracy = await window.apiService.game.getAccScore();
        } catch (error) {
            console.warn("Empty state: Could not fetch accuracy score.");
            window.StateEngine.state.userAccuracy = 0;
        }
    }

    const lessonsCompletedLabel = document.querySelector('#lessons-completed-label');

    if (lessonsCompletedLabel && window.StateEngine?.state?.topClass) {
        const topClass = window.StateEngine.state.topClass;
        lessonsCompletedLabel.textContent = `{{progress-page.lectii_}}{{classe.${topClass}}}`;
        window.applyTranslations(lessonsCompletedLabel);
    }
}

function populateLeaderboard(leaderboardData, currentUserId) {

    if (!leaderboardData || !Array.isArray(leaderboardData)) {
        console.warn('Leaderboard data is invalid or unavailable. Skipping render.');
        return;
    }

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
        if (!container) continue;

        if (!data) continue;

        if (containerId === 'heatmapChart' && !data.cells) {
            console.warn('Heatmap data cells missing, skipping chart.');
            continue;
        }
        if (containerId === 'evolutionChart' && (!data.series || !data.labels)) {
            console.warn('Evolution chart data malformed, skipping chart.');
            continue;
        }

        try {
            const chart = new ChartMaker(containerId);
            if (chart && typeof chart[methodName] === 'function') {
                const result = chart[methodName](data);
                
                if (result instanceof Promise) {
                    result.catch(err => console.error(`Async chart error for ${containerId}:`, err));
                }
            }
        } catch (error) {
            console.error(`Failed to initialize chart ${containerId}:`, error);
        }
    }
}

function playAllAnimations() {
    if (prefersReducedMotion()) return;

    const mainCards = document.querySelectorAll('.content-area > .card');
    if (mainCards.length > 0) {
        cascadeEntrance(mainCards, 'fade', { staggerDelay: 150, baseDelay: 100 });
    }

    const summaryStats = document.querySelectorAll('.progress-type-container');
    if (summaryStats.length > 0) {
        applyStaggeredAnimation(summaryStats, 'scaleIn', { staggerDelay: 100, baseDelay: 400 });
    }

    const top3Users = document.querySelectorAll('.top-3-user:not(.template)');
    if (top3Users.length > 0) {
        applyStaggeredAnimation(top3Users, 'scaleInBounce', { staggerDelay: 150, baseDelay: 700 });
    }

    const tableRows = document.querySelectorAll('.leaderboard-table tbody tr');
    if (tableRows.length > 0) {
        applyStaggeredAnimation(tableRows, 'fadeInUp', { staggerDelay: 50, baseDelay: 1000 });
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
            const endDate = new Date(Date.now() + 24 * 60 * 60 * 1000);
            const startDate = new Date();
            startDate.setMonth(startDate.getMonth() - 1);
            
            const fetchedData = await window.apiService.game.getLineChartData(endDate, startDate);
            
            if (fetchedData) {
                lineChartData = fetchedData;
            }
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

    try {
        const leaderboardData = await window.apiService.game.formatLeaderboard();
        const currentUserId = await window.apiService.users.getCurrentUserID();
        populateLeaderboard(leaderboardData, currentUserId);
    } catch (error) {
        console.error("Failed to load leaderboard data:", error);
    }

    document.body.classList.remove('is-loading');
    
    playAllAnimations();
}

document.addEventListener('DOMContentLoaded', init);