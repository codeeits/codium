package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
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
