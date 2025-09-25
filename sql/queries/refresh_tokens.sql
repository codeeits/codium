-- name: CreateRefreshToken :one
INSERT INTO refresh_tokens (token, created_at, updated_at, user_id, expires_at, revoked_at)
VALUES (
        $1,
        $2,
        $3,
        $4,
        $5,
        $6
       )
RETURNING *;

-- name: GetToken :one
SELECT * FROM refresh_tokens
WHERE token = $1;

-- name: RevokeToken :one
UPDATE refresh_tokens
SET revoked_at = $1,
    updated_at = $1
WHERE token = $2
RETURNING *;