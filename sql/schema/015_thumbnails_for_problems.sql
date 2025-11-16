-- +goose Up
ALTER TABLE problems
ADD COLUMN thumbnail_file_id uuid REFERENCES files(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE problems
DROP COLUMN thumbnail_file_id;