-- name: CreateEvent :one
INSERT INTO events (id, user_id, type, payload, created_at)
VALUES ($1, $2, $3, $4, $5)
RETURNING *;

-- name: GetEventsForUser :many
SELECT *
FROM events
WHERE user_id = $1
ORDER BY created_at ASC;

-- name: DeleteEvent :one
DELETE FROM events
WHERE id = $1
RETURNING *;