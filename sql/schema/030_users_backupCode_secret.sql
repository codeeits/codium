-- +goose Up
-- +goose StatementBegin
ALTER TABLE users ADD COLUMN backupCodeSecret VARCHAR(255) NULL;
-- +goose StatementEnd

-- +goose Down
ALTER TABLE users DROP COLUMN backupCodeSecret;