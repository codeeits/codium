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
    
}