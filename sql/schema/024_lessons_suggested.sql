-- +goose Up
ALTER TABLE lessons
ADD COLUMN suggested BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE lessons
DROP COLUMN suggested;