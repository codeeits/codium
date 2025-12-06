-- +goose Up
CREATE TABLE IF NOT EXISTS solutions (
    id uuid PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    first_solution_test_id uuid REFERENCES solutions_tests(id) ON DELETE SET NULL,
    sent_code TEXT NOT NULL,
    language TEXT NOT NULL,
    tests_passed INTEGER DEFAULT 0,
    total_tests INTEGER DEFAULT 0,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_solutions_user_id ON solutions(user_id);
CREATE INDEX IF NOT EXISTS idx_solutions_problem_id ON solutions(problem_id);

-- +goose Down
DROP TABLE IF EXISTS solutions;
DROP INDEX IF EXISTS idx_solutions_user_id;
DROP INDEX IF EXISTS idx_solutions_problem_id;