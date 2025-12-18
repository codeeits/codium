-- name: CreateUserProblem :one
INSERT INTO users_problems (id, user_id, problem_id, created_at, updated_at, liked, bookmarked, solved_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetUserProblemByUserIDAndProblemID :one
SELECT *
FROM users_problems
WHERE user_id = $1 AND problem_id = $2;

-- name: GetUserProblemsByUserID :many
SELECT *
FROM users_problems
WHERE user_id = $1;

-- name: GetBookmarkedProblemsByUserID :many
SELECT *
FROM users_problems
WHERE user_id = $1 AND bookmarked = TRUE;

-- name: GetLikedProblemsByUserID :many
SELECT *
FROM users_problems
WHERE user_id = $1 AND liked = TRUE;

-- name: CountLikesByProblemID :one
SELECT COUNT(*) AS like_count
FROM users_problems
WHERE problem_id = $1 AND liked = TRUE;

-- name: GetSolvedProblemsByUserID :many
SELECT *
FROM users_problems
WHERE user_id = $1 AND solved_at IS NOT NULL;

-- name: CountNumberOfSolvedProblemsByUserID :one
SELECT COUNT(*) AS solved_count
FROM users_problems
WHERE user_id = $1 AND solved_at IS NOT NULL;

-- name: CountNumberOfSolvesByProblemID :one
SELECT COUNT(*) AS solve_count
FROM users_problems
WHERE problem_id = $1 AND solved_at IS NOT NULL;

-- name: UpdateUserProblemBookmark :one
UPDATE users_problems
SET bookmarked = $1, updated_at = $2
WHERE user_id = $3 AND problem_id = $4
RETURNING *;

-- name: UpdateUserProblemLike :one
UPDATE users_problems
SET liked = $1, updated_at = $2
WHERE user_id = $3 AND problem_id = $4
RETURNING *;

-- name: UpdateUserProblemSolvedAt :one
UPDATE users_problems
SET solved_at = $1, updated_at = $2
WHERE user_id = $3 AND problem_id = $4
RETURNING *;

-- name: DeleteUserProblem :exec
DELETE FROM users_problems
WHERE user_id = $1 AND problem_id = $2;