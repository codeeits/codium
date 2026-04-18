-- name: CreateLeaderboard :one
INSERT INTO leaderboard (user_id, score, created_at, updated_at)
VALUES ($1, $2, $3, $4)
RETURNING *;

-- name: GetLeaderboard :many
SELECT * FROM leaderboard
ORDER BY score DESC, created_at ASC
LIMIT $1 OFFSET $2;

-- name: GetLeaderboardByUserID :one
SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as PLACEMENT FROM leaderboard
WHERE user_id = $1;

-- name: UpdateLeaderboardScore :one
UPDATE leaderboard
SET score = $2, updated_at = $3
WHERE user_id = $1
RETURNING *;

-- name: DeleteLeaderboardByUserID :exec
DELETE FROM leaderboard
WHERE user_id = $1;

-- name: GetLeaderboardCount :one
SELECT COUNT(*) FROM leaderboard;

-- name: GetLeaderboardAroundUser :many
WITH ranked_leaderboard AS (
    SELECT *, ROW_NUMBER() OVER (ORDER BY score DESC, created_at ASC) as PLACEMENT
    FROM leaderboard
)
SELECT * FROM ranked_leaderboard
WHERE PLACEMENT BETWEEN GREATEST((SELECT PLACEMENT FROM ranked_leaderboard WHERE user_id = $1) - 2, 1) AND (SELECT PLACEMENT FROM ranked_leaderboard WHERE user_id = $1) + 2
ORDER BY PLACEMENT ASC;