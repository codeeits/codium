-- +goose Up
CREATE TABLE IF NOT EXISTS users_problems
(
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id uuid NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    created_at TIMESTAMP NOT NULL,
    updated_at TIMESTAMP NOT NULL,
    liked BOOLEAN DEFAULT FALSE,
    bookmarked BOOLEAN DEFAULT FALSE,
    solved_at TIMESTAMP,
    UNIQUE (user_id, problem_id)
);

CREATE INDEX IF NOT EXISTS idx_users_problems_user_id ON users_problems(user_id);
CREATE INDEX IF NOT EXISTS idx_users_problems_problem_id ON users_problems(problem_id);

-- +goose Down
DROP TABLE IF EXISTS users_problems;
DROP INDEX IF EXISTS idx_users_problems_user_id;
DROP INDEX IF EXISTS idx_users_problems_problem_id;