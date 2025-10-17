-- +goose Up
ALTER TABLE lessons
ADD COLUMN flags INT NOT NULL DEFAULT 0;

-- +goose Down
ALTER TABLE lessons
DROP COLUMN flags;