-- +goose Up
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS next_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL;
ALTER TABLE lessons
ADD COLUMN IF NOT EXISTS prev_lesson_id uuid REFERENCES lessons(id) ON DELETE SET NULL;

-- +goose Down
ALTER TABLE lessons
DROP COLUMN IF EXISTS next_lesson_id;
ALTER TABLE lessons
DROP COLUMN IF EXISTS prev_lesson_id;