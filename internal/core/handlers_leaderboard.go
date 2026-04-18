package core

import (
	"Codium/internal/database"
	"context"
	"database/sql"
	"errors"
	"fmt"
	"net/http"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	SCOREBOARD UPDATING

===========================================
*/

func (cfg *ApiCfg) AddScoreToUser(userID uuid.UUID, score int32) (database.Leaderboard, error) {
	if cfg.DatabaseCfg.Loaded == false {
		return database.Leaderboard{}, errors.New("database not connected")
	}

	originalPlacement, err := cfg.Db.GetLeaderboardByUserID(context.TODO(), userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return database.Leaderboard{}, fmt.Errorf("failed to get user: %v", err)
	}

	var newScore = originalPlacement.Score + int32(score)

	if err != nil {
		_, err = cfg.Db.CreateLeaderboard(context.TODO(), database.CreateLeaderboardParams{
			UserID:    userID,
			Score:     0,
			CreatedAt: time.Now(),
			UpdatedAt: time.Now(),
		})
		if err != nil {
			return database.Leaderboard{}, fmt.Errorf("failed to create leaderboard: %v", err)
		}
	}

	res, err := cfg.Db.UpdateLeaderboardScore(context.TODO(), database.UpdateLeaderboardScoreParams{
		UserID:    userID,
		Score:     newScore,
		UpdatedAt: time.Now(),
	})

	if err != nil {
		return database.Leaderboard{}, fmt.Errorf("failed to update leaderboard: %v", err)
	}

	return res, nil
}

func (cfg *ApiCfg) RemoveScoreFromUser(userID uuid.UUID, score int32) (database.Leaderboard, error) {
	if cfg.DatabaseCfg.Loaded == false {
		return database.Leaderboard{}, errors.New("database not connected")
	}

	originalPlacement, err := cfg.Db.GetLeaderboardByUserID(context.TODO(), userID)
	if err != nil {
		return database.Leaderboard{}, fmt.Errorf("failed to get user: %v", err)
	}

	var newScore = originalPlacement.Score - int32(score)
	if newScore < 0 {
		return database.Leaderboard{}, errors.New("score is negative")
	}

	res, err := cfg.Db.UpdateLeaderboardScore(context.TODO(), database.UpdateLeaderboardScoreParams{
		UserID:    userID,
		Score:     newScore,
		UpdatedAt: time.Now(),
	})

	if err != nil {
		return database.Leaderboard{}, fmt.Errorf("failed to update leaderboard: %v", err)
	}

	return res, nil
}

/*
===========================================

	HANDLERS

===========================================
*/

func (cfg *ApiCfg) GetLeaderboardByUserIDHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if cfg.DatabaseCfg.Loaded == false {
		cfg.Logger.Printf("database not loaded")
		http.Error(w, "database not connected", http.StatusServiceUnavailable)
		return
	}

	cfg.Logger.Printf("Received get leaderboard request for user id: %s", sendingUser.ID)

	res, err := cfg.Db.GetLeaderboardByUserID(r.Context(), sendingUser.ID)
	if err != nil {
		cfg.Logger.Printf("failed to get leaderboard: %v", err)
		http.Error(w, "service unavailable", http.StatusServiceUnavailable)
		return
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, res, GenericPrinter)
}
