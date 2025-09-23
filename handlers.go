package main

import (
	"Codium/internal/auth"
	"Codium/internal/database"
	"database/sql"
	"encoding/json"
	"fmt"
	"net/http"
	"time"
)

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
		Email:        p.Email,
		PasswordHash: hashedPassword,
		Username:     p.Username,
		CreatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
		UpdatedAt:    sql.NullTime{Time: time.Now(), Valid: true},
	})

	if err != nil {
		cfg.logger.Printf("Failed to create user: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	cfg.logger.Printf("User created: ID=%d, Email=%s, Username=%s", res.ID, res.Email, res.Username)

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"id": %d, "email": "%v", "username": "%v", "created_at": "%v", "updated_at": "%v"}`, res.ID, res.Email, res.Username, res.CreatedAt, res.UpdatedAt)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
