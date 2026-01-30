package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"io"
	"mime/multipart"
	"net/http"
	"regexp"
	"strconv"
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
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	field := q.Get("target_field")
	if field == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received update user request for field: %v", field)

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
		cfg.logger.Printf("Invalid target_field: %v", field)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) GetLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
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
		cfg.logger.Printf("Missing search_type query parameter")
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
	default:
		cfg.logger.Printf("Invalid search_type: %v", searchType)
	}
}

func (cfg *ApiCfg) UpdateLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received update lesson request for field: %v", targetField)

	// Parse lesson ID as UUID
	lesson, err := GetObjByPathUUID(r, "lessonID", cfg.db.GetLessonByID)
	if err != nil {
		cfg.logger.Printf("Invalid lesson ID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	if !UserHasPermission(sendingUser, PermissionCanManageLessons) && !(lesson.AuthorID.UUID == sendingUser.ID) {
		cfg.logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
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
	default:
		cfg.logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) UpdateProblemTestDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	// Parse test ID as UUID
	test, err := GetObjByPathUUID(r, "testID", cfg.db.GetCodeTestByID)
	if err != nil {
		cfg.logger.Printf("Invalid test ID format: %v", err)
		http.Error(w, "Invalid test ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received update problem test request for field: %v", targetField)
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
		cfg.logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) UpdateSectionStartedLesson(lessonID uuid.UUID) (database.Lesson, error) {
	if !cfg.databaseCfg.Loaded {
		return database.Lesson{}, fmt.Errorf("database not connected")
	}

	lesson, err := cfg.db.GetLessonByID(context.Background(), lessonID)
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to retrieve lesson: %v", err)
	}
	sectionStarter := lesson.SectionStarter

	section := lesson.Flags & 0x0000FF00
	cfg.logger.Printf("Attempting to reset section starter for section: %v", section>>8)
	err = cfg.db.ResetSectionStarterForSection(context.Background(), section)
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to reset section starters for section: %v", err)
	}

	res, err := cfg.db.SetSectionStarter(context.Background(), database.SetSectionStarterParams{
		ID:             lessonID,
		SectionStarter: !sectionStarter,
	})
	if err != nil {
		return database.Lesson{}, fmt.Errorf("failed to set section starter: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) GetProblemsDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
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
		cfg.logger.Printf("Missing search_type query parameter")
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
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}
	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Failed to authenticate user: %v", sendingUser.ID)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received update problem request for field: %v", targetField)
	// Parse problem ID as UUID
	problem, err := GetObjByPathUUID(r, "problemID", cfg.db.GetProblemByID)
	if err != nil {
		cfg.logger.Printf("Invalid problem ID format: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

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
		cfg.logger.Printf("Invalid target_field: %v", targetField)
	}
}

func (cfg *ApiCfg) GetSolutionsDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
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
		cfg.logger.Printf("Missing search_type query parameter")
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
		cfg.logger.Printf("Invalid search_type: %v", searchType)
	}
}

func (cfg *ApiCfg) UpdateSolutionDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//this is the first update function that doesn't necessarily need the user to be an admin
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}
	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}
	// Parse solution ID as UUID
	solution, err := GetObjByPathUUID(r, "solutionID", cfg.db.GetSolutionByID)
	if err != nil {
		cfg.logger.Printf("Invalid solution ID format: %v", err)
	}

	cfg.logger.Printf("Received update solution request for field: %v", targetField)
	switch targetField {
	case "first_solution_test_id":
		cfg.UpdateSolutionFirstSolutionTestHandler(w, r, solution, sendingUser)
	case "tests":
		cfg.UpdateSolutionTestsHandler(w, r, solution, sendingUser)
	default:
		cfg.logger.Printf("Invalid target_field: %v", targetField)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) CountSolutionsDisambiguationHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	searchType := q.Get("search_type")
	if searchType == "" {
		cfg.logger.Printf("Missing search_type query parameter")
		http.Error(w, "Missing search_type query parameter", http.StatusBadRequest)
		return
	}

	switch searchType {
	case "user":
		cfg.CountSolutionsHandler(w, r, sendingUser)
	case "problem":
		cfg.CountSolutionsByProblemIDHandler(w, r, sendingUser)
	default:
		cfg.logger.Printf("Invalid search_type: %v", searchType)
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

	Authentication Handlers

===========================================
*/

func (cfg *ApiCfg) LoginHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Email    string `json:"email"`
		Password string `json:"password"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	cfg.logger.Print("Received login request for email: ", p.Email)

	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.Email == "" || p.Password == "" {
		cfg.logger.Printf("Missing required fields: email or password")
		http.Error(w, "Missing required fields: email or password", http.StatusBadRequest)
		return
	}

	loginTarget, err := cfg.db.GetUserByEmail(r.Context(), p.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("User not found for email: %v", p.Email)
			http.Error(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}
		cfg.logger.Printf("Failed to retrieve user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = auth.CheckPasswordHash(p.Password, loginTarget.PasswordHash)
	if err != nil {
		cfg.logger.Printf("Invalid password for email: %v", p.Email)
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}
	token, err := auth.MakeJWT(loginTarget.ID, cfg.secret, time.Hour*24*7) // 7 days
	if err != nil {
		cfg.logger.Printf("Failed to create JWT: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Create a refresh token
	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		cfg.logger.Printf("Failed to create refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = cfg.db.CreateRefreshToken(r.Context(), database.CreateRefreshTokenParams{
		Token:     refreshToken,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		UserID:    loginTarget.ID,
		ExpiresAt: time.Now().Add(24 * time.Hour * 30), // 30 days
		RevokedAt: sql.NullTime{Valid: false},
	})
	if err != nil {
		cfg.logger.Printf("Failed to store refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	userJson, err := PrintUserToJson(loginTarget)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	token = strings.TrimSpace(token)
	refreshToken = strings.TrimSpace(refreshToken)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user":%v, "auth_token": "%v", "refresh_token": "%v"}`, userJson, token, refreshToken)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) RefreshHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		RefreshToken string `json:"refresh_token"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received token refresh request")

	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.RefreshToken == "" {
		cfg.logger.Printf("Missing required field: refresh_token")
		http.Error(w, "Missing required field: refresh_token", http.StatusBadRequest)
		return
	}

	storedToken, err := cfg.db.GetToken(r.Context(), p.RefreshToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Refresh token not found: %v", p.RefreshToken)
			http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
			return
		}
		cfg.logger.Printf("Failed to retrieve refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if storedToken.RevokedAt.Valid {
		cfg.logger.Printf("Refresh token has been revoked: %v", p.RefreshToken)
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}

	if time.Now().After(storedToken.ExpiresAt) {
		cfg.logger.Printf("Refresh token has expired: %v", p.RefreshToken)
		http.Error(w, "Refresh token has expired", http.StatusUnauthorized)
		return
	}

	token, err := auth.MakeJWT(storedToken.UserID, cfg.secret, time.Hour*24*7) // 7 days
	if err != nil {
		cfg.logger.Printf("Failed to create JWT: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"auth_token": "%v"}`, token)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) ValidateEmailHandler(w http.ResponseWriter, r *http.Request) {
	uid, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received validate email request for user ID: ", uid)
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	_, err = cfg.db.ValidateEmailForId(r.Context(), database.ValidateEmailForIdParams{
		ID:        uid,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to validate user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Location", cfg.websiteUrl+"/app/")
	w.WriteHeader(http.StatusPermanentRedirect)
	_, err = w.Write([]byte("Email validated successfully. Redirecting to app..."))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

/*
===========================================

	User CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Email    string `json:"email"`
		Username string `json:"username"`
		Password string `json:"password"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received request to create user with request body: ", p)

	// Check if database is connected

	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.Email == "" || p.Password == "" || p.Username == "" {
		cfg.logger.Printf("Missing required fields: email, password, or username")
		http.Error(w, "Missing required fields: email, password, or username", http.StatusBadRequest)
		return
	}

	if len(p.Username) < 3 || len(p.Username) > 20 {
		cfg.logger.Printf("Username must be between 3 and 20 characters")
		http.Error(w, "Username must be between 3 and 20 characters", http.StatusBadRequest)
		return
	}

	if len(p.Email) < 5 || len(p.Email) > 50 {
		cfg.logger.Printf("Email must be between 5 and 50 characters")
		http.Error(w, "Email must be between 5 and 50 characters", http.StatusBadRequest)
		return
	}

	// Check for not allowed characters in username or email
	match, err := regexp.Match("^[^\\s@]+@[^\\s@]+.[^\\s@]+$", []byte(p.Email))
	if err != nil {
		cfg.logger.Printf("Invalid email address: %v", err)
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	if !match {
		cfg.logger.Printf("Email contains invalid characters")
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	curedEmail := strings.Replace(strings.ToLower(p.Email), ".", "", -1) // Normalize email by removing dots

	match, err = regexp.Match("^[a-zA-Z0-9_]+$", []byte(p.Username))
	if err != nil {
		cfg.logger.Printf("Invalid username: %v", err)
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	if !match {
		cfg.logger.Printf("Username contains invalid characters")
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	// Hash the password
	hashedPassword, err := auth.HashPassword(p.Password)
	if err != nil {
		cfg.logger.Printf("Failed to hash password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.db.CreateUser(r.Context(), database.CreateUserParams{
		ID:           uuid.New(),
		Email:        p.Email,
		PasswordHash: hashedPassword,
		Username:     p.Username,
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		IsAdmin:      false,
		CuredEmail:   sql.NullString{String: curedEmail, Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to create user: %v", err)
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	cfg.logger.Printf("User created: %v", res)

	cfg.SendValidationEmail(p.Email, res.ID.String())

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintUserToJson)
}

func (cfg *ApiCfg) GetUsersHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get users request")
	users, err := cfg.ListUsers()
	if err != nil {
		cfg.logger.Printf("Failed to retrieve users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	jsonData, err := json.Marshal(users)
	if err != nil {
		cfg.logger.Printf("Failed to marshal users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write(jsonData)
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	var user database.User
	var err error

	// Check for query parameters
	q := r.URL.Query()
	if len(q) > 0 {
		switch q.Get("search_type") {
		case "email":
			userEmail := r.PathValue("searchArg")
			user, err = cfg.db.GetUserByEmail(r.Context(), userEmail)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.logger.Printf("User not found: %v", userEmail)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		case "username":
			userName := r.PathValue("searchArg")
			user, err = cfg.db.GetUserByUsername(r.Context(), userName)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.logger.Printf("User not found: %v", userName)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		case "jwt":
			jwtToken := r.PathValue("searchArg")
			uid, err := auth.ValidateJWT(jwtToken, cfg.secret)
			if err != nil {
				cfg.logger.Printf("Invalid token: %v", err)
				http.Error(w, "Invalid token", http.StatusBadRequest)
				return
			}
			user, err = cfg.db.GetUserByID(r.Context(), uid)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.logger.Printf("User not found: %v", uid)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		default:
			cfg.logger.Printf("Invalid search type: %v", q.Get("search_type"))
			http.Error(w, "Invalid search type", http.StatusBadRequest)
			return
		}
	} else {
		// Extract user ID from URL path
		userIDStr := r.PathValue("searchArg")
		if userIDStr == "" {
			cfg.logger.Printf("Missing user ID in request")
			http.Error(w, "Missing user ID", http.StatusBadRequest)
			return
		}

		// Parse user ID as UUID

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			cfg.logger.Printf("Invalid UUID format: %v", err)
			http.Error(w, "Invalid user ID format", http.StatusBadRequest)
			return
		}

		cfg.logger.Printf("Received get user request for user ID: %v", userID)

		user, err = cfg.db.GetUserByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				cfg.logger.Printf("User not found: %v", userID)
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}
			cfg.logger.Printf("Failed to retrieve user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
	cfg.WriteSingleJsonOutput(w, http.StatusOK, user, PrintUserToJson)
}

func (cfg *ApiCfg) DeleteUserHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete user request")

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	if sendingUser.ID != userID && !UserHasPermission(sendingUser, PermissionCanManageUsers) {
		cfg.logger.Printf("Unauthorized delete attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	err = cfg.DeleteUser(userID)
	if err != nil {
		cfg.logger.Printf("Failed to delete user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

/*
===========================================

	User Update Handlers

===========================================
*/

func (cfg *ApiCfg) UpdateUserPfpHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		ImageID string `json:"image_id"`
	}

	cfg.logger.Print("Received update user pfp request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Parse image ID as UUID
	imageID, err := uuid.Parse(p.ImageID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid image ID format", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateUserPfp(r.Context(), database.UpdateUserPfpParams{
		ID:           targetUser.ID,
		ProfilePicID: uuid.NullUUID{UUID: imageID, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update user profile picture: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) UpdateUserPasswordHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	cfg.logger.Print("Received update user password request for user ID: ", targetUser.ID.String())

	var p params
	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check old password
	err = auth.CheckPasswordHash(p.OldPassword, targetUser.PasswordHash)
	if err != nil {
		cfg.logger.Printf("Invalid old password for user ID: %v", targetUser.ID.String())
		http.Error(w, "Incorrect old password", http.StatusUnauthorized)
		return
	}

	// Hash the new password
	hashedPassword, err := auth.HashPassword(p.NewPassword)
	if err != nil {
		cfg.logger.Printf("Failed to hash new password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.db.UpdateUserPassword(r.Context(), database.UpdateUserPasswordParams{
		ID:           targetUser.ID,
		PasswordHash: hashedPassword,
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update user password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	//Revoke all refresh tokens for the user
	err = cfg.db.RevokeAllUserTokens(r.Context(), database.RevokeAllUserTokensParams{
		UserID:    targetUser.ID,
		RevokedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) UpdateUserEmailHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		NewEmail string `json:"email"`
	}

	cfg.logger.Print("Received update user email request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	_, err = cfg.db.UnvalidateEmailForId(r.Context(), database.UnvalidateEmailForIdParams{
		ID:        targetUser.ID,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to invalidate user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Update email

	res, err := cfg.db.UpdateUserEmail(r.Context(), database.UpdateUserEmailParams{
		ID:        targetUser.ID,
		Email:     p.NewEmail,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Send validation email to new address
	cfg.SendValidationEmail(p.NewEmail, res.ID.String())

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) UpdateUserUsernameHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		NewUsername string `json:"username"`
	}

	cfg.logger.Print("Received update user username request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateUserUsername(r.Context(), database.UpdateUserUsernameParams{
		ID:        targetUser.ID,
		Username:  p.NewUsername,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update user username: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

/*
===========================================

	File Management Handlers

===========================================
*/

func (cfg *ApiCfg) UploadHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//retrieve query parameters
	q := r.URL.Query()
	var location string
	if len(q) > 0 {
		location = q.Get("location")
	} else {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	err := r.ParseMultipartForm(10 << 20) // Limit upload size to 10 MB
	if err != nil {
		cfg.logger.Printf("Error parsing multipart form: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	// Retrieve the file from form data

	file, handler, err := r.FormFile("file")
	if err != nil {
		cfg.logger.Printf("Error retrieving the file: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}
	defer func(file multipart.File) {
		err := file.Close()
		if err != nil {
			cfg.logger.Printf("Error closing the file: %v", err)
		}
	}(file)

	fileBytes, err := io.ReadAll(file)
	if err != nil {
		cfg.logger.Printf("Error reading the file: %v", err)
		http.Error(w, "Bad Request", http.StatusBadRequest)
		return
	}

	fileType := http.DetectContentType(fileBytes)

	cfg.logger.Printf("Received upload request for file: %v", handler.Filename)
	cfg.logger.Printf("Upload size: %v", handler.Size)
	cfg.logger.Printf("Upload type: %v", handler.Header.Get("Content-Type"))

	_, err = file.Seek(0, 0)
	if err != nil {
		cfg.logger.Printf("Error seeking file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	uploadPath, uploadID, err := cfg.Upload(file, location, fileType, sendingUser, handler.Filename[strings.LastIndex(handler.Filename, ".")+1:], handler.Size)
	if err != nil {
		cfg.logger.Printf("Failed to upload file: %v", err)
		http.Error(w, "Failed to upload file ", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"file_id": "%v", "file_path": "%v"}`, uploadID, uploadPath)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetFileHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get file by id request")

	// Parse file ID as UUID
	fileID, err := GetUUIDFromPath(r, "fileID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid file ID format", http.StatusBadRequest)
		return
	}

	file, err := cfg.db.GetFileByID(r.Context(), fileID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("File not found: %v", fileID)
			http.Error(w, "File not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve file: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Serve the file
	http.ServeFile(w, r, file.Filepath)
}

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
	}

	//check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	//check sendingUser is admin
	if !(UserHasPermission(sendingUser, PermissionCanManageLessons) || UserHasPermission(sendingUser, PermissionCanSuggestLessons)) {
		cfg.logger.Printf("Unauthorized add lesson attempt by non-admin sendingUser: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received request to add lesson with request body: ", p)

	if p.Title == "" || p.ContentID == "" {
		cfg.logger.Printf("Missing required fields: title, description, or content_id")
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
		cfg.logger.Printf("Invalid UUID format for content_id: %v", err)
		http.Error(w, "Invalid content_id format", http.StatusBadRequest)
		return
	}

	lessonID := uuid.New()

	//check for duplicate lesson
	existingLesson, err := cfg.db.GetLessonByContentID(r.Context(), contentUUID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		cfg.logger.Printf("Failed to check for existing lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if existingLesson.ID != uuid.Nil {
		cfg.logger.Printf("Lesson with content_id %v already exists", contentUUID)
		http.Error(w, "Duplicate lesson with same content_id", http.StatusConflict)
		return
	}

	flag, mask := BuildLessonFlags(p.Class, p.Section, 0, p.Module)

	//get lesson number
	number, err := cfg.db.CountLessons(r.Context(), database.CountLessonsParams{
		Flags:   int32(mask),
		Flags_2: int32(flag),
	})

	flag, _ = BuildLessonFlags(p.Class, p.Section, int(number+1), p.Module)

	//check if sendingUser is admin

	res, err := cfg.db.AddLesson(r.Context(), database.AddLessonParams{
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
	})
	if err != nil {
		cfg.logger.Printf("Failed to add lesson: %v", err)
		http.Error(w, "Failed to add lesson", http.StatusInternalServerError)
		return
	}

	if prevLesson.Valid {
		_, err = cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           prevLesson.UUID,
			NextLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update previous lesson's next field: %v", err)
			http.Error(w, "Failed to link lessons", http.StatusInternalServerError)
			return
		}
	}

	if nextLesson.Valid {
		_, err = cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           nextLesson.UUID,
			PrevLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update next lesson's previous field: %v", err)
			http.Error(w, "Failed to link lessons", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonsHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}
	cfg.logger.Print("Received get lessons request")
	lessons, err := cfg.ListLessons()
	if err != nil {
		cfg.logger.Printf("Failed to retrieve lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}

func (cfg *ApiCfg) GetLessonByIDHandler(w http.ResponseWriter, r *http.Request) {
	//Database check is done in the disambiguation function

	// Parse lesson ID as UUID
	lesson, err := GetObjByQueryUUID(r, "lesson_id", cfg.db.GetLessonByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Lesson not found: %v", err)
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.logger.Print("Received get lesson by ID request for lesson ID: ", lesson.ID)

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

	cfg.logger.Print("Received get lesson by flags request for class: ", p.Class, " section: ", p.Section, " module: ", p.Module, " number: ", p.Number)
	//Database check is done in the disambiguation function

	flag, mask := BuildLessonFlags(p.Class, p.Section, p.Number, p.Module)

	lessons, err := cfg.db.GetLessonsByFlags(r.Context(), database.GetLessonsByFlagsParams{
		Flags:   int32(mask),
		Flags_2: int32(flag),
		Limit:   1000,
		Offset:  0,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Lesson not found with specified flags")
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}

func (cfg *ApiCfg) GetSuggestedLessonsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// This function will be placed in a separate endpoint in the admins section
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get suggested lessons request")
	lessons, err := cfg.db.GetSuggestedLessons(r.Context(), database.GetSuggestedLessonsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve suggested lessons: %v", err)
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
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete lesson request")

	//Authenticate the user making the request
	if !UserHasPermission(sendingUser, PermissionCanManageLessons) {
		cfg.logger.Printf("Unauthorized delete lesson attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	lesson, err := GetObjByPathUUID(r, "lessonID", cfg.db.GetLessonByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Lesson not found: %v", err)
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Update previous lesson's next pointer
	if lesson.PrevLessonID.Valid {
		_, err = cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           lesson.PrevLessonID.UUID,
			NextLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update previous lesson's next pointer: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	// Update next lesson's previous pointer
	if lesson.NextLessonID.Valid {
		_, err = cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           lesson.NextLessonID.UUID,
			PrevLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update next lesson's previous pointer: %v", err)
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
		cfg.logger.Printf("Failed to delete lesson: %v", err)
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
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if targetLesson.NextLessonID.Valid {
		_, err = cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           targetLesson.NextLessonID.UUID,
			PrevLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update next lesson prev: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
		ID:           targetLesson.ID,
		NextLessonID: uuid.NullUUID{UUID: p.Next, Valid: p.Next != uuid.Nil},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update lesson next: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.Next != uuid.Nil {
		_, err = cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
			ID:           p.Next,
			PrevLessonID: uuid.NullUUID{UUID: targetLesson.ID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
	}

	if err != nil {
		cfg.logger.Printf("Failed to update next lesson prev: %v", err)
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
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if targetLesson.PrevLessonID.Valid {
		_, err = cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           targetLesson.PrevLessonID.UUID,
			NextLessonID: uuid.NullUUID{UUID: uuid.UUID{}, Valid: false},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
		if err != nil {
			cfg.logger.Printf("Failed to update next lesson prev: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
		ID:           targetLesson.ID,
		PrevLessonID: uuid.NullUUID{UUID: p.Prev, Valid: p.Prev != uuid.Nil},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update lesson prev: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.Prev != uuid.Nil {
		_, err = cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
			ID:           p.Prev,
			NextLessonID: uuid.NullUUID{UUID: targetLesson.ID, Valid: true},
			UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		})
	}
	if err != nil {
		cfg.logger.Printf("Failed to update prev lesson next: %v", err)
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
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	contentUUID, err := uuid.Parse(p.ContentID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for content_id: %v", err)
		http.Error(w, "Invalid content_id format", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateLessonContent(r.Context(), database.UpdateLessonContentParams{
		ID:        targetLesson.ID,
		ContentID: contentUUID,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update lesson content: %v", err)
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
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateLessonDetails(r.Context(), database.UpdateLessonDetailsParams{
		ID:          targetLesson.ID,
		Title:       p.Title,
		Description: sql.NullString{String: p.Description, Valid: true},
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update lesson details: %v", err)
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
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	flags, mask := BuildLessonFlags(p.Class, p.Section, p.Number, p.Module)

	flag := (targetLesson.Flags & ^int32(mask)) | int32(flags)

	res, err := cfg.db.UpdateLessonFlags(r.Context(), database.UpdateLessonFlagsParams{
		ID:        targetLesson.ID,
		Flags:     flag,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update lesson flags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) UpdateLessonsSectionStarterHandler(w http.ResponseWriter, _ *http.Request, targetLesson database.Lesson) {
	//Database check is done in the disambiguation function

	cfg.logger.Printf("Received update section starter lesson request for lesson ID: %v", targetLesson.ID)

	res, err := cfg.UpdateSectionStartedLesson(targetLesson.ID)
	if err != nil {
		cfg.logger.Printf("Failed to update section starter lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintLessonToJson)
}

func (cfg *ApiCfg) GetSectionStarterLessonsHandler(w http.ResponseWriter, r *http.Request) {
	//Database check is done in the disambiguation function

	cfg.logger.Print("Received get section starter lessons request")
	lessons, err := cfg.db.GetSectionStarterLessons(r.Context())
	if err != nil {
		cfg.logger.Printf("Failed to retrieve section starter lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsToAny(lessons), PrintLessonToJson)
}

/*
===========================================

	Lesson User Interaction Handlers

===========================================
*/

func (cfg *ApiCfg) FavoriteLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received favorite lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserFavorite(lessonID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle lesson favorite: %v", err)
		http.Error(w, "Failed to toggle lesson favorite", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, toggledUserLesson, GenericPrinter)
}

func (cfg *ApiCfg) BookmarkLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received bookmark lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserBookmark(lessonID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle lesson bookmark: %v", err)
		http.Error(w, "Failed to toggle lesson bookmark", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, toggledUserLesson, GenericPrinter)
}

func (cfg *ApiCfg) GetLessonUserByLessonAndUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get lesson user request")

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for lesson ID: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	lessonUser, err := cfg.db.GetLessonsUsersByLessonIDAndUserID(r.Context(), database.GetLessonsUsersByLessonIDAndUserIDParams{
		LessonID: lessonID,
		UserID:   userID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Lesson user not found for lesson ID %v and user ID %v", lessonID, userID)
			http.Error(w, "Lesson user not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) GetUserBookmarksHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get user bookmarks request for user ID: ", userID)

	lessonUsers, err := cfg.db.GetLessonsUsersBookmarkedLessonsByUserID(r.Context(), database.GetLessonsUsersBookmarkedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.logger.Printf("Failed to retrieve bookmarked lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) StartLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received start lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	lessonUser, err := cfg.MarkLessonUserStarted(lessonID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to mark lesson as started: %v", err)
		http.Error(w, "Failed to mark lesson as started", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) CompleteLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received complete lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	lessonUser, err := cfg.MarkLessonUserCompleted(lessonID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to mark lesson as completed: %v", err)
		http.Error(w, "Failed to mark lesson as completed", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, lessonUser, GenericPrinter)
}

func (cfg *ApiCfg) GetFavoritesForLessonHandler(w http.ResponseWriter, r *http.Request) {
	//Check database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
	}

	cfg.logger.Printf("Received get favorites for lesson request: %v", r.URL.Path)

	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
	}

	faves, err := cfg.db.CountLessonsUsersFavoritedLessonsByLessonID(r.Context(), lessonID)
	if err != nil {
		cfg.logger.Printf("Failed to get favorites for lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"lesson_id":"%v", "num_favorites":%v}`, lessonID, faves)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

func (cfg *ApiCfg) GetUserStartedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get user started lessons request for user ID: ", userID)

	lessonUsers, err := cfg.db.GetLessonsUsersStartedLessonsByUserID(r.Context(), database.GetLessonsUsersStartedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.logger.Printf("Failed to retrieve started lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) GetUserCompletedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get user completed lessons request for user ID: ", userID)

	lessonUsers, err := cfg.db.GetLessonsUsersCompletedLessonsByUserID(r.Context(), database.GetLessonsUsersCompletedLessonsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.logger.Printf("Failed to retrieve completed lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) GetUserInteractionsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}
	cfg.logger.Print("Received get user interactions request for user ID: ", userID)

	lessonUsers, err := cfg.db.GetLessonsUsersByUserID(r.Context(), database.GetLessonsUsersByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})

	if err != nil {
		cfg.logger.Printf("Failed to retrieve user interactions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, lessonsUsersToAny(lessonUsers), GenericPrinter)
}

func (cfg *ApiCfg) CountUserCompletedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received count user completed lessons request for user ID: ", userID)

	count, err := cfg.db.CountLessonsUsersCompletedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.logger.Printf("Failed to count completed lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "completed_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CountUserStartedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received count user started lessons request for user ID: ", userID)

	count, err := cfg.db.CountLessonsUsersStartedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.logger.Printf("Failed to count started lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "started_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CountUserBookmarkedLessonsHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received count user bookmarked lessons request for user ID: ", userID)

	count, err := cfg.db.CountLessonsUsersBookmarkedLessonsByUserID(r.Context(), userID)
	if err != nil {
		cfg.logger.Printf("Failed to count bookmarked lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user_id":"%v", "bookmarked_lessons_count":%v}`, userID, count)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

/*
===========================================

	Problem CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		Title            string    `json:"title"`
		Description      string    `json:"description"`
		Source           string    `json:"source"`
		FirstTestID      uuid.UUID `json:"first_test_id"`
		ThumbnailID      uuid.UUID `json:"thumbnail_id"`
		Difficulty       int       `json:"difficulty"`
		Module           int       `json:"module"`
		SolveType        int       `json:"solve_type"`
		ResultType       int       `json:"result_type"`
		VerificationType int       `json:"verification_type"`
		Section          int       `json:"section"`
	}
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Unauthorized create problem attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})

	cfg.logger.Print("Received create problem request with body: ", p)

	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.Title == "" || p.Description == "" {
		cfg.logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	tags, _ := BuildProblemTags(p.Difficulty, p.Module, p.SolveType, p.ResultType, p.VerificationType, p.Section)

	res, err := cfg.db.CreateProblem(r.Context(), database.CreateProblemParams{
		ID:              uuid.New(),
		Title:           p.Title,
		Description:     p.Description,
		Source:          sql.NullString{String: p.Source, Valid: p.Source != ""},
		FirstTest:       uuid.NullUUID{UUID: p.FirstTestID, Valid: p.FirstTestID != uuid.Nil},
		ThumbnailFileID: uuid.NullUUID{UUID: p.ThumbnailID, Valid: p.ThumbnailID != uuid.Nil},
		Tags:            int32(tags),
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
		AuthorID:        sendingUser.ID,
	})
	if err != nil {
		cfg.logger.Printf("Failed to create problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintProblemToJson)
}

func (cfg *ApiCfg) DeleteProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete problem request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Unauthorized delete problem attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Parse problem ID as UUID
	problem, err := GetObjByPathUUID(r, "problemID", cfg.db.GetProblemByID)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = cfg.db.DeleteProblem(r.Context(), problem.ID)
	if err != nil {
		cfg.logger.Printf("Failed to delete problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) GetProblemByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get problem by ID request")

	res, err := GetObjByQueryUUID(r, "problem_id", cfg.db.GetProblemByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Problem not found: %v", res.ID)
			http.Error(w, "Problem not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get problems request")

	problems, err := cfg.db.GetProblems(r.Context(), database.GetProblemsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsByTagsHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Module           int `json:"module"`
		Difficulty       int `json:"difficulty"`
		SolveType        int `json:"solve_type"`
		ResultType       int `json:"result_type"`
		VerificationType int `json:"verification_type"`
		SectionType      int `json:"section"`
	}

	var p = params{
		Module:           0,
		Difficulty:       0,
		SolveType:        0,
		ResultType:       0,
		VerificationType: 0,
		SectionType:      0,
	}

	// database check is done in the disambiguation function
	cfg.logger.Print("Received get problems by tags request")

	q := r.URL.Query()
	if len(q) > 0 {
		moduleStr := q.Get("module")
		difficultyStr := q.Get("difficulty")
		solveTypeStr := q.Get("solve_type")
		resultTypeStr := q.Get("result_type")
		verificationTypeStr := q.Get("verification_type")
		sectionTypeStr := q.Get("section")

		if moduleStr != "" {
			p.Module, _ = strconv.Atoi(moduleStr)
		}
		if difficultyStr != "" {
			p.Difficulty, _ = strconv.Atoi(difficultyStr)
		}
		if solveTypeStr != "" {
			p.SolveType, _ = strconv.Atoi(solveTypeStr)
		}
		if resultTypeStr != "" {
			p.ResultType, _ = strconv.Atoi(resultTypeStr)
		}
		if verificationTypeStr != "" {
			p.VerificationType, _ = strconv.Atoi(verificationTypeStr)
		}
		if sectionTypeStr != "" {
			p.SectionType, _ = strconv.Atoi(sectionTypeStr)
		}
	}

	tags, mask := BuildProblemTags(p.Difficulty, p.Module, p.SolveType, p.ResultType, p.VerificationType, p.SectionType)
	problems, err := cfg.db.GetProblemsByTag(r.Context(), database.GetProblemsByTagParams{
		Tags:   int32(mask),
		Tags_2: int32(tags),
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problems by tags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsByAuthorHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get problems by author request")

	// Parse author ID as UUID
	authorID, err := GetUUIDFromQuery(r, "author_id")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for author ID: %v", err)
		http.Error(w, "Invalid author ID format", http.StatusBadRequest)
		return
	}

	problems, err := cfg.db.GetProblemsByAuthorID(r.Context(), database.GetProblemsByAuthorIDParams{
		AuthorID: authorID,
		Limit:    1000,
		Offset:   0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problems by author: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) GetProblemsBySourceHandler(w http.ResponseWriter, r *http.Request) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get problems by source request")
	source := r.URL.Query().Get("source")
	if source == "" {
		cfg.logger.Printf("Missing source parameter in request")
		http.Error(w, "Missing source parameter", http.StatusBadRequest)
		return
	}

	problems, err := cfg.db.GetProblemsBySource(r.Context(), database.GetProblemsBySourceParams{
		Source: sql.NullString{Valid: true, String: source},
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problems by source: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, problemsToAny(problems), PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemFirstTestHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		FirstTestID uuid.UUID `json:"first_test_id"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received update problem first test request for problem ID: ", targetProblem.ID)

	res, err := cfg.db.UpdateProblemFirstTest(r.Context(), database.UpdateProblemFirstTestParams{
		ID:        targetProblem.ID,
		FirstTest: uuid.NullUUID{UUID: p.FirstTestID, Valid: p.FirstTestID != uuid.Nil},
		UpdatedAt: time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem first test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemThumbnailHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		ThumbnailID uuid.UUID `json:"thumbnail_id"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received update problem thumbnail request for problem ID: ", targetProblem.ID)

	res, err := cfg.db.UpdateProblemThumbnail(r.Context(), database.UpdateProblemThumbnailParams{
		ID:              targetProblem.ID,
		ThumbnailFileID: uuid.NullUUID{UUID: p.ThumbnailID, Valid: p.ThumbnailID != uuid.Nil},
		UpdatedAt:       time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem thumbnail: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemTagsHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		Difficulty       int `json:"difficulty"`
		Module           int `json:"module"`
		SolveType        int `json:"solve_type"`
		ResultType       int `json:"result_type"`
		VerificationType int `json:"verification_type"`
		SectionType      int `json:"section"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received update problem tags request for problem ID: ", targetProblem.ID)

	tags, mask := BuildProblemTags(p.Module, p.Difficulty, p.SolveType, p.ResultType, p.VerificationType, p.SectionType)

	tag := (targetProblem.Tags & ^int32(mask)) | int32(tags)

	res, err := cfg.db.UpdateProblemTags(r.Context(), database.UpdateProblemTagsParams{
		ID:        targetProblem.ID,
		Tags:      tag,
		UpdatedAt: time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem tags: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

func (cfg *ApiCfg) UpdateProblemDetailsHandler(w http.ResponseWriter, r *http.Request, targetProblem database.Problem) {
	// database check is done in the disambiguation function

	type params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		Source      string `json:"source"`
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received update problem details request for problem ID: ", targetProblem.ID)

	if p.Title == "" || p.Description == "" {
		cfg.logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateProblemDetails(r.Context(), database.UpdateProblemDetailsParams{
		ID:          targetProblem.ID,
		Title:       p.Title,
		Description: p.Description,
		Source:      sql.NullString{String: p.Source, Valid: p.Source != ""},
		UpdatedAt:   time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem details: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintProblemToJson)
}

/*
===========================================

	Problem Tests CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateProblemTestHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		InputText      string    `json:"input_text"`
		InputFile      uuid.UUID `json:"input_file"`
		ExpectedOutput string    `json:"expected_output"`
		PreviousTestID uuid.UUID `json:"previous_test_id"`
		NextTestID     uuid.UUID `json:"next_test_id"`
	}

	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received create problem test request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Unauthorized create problem test attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})

	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.InputText == "" && p.InputFile == uuid.Nil {
		cfg.logger.Printf("Missing input data in request body")
		http.Error(w, "Missing input data", http.StatusBadRequest)
		return
	}

	if p.ExpectedOutput == "" {
		cfg.logger.Printf("Missing expected output in request body")
		http.Error(w, "Missing expected output", http.StatusBadRequest)
		return
	}

	var inputFile bool
	if p.InputFile != uuid.Nil {
		inputFile = true
	} else {
		inputFile = false
	}

	res, err := cfg.db.CreateCodeTest(r.Context(), database.CreateCodeTestParams{
		ID:             uuid.New(),
		TxtInput:       sql.NullString{String: p.InputText, Valid: !inputFile},
		FileInput:      uuid.NullUUID{UUID: p.InputFile, Valid: inputFile},
		ExpectedOutput: p.ExpectedOutput,
		PreviousTestID: uuid.NullUUID{UUID: p.PreviousTestID, Valid: p.PreviousTestID != uuid.Nil},
		NextTestID:     uuid.NullUUID{UUID: p.NextTestID, Valid: p.NextTestID != uuid.Nil},
		CreatedAt:      time.Now(),
		UpdatedAt:      time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to create problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.PreviousTestID != uuid.Nil {
		_, err = cfg.db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         p.PreviousTestID,
			NextTestID: uuid.NullUUID{UUID: res.ID, Valid: true},
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if p.NextTestID != uuid.Nil {
		_, err = cfg.db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             p.NextTestID,
			PreviousTestID: uuid.NullUUID{UUID: res.ID, Valid: true},
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, GenericPrinter)
}

func (cfg *ApiCfg) GetProblemTestByIDHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get problem test by ID request")

	// Parse test ID as UUID
	res, err := GetObjByPathUUID(r, "testID", cfg.db.GetCodeTestByID)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) DeleteProblemTestHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete problem test request")

	if !UserHasPermission(sendingUser, PermissionCanManageProblems) {
		cfg.logger.Printf("Unauthorized delete problem test attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Parse test ID as UUID
	test, err := GetObjByPathUUID(r, "testID", cfg.db.GetCodeTestByID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format or test not found: %v", err)
		http.Error(w, "Invalid test ID format or test not found", http.StatusBadRequest)
		return
	}

	if test.NextTestID.Valid {
		_, err = cfg.db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             test.NextTestID.UUID,
			PreviousTestID: test.PreviousTestID,
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	if test.PreviousTestID.Valid {
		_, err = cfg.db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         test.PreviousTestID.UUID,
			NextTestID: test.NextTestID,
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	err = cfg.db.DeleteCodeTestByID(r.Context(), test.ID)
	if err != nil {
		cfg.logger.Printf("Failed to delete problem test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) UpdateProblemTestInputHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		InputText string    `json:"input_text"`
		InputFile uuid.UUID `json:"input_file"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	var inputFile bool
	if p.InputFile != uuid.Nil {
		inputFile = true
	} else {
		inputFile = false
	}

	res, err := cfg.db.UpdateCodeTestInputs(r.Context(), database.UpdateCodeTestInputsParams{
		ID:        test.ID,
		TxtInput:  sql.NullString{String: p.InputText, Valid: !inputFile},
		FileInput: uuid.NullUUID{UUID: p.InputFile, Valid: inputFile},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update problem test inputs: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestExpectedOutputHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		ExpectedOutput string `json:"expected_output"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateCodeTestExpectedOutput(r.Context(), database.UpdateCodeTestExpectedOutputParams{
		ID:             test.ID,
		ExpectedOutput: p.ExpectedOutput,
	})

	if err != nil {
		cfg.logger.Printf("Failed to update problem test expected output: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestNextHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		NextTestID uuid.UUID `json:"next"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	//Update the old next test's previous ID to null if it exists
	if test.NextTestID.Valid {
		_, err = cfg.db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
			ID:             test.NextTestID.UUID,
			PreviousTestID: uuid.NullUUID{UUID: uuid.Nil, Valid: false},
			UpdatedAt:      time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update old next problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
		ID:         test.ID,
		NextTestID: uuid.NullUUID{UUID: p.NextTestID, Valid: p.NextTestID != uuid.Nil},
		UpdatedAt:  time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem test next ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateProblemTestPreviousHandler(w http.ResponseWriter, r *http.Request, test database.CodeTest) {
	type params struct {
		PreviousTestID uuid.UUID `json:"prev"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	//Update the old previous test's next ID to null if it exists
	if test.PreviousTestID.Valid {
		_, err = cfg.db.UpdateNextCodeTest(r.Context(), database.UpdateNextCodeTestParams{
			ID:         test.PreviousTestID.UUID,
			NextTestID: uuid.NullUUID{UUID: uuid.Nil, Valid: false},
			UpdatedAt:  time.Now(),
		})

		if err != nil {
			cfg.logger.Printf("Failed to update old previous problem test: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	res, err := cfg.db.UpdatePreviousCodeTest(r.Context(), database.UpdatePreviousCodeTestParams{
		ID:             test.ID,
		PreviousTestID: uuid.NullUUID{UUID: p.PreviousTestID, Valid: p.PreviousTestID != uuid.Nil},
		UpdatedAt:      time.Now(),
	})
	if err != nil {
		cfg.logger.Printf("Failed to update problem test previous ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

/*
===========================================

	Solutions CRUD Handlers

===========================================
*/

func (cfg *ApiCfg) CreateSolutionHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	type params struct {
		ProblemID uuid.UUID `json:"problem_id"`
		Code      string    `json:"code"`
		Language  string    `json:"language"`
	}

	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received create solution request")

	p, err := DecodeParamsFromBody(r, params{})

	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if p.ProblemID == uuid.Nil || p.Code == "" || p.Language == "" {
		cfg.logger.Printf("Missing required fields in request body")
		http.Error(w, "Missing required fields", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.CreateSolution(r.Context(), database.CreateSolutionParams{
		ID:        uuid.New(),
		ProblemID: p.ProblemID,
		UserID:    sendingUser.ID,
		SentCode:  p.Code,
		Language:  p.Language,
		CreatedAt: sql.NullTime{Valid: true, Time: time.Now()},
		UpdatedAt: sql.NullTime{Valid: true, Time: time.Now()},
	})
	if err != nil {
		cfg.logger.Printf("Failed to create solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionByIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get solution by ID request")
	res, err := GetObjByQueryUUID(r, "solution_id", cfg.db.GetSolutionByID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Solution not found: %v", res.ID)
			http.Error(w, "Solution not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if res.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.logger.Printf("Unauthorized access attempt to solution by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) DeleteSolutionHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete solution request")

	// Parse solution ID as UUID
	solution, err := GetObjByPathUUID(r, "solutionID", cfg.db.GetSolutionByID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format or solution not found: %v", err)
		http.Error(w, "Invalid solution ID format or solution not found", http.StatusBadRequest)
		return
	}

	// Check if the sending user is the owner of the solution or an admin
	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.logger.Printf("Unauthorized delete attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	err = cfg.db.DeleteSolution(r.Context(), solution.ID)
	if err != nil {
		cfg.logger.Printf("Failed to delete solution: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) GetSolutionsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get solutions request")
	solutions, err := cfg.db.GetSolutions(r.Context(), database.GetSolutionsParams{
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Filter solutions to only include those owned by the sending user or if the user is an admin
	var filteredSolutions []database.Solution
	for _, sol := range solutions {
		if sol.UserID == sendingUser.ID || UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
			filteredSolutions = append(filteredSolutions, sol)
		}
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(filteredSolutions), GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionsByUserHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get solutions by user request")

	// Parse user ID as UUID
	userID, err := GetUUIDFromQuery(r, "user_id")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	// Check if the sending user is the owner of the solutions or an admin
	if userID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
		cfg.logger.Printf("Unauthorized access attempt to solutions by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	solutions, err := cfg.db.GetSolutionsByUserID(r.Context(), database.GetSolutionsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve solutions by user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(solutions), GenericPrinter)
}

func (cfg *ApiCfg) GetSolutionsByProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received get solutions by problem request")

	// Parse problem ID as UUID
	problemID, err := GetUUIDFromQuery(r, "problem_id")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	solutions, err := cfg.db.GetSolutionsByProblemID(r.Context(), database.GetSolutionsByProblemIDParams{
		ProblemID: problemID,
		Limit:     1000,
		Offset:    0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve solutions by problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Filter solutions to only include those owned by the sending user or if the user is an admin
	var filteredSolutions []database.Solution
	for _, sol := range solutions {
		if sol.UserID == sendingUser.ID || UserHasPermission(sendingUser, PermissionCanViewOtherSolutions) {
			filteredSolutions = append(filteredSolutions, sol)
		}
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, solutionsToAny(filteredSolutions), GenericPrinter)
}

func (cfg *ApiCfg) UpdateSolutionTestsHandler(w http.ResponseWriter, r *http.Request, solution database.Solution, sendingUser database.User) {
	type params struct {
		TestsPassed int `json:"tests_passed"`
		TotalTests  int `json:"total_tests"`
	}

	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.logger.Printf("Unauthorized update attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	res, err := cfg.db.UpdateSolutionTests(r.Context(), database.UpdateSolutionTestsParams{
		ID:          solution.ID,
		TestsPassed: sql.NullInt32{Valid: true, Int32: int32(p.TestsPassed)},
		TotalTests:  sql.NullInt32{Valid: true, Int32: int32(p.TotalTests)},
		UpdatedAt:   sql.NullTime{Valid: true, Time: time.Now()},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update solution percentage correct: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if p.TotalTests == p.TestsPassed {
		_, err = cfg.MarkProblemUserSolved(solution.ProblemID, solution.UserID)
		if err != nil {
			cfg.logger.Printf("Failed to mark problem as solved for user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) UpdateSolutionFirstSolutionTestHandler(w http.ResponseWriter, r *http.Request, solution database.Solution, sendingUser database.User) {
	type params struct {
		FirstSolutionTestID uuid.UUID `json:"first_solution_test_id"`
	}
	// Database check is done in the disambiguation function

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	if solution.UserID != sendingUser.ID && !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.logger.Printf("Unauthorized update attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	res, err := cfg.db.UpdateSolutionFirstSolutionTest(r.Context(), database.UpdateSolutionFirstSolutionTestParams{
		ID:                  solution.ID,
		FirstSolutionTestID: uuid.NullUUID{UUID: p.FirstSolutionTestID, Valid: p.FirstSolutionTestID != uuid.Nil},
		UpdatedAt:           sql.NullTime{Valid: true, Time: time.Now()},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update solution first solution test: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) CountSolutionsHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received count solutions request")

	countTotal, err := cfg.db.CountSolutionsByUserId(r.Context(), sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to count solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	countCorrect, err := cfg.db.CountUserCorrectSolutions(r.Context(), sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to count correct solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	type response struct {
		CountCorrect int64 `json:"count_correct"`
		CountTotal   int64 `json:"count_total"`
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, response{CountCorrect: countCorrect, CountTotal: countTotal}, GenericPrinter)
}

func (cfg *ApiCfg) CountSolutionsByProblemIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// database check is done in the disambiguation function

	cfg.logger.Print("Received count solutions by problem ID request")
	// Parse problem ID as UUID
	problemID, err := GetUUIDFromQuery(r, "problem_id")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	countTotal, err := cfg.db.CountUserSolutionsByProblemID(r.Context(), database.CountUserSolutionsByProblemIDParams{
		ProblemID: problemID,
		UserID:    sendingUser.ID,
	})
	if err != nil {
		cfg.logger.Printf("Failed to count solutions by problem ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	countCorrect, err := cfg.db.CountUserCorrectSolutionsByProblemID(r.Context(), database.CountUserCorrectSolutionsByProblemIDParams{
		ProblemID: problemID,
		UserID:    sendingUser.ID,
	})
	if err != nil {
		cfg.logger.Printf("Failed to count correct solutions by problem ID: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	type response struct {
		CountCorrect int64 `json:"count_correct"`
		CountTotal   int64 `json:"count_total"`
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, response{CountCorrect: countCorrect, CountTotal: countTotal}, GenericPrinter)
}

/*
===========================================

	Users Problems CRUD

===========================================
*/

func (cfg *ApiCfg) GetUserProblemByUserAndProblemHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get user problems request")

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	userProblem, err := cfg.db.GetUserProblemByUserIDAndProblemID(r.Context(), database.GetUserProblemByUserIDAndProblemIDParams{
		UserID:    userID,
		ProblemID: problemID,
	})
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("User problem not found for user ID: %v and problem ID: %v", userID, problemID)
			http.Error(w, "User problem not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve user problem: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, userProblem, GenericPrinter)
}

func (cfg *ApiCfg) LikeProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received like problem request for problem ID: %v by user ID: %v", problemID, sendingUser.ID)

	res, err := cfg.ToggleProblemUserLiked(problemID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle problem like status: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) BookmarkProblemHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for problem ID: %v", err)
		http.Error(w, "Invalid problem ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received bookmark problem request for problem ID: %v by user ID: %v", problemID, sendingUser.ID)

	res, err := cfg.ToggleProblemUserBookmarked(problemID, sendingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle problem bookmark status: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}

func (cfg *ApiCfg) GetBookmarkedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get bookmarked problems request for user ID: ", userID)
	userProblems, err := cfg.db.GetBookmarkedProblemsByUserID(r.Context(), database.GetBookmarkedProblemsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve bookmarked problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

func (cfg *ApiCfg) GetLikedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	problemID, err := GetUUIDFromPath(r, "problemID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get liked problems request")
	userProblems, err := cfg.db.GetProblemLikesByProblemID(r.Context(), database.GetProblemLikesByProblemIDParams{
		ProblemID: problemID,
		Limit:     1000,
		Offset:    0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve liked problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

func (cfg *ApiCfg) GetSolvedProblemsHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for user ID: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received get solved problems request")
	userProblems, err := cfg.db.GetSolvedProblemsByUserID(r.Context(), database.GetSolvedProblemsByUserIDParams{
		UserID: userID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve solved problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteListJsonOutput(w, http.StatusOK, userProblemsToAny(userProblems), GenericPrinter)
}

/*
===========================================

	Admin Handlers

===========================================
*/

func (cfg *ApiCfg) ResetHandler(w http.ResponseWriter, _ *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.databaseCfg.Loaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received request to reset the database")

	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionAdmin) {
		cfg.logger.Printf("Unauthorized access attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.logger.Print("Admin reset initiated by user: ", sendingUser.ID)

	// Delete all users
	err := cfg.ResetAll()
	if err != nil {
		cfg.logger.Printf("Failed to reset users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.Header().Set("Content-Type", "text/plain; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte("Database has been reset successfully."))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
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
		cfg.logger.Printf("Unauthorized set account status attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received set user account status request for user ID: %v to title: %v", p.UserID, p.Title)

	title := p.Title

	targetUser, err := cfg.db.GetUserByID(r.Context(), p.UserID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("User not found for ID: %v", p.UserID)
			http.Error(w, "User not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve target user: %v", err)
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
		cfg.logger.Printf("Invalid title provided for upgrade: %v", title)
		http.Error(w, "Invalid title provided", http.StatusBadRequest)
		return
	}
	_, err = cfg.db.SetUserTitle(r.Context(), database.SetUserTitleParams{
		ID:        targetUser.ID,
		Title:     title,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to set user title: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.db.SetUserPermissions(r.Context(), database.SetUserPermissionsParams{
		ID:          targetUser.ID,
		Permissions: int16(newPerms),
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to upgrade user permissions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) ApproveLessonHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if the user is an admin
	if !UserHasPermission(sendingUser, PermissionCanManageLessons) {
		cfg.logger.Printf("Unauthorized lesson approval attempt by non-admin user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	lessonID, err := GetUUIDFromPath(r, "lessonID")
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for lesson ID: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received approve lesson request for lesson ID: %v by user ID: %v", lessonID, sendingUser.ID)

	res, err := cfg.db.UpdateLessonSuggested(r.Context(), database.UpdateLessonSuggestedParams{
		ID:        lessonID,
		Suggested: false,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to approve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}
