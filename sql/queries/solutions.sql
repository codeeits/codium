-- name: CreateSolution :one
INSERT INTO solutions (id, problem_id, user_id, first_solution_test_id, sent_code, language, tests_passed, total_tests, created_at, updated_at)
VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
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

-- name: UpdateSolutionTests :one
UPDATE solutions
SET tests_passed = $2, updated_at = $3
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

-- name: GetSolutions :many
SELECT *
FROM solutions
ORDER BY created_at DESC
LIMIT $1 OFFSET $2;

-- name: CountUserSolutionsByProblemID :one
SELECT COUNT(*) AS count
FROM solutions
WHERE user_id = $1 AND problem_id = $2;

-- name: CountUserCorrectSolutionsByProblemID :one
SELECT COUNT(*) AS count
FROM solutions
WHERE user_id = $1 AND problem_id = $2 AND tests_passed = total_tests;

-- name: CountSolutionsByUserId :one
SELECT COUNT(*) AS count
FROM solutions
WHERE user_id = $1;

-- name: CountUserCorrectSolutions :one
SELECT COUNT(*) AS count
FROM solutions
WHERE user_id = $1 AND tests_passed = total_tests;