-- name: AddLesson :one
INSERT INTO lessons (id, title, description, author_id, content_id, created_at, updated_at, flags, next_lesson_id, prev_lesson_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

-- the following query counts the number of lessons with flags matching a given bitmask
-- name: CountLessons :one
SELECT COUNT(*) FROM lessons
WHERE flags & $1 = $2;

-- name: GetLessonByContentID :one
SELECT * FROM lessons
WHERE content_id = $1;