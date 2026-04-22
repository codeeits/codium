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

    async getLessons(params = {}) {
        const queryString = new URLSearchParams(params).toString();
        const url = queryString ? `/api/lessons?${queryString}` : '/api/lessons';
        return this.api.get(url, false);
    }

    async getLessonById(lessonId) {
        return this.api.get(`/api/lessons?search_type=id&lesson_id=${lessonId}`, false);
    }

    async getLessonsByFlags(classNum = null, section = null, module = null) {
        const params = new URLSearchParams({ search_type: 'flags' });
        if (classNum !== null) params.append('class', classNum);
        if (section !== null) params.append('section', section);
        if (module !== null) params.append('module', module);
        return this.api.get(`/api/lessons?${params.toString()}`, false);
    }

    async getLessonsSortedByPrevNext(classNum = null, section = null, module = null, debug = false) {
        //console.log(`[DEBUG] getLessonsSortedByPrevNext called with:`, { classNum, section, module, debug });

        const response = await this.getLessonsByFlags(classNum, section, module);
        const lessonsData = typeof response === 'string' ? JSON.parse(response) : response;
        //console.log(`[DEBUG] lessonsData:`, lessonsData);

        if (!Array.isArray(lessonsData) || lessonsData.length === 0) {
            console.warn("[WARN] No lessons found for given flags.");
            return [];
        }

        let lessons = [];
        let startLesson = null;
        let nextId = null;

        // attempt to find a section starter (if not in debug mode)

        if (!debug) {
            const sectionStarter = lessonsData.find(lesson => {
                const starter = lesson.lesson.SectionStarter;
                let valid = false;

                if (typeof starter === 'boolean') {
                    valid = starter === true;
                } else if (starter && typeof starter === 'object') {
                    valid = starter.Valid && starter.Int32 === section;
                }

                /*console.log(`[DEBUG] Checking lesson ${lesson.lesson.ID} for section starter:`, {
                    sectionStarter: starter,
                    valid,
                    targetSection: section
                });*/

                return valid;
            });

            if (sectionStarter) {
                //console.log(`[DEBUG] Found section starter:`, sectionStarter);
                startLesson = sectionStarter;
            } else {
                console.log(`[DEBUG] No section starter found for section ${section}, falling back to first lesson in chain.`);
            }
        }

        // fallback (also used when debug === true)
        if (!startLesson) {
            startLesson = lessonsData.find(lesson =>
                !lesson.lesson.PrevLessonID || lesson.lesson.PrevLessonID === ""
            );
            console.log(`[DEBUG] Fallback - found first lesson:`, startLesson);
        }

        // if still no valid starting point, just return lessons sorted by creation time
        if (!startLesson) {
            console.log(`[DEBUG] No valid chain start found, sorting by CreatedAt`);
            return lessonsData.sort((a, b) => {
                const dateA = new Date(a.lesson.CreatedAt.Time);
                const dateB = new Date(b.lesson.CreatedAt.Time);
                return dateA - dateB;
            });
        }

        // build chain
        const visitedIds = new Set();
        lessons.push(startLesson);
        visitedIds.add(startLesson.lesson.ID);
        nextId = startLesson.lesson.NextLessonID;

        while (nextId) {
            // avoid circular reference exists
            if (lessons.some(l => l.lesson.ID === nextId)) {
                console.warn(`[WARN] Circular reference detected at lesson ${nextId}.`);
                break;
            }

            const nextLesson = lessonsData.find(l => l.lesson.ID === nextId);
            if (nextLesson) {
                lessons.push(nextLesson);
                visitedIds.add(nextLesson.lesson.ID);
                nextId = nextLesson.lesson.NextLessonID;
            } else {
                nextId = null; // chain ends
            }
        }

        // Keep disconnected lessons visible so they can be repaired from the UI.
        const disconnectedLessons = lessonsData.filter(l => !visitedIds.has(l.lesson.ID));
        if (disconnectedLessons.length > 0) {
            disconnectedLessons.sort((a, b) => {
                const dateA = new Date(a.lesson.CreatedAt.Time);
                const dateB = new Date(b.lesson.CreatedAt.Time);
                return dateA - dateB;
            });
            lessons.push(...disconnectedLessons);
            console.warn(`[WARN] Appended ${disconnectedLessons.length} disconnected lesson(s) to preserve visibility.`);
        }

        //console.log(`[DEBUG] Final sorted lessons:`, lessons);
        return lessons;
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
        const response = await this.getLessonsByFlags(classNum, null, module);
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
            userId = userData.ID;
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

        const startTime = new Date(startRaw);
        const finishTime = new Date(finishRaw);

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
            const currentUser = await this.api.getCurrentUser();
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
        const fileResponse = await this.api.uploadFile(file, 'lessons');
        // here we could also delete the old file :D
        return this.api.put(`/api/lessons/${lessonId}?target_field=content`, { content_id: fileResponse.file_id }, true);
    }

    async uploadLesson(lessonData, file) {
        // First upload the file
        const fileResponse = await this.api.uploadFile(file, 'lessons');
        
        const lessonPayload = {
            ...lessonData,
            content_id: fileResponse.file_id
        };
        
        return this.createLesson(lessonPayload);
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