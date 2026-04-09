package core

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"regexp"
	"strings"
	"time"

	"github.com/google/uuid"
)

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
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}
	cfg.Logger.Print("Received login request for email: ", p.Email)

	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.Email == "" || p.Password == "" {
		cfg.Logger.Printf("Missing required fields: email or password")
		http.Error(w, "Missing required fields: email or password", http.StatusBadRequest)
		return
	}

	loginTarget, err := cfg.Db.GetUserByEmail(r.Context(), p.Email)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("User not found for email: %v", p.Email)
			http.Error(w, "Invalid email or password", http.StatusUnauthorized)
			return
		}
		cfg.Logger.Printf("Failed to retrieve user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	err = auth.CheckPasswordHash(p.Password, loginTarget.PasswordHash)
	if err != nil {
		cfg.Logger.Printf("Invalid password for email: %v", p.Email)
		http.Error(w, "Invalid email or password", http.StatusUnauthorized)
		return
	}
	token, err := auth.MakeUUIDJWT(loginTarget.ID, cfg.Secret, time.Hour*24*7) // 7 days
	if err != nil {
		cfg.Logger.Printf("Failed to create JWT: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Create a refresh token
	refreshToken, err := auth.MakeRefreshToken()
	if err != nil {
		cfg.Logger.Printf("Failed to create refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	_, err = cfg.Db.CreateRefreshToken(r.Context(), database.CreateRefreshTokenParams{
		Token:     refreshToken,
		CreatedAt: time.Now(),
		UpdatedAt: time.Now(),
		UserID:    loginTarget.ID,
		ExpiresAt: time.Now().Add(24 * time.Hour * 30), // 30 days
		RevokedAt: sql.NullTime{Valid: false},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to store refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	userJson, err := PrintUserToJson(loginTarget)
	if err != nil {
		cfg.Logger.Printf("Failed to marshal user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	token = strings.TrimSpace(token)
	refreshToken = strings.TrimSpace(refreshToken)
	_, err = w.Write([]byte(fmt.Sprintf(`{"user":%v, "auth_token": "%v", "refresh_token": "%v"}`, userJson, token, refreshToken)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
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
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received token refresh request")

	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.RefreshToken == "" {
		cfg.Logger.Printf("Missing required field: refresh_token")
		http.Error(w, "Missing required field: refresh_token", http.StatusBadRequest)
		return
	}

	storedToken, err := cfg.Db.GetToken(r.Context(), p.RefreshToken)
	if err != nil {
		if errors.Is(err, sql.ErrNoRows) {
			cfg.Logger.Printf("Refresh token not found: %v", p.RefreshToken)
			http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
			return
		}
		cfg.Logger.Printf("Failed to retrieve refresh token: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	if storedToken.RevokedAt.Valid {
		cfg.Logger.Printf("Refresh token has been revoked: %v", p.RefreshToken)
		http.Error(w, "Invalid refresh token", http.StatusUnauthorized)
		return
	}

	if time.Now().After(storedToken.ExpiresAt) {
		cfg.Logger.Printf("Refresh token has expired: %v", p.RefreshToken)
		http.Error(w, "Refresh token has expired", http.StatusUnauthorized)
		return
	}

	token, err := auth.MakeUUIDJWT(storedToken.UserID, cfg.Secret, time.Hour*24*7) // 7 days
	if err != nil {
		cfg.Logger.Printf("Failed to create JWT: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	_, err = w.Write([]byte(fmt.Sprintf(`{"auth_token": "%v"}`, token)))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) ValidateEmailHandler(w http.ResponseWriter, r *http.Request) {
	uid, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received validate email request for user ID: ", uid)
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	_, err = cfg.Db.ValidateEmailForId(r.Context(), database.ValidateEmailForIdParams{
		ID:        uid,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.Logger.Printf("Failed to validate user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Location", cfg.WebsiteUrl+"/app/")
	w.WriteHeader(http.StatusPermanentRedirect)
	_, err = w.Write([]byte("Email validated successfully. Redirecting to app..."))
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) CreateTOTPHandler(w http.ResponseWriter, r *http.Request, sendingUser *database.User) {

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
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	cfg.Logger.Print("Received request to create user with request body: ", p)

	// Check if database is connected

	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	if p.Email == "" || p.Password == "" || p.Username == "" {
		cfg.Logger.Printf("Missing required fields: email, password, or username")
		http.Error(w, "Missing required fields: email, password, or username", http.StatusBadRequest)
		return
	}

	if len(p.Username) < 3 || len(p.Username) > 20 {
		cfg.Logger.Printf("Username must be between 3 and 20 characters")
		http.Error(w, "Username must be between 3 and 20 characters", http.StatusBadRequest)
		return
	}

	if len(p.Email) < 5 || len(p.Email) > 50 {
		cfg.Logger.Printf("Email must be between 5 and 50 characters")
		http.Error(w, "Email must be between 5 and 50 characters", http.StatusBadRequest)
		return
	}

	// Check for not allowed characters in username or email
	match, err := regexp.Match("^[^\\s@]+@[^\\s@]+.[^\\s@]+$", []byte(p.Email))
	if err != nil {
		cfg.Logger.Printf("Invalid email address: %v", err)
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	if !match {
		cfg.Logger.Printf("Email contains invalid characters")
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	curedEmail := strings.Replace(strings.ToLower(p.Email), ".", "", -1) // Normalize email by removing dots

	match, err = regexp.Match("^[a-zA-Z0-9_]+$", []byte(p.Username))
	if err != nil {
		cfg.Logger.Printf("Invalid username: %v", err)
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	if !match {
		cfg.Logger.Printf("Username contains invalid characters")
		http.Error(w, "Invalid email address or username", http.StatusBadRequest)
		return
	}

	// Hash the password
	hashedPassword, err := auth.HashPassword(p.Password)
	if err != nil {
		cfg.Logger.Printf("Failed to hash password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.Db.CreateUser(r.Context(), database.CreateUserParams{
		ID:           uuid.New(),
		Email:        p.Email,
		PasswordHash: hashedPassword,
		Username:     p.Username,
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		CuredEmail:   sql.NullString{String: curedEmail, Valid: true},
		Title:        "basic",
	})

	if err != nil {
		cfg.Logger.Printf("Failed to create user: %v", err)
		http.Error(w, "Failed to create user", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Printf("User created: %v", res)

	cfg.SendValidationEmail(p.Email, res.ID.String())

	cfg.WriteSingleJsonOutput(w, http.StatusCreated, res, PrintUserToJson)
}

func (cfg *ApiCfg) GetUsersHandler(w http.ResponseWriter, _ *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received get users request")
	users, err := cfg.ListUsers()
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.WriteHeader(http.StatusOK)
	jsonData, err := json.Marshal(users)
	if err != nil {
		cfg.Logger.Printf("Failed to marshal users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	_, err = w.Write(jsonData)
	if err != nil {
		cfg.Logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) GetUserHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
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
			user, err = cfg.Db.GetUserByEmail(r.Context(), userEmail)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.Logger.Printf("User not found: %v", userEmail)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.Logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		case "username":
			userName := r.PathValue("searchArg")
			user, err = cfg.Db.GetUserByUsername(r.Context(), userName)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.Logger.Printf("User not found: %v", userName)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.Logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		case "jwt":
			jwtToken := r.PathValue("searchArg")
			uid, err := auth.ValidateUUIDJWT(jwtToken, cfg.Secret)
			if err != nil {
				cfg.Logger.Printf("Invalid token: %v", err)
				http.Error(w, "Invalid token", http.StatusBadRequest)
				return
			}
			user, err = cfg.Db.GetUserByID(r.Context(), uid)
			if err != nil {
				if errors.Is(err, sql.ErrNoRows) {
					cfg.Logger.Printf("User not found: %v", uid)
					http.Error(w, "User not found", http.StatusNotFound)
					return
				}
				cfg.Logger.Printf("Failed to retrieve user: %v", err)
				http.Error(w, "Internal server error", http.StatusInternalServerError)
				return
			}
		default:
			cfg.Logger.Printf("Invalid search type: %v", q.Get("search_type"))
			http.Error(w, "Invalid search type", http.StatusBadRequest)
			return
		}
	} else {
		// Extract user ID from URL path
		userIDStr := r.PathValue("searchArg")
		if userIDStr == "" {
			cfg.Logger.Printf("Missing user ID in request")
			http.Error(w, "Missing user ID", http.StatusBadRequest)
			return
		}

		// Parse user ID as UUID

		userID, err := uuid.Parse(userIDStr)
		if err != nil {
			cfg.Logger.Printf("Invalid UUID format: %v", err)
			http.Error(w, "Invalid user ID format", http.StatusBadRequest)
			return
		}

		cfg.Logger.Printf("Received get user request for user ID: %v", userID)

		user, err = cfg.Db.GetUserByID(r.Context(), userID)
		if err != nil {
			if errors.Is(err, sql.ErrNoRows) {
				cfg.Logger.Printf("User not found: %v", userID)
				http.Error(w, "User not found", http.StatusNotFound)
				return
			}
			cfg.Logger.Printf("Failed to retrieve user: %v", err)
			http.Error(w, "Internal server error", http.StatusInternalServerError)
			return
		}
	}
	cfg.WriteSingleJsonOutput(w, http.StatusOK, user, PrintUserToJson)
}

func (cfg *ApiCfg) DeleteUserHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.Logger.Print("Received delete user request")

	// Parse user ID as UUID
	userID, err := GetUUIDFromPath(r, "userID")
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid user ID format", http.StatusBadRequest)
		return
	}

	if sendingUser.ID != userID && !UserHasPermission(sendingUser, PermissionCanManageUsers) {
		cfg.Logger.Printf("Unauthorized delete attempt by user: %v", sendingUser.ID)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	err = cfg.DeleteUser(userID)
	if err != nil {
		cfg.Logger.Printf("Failed to delete user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusNoContent)
}

func (cfg *ApiCfg) GetAllUserDataHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type userData struct {
		User          database.User           `json:"user"`
		UserProblems  []database.UsersProblem `json:"users_problems"`
		UserLessons   []database.LessonsUser  `json:"users_lessons"`
		UserSolutions []database.Solution     `json:"user_solutions"`
	}

	cfg.Logger.Print("Received get all user data request for user ID: ", targetUser.ID.String())

	// Check if database is connected
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	userProblems, err := cfg.Db.GetUserProblemsByUserID(r.Context(), database.GetUserProblemsByUserIDParams{
		UserID: targetUser.ID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve user problems: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	userLessons, err := cfg.Db.GetLessonsUsersByUserID(r.Context(), database.GetLessonsUsersByUserIDParams{
		UserID: targetUser.ID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve user lessons: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	userSolutions, err := cfg.Db.GetSolutionsByUserID(r.Context(), database.GetSolutionsByUserIDParams{
		UserID: targetUser.ID,
		Limit:  1000,
		Offset: 0,
	})
	if err != nil {
		cfg.Logger.Printf("Failed to retrieve user solutions: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res := userData{
		User:          targetUser,
		UserProblems:  userProblems,
		UserLessons:   userLessons,
		UserSolutions: userSolutions,
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, func(data any) (string, error) {
		userData := data.(userData)

		userJson, err := PrintUserToJson(userData.User)
		if err != nil {
			return "", fmt.Errorf("failed to marshal user: %v", err)
		}

		userProblemsJson := "["
		for _, userProblem := range userData.UserProblems {
			userProblemJson, err := GenericPrinter(userProblem)
			if err != nil {
				return "", fmt.Errorf("failed to marshal user problem: %v", err)
			}
			userProblemsJson += userProblemJson + ","
		}
		if len(userData.UserProblems) > 0 {
			userProblemsJson = userProblemsJson[:len(userProblemsJson)-1] // Remove trailing comma
		}
		userProblemsJson += "]"

		userLessonsJson := "["
		for _, userLesson := range userData.UserLessons {
			userLessonJson, err := GenericPrinter(userLesson)
			if err != nil {
				return "", fmt.Errorf("failed to marshal user lesson: %v", err)
			}
			userLessonsJson += userLessonJson + ","
		}
		if len(userData.UserLessons) > 0 {
			userLessonsJson = userLessonsJson[:len(userLessonsJson)-1] // Remove trailing comma
		}
		userLessonsJson += "]"

		userSolutionsJson := "["
		for _, userSolution := range userData.UserSolutions {
			userSolutionJson, err := GenericPrinter(userSolution)
			if err != nil {
				return "", fmt.Errorf("failed to marshal user solution: %v", err)
			}
			userSolutionsJson += userSolutionJson + ","
		}
		if len(userData.UserSolutions) > 0 {
			userSolutionsJson = userSolutionsJson[:len(userSolutionsJson)-1] // Remove trailing comma
		}
		userSolutionsJson += "]"

		return fmt.Sprintf(`{"user":%v,"users_problems":%v,"users_lessons":%v,"user_solutions":%v}`, userJson, userProblemsJson, userLessonsJson, userSolutionsJson), nil
	})
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

	cfg.Logger.Print("Received update user pfp request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Parse image ID as UUID
	imageID, err := uuid.Parse(p.ImageID)
	if err != nil {
		cfg.Logger.Printf("Invalid UUID format: %v", err)
		http.Error(w, "Invalid image ID format", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateUserPfp(r.Context(), database.UpdateUserPfpParams{
		ID:           targetUser.ID,
		ProfilePicID: uuid.NullUUID{UUID: imageID, Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update user profile picture: %v", err)
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

	cfg.Logger.Print("Received update user password request for user ID: ", targetUser.ID.String())

	var p params
	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	// Check old password
	err = auth.CheckPasswordHash(p.OldPassword, targetUser.PasswordHash)
	if err != nil {
		cfg.Logger.Printf("Invalid old password for user ID: %v", targetUser.ID.String())
		http.Error(w, "Incorrect old password", http.StatusUnauthorized)
		return
	}

	// Hash the new password
	hashedPassword, err := auth.HashPassword(p.NewPassword)
	if err != nil {
		cfg.Logger.Printf("Failed to hash new password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	res, err := cfg.Db.UpdateUserPassword(r.Context(), database.UpdateUserPasswordParams{
		ID:           targetUser.ID,
		PasswordHash: hashedPassword,
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update user password: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	//Revoke all refresh tokens for the user
	err = cfg.Db.RevokeAllUserTokens(r.Context(), database.RevokeAllUserTokensParams{
		UserID:    targetUser.ID,
		RevokedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}

func (cfg *ApiCfg) UpdateUserEmailHandler(w http.ResponseWriter, r *http.Request, targetUser database.User) {
	type params struct {
		NewEmail string `json:"email"`
	}

	cfg.Logger.Print("Received update user email request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	_, err = cfg.Db.UnvalidateEmailForId(r.Context(), database.UnvalidateEmailForIdParams{
		ID:        targetUser.ID,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to invalidate user email: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	// Update email

	res, err := cfg.Db.UpdateUserEmail(r.Context(), database.UpdateUserEmailParams{
		ID:        targetUser.ID,
		Email:     p.NewEmail,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update user email: %v", err)
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

	cfg.Logger.Print("Received update user username request for user ID: ", targetUser.ID.String())

	p, err := DecodeParamsFromBody(r, params{})
	if err != nil {
		cfg.Logger.Printf("Invalid request body: %v", err)
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.Db.UpdateUserUsername(r.Context(), database.UpdateUserUsernameParams{
		ID:        targetUser.ID,
		Username:  p.NewUsername,
		UpdatedAt: sql.NullTime{Time: time.Now(), Valid: true},
	})
	if err != nil {
		cfg.Logger.Printf("Failed to update user username: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, PrintUserToJson)
}
