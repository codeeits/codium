import { ModalEngine } from '/app/Scripts/modal/modalMain.js';
import { ModalHelpers } from '/app/Scripts/modal/modalHelpers.js';

const engine = new ModalEngine();

const state = {
    userId: null,
    user: null,
    continueItems: [],
    continueIndex: 0,
    bookmarkLessons: [],
    bookmarkIndex: 0,
};

const elements = {
    userAvatar: document.getElementById('userAvatar'),
    userName: document.getElementById('userName'),
    userEmail: document.getElementById('userEmail'),
    logoutBtn: document.getElementById('logoutBtn'),
    editProfileBtn: document.getElementById('editProfileBtn'),
    continueCard: document.getElementById('continueCard'),
    continueCategory: document.getElementById('continueCategory'),
    continueTitle: document.getElementById('continueTitle'),
    continueDescription: document.getElementById('continueDescription'),
    continueDifficulty: document.getElementById('continueDifficulty'),
    continueButton: document.getElementById('continueButton'),
    continuePrevBtn: document.getElementById('continuePrevBtn'),
    continueNextBtn: document.getElementById('continueNextBtn'),
    continueNavIndicator: document.getElementById('continueNavIndicator'),
    bookmarksCards: document.getElementById('bookmarksCards'),
    bookmarkTemplate: document.getElementById('bookmarkTemplate'),
    bookmarksEmptyState: document.getElementById('bookmarksEmptyState'),
    bookmarksPrevBtn: document.getElementById('bookmarksPrevBtn'),
    bookmarksNextBtn: document.getElementById('bookmarksNextBtn'),
    bookmarksNavIndicator: document.getElementById('bookmarksNavIndicator'),

    streakDaysContainer: document.querySelector('.streak-days'),
    streakDescription: document.querySelector('.streak-days')?.previousElementSibling
};

function parseData(data) {
    return typeof data === 'string' ? JSON.parse(data) : data;
}

function showToast(message, type = 'info', duration = 3000) {
    if (window.toastsLoader && typeof window.toastsLoader.showToast === 'function') {
        window.toastsLoader.showToast(message, type, duration);
        return;
    }
    console.log(`[${type}] ${message}`);
}

function getLessonUrl(lessonId) {
    return `/app/Lectii/lessonindiv.html?id=${encodeURIComponent(lessonId)}`;
}

function makeElementKeyboardActivatable(element, onActivate, role = 'link') {
    if (!element || typeof onActivate !== 'function') {
        return;
    }

    element.setAttribute('tabindex', '0');
    element.setAttribute('role', role);
    element.style.cursor = 'pointer';

    element.onclick = onActivate;
    element.onkeydown = (event) => {
        if (event.key === 'Enter' || event.key === ' ' || event.key === 'Spacebar') {
            event.preventDefault();
            onActivate(event);
        }
    };
}

function setContinueEmptyState() {
    if (!elements.continueTitle || !elements.continueDescription || !elements.continueButton) {
        return;
    }

    elements.continueCategory.textContent = 'No activity';
    elements.continueTitle.textContent = 'Start your first lesson';
    elements.continueDescription.textContent = 'Your next lesson will appear here after you begin learning.';
    elements.continueDifficulty.textContent = '-';
    elements.continueButton.textContent = 'Browse lessons';
    elements.continueButton.onclick = () => {
        window.location.href = '/app/Lectii/lessons.html';
    };

    if (elements.continuePrevBtn) {
        elements.continuePrevBtn.disabled = true;
    }
    if (elements.continueNextBtn) {
        elements.continueNextBtn.disabled = true;
    }
    if (elements.continueNavIndicator) {
        elements.continueNavIndicator.textContent = '0/0';
    }
}

async function loadStreakWidget() {
    if (!elements.streakDaysContainer || !elements.streakDescription) return;

    try {
        let streakData = { current_streak: 0, done_today: false };
        if (window.apiService && window.apiService.game) {
            streakData = await window.apiService.game.getStreak();
        }

        const currentStreak = streakData.current_streak || 0;
        const isDoneToday = streakData.done_today || false;

        const jsDay = new Date().getDay();
        const todayIndex = jsDay === 0 ? 6 : jsDay - 1; 

        const dayElements = elements.streakDaysContainer.querySelectorAll('.streak-day');
        
        dayElements.forEach((el, index) => {
            el.classList.remove('active', 'completed');
            
            const daysToLookBack = isDoneToday ? currentStreak - 1 : currentStreak;
            if (index < todayIndex && index >= todayIndex - daysToLookBack) {
                el.classList.add('completed');
            }
        });

        const todayEl = dayElements[todayIndex];
        if (todayEl) {
            todayEl.classList.add('active');
            if (isDoneToday) todayEl.classList.add('completed');
        }

        if (isDoneToday) {
            elements.streakDescription.textContent = `Great job! Problem completed today. Streak continues!`;
        } else {
            elements.streakDescription.textContent = `Complete a problem today to start a new streak.`;
        }

    } catch (error) {
        console.error("Failed to load streak widget:", error);
    }
}

function setArrowState(prevBtn, nextBtn, itemCount, index = 0) {
    const disabled = itemCount <= 1;
    if (prevBtn) {
        prevBtn.disabled = disabled || index <= 0;
    }
    if (nextBtn) {
        nextBtn.disabled = disabled || index >= itemCount - 1;
    }
}

function updateNavIndicator(element, index, total) {
    if (!element) {
        return;
    }
    if (!total || total < 1) {
        element.textContent = '0/0';
        return;
    }
    element.textContent = `${index + 1}/${total}`;
}

function setCardPatternImage(container, seed) {
    if (!container || !window.apiService || typeof window.apiService.getPatternUrl !== 'function') {
        return;
    }

    const patternUrl = window.apiService.getPatternUrl(String(seed || 'codium'), 'shapes');
    container.style.backgroundImage = `url('${patternUrl}')`;
    container.style.backgroundSize = 'cover';
    container.style.backgroundPosition = 'center';
    container.style.backgroundRepeat = 'no-repeat';
}

function clampIndex(index, total) {
    if (total <= 0) {
        return 0;
    }
    return Math.max(0, Math.min(index, total - 1));
}

function inferDifficulty(lessonData) {
    if (lessonData && lessonData.difficulty) {
        return lessonData.difficulty;
    }
    return 'Unknown';
}

function bindProfileActions() {
    if (elements.logoutBtn) {
        elements.logoutBtn.addEventListener('click', () => {
            engine.openModal({
                type: 'danger-confirmation',
                onConfirm: () => {
                    window.apiService.users.logout();
                },
                onCancel: () => {
                    showToast('Logout cancelled.', 'info', 2000);
                }
            });
        });
    }

    if (elements.editProfileBtn) {
        /*
        elements.editProfileBtn.addEventListener('click', () => {
            engine.openModal({
                type: 'edit-profile',
                icon: 'fa-pencil',
                onConfirm: async (formElement) => {
                    await handleProfileEdit(formElement);
                }
            });

            // Modal markup is injected dynamically by ModalEngine, so we prefill after open.
            const editEmail = document.getElementById('editEmail');
            const editUsername = document.getElementById('editUsername');

            if (editEmail && state.user?.Email) {
                editEmail.value = state.user.Email;
            }

            if (editUsername && state.user?.Username) {
                editUsername.value = state.user.Username;
            }
        });
*/
        elements.editProfileBtn.addEventListener('click', async () => {
            await ModalHelpers.EditProfile.openModal({
                engine,
                user: state.user,
                icon: 'fa-pencil',
                onConfirm: (formElement) => {
                    console.log('Profile edit confirmed');
                    handleProfileEdit(formElement);
                }
            });

        });
    }
}

async function handleProfileEdit(formElement) {
    const updateData = {
        email: formElement.elements.email?.value?.trim() || null,
        username: formElement.elements.username?.value?.trim() || null,
        oldPassword: formElement.elements.password?.value || null,
        newPassword: formElement.elements.newPassword?.value || null,
        profilePicture: formElement.elements.profilePicture?.files?.[0] || null,
    };

    const hasAnyChange = Boolean(
        updateData.email ||
        updateData.username ||
        updateData.oldPassword ||
        updateData.newPassword ||
        updateData.profilePicture
    );

    if (!hasAnyChange) {
        showToast('No changes detected.', 'info', 2500);
        return;
    }

    try {
        await ModalHelpers.EditProfile.updateProfileData(updateData);
        showToast('Profile updated successfully!', 'success', 3000);
        await loadUserProfile();
    } catch (error) {
        if (window.handleApiError) {
            window.handleApiError(error, 'Failed to update profile.');
        } else {
            showToast(error?.message || 'Failed to update profile.', 'error', 4000);
        }
    }
}

async function loadUserProfile() {
    try {
        const currentUserRaw = await window.apiService.users.getCurrentUser();
        const user = parseData(currentUserRaw);

        state.user = user;
        state.userId = user.ID;

        if (elements.userName) {
            elements.userName.textContent = user.Username || 'Unknown User';
        }

        if (elements.userEmail) {
            elements.userEmail.textContent = user.Email || 'No email';
        }

        if (elements.userAvatar) {
            if (user.ProfilePicID) {
                elements.userAvatar.src = window.apiService.fileManager.getFileUrl(user.ProfilePicID);
            } else {
                elements.userAvatar.src = 'https://api.dicebear.com/9.x/initials/svg?seed=' + encodeURIComponent(user.Username || 'user');
            }
        }
    } catch (error) {
        if (window.handleApiError) {
            window.handleApiError(error, 'Failed to load user profile.');
        }
    }
}

function isInProgressInteraction(interaction) {
    const completed = interaction?.CompletedAt?.Valid;
    return !completed;
}

function getInteractionLessonId(interaction) {
    return interaction?.LessonID || interaction?.lesson_id || null;
}

function renderContinueItem(index) {
    if (!Array.isArray(state.continueItems) || state.continueItems.length === 0) {
        setContinueEmptyState();
        return;
    }

    const safeIndex = clampIndex(index, state.continueItems.length);
    state.continueIndex = safeIndex;

    const selected = state.continueItems[safeIndex];
    const lessonData = selected.lessonData;
    const lesson = lessonData.lesson;
    const classLabel = lessonData?.flag_translation?.class;

    if (elements.continueCategory) {
        elements.continueCategory.textContent = classLabel ? `CLASA A ${classLabel}-A` : 'Lesson';
    }
    if (elements.continueTitle) {
        elements.continueTitle.textContent = lesson.Title || 'Untitled lesson';
    }
    if (elements.continueDescription) {
        const description = lesson.Description?.String || lesson.Description || 'Continue your learning journey.';
        elements.continueDescription.textContent = description;
    }
    if (elements.continueDifficulty) {
        elements.continueDifficulty.textContent = inferDifficulty(lessonData);
    }

    if (elements.continueCard) {
        makeElementKeyboardActivatable(elements.continueCard, () => {
            window.location.href = getLessonUrl(lesson.ID);
        }, 'link');
    }

    if (elements.continueButton) {
        elements.continueButton.textContent = isInProgressInteraction(selected.interaction) ? 'Continue' : 'Open lesson';
        elements.continueButton.onclick = (event) => {
            event.stopPropagation();
            window.location.href = getLessonUrl(lesson.ID);
        };
    }

    const image = elements.continueCard?.querySelector('.content-card-image');
    setCardPatternImage(image, lesson.ID);

    setArrowState(elements.continuePrevBtn, elements.continueNextBtn, state.continueItems.length, safeIndex);
    updateNavIndicator(elements.continueNavIndicator, safeIndex, state.continueItems.length);
}

function bindContinueArrows() {
    if (elements.continuePrevBtn) {
        elements.continuePrevBtn.addEventListener('click', () => {
            renderContinueItem(state.continueIndex - 1);
        });
    }
    if (elements.continueNextBtn) {
        elements.continueNextBtn.addEventListener('click', () => {
            renderContinueItem(state.continueIndex + 1);
        });
    }
}

async function loadContinueLearning() {
    // loadContinueLearning returns, on logged in users, an array of interactions sorted by most recent, with the lesson data for each interaction, and whether it's in progress or completed. We then render the most recent interaction as the "Continue Learning" card, and allow navigation through the next 5 interactions if available.
    if (!state.userId) {
        setContinueEmptyState();
        return;
    }

    try {
        const interactionsRaw = await window.apiService.lessons.getInteractions(state.userId, 6);
        const interactions = parseData(interactionsRaw) || [];

        if (!Array.isArray(interactions) || interactions.length === 0) {
            setContinueEmptyState();
            return;
        }

        const sortedInteractions = interactions.filter((interaction) => getInteractionLessonId(interaction));

        if (sortedInteractions.length === 0) {
            setContinueEmptyState();
            return;
        }

        const uniqueLessonIds = [];
        sortedInteractions.forEach((interaction) => {
            const lessonId = getInteractionLessonId(interaction);
            if (lessonId && !uniqueLessonIds.includes(lessonId)) {
                uniqueLessonIds.push(lessonId);
            }
        });

        const lessonResults = await Promise.allSettled(
            uniqueLessonIds.slice(0, 10).map((lessonId) => window.apiService.lessons.getLessonById(lessonId))
        );

        const lessonMap = new Map();
        lessonResults.forEach((result) => {
            if (result.status !== 'fulfilled') {
                return;
            }
            const lessonData = parseData(result.value);
            if (lessonData?.lesson?.ID) {
                lessonMap.set(lessonData.lesson.ID, lessonData);
            }
        });

        const inProgressItems = [];
        const otherItems = [];

        sortedInteractions.forEach((interaction) => {
            const lessonId = getInteractionLessonId(interaction);
            const lessonData = lessonMap.get(lessonId);
            if (!lessonData?.lesson?.ID) {
                return;
            }

            const item = { interaction, lessonData };
            if (isInProgressInteraction(interaction)) {
                inProgressItems.push(item);
            } else {
                otherItems.push(item);
            }
        });

        state.continueItems = [...inProgressItems, ...otherItems];

        if (state.continueItems.length === 0) {
            setContinueEmptyState();
            return;
        }

        state.continueIndex = 0;
        renderContinueItem(state.continueIndex);
    } catch (error) {
        state.continueItems = [];
        setContinueEmptyState();
        if (window.handleApiError) {
            window.handleApiError(error, 'Failed to load continue learning section.');
        }
    }
}

function createBookmarkCard(lessonData) {
    if (!elements.bookmarkTemplate) {
        return null;
    }

    const card = elements.bookmarkTemplate.cloneNode(true);
    card.id = `bookmark-${lessonData.lesson.ID}`;
    card.style.display = '';

    const title = card.querySelector('.bookmark-title');
    const category = card.querySelector('.bookmark-category');
    const description = card.querySelector('.bookmark-description');
    const difficulty = card.querySelector('.bookmark-difficulty');
    const button = card.querySelector('.bookmark-button');

    if (title) {
        title.textContent = lessonData.lesson.Title || 'Untitled lesson';
    }

    if (category) {
        const classLabel = lessonData?.flag_translation?.class;
        category.textContent = classLabel ? `CLASA A ${classLabel}-A` : 'Lesson';
    }

    if (description) {
        const desc = lessonData.lesson.Description?.String || lessonData.lesson.Description || 'Open this lesson to continue learning.';
        description.textContent = desc;
    }

    if (difficulty) {
        difficulty.textContent = inferDifficulty(lessonData);
    }

    const image = card.querySelector('.content-card-image');
    setCardPatternImage(image, lessonData.lesson.ID);

    const openLesson = () => {
        window.location.href = getLessonUrl(lessonData.lesson.ID);
    };

    if (button) {
        button.onclick = (event) => {
            event.stopPropagation();
            openLesson();
        };
    }

    makeElementKeyboardActivatable(card, openLesson, 'link');

    return card;
}

function renderBookmarkItem(index) {
    if (!elements.bookmarksCards) {
        return;
    }

    elements.bookmarksCards.innerHTML = '';

    if (!Array.isArray(state.bookmarkLessons) || state.bookmarkLessons.length === 0) {
        if (elements.bookmarksEmptyState) {
            elements.bookmarksEmptyState.style.display = 'block';
        }
        setArrowState(elements.bookmarksPrevBtn, elements.bookmarksNextBtn, 0, 0);
        updateNavIndicator(elements.bookmarksNavIndicator, 0, 0);
        return;
    }

    const safeIndex = clampIndex(index, state.bookmarkLessons.length);
    state.bookmarkIndex = safeIndex;

    if (elements.bookmarksEmptyState) {
        elements.bookmarksEmptyState.style.display = 'none';
    }

    const selectedLesson = state.bookmarkLessons[safeIndex];
    const card = createBookmarkCard(selectedLesson);
    if (card) {
        elements.bookmarksCards.appendChild(card);
    }

    setArrowState(elements.bookmarksPrevBtn, elements.bookmarksNextBtn, state.bookmarkLessons.length, safeIndex);
    updateNavIndicator(elements.bookmarksNavIndicator, safeIndex, state.bookmarkLessons.length);
}

function bindBookmarkArrows() {
    if (elements.bookmarksPrevBtn) {
        elements.bookmarksPrevBtn.addEventListener('click', () => {
            renderBookmarkItem(state.bookmarkIndex - 1);
        });
    }

    if (elements.bookmarksNextBtn) {
        elements.bookmarksNextBtn.addEventListener('click', () => {
            renderBookmarkItem(state.bookmarkIndex + 1);
        });
    }
}

async function loadBookmarks() {
    if (!state.userId || !elements.bookmarksCards || !elements.bookmarkTemplate) {
        return;
    }

    try {
        const bookmarksRaw = await window.apiService.lessons.getBookmarks(state.userId);
        const bookmarks = parseData(bookmarksRaw) || [];
        const normalizedBookmarks = Array.isArray(bookmarks)
            ? bookmarks
            : Array.isArray(bookmarks?.bookmarks)
                ? bookmarks.bookmarks
                : [];

        if (normalizedBookmarks.length === 0) {
            state.bookmarkLessons = [];
            renderBookmarkItem(0);
            return;
        }

        const uniqueLessonIds = Array.from(
            new Set(
                normalizedBookmarks
                    .map((bookmark) => bookmark?.LessonID || bookmark?.lesson_id || null)
                    .filter(Boolean)
            )
        );

        const lessonPromises = uniqueLessonIds
            .slice(0, 5)
            .map((lessonId) => window.apiService.lessons.getLessonById(lessonId));

        const lessonResults = await Promise.allSettled(lessonPromises);
        const lessons = lessonResults
            .filter((result) => result.status === 'fulfilled')
            .map((result) => parseData(result.value))
            .filter((lessonData) => lessonData && lessonData.lesson && lessonData.lesson.ID);

        state.bookmarkLessons = lessons;
        state.bookmarkIndex = 0;
        renderBookmarkItem(state.bookmarkIndex);
    } catch (error) {
        state.bookmarkLessons = [];
        renderBookmarkItem(0);

        if (window.handleApiError) {
            window.handleApiError(error, 'Failed to load bookmarks.');
        }
    }
}

async function initApp() {
    if (!(await window.apiService.checkAuthentication(true))) {
        return;
    }

    bindContinueArrows();
    bindBookmarkArrows();

    await loadUserProfile();
    bindProfileActions();

    await loadStreakWidget();

    await Promise.all([
        loadContinueLearning(),
        loadBookmarks(),
    ]);
}

document.addEventListener('DOMContentLoaded', async () => {
    try {
        await initApp();
    } catch (error) {
        if (window.handleApiError) {
            window.handleApiError(error, 'Failed to initialize user dashboard.');
        }
    }
});
