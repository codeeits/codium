-- name: AddLesson :one
INSERT INTO lessons (id, title, description, author_id, content_id, created_at, updated_at, flags, next_lesson_id, prev_lesson_id, suggested, thumbnail_id, language)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
RETURNING *;

-- name: GetLessonByID :one
SELECT * FROM lessons
WHERE id = $1;

-- name: GetLessonsByLanguage :many
SELECT * FROM lessons
WHERE language = $1 and suggested = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetLessons :many
SELECT * FROM lessons
WHERE suggested = FALSE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetLessonByFlags :one
SELECT * FROM lessons
WHERE flags = $1 and suggested = FALSE;

-- name: GetSuggestedLessons :many
SELECT * FROM lessons
WHERE suggested = TRUE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- the following query counts the number of lessons with flags matching a given bitmask
-- name: CountLessons :one
SELECT COUNT(*) FROM lessons
WHERE flags & $1 = $2 and suggested = FALSE;

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
WHERE flags & $1 = $2 and suggested = FALSE
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
WHERE section_starter = TRUE
ORDER BY section_starter ASC;

-- name: SetSectionStarter :one
UPDATE lessons
SET section_starter = $2
WHERE id = $1 and suggested = FALSE
RETURNING *;

-- name: ResetSectionStarterForSection :exec
UPDATE lessons
SET section_starter = FALSE
WHERE flags & 65280 = $1;

-- name: CountLessonsByUniqueSections :one
SELECT COUNT(*) FROM (
    SELECT DISTINCT flags & 65280 AS section_flag
    FROM lessons
    WHERE section_starter = TRUE
) AS unique_sections;

-- name: UpdateLessonSuggested :one
UPDATE lessons
SET suggested = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateLessonThumbnail :one
UPDATE lessons
SET thumbnail_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateLessonLanguage :one
UPDATE lessons
SET language = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: GetAllLessonsFromSectionStarter :many
WITH RECURSIVE lesson_chain AS (
    SELECT *
    FROM lessons f
    WHERE f.id = $1
    UNION ALL
    SELECT l.*
    FROM lessons l
    INNER JOIN lesson_chain lc ON l.id = lc.next_lesson_id
)
SELECT * FROM lesson_chain
ORDER BY created_at ASC;


-- name: GetLessonsBySearchQuery :many
SELECT * FROM lessons
WHERE (title ILIKE '%' || $1 || '%' OR description ILIKE '%' || $1 || '%') and suggested = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;