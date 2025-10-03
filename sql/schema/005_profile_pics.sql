-- +goose Up
ALTER TABLE users
ADD COLUMN IF NOT EXISTS profile_pic_id uuid REFERENCES files(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE users
DROP COLUMN IF EXISTS profile_pic_id;