-- +goose Up
CREATE TABLE IF NOT EXISTS solutions_tests (
    id uuid PRIMARY KEY,
    code_test_id uuid REFERENCES code_tests(id) ON DELETE CASCADE,
    run_time_ms INTEGER NOT NULL,
    memory_usage_kb INTEGER NOT NULL,
    success BOOLEAN NOT NULL,
    error_message TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    next_solutions_test_id uuid REFERENCES solutions_tests(id) ON DELETE SET NULL,
    prev_solutions_test_id uuid REFERENCES solutions_tests(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_solutions_tests_code_test_id ON solutions_tests(code_test_id);

-- +goose Down
DROP TABLE IF EXISTS solutions_tests;
DROP INDEX IF EXISTS idx_solutions_tests_code_test_id;