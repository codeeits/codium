-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = $1;