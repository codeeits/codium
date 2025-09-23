-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;

-- name: CreateUser :one
INSERT INTO users (email, password_hash, username, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;