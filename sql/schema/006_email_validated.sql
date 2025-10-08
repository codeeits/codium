-- +goose Up
ALTER TABLE users
ADD COLUMN email_validated BOOLEAN NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE users
DROP COLUMN email_validated;