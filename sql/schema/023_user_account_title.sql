-- +goose Up
ALTER TABLE users
ADD COLUMN title VARCHAR(100) NOT NULL DEFAULT 'basic';

-- +goose Down
ALTER TABLE users
DROP COLUMN title;