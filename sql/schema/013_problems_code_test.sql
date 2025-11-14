-- +goose Up
ALTER TABLE problems
ADD COLUMN IF NOT EXISTS first_test uuid REFERENCES code_tests(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE problems
DROP COLUMN IF EXISTS first_test;