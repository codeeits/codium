-- +goose Up
CREATE TABLE IF NOT EXISTS code_tests (
    id UUID PRIMARY KEY,
    problem_id UUID NOT NULL REFERENCES problems(id) ON DELETE CASCADE,
    -- at least one of txt_input or file_input must be provided
    txt_input TEXT,
    file_input UUID REFERENCES files(id) ON DELETE CASCADE,
    expected_output TEXT NOT NULL,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    next_test_id UUID REFERENCES code_tests(id) ON DELETE SET NULL,
    previous_test_id UUID REFERENCES code_tests(id) ON DELETE CASCADE,
    CONSTRAINT at_least_one_input CHECK (txt_input IS NOT NULL OR file_input IS NOT NULL)
);

-- +goose Down
DROP TABLE IF EXISTS code_tests;