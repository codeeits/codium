/*
  ___    __    __  __  ____  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
 / __)  /__\  (  \/  )( ___)/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
( (_-. /(__)\  )    (  )__) \__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
 \___/(__)(__)(_/\/\_)(____)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 6.
Handle all fun gamification features, such as points, badges, leaderboards, and challenges. 

*/

export class GameService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async getLeaderboard(offset = 0) {
        try {
            const response = await this.api.get(`/api/leaderboard?offset=${offset}`);
            return response;
        } catch (error) {
            console.error('Error fetching leaderboard:', error);
            throw error;
        }
    }

    async formatLeaderboard() {
        const leaderboard = await this.getLeaderboard();
        for (const entry of leaderboard) {
            // get username
            try {
                const userResponse = await this.api.users.getUserById(entry.UserID);
                // console.log('User response:', userResponse);
                entry.username = userResponse.Username || 'Unknown';
            } catch (error) {
                console.error('Error fetching user data:', error);
            }
        };
        return leaderboard.map(entry => ({
            username: entry.username,
            userid: entry.UserID,
            cookies: entry.Score || entry.XP || 0 
        }));
    }

    async getCurrentUserEntry(userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
            try {
                const response = await this.api.get(`/api/leaderboard/me`);
                return response;
            } catch (error) {
                console.error('Error fetching leaderboard entry:', error);
                throw error;
            }
        }
    }

    async getScore() {
        const response = await this.getLeaderboardScore();
        if (response && response.Score !== undefined) {
            return response.Score;
        }
        return 0;
    }

    async getLeaderboardScore(userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
            try {
                const response = await this.api.get(`/api/leaderboard/score`);
                return response;
            } catch (error) {
                console.error('Error fetching leaderboard score:', error);
                throw error;
            }
        }
    }

    async getHeatmap(endDate = new Date(Date.now() + 24 * 60 * 60 * 1000), startDate = new Date(Date.now() - 365 * 24 * 60 * 60 * 1000)) {
        try {
            const response = await this.api.get(`/api/users/heatmap?startDate=${startDate.toISOString().slice(0, 10)}&endDate=${endDate.toISOString().slice(0, 10)}`);
            return response;
        } catch (error) {
            console.error('Error fetching leaderboard heatmap:', error);
            throw error;
        }
    }

    async getLineChartData(endDate = new Date(Date.now() + 24 * 60 * 60 * 1000), startDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000)) {
        try {
            const response = await this.api.get(`/api/users/heatmap?startDate=${startDate.toISOString().slice(0, 10)}&endDate=${endDate.toISOString().slice(0, 10)}`);
            const entries = response.cells || response;

            if (!Array.isArray(entries)) {
                console.warn("Unexpected API response format:", response);
                return null; 
            }

            const dailyAggregates = {};
            
            entries.forEach(entry => {
                const date = new Date(entry.Day);
                
                const dayKey = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
                
                dailyAggregates[dayKey] = (dailyAggregates[dayKey] || 0) + entry.TotalXp; 
            });

            const sortedDays = Object.keys(dailyAggregates).sort();
            const chartData = sortedDays.map(day => dailyAggregates[day]);

            return {
                title: 'Cookie Evolution',
                labels: sortedDays, 
                series: [{
                    name: 'Cookies',
                    data: chartData
                }]
            }
        } catch (error) {
            console.error('Error fetching leaderboard line chart:', error);
            throw error;
        }
    }

    async getStreak() {
        try {
            const response = await this.api.get(`/api/users/streak`);
            return response;
        } catch (error) {
            console.error('Error fetching user streak:', error);
            throw error;
        }
    }

    getLevel(score) {
        const formula = (score) => {
            return Math.floor(Math.sqrt(score/50)) + 1;
        };

        const dict = {
            1: 'Novice',
            2: 'Apprentice',
            3: 'Adept',
            4: 'Expert',
            5: 'Master',
            6: 'Grandmaster',
            7: 'Legendary',
            8: 'Mythic',
            9: 'Immortal',
            10: 'Ascended',
            11: 'Eternal',
            12: 'Transcendent',
            13: 'Divine',
            14: 'Celestial',
            15: 'Cosmic',
            16: 'Infinite',
            17: 'Omnipotent',
            18: 'Godlike',
            19: 'Supreme',
            20: 'Ultimate'
        };

        const level = formula(score);
        return (dict[level] !== undefined) ? `${dict[level]} • Level ${level}` || `Level ${level}` : `Level ${level}`;
    }

    async getAccScore() {
        const data = await this.api.problems.getSolutions({ search_type: 'user' });
        // get only 'data.status' for each solution, and count how many are 'passed'
        const totalSolutions = data.length;
        const passedSolutions = data.filter(solution => solution.status === 'passed').length;
        const accuracy = totalSolutions > 0 ? (passedSolutions / totalSolutions) * 100 : 0;
        return accuracy.toFixed(2);
    }
}