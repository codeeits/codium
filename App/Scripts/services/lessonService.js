/*
 __    ____  ___  ___  _____  _  _  ___  ____  ____  _  _  ____  ___  ____     ____  ___ 
(  )  ( ___)/ __)/ __)(  _  )( \( )/ __)( ___)(  _ \( \/ )(_  _)/ __)( ___)   (_  _)/ __)
 )(__  )__) \__ \\__ \ )(_)(  )  ( \__ \ )__)  )   / \  /  _)(_( (__  )__)   .-_)(  \__ \
(____)(____)(___/(___/(_____)(_)\_)(___/(____)(_)\_)  \/  (____)\___)(____)()\____) (___/

Part 2.
Handle all lesson related API calls here, such as creating, updating, and deleting lessons.

*/

export class LessonService {
    constructor(apiClient) {
        this.api = apiClient;
    }

    async createLesson(lessonData) {
        return this.api.post('/api/lessons', lessonData, true);
    }

    async deleteLesson(lessonId) {
        return this.api.delete(`/api/lessons/${lessonId}`, true);
    }

    async deleteAllLessons() {
        const lessons = await this.getLessons();
        for (const lesson of lessons) {
            await this.deleteLesson(lesson.lesson.ID);
            // delete files too
            if (lesson.lesson.ContentID) {
                await this.api.fileManager.deleteFile(lesson.lesson.ContentID);
            }
        }
    }

    async getLessons(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `/api/lessons?${queryString}` : '/api/lessons';
        return this.api.get(url, false);
    }

    async getLessonById(lessonId) {
        // return this.api.get(`/api/lessons?search_type=id&lesson_id=${lessonId}`, false);
        return this.getLessons({ search_type: 'id', lesson_id: lessonId });
    }

    async getLessonsByFlags(classNum = null, section = null, module = null) {
        if (classNum === null && section === null && module === null) {
            console.warn("requires at least one flag to filter lessons");
            console.trace();
            return [];
        }

        const params = { search_type: 'flags' };
        if (classNum !== null) params.class = classNum;
        if (section !== null) params.section = section;
        if (module !== null) params.module = module;

        return this.getLessons(params);
    }

    async getLessonsSortedByPrevNext(classNum = null, section = null, module = null, debug = false) {
        //console.log(`[DEBUG] getLessonsSortedByPrevNext called with:`, { classNum, section, module, debug });

        const response = await this.getLessonsByFlags(classNum, section, module);
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        //console.log(`[DEBUG] lessonsData:`, lessonsData);

        if (!Array.isArray(lessonsData) || lessonsData.length === 0) {
            if (debug) console.warn("[WARN] No lessons found for given flags.");
            return [];
        }

        const lessonMap = new Map(lessonsData.map(lesson => [lesson.lesson.ID, lesson]));
        let startLesson = null;

        if (!debug) {
            startLesson = lessonsData.find(lesson => {
                const starter = lesson.lesson.SectionStarter;
                return starter === true || (starter?.Valid && starter.Int32 === section);
            });
        }

        if (!startLesson) {
            startLesson = lessonsData.find(l => !l.lesson.PrevLessonID || l.lesson.PrevLessonID === "");
        }

        if (!startLesson) {
            return lessonsData.sort((a, b) => new Date(a.lesson.CreatedAt.Time) - new Date(b.lesson.CreatedAt.Time));
        }

        const lessons = [];
        const visitedIds = new Set();
        let currentId = startLesson.lesson.ID;

        while (currentId && lessonMap.has(currentId)) {
            if (visitedIds.has(currentId)) {
                console.warn(`[WARN] Circular reference detected at lesson ${currentId}.`);
                break;
            }

            const currentLesson = lessonMap.get(currentId);
            lessons.push(currentLesson);
            visitedIds.add(currentId);
            
            currentId = currentLesson.lesson.NextLessonID;
        }

        if (visitedIds.size < lessonsData.length) {
            const disconnected = lessonsData.filter(l => !visitedIds.has(l.lesson.ID));
            disconnected.sort((a, b) => new Date(a.lesson.CreatedAt.Time) - new Date(b.lesson.CreatedAt.Time));
            lessons.push(...disconnected);
            console.warn(`[WARN] Appended ${disconnected.length} disconnected lesson(s) to preserve visibility.`);
        }

        return lessons;
    }

    async getSectionLessonChain(lessonId) {
        try {
            const lesson = await this.getLessonById(lessonId);
            const lessonData = typeof lesson === 'string' ? JSON.parse(lesson) : lesson;
            
            const classNum = lessonData?.flag_translation?.class ?? null;
            const section = lessonData?.flag_translation?.section ?? null;
            const module = lessonData?.flag_translation?.module ?? null;

            if (classNum === null && section === null && module === null) {
                console.warn(`[WARN] Cannot build chain: Lesson ${lessonId} lacks all routing flags.`);
                return [];
            }

            return await this.api.get(`/api/lesson_chapter/${lessonId}`);
        } catch (error) {
            console.error(`Failed to get sorted lessons for section starter ID ${lessonId}:`, error);
            return [];
        }
    }

    async getSectionsForClass(classNum){
        console.warn("getSectionsForClass is DEPRECATED. Use getSections instead.");
        const result = await this.getSections(classNum, null);
        for (let i = 0; i < result.length; i++) {
            result[i] = result[i].section;
        }
        return result;
    }

    async getSections(classNum = null, module = null) {

        let response = {};
        if (classNum === null && module === null) {
            response = await this.getLessons();
        } else {
            response = await this.getLessonsByFlags(classNum, null, module);
        }
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        const sectionsMap = new Map();

        lessonsData.forEach(lesson => {
            const key = `${lesson.flag_translation.class}-${lesson.flag_translation.section}`;
            sectionsMap.set(key, {
                section: lesson.flag_translation.section,
                class: lesson.flag_translation.class,
                module: lesson.flag_translation.module
            });

        })
        
        const result = Array.from(sectionsMap.values());
        // Sort by class first, then by section
        result.sort((a, b) => {
            if (a.class !== b.class) return a.class - b.class;
            return a.section - b.section;
        });
        return result;
    }

    async getSectionStarters(classNum = null, section = null, module = null) {
        const response = await this.getLessonsByFlags(classNum, section, module);
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        const starters = lessonsData.filter(lesson => {
            const starter = lesson.lesson.SectionStarter;
            if (typeof starter === 'boolean') {
                return starter === true;
            } else if (starter && typeof starter === 'object') {
                return starter.Valid && starter.Int32 === section;
            }
            return false;
        });
        return starters;
    }

    async modifyBookmark(lessonId) {
        return this.api.post(`/api/lessons/${lessonId}/bookmark`, {}, true);
    }

    async modifyFavorite(lessonId) {
        return this.api.post(`/api/lessons/${lessonId}/favorite`, {}, true);
    }

    async getBookmarks(userId) {
        return this.api.get(`/api/users/${userId}/bookmarks`);
    }

    async getBookmarkStatus(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            if (!userData || !userData.ID) {
                console.warn('User not authenticated or user data is invalid');
                return false;
            } else {
                userId = userData.ID;
            }
        }
        
        const bookmarks = await this.getBookmarks(userId);
        //console.log('Bookmarks:', bookmarks);
        const isBookmarked = bookmarks.some(bookmark => bookmark.LessonID === lessonId);
        return isBookmarked;
    }

    async getFavoritesNumber(lessonId) {
        return this.api.get(`/api/lessons/${lessonId}/faves`);
    }

    async getFavoriteStatus(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }
        
        try {
            const response = await this.api.get(`/api/lessons/${lessonId}/users/${userId}`, true);
            const data = typeof response === 'string' ? JSON.parse(response) : response;
            return data.Favorited;
        } catch (error) {
            console.error('Failed to get favorite status:', error);
            return false;
        }
    }

    async finishLesson(lessonId) {
        return this.api.post(`/api/lessons/${lessonId}/complete`, {}, true);
    }

    async startLesson(lessonId) {
        return this.api.post(`/api/lessons/${lessonId}/start`, {}, true);
    }

    async getCompletionTime(lessonId, userId = null) {
        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }

        const response = await this.api.get(`/api/lessons/${lessonId}/users/${userId}`, true);
        const data = typeof response === 'string' ? JSON.parse(response) : response;
        const startRaw = data?.StartedAt?.Time || data?.StartedAt;
        const finishRaw = data?.CompletedAt?.Time || data?.CompletedAt;

        const startTime = new Date(startRaw.replace(' ', 'T'));
        const finishTime = new Date(finishRaw.replace(' ', 'T'));

        if (!Number.isFinite(startTime.getTime()) || !Number.isFinite(finishTime.getTime())) {
            return "0 minute(s) and 0 second(s)";
        }

        const durationMs = Math.max(0, finishTime.getTime() - startTime.getTime());
        const minutes = Math.floor(durationMs / 60000);
        const seconds = Math.floor((durationMs % 60000) / 1000);
        const dataFormatted = `${minutes} minute(s) and ${seconds} second(s)`;
        return dataFormatted;
    }

    async getInteractions(userId = null, max_results = 3) {

        if (!userId) {
            const currentUser = await this.api.users.getCurrentUser();
            const userData = typeof currentUser === 'string' ? JSON.parse(currentUser) : currentUser;
            userId = userData.ID;
        }

        let response = await this.api.get(`/api/users/${userId}/interactions`);
        // sort by UpdatedAt descending
        response.sort((a, b) => {
            const dateA = new Date(a.UpdatedAt.Time);
            const dateB = new Date(b.UpdatedAt.Time);
            return dateB - dateA;
        });
        response = response.slice(0, max_results);
        //console.log("User interactions:", response);
        return response;

    }

    async getInteractionsSection(lessonId, section = null, clasa = null, userId = null) {
    const userPromise = userId ? Promise.resolve(userId) : this.api.users.getCurrentUser().then(user => {
        const userData = typeof user === 'string' ? JSON.parse(user) : user;
        return userData?.ID || null;
    });

    const chainPromise = this.getSectionLessonChain(lessonId);

    const [resolvedUserId, lessonChain] = await Promise.all([userPromise, chainPromise]);

    if (!resolvedUserId) {
        console.warn('User not authenticated or user data is invalid');
        return [];
    }

    if (!lessonChain || lessonChain.length === 0) {
        return [];
    }

    const validLessonIds = new Set(lessonChain.map(lesson => lesson.ID || lesson.id || lesson));

    const interactions = await this.api.get(`/api/users/${resolvedUserId}/interactions`);

    const filteredInteractions = [];

    for (const interaction of interactions) {
        if (validLessonIds.has(interaction.LessonID)) {
            
            const isCompleted = interaction.CompletedAt?.Valid;
            const isStarted = interaction.StartedAt?.Valid;

            if (isCompleted) {
                interaction.ParsedStatus = 'Completed';
            } else if (isStarted) {
                interaction.ParsedStatus = 'Started';
            } else {
                interaction.ParsedStatus = 'Not Started';
            }
            
            filteredInteractions.push(interaction);
        }
    }

    return filteredInteractions;
}

    async updateLessonOrder(lessonId, prev = null, next = null) {
        // Validate lesson ID
        if (!lessonId || lessonId.trim() === '') {
            throw new Error('Invalid lesson ID: lesson ID cannot be empty');
        }

        if (prev != null) {
            return await this.api.put(`/api/lessons/${lessonId}?target_field=prev`, { prev: prev }, true);
        }
        if (next != null) {
            return await this.api.put(`/api/lessons/${lessonId}?target_field=next`, { next: next }, true);
        }
        return null;
    }

    async updateLessonSectionStarter(lessonId, sectionNumber) {
        return this.api.put(`/api/lessons/${lessonId}?target_field=section_starter`, { section: sectionNumber }, true);
    }

    async updateLessonContent(lessonId, file) {
        // First upload the file
        const fileResponse = await this.api.fileManager.uploadFile(file, 'lessons');
        // here we could also delete the old file :D
        return this.api.put(`/api/lessons/${lessonId}?target_field=content`, { content_id: fileResponse.file_id }, true);
    }

    async uploadLesson(lessonData, file) {
        // First upload the file
        const fileResponse = await this.api.fileManager.uploadFile(file, 'lessons');
        
        const lessonPayload = {
            ...lessonData,
            content_id: fileResponse.file_id
        };
        
        return this.createLesson(lessonPayload);
    }

    // for section starter page

    async isIdSectionStarter(lessonId) {
        try {
            const lesson = await this.getLessonById(lessonId);
            if (!lesson) return false;
            const lessonData = typeof lesson === 'string' ? JSON.parse(lesson) : lesson;
            
            return !!lessonData?.lesson?.SectionStarter;
        } catch (error) {
            console.error(`Failed to verify section starter for ID ${lessonId}:`, error);
            return false; 
        }
    }

    async getSectionLength(starterSectionLessonId) {
        try {
            const lesson = await this.getLessonById(starterSectionLessonId);
            if (!lesson) return 0;
            const classNum = lesson.flag_translation?.class || null;
            const section = lesson.flag_translation?.section || null;
            const module = lesson.flag_translation?.module || null;

            const lessons = await this.getLessonsSortedByPrevNext(classNum, section, module);
            return lessons.length;
        } catch (error) {
            console.error(`Failed to get section length for ID ${starterSectionLessonId}:`, error);
            return 0;
        }
    }

    // Update existing lesson

    async updateLessonField(lessonId, targetField, data) {
        // field can be: flags (class, section, module), details (title, description)
        return this.api.put(`/api/lessons/${lessonId}?target_field=${targetField}`, data, true);
    }

    // suggestions endpoints

    async getPendingLessons() {
        return this.api.get('/admin/lessons/suggested', true);
    }

    async approveLesson(lessonId) {
        return this.api.post(`/admin/lessons/suggested/${lessonId}/approve`, {}, true);
    }
}