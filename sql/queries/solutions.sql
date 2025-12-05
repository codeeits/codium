-- name: CreateSolution :one
INSERT INTO solutions (id, problem_id, user_id, first_solution_test_id, sent_code, language, percentage_correct, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
RETURNING *;

-- name: DeleteSolution :exec
DELETE FROM solutions
WHERE id = $1;

-- name: GetSolutionByID :one
SELECT *
FROM solutions
WHERE id = $1;

-- name: GetSolutionsByUserID :many
SELECT *
FROM solutions
WHERE user_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: GetSolutionsByProblemID :many
SELECT *
FROM solutions
WHERE problem_id = $1
ORDER BY created_at DESC
LIMIT $2 OFFSET $3;

-- name: UpdateSolutionFirstSolutionTest :one
UPDATE solutions
SET first_solution_test_id = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: UpdateSolutionPercentageCorrect :one
UPDATE solutions
SET percentage_correct = $2, updated_at = $3
WHERE id = $1
RETURNING *;

-- name: CountSolutionsByUserID :one
SELECT COUNT(*) AS count
FROM solutions
WHERE user_id = $1;

-- name: CountSolutionsByProblemID :one
SELECT COUNT(*) AS count
FROM solutions
WHERE problem_id = $1;

-- name: GetAllSolutions :many
SELECT *
FROM solutions
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

