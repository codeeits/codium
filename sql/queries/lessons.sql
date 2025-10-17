-- name: AddLesson :one
INSERT INTO lessons (id, title, description, author_id, content_id, created_at, updated_at, flags)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetLessonByID :one
SELECT * FROM lessons
WHERE id = $1;

-- name: GetAllLessons :many
SELECT * FROM lessons
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetLessonByFlags :one
SELECT * FROM lessons
WHERE flags = $1;