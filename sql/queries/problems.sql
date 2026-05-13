-- name: CreateProblem :one
INSERT INTO problems (id, title, description, tags, source, created_at, updated_at, first_test, thumbnail_file_id, author_id, suggested, total_tests)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
RETURNING *;

-- name: GetProblemByID :one
SELECT * FROM problems
WHERE id = $1;

-- name: GetProblems :many
SELECT * FROM problems
         WHERE suggested = FALSE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- tags is similar to flags, so it's stored as an INT
-- name: GetProblemsByTag :many
SELECT * FROM problems
WHERE $1 & tags = $2 and suggested = FALSE
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: UpdateProblemFirstTest :one
UPDATE problems
SET first_test = $2, updated_at = $3, total_tests = $4
WHERE id = $1
RETURNING *;

-- name: UpdateProblemThumbnail :one
UPDATE problems
SET thumbnail_file_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: DeleteProblem :exec
DELETE FROM problems
WHERE id = $1;

-- name: UpdateProblemTags :one
UPDATE problems
SET tags = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateProblemDetails :one
UPDATE problems
SET title = $2, description = $3, source=$4, updated_at = $5
WHERE id = $1
RETURNING *;

-- name: CountProblems :one
SELECT COUNT(*) FROM problems
WHERE suggested = FALSE;

-- name: CountProblemsByTag :one
SELECT COUNT(*) FROM problems
WHERE $1 & tags = $2 and suggested = FALSE;

-- name: GetProblemsByAuthorID :many
SELECT * FROM problems
WHERE author_id = $1 and suggested = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountProblemsByAuthorID :one
SELECT COUNT(*) FROM problems
WHERE author_id = $1 and suggested = FALSE;

-- name: GetProblemsBySource :many
SELECT * FROM problems
WHERE (source ILIKE '%' || $1 || '%') and suggested = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateProblemSuggested :one
UPDATE problems
SET suggested = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: GetSuggestedProblems :many
SELECT * FROM problems
WHERE suggested = TRUE
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: GetProblemsBySearchQuery :many
SELECT * FROM problems
WHERE (title ILIKE '%' || $1 || '%') and suggested = FALSE
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;