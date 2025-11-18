-- name: AddLesson :one
INSERT INTO lessons (id, title, description, author_id, content_id, created_at, updated_at, flags, next_lesson_id, prev_lesson_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetLessonByID :one
SELECT * FROM lessons
WHERE id = $1;

-- name: GetLessons :many
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

-- name: GetLessonsByAuthorID :many
SELECT * FROM lessons
WHERE author_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessonsByFlags :many
SELECT * FROM lessons
WHERE flags & $1 = $2
ORDER BY flags ASC, created_at DESC
LIMIT $3 OFFSET $4;

-- name: DeleteLessonByID :exec
DELETE FROM lessons
WHERE id = $1;

-- name: UpdateLessonNext :one
UPDATE lessons
SET next_lesson_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateLessonPrev :one
UPDATE lessons
SET prev_lesson_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateLessonContent :one
UPDATE lessons
SET content_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateLessonDetails :one
UPDATE lessons
SET title = $2, description = $3, updated_at = $4
WHERE id = $1
RETURNING *;

-- name: UpdateLessonFlags :one
UPDATE lessons
SET flags = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: GetSectionStarterLessons :many
SELECT * FROM lessons
WHERE section_starter IS NOT NULL
ORDER BY section_starter ASC;

-- name: ResetSectionStarter :exec
UPDATE lessons
SET section_starter = NULL
WHERE section_starter = $1;

-- name: SetSectionStarter :one
UPDATE lessons
SET section_starter = $2
WHERE id = $1
RETURNING *;