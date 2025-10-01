-- name: CreateFile :one
INSERT INTO files (id, user_id, filename, filepath, filesize, uploaded_at)
VALUES ($1, $2, $3, $4, $5, $6)
RETURNING *;

-- name: GetFileByID :one
SELECT * FROM files
WHERE id = $1;

-- name: GetFilesByUserID :many
SELECT * FROM files
WHERE user_id = $1
ORDER BY uploaded_at DESC
LIMIT $2 OFFSET $3;