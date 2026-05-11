-- +goose Up
ALTER TABLE problems
    ADD COLUMN total_tests INTEGER NOT NULL DEFAULT 0;

ALTER TABLE solutions
    DROP COLUMN total_tests;

-- +goose Down
ALTER TABLE problems
    DROP COLUMN total_tests;

ALTER TABLE solutions
    ADD COLUMN total_tests INTEGER NOT NULL DEFAULT 0;