-- +goose Up
ALTER TABLE problems
ADD COLUMN suggested BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE problems
DROP COLUMN suggested;