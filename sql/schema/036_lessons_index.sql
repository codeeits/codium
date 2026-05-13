-- in preparation for searching lessons by title or UUID, we add an index on those columns. This should speed up queries that filter by id or title, which are common when looking up lessons.
-- +goose Up
CREATE INDEX IF NOT EXISTS idx_lessons_id ON lessons (id);
CREATE INDEX IF NOT EXISTS idx_lessons_title ON lessons (title);

-- +goose Down
DROP INDEX IF EXISTS idx_lessons_id;
DROP INDEX IF EXISTS idx_lessons_title;