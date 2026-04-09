package core

import (
	"Codium/internal/database"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"strings"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	Helper Functions

===========================================
*/

func (cfg *ApiCfg) UpdateUserDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	field := q.Get("target_field")
	if field == "" {
		cfg.Logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received update user request for field: %v", field)

	switch field {
	case "username":
		// Update username
		cfg.UpdateUserUsernameHandler(w, r, sendingUser)
	case "password":
		// Update password
		cfg.UpdateUserPasswordHandler(w, r, sendingUser)
	case "email":
		// Update email
		cfg.UpdateUserEmailHandler(w, r, sendingUser)
	case "pfp":
		// Update profile picture
		cfg.UpdateUserPfpHandler(w, r, sendingUser)

	default:
		cfg.Logger.Printf("Invalid target_field: %v", field)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) GetLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.GetLessonsHandler(w, r)
		return
	}
	searchType := q.Get("search_type")
	if searchType == "" {
		cfg.Logger.Printf("Missing search_type query parameter")
		http.Error(w, "Missing search_type query parameter", http.StatusBadRequest)
		return
	}

	switch searchType {
	case "id":
		cfg.GetLessonByIDHandler(w, r)
	case "flags":
		cfg.GetLessonsByFlagsHandler(w, r)
	case "section_starters":
		cfg.GetSectionStarterLessonsHandler(w, r)
	case "language":
		cfg.GetLessonsByLanguage(w, r)
	default:
		cfg.Logger.Printf("Invalid search_type: %v", searchType)
	}
}

func (cfg *ApiCfg) UpdateLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.Logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received update lesson request for field: %v", targetField)

	// Parse lesson ID as UUID
	lesson, err := GetObjByPathUUID(r, "lessonID", cfg.Db.GetLessonByID)
	if err != nil {
		cfg.Logger.Printf("Invalid lesson ID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	if !UserHasPermission(sendingUser, PermissionCanManageLessons) && !(lesson.AuthorID.UUID == sendingUser.ID) {
		cfg.Logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	switch targetField {
	case "next":
		cfg.UpdateLessonNextHandler(w, r, lesson)
	case "prev":
		cfg.UpdateLessonPrevHandler(w, r, lesson)
	case "details":
		cfg.UpdateLessonDetailsHandler(w, r, lesson)
	case "content":
		cfg.UpdateLessonContentHandler(w, r, lesson)
	case "flags":
		cfg.UpdateLessonFlagsHandler(w, r, lesson)
	case "section_starter":
		cfg.UpdateLessonsSectionStarterHandler(w, r, lesson)
	case "thumbnail":
		cfg.UpdateLessonThumbnailHandler(w, r, lesson)
	case "language":
		cfg.UpdateLessonLanguageHandler(w, r, lesson)
	default:
		cfg.Logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) UpdateProblemTestDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if !(UserHasPermission(sendingUser, PermissionCanManageProblems) || UserHasPermission(sendingUser, PermissionCanSuggestProblems)) {
		cfg.Logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.Logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received update problem test request for field: %v by user: %v", targetField, sendingUser.ID)

	// Parse test ID as UUID
	test, err := GetObjByPathUUID(r, "testID", cfg.Db.GetCodeTestByID)
	if err != nil {
		cfg.Logger.Printf("Invalid test ID format: %v", err)
		http.Error(w, "Invalid test ID format", http.StatusBadRequest)
		return
	}

	switch targetField {
	case "input":
		cfg.UpdateProblemTestInputHandler(w, r, test)
	case "expected_output":
		cfg.UpdateProblemTestExpectedOutputHandler(w, r, test)
	case "prev":
		cfg.UpdateProblemTestPreviousHandler(w, r, test)
	case "next":
		cfg.UpdateProblemTestNextHandler(w, r, test)
	default:
		cfg.Logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) UpdateSectionStartedLesson(lessonID uuid.UUID) (database.Lesson, error) {
	if !cfg.DatabaseCfg.Loaded {
		return database.Lesson{}, fmt.Errorf("database not connected")
	}

	lesson, err := cfg.Db.GetLessonByID(context.Background(), lessonID)
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to retrieve lesson: %v", err)
	}
	sectionStarter := lesson.SectionStarter

	section := lesson.Flags & 0x0000FF00
	cfg.Logger.Printf("Attempting to reset section starter for section: %v", section>>8)
	err = cfg.Db.ResetSectionStarterForSection(context.Background(), section)
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to reset section starters for section: %v", err)
	}

	res, err := cfg.Db.SetSectionStarter(context.Background(), database.SetSectionStarterParams{
		ID:             lessonID,
		SectionStarter: !sectionStarter,
	})
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to set section starter: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) GetProblemsDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.GetProblemsHandler(w, r)
		return
	}
	searchType := q.Get("search_type")
	if searchType == "" {
		cfg.Logger.Printf("Missing search_type query parameter")
		http.Error(w, "Missing search_type query parameter", http.StatusBadRequest)
	}
	switch searchType {
	case "id":
		cfg.GetProblemByIDHandler(w, r)
	case "tags":
		cfg.GetProblemsByTagsHandler(w, r)
	case "author":
		cfg.GetProblemsByAuthorHandler(w, r)
	case "source":
		cfg.GetProblemsBySourceHandler(w, r)
	}
}

func (cfg *ApiCfg) UpdateProblemDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.Logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	// Parse problem ID as UUID
	problem, err := GetObjByPathUUID(r, "problemID", cfg.Db.GetProblemByID)
	if err != nil {
		cfg.Logger.Printf("Invalid problem ID format: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	if !(UserHasPermission(sendingUser, PermissionCanManageProblems) || problem.AuthorID == sendingUser.ID) {
		cfg.Logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	cfg.Logger.Printf("Received update problem request for field: %v by user: %v", targetField, sendingUser.ID)

	switch targetField {
	case "details":
		cfg.UpdateProblemDetailsHandler(w, r, problem)
	case "tags":
		cfg.UpdateProblemTagsHandler(w, r, problem)
	case "test":
		cfg.UpdateProblemFirstTestHandler(w, r, problem)
	case "thumbnail":
		cfg.UpdateProblemThumbnailHandler(w, r, problem)
	default:
		cfg.Logger.Printf("Invalid target_field: %v", targetField)
	}
}

func (cfg *ApiCfg) GetSolutionsDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.GetSolutionsHandler(w, r, sendingUser)
		return
	}

	searchType := q.Get("search_type")
	if searchType == "" {
		cfg.Logger.Printf("Missing search_type query parameter")
		http.Error(w, "Missing search_type query parameter", http.StatusBadRequest)
		return
	}

	switch searchType {
	case "id":
		cfg.GetSolutionByIDHandler(w, r, sendingUser)
	case "user":
		cfg.GetSolutionsByUserHandler(w, r, sendingUser)
	case "problem":
		cfg.GetSolutionsByProblemHandler(w, r, sendingUser)
	default:
		cfg.Logger.Printf("Invalid search_type: %v", searchType)
	}
}

func (cfg *ApiCfg) UpdateSolutionDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//this is the first update function that doesn't necessarily need the user to be an admin
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}
	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.Logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}
	// Parse solution ID as UUID
	solution, err := GetObjByPathUUID(r, "solutionID", cfg.Db.GetSolutionByID)
	if err != nil {
		cfg.Logger.Printf("Invalid solution ID format: %v", err)
	}

	cfg.Logger.Printf("Received update solution request for field: %v", targetField)
	switch targetField {
	case "first_solution_test_id":
		cfg.UpdateSolutionFirstSolutionTestHandler(w, r, solution, sendingUser)
	case "tests":
		cfg.UpdateSolutionTestsHandler(w, r, solution, sendingUser)
	default:
		cfg.Logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) CountSolutionsDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	searchType := q.Get("search_type")
	if searchType == "" {
		cfg.Logger.Printf("Missing search_type query parameter")
		http.Error(w, "Missing search_type query parameter", http.StatusBadRequest)
		return
	}

	switch searchType {
	case "user":
		cfg.CountSolutionsHandler(w, r, sendingUser)
	case "problem":
		cfg.CountSolutionsByProblemIDHandler(w, r, sendingUser)
	default:
		cfg.Logger.Printf("Invalid search_type: %v", searchType)
		http.Error(w, "Invalid search_type", http.StatusBadRequest)
		return
	}
}

func GetUUIDFromPath(r *http.Request, key string) (uuid.UUID, error) {
	idStr := r.PathValue(key)
	if idStr == "" {
		return uuid.Nil, fmt.Errorf("missing %v in request", key)
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid UUID format for %v: %v", key, err)
	}
	return id, nil
}

func GetObjByPathUUID[T any](r *http.Request, key string, databaseGetter func(context.Context, uuid.UUID) (T, error)) (T, error) {
	idStr := r.PathValue(key)
	if idStr == "" {
		var zero T
		return zero, fmt.Errorf("missing %v in request", key)
	}
	id, err := uuid.Parse(idStr)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("invalid UUID format for %v: %v", key, err)
	}

	result, err := databaseGetter(r.Context(), id)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("failed to retrieve %v from database: %v", key, err)
	}
	return result, nil
}

func GetObjByQueryUUID[T any](r *http.Request, key string, databaseGetter func(context.Context, uuid.UUID) (T, error)) (T, error) {
	idStr := r.URL.Query().Get(key)
	if idStr == "" {
		var zero T
		return zero, fmt.Errorf("missing %v in request", key)
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("invalid UUID format for %v: %v", key, err)
	}

	result, err := databaseGetter(r.Context(), id)
	if err != nil {
		var zero T
		return zero, fmt.Errorf("failed to retrieve %v from database: %v", key, err)
	}
	return result, nil
}

func GetUUIDFromQuery(r *http.Request, key string) (uuid.UUID, error) {
	q := r.URL.Query()
	if len(q) == 0 {
		return uuid.Nil, fmt.Errorf("missing %v in request", key)
	}
	idStr := q.Get(key)
	if idStr == "" {
		return uuid.Nil, fmt.Errorf("missing %v in request", key)
	}

	id, err := uuid.Parse(idStr)
	if err != nil {
		return uuid.Nil, fmt.Errorf("invalid UUID format for %v: %v", key, err)
	}
	return id, nil
}

// convert []database.Lesson -> []any and wrapper printer to call PrintLessonToJson
func lessonsToAny(lessons []database.Lesson) []any {
	res := make([]any, len(lessons))
	for i, l := range lessons {
		res[i] = l
	}
	return res
}

func lessonsUsersToAny(lus []database.LessonsUser) []any {
	res := make([]any, len(lus))
	for i, lu := range lus {
		res[i] = lu
	}
	return res
}

func problemsToAny(problems []database.Problem) []any {
	res := make([]any, len(problems))
	for i, p := range problems {
		res[i] = p
	}
	return res
}

func solutionsToAny(solutions []database.Solution) []any {
	res := make([]any, len(solutions))
	for i, v := range solutions {
		res[i] = v
	}
	return res
}

func userProblemsToAny(ups []database.UsersProblem) []any {
	res := make([]any, len(ups))
	for i, up := range ups {
		res[i] = up
	}
	return res
}

/*
===========================================

	File Management Handlers

===========================================
*/

func (cfg *ApiCfg) UploadHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//retrieve query parameters
	q := r.URL.Query()
	var location string
	if len(q) > 0 {
		location = q.Get("location")
	} else {
		cfg.Logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // Limit upload size to 10 MB
	if err != nil {
		cfg.Logger.Printf("Error parsing multipart form: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Retrieve the file from form data

	file, handler, err := r.FormFile("file")
	if err != nil {
		cfg.Logger.Printf("Error retrieving the file: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	defer func(file multipart.File) {
		err := file.Close()
		if err != nil {
			cfg.Logger.Printf("Error closing the file: %v", err)
		}
	}(file)

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		cfg.Logger.Printf("Error reading the file: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	fileType := http.DetectContentType(fileBytes)

	cfg.Logger.Printf("Received upload request for file: %v", handler.Filename)
	cfg.Logger.Printf("Upload size: %v", handler.Size)
	cfg.Logger.Printf("Upload type: %v", handler.Header.Get("Content-Type"))

	_, err = file.Seek(0, 0)
	if err != nil {
		cfg.Logger.Printf("Error seeking file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	uploadPath, uploadID, err := cfg.Upload(file, location, fileType, sendingUser, handler.Filename[strings.LastIndex(handler.Filename, ".")+1:], handler.Size)
	if err != nil {
		cfg.Logger.Printf("Failed to upload file: %v", err)
		http.Error(w, "Failed to upload file ", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"file_id": "%v", "file_path": "%v"}`, uploadID, uploadPath)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetFileHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get file by id request")

	// Parse file ID as UUID
	fileID, err := GetUUIDFromPath(r, "fileID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid file ID format", http.StatusBadRequest)
		return
	}

	file, err := cfg.Db.GetFileByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("File not found: %v", fileID)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Serve the file
	http.ServeFile(w, r, file.Filepath)
}

/*
===========================================

	Admin Handlers

===========================================
*/

func (cfg *ApiCfg) ResetHandler(w http.ResponseWriter, _ *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received request to reset the database")

	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.Logger.Printf("Unauthorized access attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.Logger.Print("Admin reset initiated by user: ", sendingUser.ID)

	// Delete all users
	err := cfg.ResetAll()
	if err != nil {
		cfg.Logger.Printf("Failed to reset users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte("Database has been reset successfully."))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) SetUserAccountStatusHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		UserID uuid.UUID `json:"userId"`
		Title  string    `json:"title"`
	}

	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.Logger.Printf("Unauthorized set account status attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received set user account status request for user ID: %v to title: %v", p.UserID, p.Title)

	title := p.Title

	targetUser, err := cfg.Db.GetUserByID(r.Context(), p.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("User not found for ID: %v", p.UserID)
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		cfg.Logger.Printf("Failed to retrieve target user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	var newPerms UserPermissions

	switch title {
	case "basic":
		newPerms = 0
	case "admin":
		newPerms |= PermissionAdmin | PermissionCanManageUsers | PermissionCanManageLessons | PermissionCanManageProblems | PermissionCanViewOtherSolutions
	case "teacher":
		newPerms |= PermissionCanViewOtherSolutions | PermissionCanSuggestLessons | PermissionCanSuggestProblems
	case "moderator":
		newPerms |= PermissionCanManageLessons | PermissionCanManageProblems
	default:
		cfg.Logger.Printf("Invalid title provided for upgrade: %v", title)
		http.Error(w, "Invalid title provided", http.StatusBadRequest)
		return
	}
	_, err = cfg.Db.SetUserTitle(r.Context(), database.SetUserTitleParams{
		ID:        targetUser.ID,
		Title:     title,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to set user title: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.Db.SetUserPermissions(r.Context(), database.SetUserPermissionsParams{
		ID:          targetUser.ID,
		Permissions: int16(newPerms),
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to upgrade user permissions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) ApproveLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionCanManageLessons) {
		cfg.Logger.Printf("Unauthorized lesson approval attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for lesson ID: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received approve lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	res, err := cfg.Db.UpdateLessonSuggested(r.Context(), database.UpdateLessonSuggestedParams{
		ID:        lessonID,
		Suggested: false,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to approve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) ApproveProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.Logger.Printf("Unauthorized problem approval attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Printf("Received approve problem request for problem ID: %v by user ID: %v", problemID, sendingUser.ID)

	res, err := cfg.Db.UpdateProblemSuggested(r.Context(), database.UpdateProblemSuggestedParams{
		ID:        problemID,
		Suggested: false,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		cfg.Logger.Printf("Failed to approve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}
