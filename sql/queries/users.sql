-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: CreateUser :one
INSERT INTO users (id, email, password_hash, username, created_at, updated_at, is_admin)
VALUES ($1, $2, $3, $4, $5, $6, $7)
RETURNING *;

-- name: DeleteUsers :exec
DELETE FROM users *;

-- name: GetUserByID :one
SELECT * FROM users WHERE id = $1;