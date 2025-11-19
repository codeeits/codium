-- name: CreateProblem :one
INSERT INTO problems (id, title, description, tags, source, created_at, updated_at, first_test, thumbnail_file_id, author_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
RETURNING *;

-- name: GetProblemByID :one
SELECT * FROM problems
WHERE id = $1;

-- name: GetProblems :many
SELECT * FROM problems
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- tags is similar to flags, so it's stored as an INT
-- name: GetProblemsByTag :many
SELECT * FROM problems
WHERE $1 & tags = $2
ORDER BY created_at DESC
LIMIT $3 OFFSET $4;

-- name: UpdateProblemFirstTest :one
UPDATE problems
SET first_test = $2, updated_at = $3
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

-- name: UpdateProblemTitleAndDescription :one
UPDATE problems
SET title = $2, description = $3, updated_at = $4
WHERE id = $1
RETURNING *;

-- name: CountProblems :one
SELECT COUNT(*) FROM problems;

-- name: CountProblemsByTag :one
SELECT COUNT(*) FROM problems
WHERE $1 & tags = $2;

-- name: GetProblemsByAuthorID :many
SELECT * FROM problems
WHERE author_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: CountProblemsByAuthorID :one
SELECT COUNT(*) FROM problems
WHERE author_id = $1;

-- name: GetProblemsBySource :many
SELECT * FROM problems
WHERE source = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

