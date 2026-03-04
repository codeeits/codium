-- +goose Up
ALTER TABLE lessons
ADD COLUMN thumbnail_id UUID NULL,
ADD CONSTRAINT fk_lessons_thumbnail_id FOREIGN KEY (thumbnail_id) REFERENCES files(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE lessons
DROP CONSTRAINT fk_lessons_thumbnail_id,
DROP COLUMN thumbnail_id;