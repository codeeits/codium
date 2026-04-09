package core

import (
	"Codium/internal/database"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	Lesson CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		Title       string    `json:"title"`
		Description string    `json:"description"`
		ContentID   string    `json:"content_id"`
		Class       int       `json:"class"`
		Section     int       `json:"section"`
		Module      int       `json:"module"`
		Previous    uuid.UUID `json:"previous"`
		Next        uuid.UUID `json:"next"`
		Thumbnail   uuid.UUID `json:"thumbnail"`
		Language    string    `json:"language"`
	}

	//check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//check sendingUser is admin
	if !(UserHasPermission(sendingUser, PermissionCanManageLessons) || UserHasPermission(sendingUser, PermissionCanSuggestLessons)) {
		cfg.Logger.Printf("Unauthorized add lesson attempt by non-admin sendingUser: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received request to add lesson with request body: ", p)

	if p.Title == "" || p.ContentID == "" {
		cfg.Logger.Printf("Missing required fields: title, description, or content_id")
		http.Error(w, "Missing required fields: title, description, or content_id", http.StatusBadRequest)
		return
	}

	var prevLesson uuid.NullUUID
	var nextLesson uuid.NullUUID

	if p.Previous != uuid.Nil {
		prevLesson.UUID = p.Previous
		prevLesson.Valid = true
	}

	if p.Next != uuid.Nil {
		nextLesson.UUID = p.Next
		nextLesson.Valid = true
	}

	contentUUID, err := uuid.Parse(p.ContentID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for content_id: %v", err)
		http.Error(w, "Invalid content_id format", http.StatusBadRequest)
		return
	}

	lessonID := uuid.New()

	//check for duplicate lesson
	existingLesson, err := cfg.Db.GetLessonByContentID(r.Context(), contentUUID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		cfg.Logger.Printf("Failed to check for existing lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existingLesson.ID != uuid.Nil {
		cfg.Logger.Printf("Lesson with content_id %v already exists", contentUUID)
		http.Error(w, "Duplicate lesson with same content_id", http.StatusConflict)
		return
	}

	flag, mask := BuildLessonFlags(p.Class, p.Section, 0, p.Module)

	//get lesson number
	number, err := cfg.Db.CountLessons(r.Context(), database.CountLessonsParams{
		Flags:   int32(mask),
		Flags_2: int32(flag),
	})

	flag, _ = BuildLessonFlags(p.Class, p.Section, int(number+1), p.Module)

	//check if sendingUser is admin

	res, err := cfg.Db.AddLesson(r.Context(), database.AddLessonParams{
		ID:           lessonID,
		Title:        p.Title,
		Description:  sql.NullString{String: p.Description, Valid: p.Description != ""},
		ContentID:    contentUUID,
		AuthorID:     uuid.NullUUID{UUID: sendingUser.ID, Valid: true},
		Flags:        int32(flag),
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		PrevLessonID: prevLesson,
		NextLessonID: nextLesson,
		Suggested:    UserHasPermission(sendingUser, PermissionCanSuggestLessons),
		ThumbnailID:  uuid.NullUUID{UUID: p.Thumbnail, Valid: p.Thumbnail != uuid.Nil},
		Language:     p.Language,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to add lesson: %v", err)
		http.Error(w, "Failed to add lesson", http.StatusInternalServerError)
		return
	}

	if prevLesson.Valid {
		_, err = cfg.Db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           prevLesson.UUID,
			NextLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update previous lesson's next field: %v", err)
			http.Error(w, "Failed to link lessons", http.StatusInternalServerError)
			return
		}
	}

	if nextLesson.Valid {
		_, err = cfg.Db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           nextLesson.UUID,
			PrevLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update next lesson's previous field: %v", err)
			http.Error(w, "Failed to link lessons", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonsHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}
	cfg.Logger.Print("Received get lessons request")
	lessons, err := cfg.ListLessons()
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonByIDHandler(w http.ResponseWriter, r *http.Request) {
	//Database check is done in the disambiguation function

	// Parse lesson ID as UUID
	lesson, err := GetObjByQueryUUID(r, "lesson_id", cfg.Db.GetLessonByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Lesson not found: %v", err)
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.Logger.Print("Received get lesson by ID request for lesson ID: ", lesson.ID)

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lesson, PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonsByFlagsHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Class   int `json:"class"`
		Section int `json:"section"`
		Module  int `json:"module"`
		Number  int `json:"number"`
	}

	var p = params{
		0, 0, 0, 0,
	}

	queries := r.URL.Query()
	// One of the queries will be for search_type, so we check if there are more than 1 query parameters
	if len(queries) > 1 {
		classStr := queries.Get("class")
		sectionStr := queries.Get("section")
		moduleStr := queries.Get("module")
		numberStr := queries.Get("number")

		if classStr != "" {
			p.Class, _ = strconv.Atoi(classStr)
		}
		if sectionStr != "" {
			p.Section, _ = strconv.Atoi(sectionStr)
		}
		if moduleStr != "" {
			p.Module, _ = strconv.Atoi(moduleStr)
		}
		if numberStr != "" {
			p.Number, _ = strconv.Atoi(numberStr)
		}
	}

	cfg.Logger.Print("Received get lesson by flags request for class: ", p.Class, " section: ", p.Section, " module: ", p.Module, " number: ", p.Number)
	//Database check is done in the disambiguation function

	flag, mask := BuildLessonFlags(p.Class, p.Section, p.Number, p.Module)

	lessons, err := cfg.Db.GetLessonsByFlags(r.Context(), database.GetLessonsByFlagsParams{
		Flags:   int32(mask),
		Flags_2: int32(flag),
		Limit:   1000,
		Offset:  0,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Lesson not found with specified flags")
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonsByLanguage(w http.ResponseWriter, r *http.Request) {
	queries := r.URL.Query()
	if len(queries) < 1 {
		cfg.Logger.Printf("Missing query parameter 'language'")
		http.Error(w, "Missing query parameter 'language'", http.StatusBadRequest)
		return
	}

	language := queries.Get("language")
	res, err := cfg.Db.GetLessonsByLanguage(r.Context(), database.GetLessonsByLanguageParams{
		Language: language,
		Limit:    1000,
		Offset:   0,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Language not found with specified language")
			http.Error(w, "Language not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(res), PrintLessonToJson)
}

func (cfg *ApiCfg) GetSuggestedLessonsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// This function will be placed in a separate endpoint in the admins section
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get suggested lessons request")
	lessons, err := cfg.Db.GetSuggestedLessons(r.Context(), database.GetSuggestedLessonsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve suggested lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	var filteredLessons []database.Lesson
	for _, lesson := range lessons {
		if UserHasPermission(sendingUser, PermissionAdmin) || lesson.AuthorID.Valid && lesson.AuthorID.UUID == sendingUser.ID {
			filteredLessons = append(filteredLessons, lesson)
		}
	}
	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(filteredLessons), PrintLessonToJson)
}

func (cfg *ApiCfg) DeleteLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received delete lesson request")

	//Authenticate the user making the request
	if !UserHasPermission(sendingUser, PermissionCanManageLessons) {
		cfg.Logger.Printf("Unauthorized delete lesson attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	lesson, err := GetObjByPathUUID(r, "lessonID", cfg.Db.GetLessonByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Lesson not found: %v", err)
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Update previous lesson's next pointer
	if lesson.PrevLessonID.Valid {
		_, err = cfg.Db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           lesson.PrevLessonID.UUID,
			NextLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update previous lesson's next pointer: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	// Update next lesson's previous pointer
	if lesson.NextLessonID.Valid {
		_, err = cfg.Db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           lesson.NextLessonID.UUID,
			PrevLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update next lesson's previous pointer: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if lesson.SectionStarter && lesson.NextLessonID.Valid {
		_, err = cfg.UpdateSectionStartedLesson(lesson.NextLessonID.UUID)
	}

	// Delete the lesson

	err = cfg.DeleteLesson(lesson.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to delete lesson: %v", err)
		http.Error(w, "Failed to delete lesson", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) UpdateLessonNextHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		Next uuid.UUID `json:"next"`
	}

	//Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if targetLesson.NextLessonID.Valid {
		_, err = cfg.Db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           targetLesson.NextLessonID.UUID,
			PrevLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update next lesson prev: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
		ID:           targetLesson.ID,
		NextLessonID: uuid.NullUUID{UUID: p.Next, Valid: p.Next != uuid.Nil},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson next: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.Next != uuid.Nil {
		_, err = cfg.Db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           p.Next,
			PrevLessonID: uuid.NullUUID{UUID: targetLesson.ID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
	}

	if err != nil {
		cfg.Logger.Printf("Failed to update next lesson prev: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonPrevHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		Prev uuid.UUID `json:"prev"`
	}
	//Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if targetLesson.PrevLessonID.Valid {
		_, err = cfg.Db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           targetLesson.PrevLessonID.UUID,
			NextLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.Logger.Printf("Failed to update next lesson prev: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.Db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
		ID:           targetLesson.ID,
		PrevLessonID: uuid.NullUUID{UUID: p.Prev, Valid: p.Prev != uuid.Nil},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to update lesson prev: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.Prev != uuid.Nil {
		_, err = cfg.Db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           p.Prev,
			NextLessonID: uuid.NullUUID{UUID: targetLesson.ID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
	}
	if err != nil {
		cfg.Logger.Printf("Failed to update prev lesson next: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonContentHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		ContentID string `json:"content_id"`
	}
	//Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	contentUUID, err := uuid.Parse(p.ContentID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for content_id: %v", err)
		http.Error(w, "Invalid content_id format", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateLessonContent(r.Context(), database.UpdateLessonContentParams{
		ID:        targetLesson.ID,
		ContentID: contentUUID,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson content: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonDetailsHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
	}

	//Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateLessonDetails(r.Context(), database.UpdateLessonDetailsParams{
		ID:          targetLesson.ID,
		Title:       p.Title,
		Description: sql.NullString{String: p.Description, Valid: true},
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson details: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonFlagsHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		Class   int `json:"class"`
		Section int `json:"section"`
		Module  int `json:"module"`
		Number  int `json:"number"`
	}

	//Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	flags, mask := BuildLessonFlags(p.Class, p.Section, p.Number, p.Module)

	flag := (targetLesson.Flags & ^int32(mask)) | int32(flags)

	res, err := cfg.Db.UpdateLessonFlags(r.Context(), database.UpdateLessonFlagsParams{
		ID:        targetLesson.ID,
		Flags:     flag,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson flags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonsSectionStarterHandler(w http.ResponseWriter, _ *http.Request, targetLesson database.Lesson) {
	//Database check is done in the disambiguation function

	cfg.Logger.Printf("Received update section starter lesson request for lesson ID: %v", targetLesson.ID)

	res, err := cfg.UpdateSectionStartedLesson(targetLesson.ID)
	if err != nil {
		cfg.Logger.Printf("Failed to update section starter lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonThumbnailHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		ThumbnailID string `json:"thumbnail_id"`
	}

	//Database check is done in the disambiguation function
	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	thumbnailUUID, err := uuid.Parse(p.ThumbnailID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for thumbnail_id: %v", err)
		http.Error(w, "Invalid thumbnail_id format", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateLessonThumbnail(r.Context(), database.UpdateLessonThumbnailParams{
		ID:          targetLesson.ID,
		ThumbnailID: uuid.NullUUID{UUID: thumbnailUUID, Valid: true},
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson thumbnail: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonLanguageHandler(w http.ResponseWriter, r *http.Request, targetLesson database.Lesson) {
	type params struct {
		Language string `json:"language"`
	}
	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateLessonLanguage(r.Context(), database.UpdateLessonLanguageParams{
		ID:        targetLesson.ID,
		Language:  p.Language,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update lesson language: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) GetSectionStarterLessonsHandler(w http.ResponseWriter, r *http.Request) {
	//Database check is done in the disambiguation function

	cfg.Logger.Print("Received get section starter lessons request")
	lessons, err := cfg.Db.GetSectionStarterLessons(r.Context())
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve section starter lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}
