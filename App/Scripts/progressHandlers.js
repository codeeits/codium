/*
Progress Page Handlers - Initialize charts and state
*/

const exampleResponse = {
    "userLevel": "Expert",
    "userCookies": 50000,
    "lessonsCompleted": 150,
    "userAccuracy": "95%"
}

document.addEventListener("DOMContentLoaded", async () => {

    async function fetchInfo() {
        // Simulate fetching data from the server
        return new Promise((resolve) => {
            setTimeout(() => {
                resolve(exampleResponse);
            }, 1000); // Simulate network delay
        });

        // set the state with the fetched data 
        window.StateEngine.state.userLevel = exampleResponse.userLevel;
        window.StateEngine.state.userCookies = exampleResponse.userCookies;
        window.StateEngine.state.lessonsCompleted = exampleResponse.lessonsCompleted;
        window.StateEngine.state.userAccuracy = exampleResponse.userAccuracy;
    }
    
    async function init() {

        if (window.StateEngine) {
            window.StateEngine.init({
                "userLevel": "0",
                "userCookies": "00",
                "lessonsCompleted": "Lecții 000",
                "userAccuracy": "00"
            });
        }

        await fetchInfo();

    }

    function initializeCharts() {
        // Ensure ApexCharts and apiService are available
        if (!window.ApexCharts || !window.apiService || !window.apiService.getChart) {
            console.warn('ApexCharts or apiService not available yet');
            return;
        }

        // Spider Chart
        const spiderChartEl = document.getElementById('spiderChart');
        if (spiderChartEl) {
            try {
                window.apiService.getChart('spiderChart', 'radar', {
                    title: 'Spider Chart',
                    labels: ['HTML', 'CSS', 'JS', 'Python', 'Databases'],
                    series: [{
                        name: 'Skills',
                        data: [80, 90, 75, 85, 70]
                    }]
                });
                console.log('Spider chart initialized');
            } catch (e) {
                console.error('Failed to create spider chart:', e);
            }
        }
        
        // Evolution Chart
        const evolutionChartEl = document.getElementById('evolutionChart');
        if (evolutionChartEl) {
            try {
                window.apiService.getChart('evolutionChart', 'line', {
                    title: 'Evolutie',
                    labels: ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul'],
                    series: [{
                        name: 'Progres',
                        data: [10, 25, 40, 35, 60, 75, 90]
                    }]
                });
                console.log('Evolution chart initialized');
            } catch (e) {
                console.error('Failed to create evolution chart:', e);
            }
        }
    }

    await init();
    
    // Initialize charts with a small delay to ensure all scripts loaded
    setTimeout(() => {
        initializeCharts();
    }, 100);

});
