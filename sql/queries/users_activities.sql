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

-- name: GetUserActivitiesGroupedByDays :many
WITH daily AS (
    SELECT
        created_at::date AS day,
    COUNT(*)::float8 AS activity_count,
    COALESCE(SUM(xp_gained), 0)::float8 AS total_xp
FROM users_activities
WHERE user_id = $1
  AND created_at >= $2
  AND created_at <= $3
GROUP BY created_at::date
    ),
    avg_daily AS (
SELECT COALESCE(AVG(activity_count), 0.0) AS avg_count
FROM daily
    )
SELECT
    d.day,
    d.activity_count::bigint AS activity_count,
    d.total_xp::bigint AS total_xp,
    CASE
        WHEN a.avg_count = 0 THEN 0.0
        ELSE LEAST(1.0, GREATEST(0.0, d.activity_count / (2.0 * a.avg_count)))
        END AS intensity
FROM daily d
         CROSS JOIN avg_daily a
ORDER BY d.day DESC
    LIMIT $4 OFFSET $5;

-- name: GetLastUserActivity :one
SELECT * FROM users_activities
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT 1;


-- This function works on the users table, but it's related to user activities
-- Hence future me get bamboozled <3
-- name: UpdateUserStreak :one
UPDATE users
SET current_streak = current_streak + 1
WHERE id = $1
RETURNING current_streak;

-- name: GetUserStreak :one
SELECT current_streak FROM users
WHERE id = $1;

-- name: ResetUserStreak :exec
UPDATE users
SET current_streak = 0
WHERE id = $1;