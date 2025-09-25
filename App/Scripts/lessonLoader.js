
let info = []; 
let content = '';
const titleContainer = document.getElementById('lesson-topic');

//varianta rudimentara la incercam sa fac inital, presupun ca mere si asa, doar sa existe o interfata grafica sa adaugi lectiile.

async function loadLesson(lessonId) {
    try {
        if (info.length === 0) {
            await fetchLessons();
        }
        
        const lesson = info.find(l => l.id === String(lessonId));
        if (!lesson) throw new Error('Lesson not found');
        
        const response = await fetch(lesson.path);
        content = await response.text();

        console.log('Lesson found:', lesson);
        console.log('Content:', content);
        return { lesson, content };
        
    } catch (error) {
        console.error('Error loading lesson:', error);
        throw error;
    }
}

async function fetchLessons() {
    try {
        const response = await fetch('/app/Lectii/manifest.json');
        const data = await response.json();
        console.log('Fetched lessons:', data.lectii);
        info = data.lectii; 
        return info;
    } catch (error) {
        console.error('Error fetching lessons:', error);
        throw error;
    }
}