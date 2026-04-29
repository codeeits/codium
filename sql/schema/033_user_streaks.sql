-- +goose Up
ALTER TABLE users
ADD COLUMN current_streak INTEGER NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE users
DROP COLUMN current_streak;