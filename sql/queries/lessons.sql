-- name: AddLesson :one
INSERT INTO lessons (id, title, description, author_id, content_id, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: GetLessonByID :one
SELECT * FROM lessons
WHERE id = $1;

-- name: GetAllLessons :many
SELECT * FROM lessons
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;