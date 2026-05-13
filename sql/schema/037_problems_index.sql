-- In preparation for searching problems by title or UUID, we add an index on those columns. This should speed up queries that filter by id or title, which are common when looking up problems.
-- +goose Up
CREATE INDEX IF NOT EXISTS idx_problems_id ON problems (id);
CREATE INDEX IF NOT EXISTS idx_problems_title ON problems (title);

-- +goose Down
DROP INDEX IF EXISTS idx_problems_id;
DROP INDEX IF EXISTS idx_problems_title;