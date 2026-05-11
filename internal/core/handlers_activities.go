package core

import (
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

	UsersActivities Handlers

===========================================
*/

func (cfg *ApiCfg) CreateUserActivity(userID uuid.UUID, activityType string, xpGained int32) error {
	lastActivity, err := cfg.Db.GetLastUserActivity(context.Background(), userID)
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		return err
	}

	// Check whether to increase the streak
	timeSinceLastActivity := time.Now().Sub(lastActivity.CreatedAt)
	if (timeSinceLastActivity < 24*time.Hour && lastActivity.CreatedAt.Day() != time.Now().Day()) || (timeSinceLastActivity >= 24*time.Hour && timeSinceLastActivity < 48*time.Hour) {
		res, err := cfg.Db.UpdateUserStreak(context.Background(), userID)
		if err != nil {
			return err
		}

		_, err = cfg.Db.CreateEvent(context.Background(), database.CreateEventParams{
			ID:        uuid.New(),
			UserID:    userID,
			Type:      "streakUpdated",
			Payload:   json.RawMessage(fmt.Sprintf(`{"text":"server_events.streaks.updated.placeholder", "type": "info", "streak": %v}`, res)),
			CreatedAt: time.Now(),
		})
	} else if timeSinceLastActivity > 48*time.Hour {
		err = cfg.Db.ResetUserStreak(context.Background(), userID)
		if err != nil {
			return err
		}

		_, err = cfg.Db.CreateEvent(context.Background(), database.CreateEventParams{
			ID:        uuid.New(),
			UserID:    userID,
			Type:      "streakLost",
			Payload:   json.RawMessage(fmt.Sprintf(`{"text":"server_events.streaks.lost.placeholder", "type": "danger"}`)),
			CreatedAt: time.Now(),
		})
	}

	_, err = cfg.Db.CreateUsersActivities(context.Background(), database.CreateUsersActivitiesParams{
		UserID:       userID,
		XpGained:     xpGained,
		ActivityType: activityType,
		CreatedAt:    time.Now(),
		UpdatedAt:    time.Now(),
		ID:           uuid.New(),
	})

	if err != nil {
		cfg.Logger.Printf("Error creating user activity: %v", err)
		return err
	}

	return nil
}

func (cfg *ApiCfg) GetHeatMapData(user database.User, startDate time.Time, endDate time.Time) ([]database.GetUserActivitiesGroupedByDaysRow, error) {
	res, err := cfg.Db.GetUserActivitiesGroupedByDays(context.Background(), database.GetUserActivitiesGroupedByDaysParams{
		UserID:      user.ID,
		CreatedAt:   startDate,
		CreatedAt_2: endDate,
		Limit:       365,
		Offset:      0,
	})
	if err != nil {
		return nil, err
	}

	return res, nil
}

func (cfg *ApiCfg) GetHeatmapHandler(w http.ResponseWriter, r *http.Request, sendingUser database.User) {
	if !cfg.DatabaseCfg.Loaded {
		cfg.Logger.Println("Database not loaded")
		http.Error(w, "Database not loaded", http.StatusNotImplemented)
		return
	}

	startDateStr := r.URL.Query().Get("startDate")
	endDateStr := r.URL.Query().Get("endDate")

	var startDate time.Time
	var endDate time.Time
	var err error

	if startDateStr != "" {
		startDate, err = time.Parse("2006-01-02", startDateStr)
		if err != nil {
			cfg.Logger.Printf("Error parsing start date: %v", err)
			http.Error(w, "Error parsing start date", http.StatusBadRequest)
			return
		}
	} else {
		startDate = sendingUser.CreatedAt.Time
	}

	if endDateStr != "" {
		endDate, err = time.Parse("2006-01-02", endDateStr)
		if err != nil {
			cfg.Logger.Printf("Error parsing end date: %v", err)
			http.Error(w, "Error parsing end date", http.StatusBadRequest)
			return
		}
	} else {
		endDate = time.Now()
	}

	heatmapData, err := cfg.GetHeatMapData(sendingUser, startDate, endDate)
	if err != nil {
		cfg.Logger.Printf("Error getting heatmap data: %v", err)
		http.Error(w, "Error getting heatmap data", http.StatusInternalServerError)
		return
	}

	type out struct {
		StartDate time.Time                                    `json:"startDate"`
		EndDate   time.Time                                    `json:"endDate"`
		Cells     []database.GetUserActivitiesGroupedByDaysRow `json:"cells"`
	}

	cfg.WriteSingleJsonOutput(w, http.StatusOK, out{StartDate: startDate, EndDate: endDate, Cells: heatmapData}, GenericPrinter)
}
