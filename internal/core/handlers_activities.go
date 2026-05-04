package core

import (
	"Codium/internal/database"
	"context"
	"database/sql"
	"encoding/json"
	"errors"
	"fmt"
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
	if timeSinceLastActivity < 24*time.Hour && lastActivity.CreatedAt.Day() != time.Now().Day() && timeSinceLastActivity < 48*time.Hour {
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

func (cfg *ApiCfg) GetHeatMapData(user database.User, startDate time.Time, endDate time.Time) (map[time.Time]database.UsersActivity, error) {
	res, err := cfg.Db.GetUserActivities(context.Background(), database.GetUserActivitiesParams{
		UserID:      user.ID,
		CreatedAt:   startDate,
		CreatedAt_2: endDate,
		Limit:       1000,
		Offset:      0,
	})

	if err != nil {
		cfg.Logger.Printf("Error getting user activity: %v", err)
		return nil, err
	}
	activities := make(map[time.Time]database.UsersActivity)
	for _, activity := range res {
		activities[activity.CreatedAt] = activity
	}

	return activities, nil
}
