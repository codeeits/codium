-- name: CreateProblem :one
INSERT INTO problems (id, title, description, tags, source, created_at, updated_at, first_test, thumbnail_file_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
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

-- name: