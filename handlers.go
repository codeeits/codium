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

	if !cfg.dbLoaded {
		http.Error(w, "Database not connected", http.StatusInternalServerError)
	}

	decoder := json.NewDecoder(r.Body)
	var p params
	err := decoder.Decode(&p)
	if err != nil {
		http.Error(w, "Invalid request", http.StatusBadRequest)
		return
	}

	res, err := cfg.db.CreateUser(r.Context(), database.CreateUserParams{
		Email:        p.Email,
		PasswordHash: p.Password,
		Username:     p.Username,
	})

	if err != nil {
		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.WriteHeader(http.StatusCreated)
	w.Header().Set("Content-Type", "application/json")
	_, err = w.Write([]byte(fmt.Sprintf(`{"id": %d, "email": %v, "username": %v, "created_at": %v, "updated_at: %v"}`, res.ID, res.Email, res.Username, res.CreatedAt, res.UpdatedAt)))
	if err != nil {
		cfg.logger.Println(err)
		http.Error(w, "Failed to write response", http.StatusInternalServerError)
		return
	}
}
