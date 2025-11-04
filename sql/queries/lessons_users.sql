-- name: CreateLessonsUsers :one
INSERT INTO lessons_users (lesson_id, user_id, favorited, bookmarked, started_at, completed_at, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: UpdateLessonsUsersFavorited :one
UPDATE lessons_users
SET favorited = $1, updated_at = $2
WHERE lesson_id = $3 AND user_id = $4
RETURNING *;

-- name: UpdateLessonsUsersBookmarked :one
UPDATE lessons_users
SET bookmarked = $1, updated_at = $2
WHERE lesson_id = $3 AND user_id = $4
RETURNING *;

-- name: UpdateLessonsUsersStart :one
UPDATE lessons_users
SET started_at = $1, updated_at = $2
WHERE lesson_id = $3 AND user_id = $4
RETURNING *;

-- name: UpdateLessonsUsersComplete :one
UPDATE lessons_users
SET completed_at = $1, updated_at = $2
WHERE lesson_id = $3 AND user_id = $4
RETURNING *;

-- name: GetLessonsUsersByUserID :many
SELECT * FROM lessons_users
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsUsersByLessonID :many
SELECT * FROM lessons_users
WHERE lesson_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsUsersByLessonIDAndUserID :one
SELECT * FROM lessons_users
WHERE lesson_id = $1 AND user_id = $2;

-- name: DeleteLessonsUsersByLessonIDAndUserID :exec
DELETE FROM lessons_users
WHERE lesson_id = $1 AND user_id = $2;

-- name: GetLessonsUsersCompletedLessonsByUserID :many
SELECT * FROM lessons_users
WHERE user_id = $1 AND completed_at IS NOT NULL
ORDER BY completed_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsUsersFavoritedLessonsByUserID :many
SELECT * FROM lessons_users
WHERE user_id = $1 AND favorited = TRUE
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsUsersBookmarkedLessonsByUserID :many
SELECT * FROM lessons_users
WHERE user_id = $1 AND bookmarked = TRUE
ORDER BY updated_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsUsersStartedLessonsByUserID :many
SELECT * FROM lessons_users
WHERE user_id = $1 AND started_at IS NOT NULL AND completed_at IS NULL
ORDER BY started_at DESC
LIMIT $2 OFFSET $3;

-- name: CountLessonsUsersFavoritedLessonsByLessonID :one
SELECT COUNT(*) FROM lessons_users
WHERE lesson_id = $1 AND favorited = TRUE;