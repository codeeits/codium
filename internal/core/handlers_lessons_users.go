package core

import (
	"Codium/internal/database"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
)

/*
===========================================

	Lesson User Interaction Handlers

===========================================
*/

func (cfg *ApiCfg) FavoriteLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received favorite lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserFavorite(lessonID, sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to toggle lesson favorite: %v", err)
		http.Error(w, "Failed to toggle lesson favorite", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, toggledUserLesson, GenericPrinter)
}

func (cfg *ApiCfg) BookmarkLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received bookmark lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserBookmark(lessonID, sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to toggle lesson bookmark: %v", err)
		http.Error(w, "Failed to toggle lesson bookmark", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, toggledUserLesson, GenericPrinter)
}

func (cfg *ApiCfg) GetLessonUserByLessonAndUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get lesson user request")

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for lesson ID: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	lessonUser, err := cfg.Db.GetLessonsUsersByLessonIDAndUserID(r.Context(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Lesson user not found for lesson ID %v and user ID %v", lessonID, userID)
			http.Error(w, "Lesson user not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) GetUserBookmarksHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get user bookmarks request for user ID: ", userID)

	lessonUsers, err := cfg.Db.GetLessonsUsersBookmarkedLessonsByUserID(r.Context(), database.GetLessonsUsersBookmarkedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.Logger.Printf("Failed to retrieve bookmarked lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) StartLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received start lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	lessonUser, err := cfg.MarkLessonUserStarted(lessonID, sendingUser.ID)
	if err != nil {
		if errors.Is(err, ErrNoChange) {
			cfg.Logger.Printf("Lesson was already started for lessonID %v: %v", lessonID, err)
			http.Error(w, "Lesson was already started", http.StatusNotModified)
			return
		}
		cfg.Logger.Printf("Failed to mark lesson as started: %v", err)
		http.Error(w, "Failed to mark lesson as started", http.StatusInternalServerError)
		return
	}

	err = cfg.WriteEventsForUser(sendingUser.ID, w)
	if err != nil {
		cfg.Logger.Printf("Failed to write events for user: %v", err)
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) CompleteLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received complete lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	lessonUser, err := cfg.MarkLessonUserCompleted(lessonID, sendingUser.ID)
	if err != nil {
		if errors.Is(err, ErrNoChange) {
			cfg.Logger.Printf("Lesson was already completed for lessonID %v: %v", lessonID, err)
			http.Error(w, "Lesson was already completed", http.StatusNotModified)
			return
		}

		cfg.Logger.Printf("Failed to mark lesson as completed: %v", err)
		http.Error(w, "Failed to mark lesson as completed", http.StatusInternalServerError)
		return
	}

	err = cfg.WriteEventsForUser(sendingUser.ID, w)
	if err != nil {
		cfg.Logger.Printf("Failed to write events for user: %v", err)
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) GetFavoritesForLessonHandler(w http.ResponseWriter, r *http.Request) {
	//Check database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
	}

	cfg.Logger.Printf("Received get favorites for lesson request: %v", r.URL.Path)

	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
	}

	faves, err := cfg.Db.CountLessonsUsersFavoritedLessonsByLessonID(r.Context(), lessonID)
	if err != nil {
		cfg.Logger.Printf("Failed to get favorites for lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"lesson_id":"%v", "num_favorites":%v}`, lessonID, faves)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func (cfg *ApiCfg) GetUserStartedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get user started lessons request for user ID: ", userID)

	lessonUsers, err := cfg.Db.GetLessonsUsersStartedLessonsByUserID(r.Context(), database.GetLessonsUsersStartedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.Logger.Printf("Failed to retrieve started lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) GetUserCompletedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received get user completed lessons request for user ID: ", userID)

	lessonUsers, err := cfg.Db.GetLessonsUsersCompletedLessonsByUserID(r.Context(), database.GetLessonsUsersCompletedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.Logger.Printf("Failed to retrieve completed lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) GetUserInteractionsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}
	cfg.Logger.Print("Received get user interactions request for user ID: ", userID)

	lessonUsers, err := cfg.Db.GetLessonsUsersByUserID(r.Context(), database.GetLessonsUsersByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.Logger.Printf("Failed to retrieve user interactions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) CountUserCompletedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received count user completed lessons request for user ID: ", userID)

	count, err := cfg.Db.CountLessonsUsersCompletedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.Logger.Printf("Failed to count completed lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "completed_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CountUserStartedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received count user started lessons request for user ID: ", userID)

	count, err := cfg.Db.CountLessonsUsersStartedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.Logger.Printf("Failed to count started lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "started_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CountUserBookmarkedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received count user bookmarked lessons request for user ID: ", userID)

	count, err := cfg.Db.CountLessonsUsersBookmarkedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.Logger.Printf("Failed to count bookmarked lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "bookmarked_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
