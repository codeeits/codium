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
	"os"
	"strings"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	API Functions

===========================================
*/

func (cfg *ApiCfg) ResetAll() error {

	cfg.logger.Println("Resetting the database...")

	err := cfg.db.DeleteUsers(context.Background())
	if err != nil {
		cfg.logger.Printf("Failed to delete users: %v", err)
		return err
	}

	// Add default admin user
	hashedPassword, err := auth.HashPassword(cfg.adminDefaultPassword)
	if err != nil {
		cfg.logger.Printf("Failed to hash default admin password: %v", err)
		return err
	}

	_, err = cfg.db.CreateUser(context.Background(), database.CreateUserParams{
		ID:           uuid.New(),
		Email:        "codiumOfficial@lekas.tech",
		PasswordHash: hashedPassword,
		Username:     "codiumOfficial",
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		IsAdmin:      true,
	})
	if err != nil {
		cfg.logger.Printf("Failed to create default admin user: %v", err)
		return err
	}

	cfg.logger.Print("Default admin user created successfully.")
	return nil
}

// Upload local upload
func (cfg *ApiCfg) Upload(multipart multipart.File, location string, fileType string, user database.User, fileExts string) (string, error) {
	cwd, err := os.Getwd()
	if err != nil {
		return "", fmt.Errorf("failed to get current working directory: %v", err)
	}

	appDir := cwd + "/App/"
	location = strings.TrimSpace(location)

	var filePath string
	fileId := uuid.New()

	switch location {
	case "images":
		if strings.HasPrefix(fileType, "image/") == false {
			return "", fmt.Errorf("invalid file type for images: %v", fileType)
		}
		imageDir := appDir + "Images/uploads"
		// Ensure the directory exists
		err := os.MkdirAll(imageDir, os.ModePerm)
		if err != nil {
			return "", fmt.Errorf("failed to create image directory: %v", err)
		}
		// Handle image upload
		filePath = fmt.Sprintf("%s/%s.%s", imageDir, fileId.String(), fileExts)
		dst, err := os.Create(filePath)
		if err != nil {
			return "", fmt.Errorf("failed to create file: %v", err)
		}
		defer func(dst *os.File) {
			err := dst.Close()
			if err != nil {
				cfg.logger.Printf("Error closing the file: %v", err)
			}
		}(dst)

		//copy the uploaded file to the destination file
		_, err = io.Copy(dst, multipart)
		if err != nil {
			return "", fmt.Errorf("failed to save file: %v", err)
		}
		cfg.logger.Printf("Image uploaded successfully: %s", filePath)
		// Return the file path or URL
		filePath = strings.TrimPrefix(filePath, cwd+"/")
		cfg.logger.Printf("Image accessible at path: %s", filePath)
		// Return the file path or URL
	case "lessons":
		// Check if file is markdown
		if strings.HasPrefix(fileType, "markdown/") == false {
			return "", fmt.Errorf("invalid file type for lessons: %v", fileType)
		}
		// Lessons are privileged uploads only
		if !user.IsAdmin {
			return "", fmt.Errorf("unauthorized upload attempt to lessons")
		}

		// Handle lesson upload
		return "", fmt.Errorf("lesson uploads are not yet implemented")
	default:
		return "", fmt.Errorf("invalid location: %v", location)
	}

	_, err = cfg.db.CreateFile(context.Background(), database.CreateFileParams{
		ID:       fileId,
		UserID:   user.ID,
		Filename: fileId.String() + "." + fileExts,
		Filepath: filePath,
		Filesize: 0, // TODO: get actual file size
		UploadedAt: sql.NullTime{
			Time:  time.Now(),
			Valid: true,
		},
	})

	if err != nil {
		return "", fmt.Errorf("failed to record file in database: %v", err)
	}

	return filePath, nil
}

/*
===========================================

	Handlers

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
	})

	if err != nil {
		cfg.logger.Printf("Failed to create user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	cfg.logger.Printf("User created: %v", res)

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"id": %v, "email": "%v", "username": "%v", "created_at": "%v","updated_at": "%v"}`, res.ID, res.Email, res.Username, res.CreatedAt, res.UpdatedAt)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}

func (cfg *ApiCfg) ResetHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received request to reset the database")

	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		cfg.logger.Printf("Unauthorized access attempt: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Validate the token
	uid, err := auth.ValidateJWT(token, cfg.secret)
	if err != nil {
		cfg.logger.Printf("Invalid token: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	// Check if the user is an admin
	adminUser, err := cfg.db.GetUserByID(r.Context(), uid)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}
	if !adminUser.IsAdmin {
		cfg.logger.Printf("Unauthorized access attempt by non-admin user: %v", uid)
		http.Error(w, "Forbidden", http.StatusForbidden)
		return
	}

	cfg.logger.Print("Admin reset initiated by user: ", uid)

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
	_, err = w.Write([]byte(fmt.Sprintf(`{"auth_token": "%v", "refresh_token": "%v"}`, token, refreshToken)))
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

func (cfg *ApiCfg) GetUsersHandler(w http.ResponseWriter, r *http.Request) {
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	cfg.logger.Print("Received get users request")
	users, err := cfg.db.GetUsers(r.Context(), database.GetUsersParams{
		Limit:  100,
		Offset: 0,
	})
	if err != nil {
		cfg.logger.Printf("Failed to retrieve users: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")

	//skip password hashes in response
	for i := range users {
		users[i].PasswordHash = ""
	}
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
	user.PasswordHash = "" // Skip password hash in response

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	jsonData, err := json.Marshal(user)
	if err != nil {
		cfg.logger.Printf("Failed to marshal user: %v", err)
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

func (cfg *ApiCfg) UploadHandler(w http.ResponseWriter, r *http.Request) {
	//check user credentials
	// Check if database is connected
	if !cfg.dbLoaded {
		cfg.logger.Println("Database not connected")
		http.Error(w, "Database not connected", http.StatusInternalServerError)
		return
	}

	token, err := auth.GetBearerToken(r.Header)
	if err != nil {
		cfg.logger.Printf("Unauthorized access attempt: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}

	targetId, err := auth.ValidateJWT(token, cfg.secret)
	if err != nil {
		cfg.logger.Printf("Invalid token: %v", err)
		http.Error(w, "Unauthorized", http.StatusUnauthorized)
		return
	}
	targetUser, err := cfg.db.GetUserByID(r.Context(), targetId)
	if err != nil {
		cfg.logger.Printf("Failed to retrieve user: %v", err)
		http.Error(w, "Internal server error", http.StatusInternalServerError)
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

	uploadPath, err := cfg.Upload(file, location, fileType, targetUser, handler.Filename[strings.LastIndex(handler.Filename, ".")+1:])
	if err != nil {
		cfg.logger.Printf("Failed to upload file: %v", err)
		http.Error(w, "Failed to upload file ", http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusOK)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"file_path": "%v"}`, uploadPath)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
