-- +goose Up
ALTER TABLE users
ADD COLUMN title VARCHAR(100);

-- +goose Down
ALTER TABLE users
DROP COLUMN title;