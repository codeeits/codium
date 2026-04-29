package core

import (
	"Codium/internal/database"
	"context"
	"time"

	"github.com/google/uuid"
)

/*
===========================================

	UsersActivities Handlers

===========================================
*/

func (cfg *ApiCfg) CreateUserActivity(user database.User, activityType string, xpGained int32) error {
	_, err := cfg.Db.CreateUsersActivities(context.Background(), database.CreateUsersActivitiesParams{
		UserID:       user.ID,
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
