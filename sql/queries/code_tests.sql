-- name: CreateCodeTest :one
INSERT INTO code_tests (id, txt_input, file_input, expected_output, created_at, updated_at, previous_test_id, next_test_id)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
RETURNING *;

-- name: GetCodeTestByID :one
SELECT * FROM code_tests
WHERE id = $1;

-- name: UpdateNextCodeTest :one
UPDATE code_tests
SET next_test_id = $2,
    updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdatePreviousCodeTest :one
UPDATE code_tests
SET previous_test_id = $2,
    updated_at = $3
WHERE id = $1
RETURNING *;

-- name: DeleteCodeTestByID :exec
DELETE FROM code_tests
WHERE id = $1;

-- name: ListCodeTestsByIDs :many
SELECT * FROM code_tests
WHERE id = ANY($1);

-- name: UpdateCodeTestExpectedOutput :one
UPDATE code_tests
SET expected_output = $2,
    updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateCodeTestInputs :one
UPDATE code_tests
SET txt_input = $2,
    file_input = $3,
    updated_at = $4
WHERE id = $1
RETURNING *;

-- name: ListAllCodeTests :many
SELECT * FROM code_tests
ORDER BY created_at ASC
LIMIT $1 OFFSET $2;