package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
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

func PrintUserToJson(user database.User) (string, error) {
	user.PasswordHash = "" // Remove password hash for security
	jsonData, err := json.Marshal(user)
	if err != nil {
		return "", fmt.Errorf("failed to marshal user: %v", err)
	}
	return string(jsonData), nil
}

func PrintLessonToJson(lesson database.Lesson) (string, error) {
	flagTranslation := ParseLessonFlags(lesson.Flags)
	jsonDataWithFlags, err := json.Marshal(LessonWithFlags{
		Lesson:          lesson,
		FlagTranslation: flagTranslation,
	})
	if err != nil {
		return "", fmt.Errorf("failed to marshal lesson: %v", err)
	}
	return string(jsonDataWithFlags), nil
}

func PrintLessonUserToJson(lessonUser database.LessonsUser) (string, error) {
	jsonData, err := json.Marshal(lessonUser)
	if err != nil {
		return "", fmt.Errorf("failed to marshal lesson user: %v", err)
	}
	return string(jsonData), nil
}

func (cfg *ApiCfg) UpdateUserDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	// Check for query parameters
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
		http.Error(w, "Missing query parameters", http.StatusBadRequest)
		return
	}

	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	targetUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	field := q.Get("target_field")
	if field == "" {
		cfg.logger.Printf("Missing target_field query parameter")
		http.Error(w, "Missing target_field query parameter", http.StatusBadRequest)
		return
	}

	switch field {
	case "username":
		// Update username
		cfg.UpdateUserUsernameHandler(w, r, targetUser)
	case "password":
		// Update password
		cfg.UpdateUserPasswordHandler(w, r, targetUser)
	case "email":
		// Update email
		cfg.UpdateUserEmailHandler(w, r, targetUser)
	case "pfp":
		// Update profile picture
		cfg.UpdateUserPfpHandler(w, r, targetUser)

	default:
		cfg.logger.Printf("Invalid target_field: %v", field)
		http.Error(w, "Invalid target_field", http.StatusBadRequest)
		return
	}
}

func (cfg *ApiCfg) AuthenticateUser(r *http.Request) (database.User, error) {
	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		cfg.logger.Printf("Unauthorized access attempt: %v", err)
		return database.User{}, err
	}

	targetId, err := auth.ValidateJWT(token, cfg.secret)
	if err != nil {
		cfg.logger.Printf("Invalid token: %v", err)
		return database.User{}, err
	}
	targetUser, err := cfg.db.GetUserByID(r.Context(), targetId)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve user: %v", err)
		return database.User{}, err
	}

	return targetUser, nil
}

func (cfg *ApiCfg) GetLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	if !cfg.dbLoaded {
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
	default:
		cfg.logger.Printf("Invalid search_type: %v", searchType)
	}
}

func (cfg *ApiCfg) UpdateLessonDisambiguationHandler(w http.ResponseWriter, r *http.Request) {
	q := r.URL.Query()
	if len(q) == 0 {
		cfg.logger.Printf("Missing query parameters")
	}

	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
	}

	sendingUser, err := cfg.AuthenticateUser(r)
	if err != nil || !sendingUser.IsAdmin {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
	}

	targetField := q.Get("target_field")
	if targetField == "" {
		cfg.logger.Printf("Missing search_type query parameter")
	}

	switch targetField {
	case "next":
		cfg.UpdateLessonNextHandler(w, r)
	case "prev":
		cfg.UpdateLessonPrevHandler(w, r)
	}
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

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received login request for email: ", p.Email)

	// Check if database is connected
	if !cfg.dbLoaded {
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
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

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received token refresh request")

	// Check if database is connected
	if !cfg.dbLoaded {
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"auth_token": "%v"}`, token)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) ValidateEmailHandler(w http.ResponseWriter, r *http.Request) {
	userId := r.PathValue("userID")
	if userId == "" {
		cfg.logger.Printf("Missing user ID in request")
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	// Parse user ID as UUID
	uid, err := uuid.Parse(userId)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received validate email request for user ID: ", uid)
	// Check if database is connected
	if !cfg.dbLoaded {
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

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.logger.Print("Received request to create user with request body: ", p)

	// Check if database is connected

	if !cfg.dbLoaded {
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

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, userJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetUsersHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
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
	if !cfg.dbLoaded {
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
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(user)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(userJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) DeleteUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete user request")

	//Authenticate the user making the request
	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Extract user ID from URL path
	userIDStr := r.PathValue("userID")
	if userIDStr == "" {
		cfg.logger.Printf("Missing user ID in request")
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	if requestingUser.ID.String() != userIDStr && !requestingUser.IsAdmin {
		cfg.logger.Printf("Unauthorized delete attempt by user: %v", requestingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Parse user ID as UUID
	userID, err := uuid.Parse(userIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	err = cfg.DeleteUser(userID)

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "text/plain")
	_, err = w.Write([]byte("User deleted successfully."))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
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

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(userJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) UpdateUserPasswordHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		OldPassword string `json:"old_password"`
		NewPassword string `json:"new_password"`
	}

	cfg.logger.Print("Received update user password request for user ID: ", targetUser.ID.String())

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(userJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) UpdateUserEmailHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		NewEmail string `json:"email"`
	}

	cfg.logger.Print("Received update user email request for user ID: ", targetUser.ID.String())

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
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
		cfg.logger.Printf("Failed to unvalidate user email: %v", err)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(userJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) UpdateUserUsernameHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		NewUsername string `json:"username"`
	}

	cfg.logger.Print("Received update user username request for user ID: ", targetUser.ID.String())

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	userJson, err := PrintUserToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(userJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

/*
===========================================

	File Management Handlers

===========================================
*/

func (cfg *ApiCfg) UploadHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	targetUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
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

	err = r.ParseMultipartForm(10 << 20) // Limit upload size to 10 MB
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

	uploadPath, uploadID, err := cfg.Upload(file, location, fileType, targetUser, handler.Filename[strings.LastIndex(handler.Filename, ".")+1:], handler.Size)
	if err != nil {
		cfg.logger.Printf("Failed to upload file: %v", err)
		http.Error(w, "Failed to upload file ", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"file_id": "%v", "file_path": "%v"}`, uploadID, uploadPath)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetFileHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get file by id request")
	fileIDStr := r.PathValue("fileID")
	if fileIDStr == "" {
		cfg.logger.Printf("Missing file ID in request")
		http.Error(w, "Missing file ID", http.StatusBadRequest)
		return
	}

	// Parse file ID as UUID
	fileID, err := uuid.Parse(fileIDStr)
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

func (cfg *ApiCfg) AddLessonHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Title       string `json:"title"`
		Description string `json:"description"`
		ContentID   string `json:"content_id"`
		Class       int    `json:"class"`
		Section     int    `json:"section"`
		Module      int    `json:"module"`
		Previous    string `json:"previous"`
		Next        string `json:"next"`
	}

	//check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
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

	if p.Previous != "" {
		prevLesson.UUID, err = uuid.Parse(p.Previous)
		if err != nil {
			cfg.logger.Printf("Invalid UUID format for previous lesson: %v", err)
			http.Error(w, "Invalid previous lesson format", http.StatusBadRequest)
			return
		}
		prevLesson.Valid = true
	}

	if p.Next != "" {
		nextLesson.UUID, err = uuid.Parse(p.Next)
		if err != nil {
			cfg.logger.Printf("Invalid UUID format for next lesson: %v", err)
			http.Error(w, "Invalid next lesson format", http.StatusBadRequest)
			return
		}
		nextLesson.Valid = true
	}

	contentUUID, err := uuid.Parse(p.ContentID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for content_id: %v", err)
		http.Error(w, "Invalid content_id format", http.StatusBadRequest)
		return
	}

	lessonID := uuid.New()

	//check user
	user, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !user.IsAdmin {
		cfg.logger.Printf("Unauthorized add lesson attempt by non-admin user: %v", user.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

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

	//check if user is admin

	res, err := cfg.db.AddLesson(r.Context(), database.AddLessonParams{
		ID:          lessonID,
		Title:       p.Title,
		Description: sql.NullString{String: p.Description, Valid: true},
		ContentID:   contentUUID,
		AuthorID:    uuid.NullUUID{UUID: user.ID, Valid: true},
		Flags:       int32(flag),
		CreatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:   sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to add lesson: %v", err)
		http.Error(w, "Failed to add lesson", http.StatusInternalServerError)
		return
	}

	lessonJson, err := PrintLessonToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, lessonJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetLessonsHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
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
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")

	//Marshal using PrintToJson for proper formatting
	_, err = w.Write([]byte("["))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
	for i, lesson := range lessons {
		if i > 0 {
			_, err = w.Write([]byte(","))
			if err != nil {
				cfg.logger.Printf("Failed to write response: %v", err)
				http.Error(w, "Failed to write response", http.StatusInternalServerError)
				return
			}
		}
		lessonJson, err := PrintLessonToJson(lesson)
		if err != nil {
			cfg.logger.Printf("Failed to marshal lesson: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		_, err = w.Write([]byte(lessonJson))
		if err != nil {
			cfg.logger.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	}
	_, err = w.Write([]byte("]"))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetLessonByIDHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		LessonID string `json:"lesson_id"`
	}

	var p params

	queries := r.URL.Query()
	// One of the queries will be for search_type, so we check if there are more than 1 query parameters
	if len(queries) > 1 {
		p.LessonID = queries.Get("lesson_id")
	}
	if p.LessonID == "" {
		http.Error(w, "lesson_id is required", http.StatusBadRequest)
	}

	cfg.logger.Print("Received get lesson by ID request for lesson ID: ", p.LessonID)
	//Database check is done in the disambiguation function

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(p.LessonID)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}
	lesson, err := cfg.db.GetLessonByID(r.Context(), lessonID)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.logger.Printf("Lesson not found: %v", lessonID)
			http.Error(w, "Lesson not found", http.StatusNotFound)
			return
		}
		cfg.logger.Printf("Failed to retrieve lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	lessonJson, err := PrintLessonToJson(lesson)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(lessonJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	//Marshal using PrintToJson for proper formatting
	_, err = w.Write([]byte("["))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
	for i, lesson := range lessons {
		if i > 0 {
			_, err = w.Write([]byte(","))
			if err != nil {
				cfg.logger.Printf("Failed to write response: %v", err)
				http.Error(w, "Failed to write response", http.StatusInternalServerError)
				return
			}
		}
		lessonJson, err := PrintLessonToJson(lesson)
		if err != nil {
			cfg.logger.Printf("Failed to marshal lesson: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		_, err = w.Write([]byte(lessonJson))
		if err != nil {
			cfg.logger.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	}
	_, err = w.Write([]byte("]"))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) DeleteLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received delete lesson request")

	//Authenticate the user making the request
	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	if !requestingUser.IsAdmin {
		cfg.logger.Printf("Unauthorized delete lesson attempt by non-admin user: %v", requestingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	// Extract lesson ID from URL path
	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	err = cfg.DeleteLesson(lessonID)
	if err != nil {
		cfg.logger.Printf("Failed to delete lesson: %v", err)
		http.Error(w, "Failed to delete lesson", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "text/plain")
	_, err = w.Write([]byte("Lesson deleted successfully."))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) UpdateLessonNextHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Next uuid.UUID `json:"next"`
	}

	//Database check is done in the disambiguation function

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
		ID:           lessonID,
		NextLessonID: uuid.NullUUID{UUID: p.Next, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update lesson next: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
		ID:           p.Next,
		PrevLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update next lesson prev: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	lessonJson, err := PrintLessonToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(lessonJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) UpdateLessonPrevHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Prev uuid.UUID `json:"prev"`
	}
	//Database check is done in the disambiguation function

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		cfg.logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.UpdateLessonPrev(r.Context(), database.UpdateLessonPrevParams{
		ID:           lessonID,
		PrevLessonID: uuid.NullUUID{UUID: p.Prev, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to update lesson prev: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = cfg.db.UpdateLessonNext(r.Context(), database.UpdateLessonNextParams{
		ID:           p.Prev,
		NextLessonID: uuid.NullUUID{UUID: lessonID, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.logger.Printf("Failed to update prev lesson next: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	lessonJson, err := PrintLessonToJson(res)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(lessonJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

/*
===========================================

	Lesson User Interaction Handlers

===========================================
*/

func (cfg *ApiCfg) FavoriteLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received favorite lesson request for lesson ID: %v by user ID: %v", lessonID, requestingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserFavorite(lessonID, requestingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle lesson favorite: %v", err)
		http.Error(w, "Failed to toggle lesson favorite", http.StatusInternalServerError)
		return
	}

	toggledUserLessonJson, err := PrintLessonUserToJson(toggledUserLesson)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, toggledUserLessonJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) BookmarkLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received bookmark lesson request for lesson ID: %v by user ID: %v", lessonID, requestingUser.ID)

	toggledUserLesson, err := cfg.ToggleLessonUserBookmark(lessonID, requestingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to toggle lesson bookmark: %v", err)
		http.Error(w, "Failed to toggle lesson bookmark", http.StatusInternalServerError)
		return
	}

	toggledUserLessonJson, err := PrintLessonUserToJson(toggledUserLesson)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, toggledUserLessonJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetLessonUserByLessonAndUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get lesson user request")
	lessonIDStr := r.PathValue("lessonID")
	userIDStr := r.PathValue("userID")

	if lessonIDStr == "" || userIDStr == "" {
		cfg.logger.Printf("Missing lesson ID or user ID in request")
		http.Error(w, "Missing lesson ID or user ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format for lesson ID: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	// Parse user ID as UUID
	userID, err := uuid.Parse(userIDStr)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	lessonUserJson, err := PrintLessonUserToJson(lessonUser)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write([]byte(lessonUserJson))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetUserBookmarksHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userIDString := r.PathValue("userID")
	if userIDString == "" {
		cfg.logger.Printf("Missing user ID in request")
		http.Error(w, "Missing user ID", http.StatusBadRequest)
		return
	}

	// Parse user ID as UUID
	userID, err := uuid.Parse(userIDString)
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

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")

	//Marshal using PrintToJson for proper formatting
	_, err = w.Write([]byte("["))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
	for i, lessonUser := range lessonUsers {
		if i > 0 {
			_, err = w.Write([]byte(","))
			if err != nil {
				cfg.logger.Printf("Failed to write response: %v", err)
				http.Error(w, "Failed to write response", http.StatusInternalServerError)
				return
			}
		}
		lessonUserJson, err := PrintLessonUserToJson(lessonUser)
		if err != nil {
			cfg.logger.Printf("Failed to marshal lesson user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
		_, err = w.Write([]byte(lessonUserJson))
		if err != nil {
			cfg.logger.Printf("Failed to write response: %v", err)
			http.Error(w, "Failed to write response", http.StatusInternalServerError)
			return
		}
	}
	_, err = w.Write([]byte("]"))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) StartLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received start lesson request for lesson ID: %v by user ID: %v", lessonID, requestingUser.ID)

	lessonUser, err := cfg.MarkLessonUserStarted(lessonID, requestingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to mark lesson as started: %v", err)
		http.Error(w, "Failed to mark lesson as started", http.StatusInternalServerError)
		return
	}

	lessonUserJson, err := PrintLessonUserToJson(lessonUser)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, lessonUserJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CompleteLessonHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	requestingUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
		return
	}

	// Parse lesson ID as UUID
	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
		return
	}

	cfg.logger.Printf("Received complete lesson request for lesson ID: %v by user ID: %v", lessonID, requestingUser.ID)

	lessonUser, err := cfg.MarkLessonUserCompleted(lessonID, requestingUser.ID)
	if err != nil {
		cfg.logger.Printf("Failed to mark lesson as completed: %v", err)
		http.Error(w, "Failed to mark lesson as completed", http.StatusInternalServerError)
		return
	}

	lessonUserJson, err := PrintLessonUserToJson(lessonUser)
	if err != nil {
		cfg.logger.Printf("Failed to marshal lesson user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`%v`, lessonUserJson)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetFavoritesForLessonHandler(w http.ResponseWriter, r *http.Request) {
	//Check database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
	}

	cfg.logger.Printf("Received get favorites for lesson request: %v", r.URL.Path)

	lessonIDStr := r.PathValue("lessonID")
	if lessonIDStr == "" {
		cfg.logger.Printf("Missing lesson ID in request")
		http.Error(w, "Missing lesson ID", http.StatusBadRequest)
	}

	lessonID, err := uuid.Parse(lessonIDStr)
	if err != nil {
		cfg.logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid lesson ID format", http.StatusBadRequest)
	}

	faves, err := cfg.db.CountLessonsUsersFavoritedLessonsByLessonID(r.Context(), lessonID)
	if err != nil {
		cfg.logger.Printf("Failed to get favorites for lesson: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"lesson_id":"%v", "num_favorites":%v}`, lessonID, faves)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
	}
}

/*
===========================================

	Admin Handlers

===========================================
*/

func (cfg *ApiCfg) ResetHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received request to reset the database")

	// Check if the user is an admin
	adminUser, err := cfg.AuthenticateUser(r)
	if err != nil {
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	if !adminUser.IsAdmin {
		cfg.logger.Printf("Unauthorized access attempt by non-admin user: %v", adminUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.logger.Print("Admin reset initiated by user: ", adminUser.ID)

	// Delete all users
	err = cfg.ResetAll()
	if err != nil {
		cfg.logger.Printf("Failed to reset users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "text/plain")
	_, err = w.Write([]byte("Database has been reset successfully."))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
