-- +goose Up
ALTER TABLE code_tests
    DROP COLUMN problem_id;

-- +goose Down
ALTER TABLE code_tests
    ADD COLUMN problem_id uuid REFERENCES problems(id) ON DELETE SET NULL;