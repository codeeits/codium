-- +goose Up
ALTER TABLE lessons
ADD COLUMN language VARCHAR(255) NOT NULL DEFAULT 'en';

-- +goose Down
ALTER TABLE lessons
DROP COLUMN IF EXISTS language;