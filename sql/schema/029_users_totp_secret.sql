-- +goose Up
ALTER TABLE users ADD COLUMN totp_secret VARCHAR(255) NULL;

-- +goose Down
ALTER TABLE users DROP COLUMN totp_secret;