-- name: CreateUsersActivities :one
INSERT INTO users_activities (user_id, xp_gained, activity_type, created_at, updated_at, id)
    VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetUserActivities :many
SELECT * FROM users_activities
WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
ORDER BY created_at DESC
LIMIT $4 OFFSET $5;

-- name: GetUserActivitiesByType :many
SELECT * FROM users_activities
WHERE user_id = $1 AND activity_type = $2 AND created_at >= $3 AND created_at <= $4
ORDER BY created_at DESC
LIMIT $5 OFFSET $6;

-- name: GetUserActivityById :one
SELECT * FROM users_activities
WHERE id = $1;

-- name: DeleteUserActivitiesByUserId :exec
DELETE FROM users_activities
WHERE user_id = $1;

-- name: CountUserActivitiesByType :one
SELECT COUNT(*) AS activity_count FROM users_activities
WHERE user_id = $1 AND activity_type = $2 AND created_at >= $3 AND created_at <= $4;

-- name: SumXpGainedByUserId :one
SELECT COALESCE(SUM(xp_gained), 0) AS total_xp FROM users_activities
WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3;

-- name: SumXpGainedByUserIdAndType :one
SELECT COALESCE(SUM(xp_gained), 0) AS total_xp FROM users_activities
WHERE user_id = $1 AND activity_type = $2 AND created_at >= $3 AND created_at <= $4;

-- name: SumXpGainedGroupedByDays :many
SELECT DATE_TRUNC('day', created_at) AS day, COALESCE(SUM(xp_gained), 0) AS total_xp
FROM users_activities
WHERE user_id = $1 AND created_at >= $2 AND created_at <= $3
GROUP BY day
ORDER BY day ASC
LIMIT $4 OFFSET $5;