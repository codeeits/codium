package main

import (
	"Codium/internal/database"
	"encoding/json"
	"fmt"
	"net/http"
)

/*
===========================================

	Handlers

===========================================
*/

func (cfg *ApiCfg) CreateUserHandler(w http.ResponseWriter, r *http.Request) {
	type params struct {
		Username string `json:"username"`
		Email    string `json:"email"`
		Password string `json:"password"`
	}
	cfg.logger.Print("Received request to create user with request body: ", r.Body)

	// Check if database is connected

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

	res, err := cfg.db.CreateUser(r.Context(), database.CreateUserParams{
		Email:        p.Email,
		PasswordHash: p.Password,
		Username:     p.Username,
	})

	if err != nil {
		cfg.logger.Printf("Failed to create user: %v", err)
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	cfg.logger.Printf("User created: ID=%d, Email=%s, Username=%s", res.ID, res.Email, res.Username)

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"id": %d, "email": %v, "username": %v, "created_at": %v, "updated_at: %v"}`, res.ID, res.Email, res.Username, res.CreatedAt, res.UpdatedAt)))
	if err != nil {
		cfg.logger.Printf("Failed to write response: %v", err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
