-- +goose Up
CREATE TABLE IF NOT EXISTS problems (
    id uuid PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT NOT NULL,
    -- tags is pretty much flags for problems
    tags INT NOT NULL,
    source VARCHAR(255),
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS problems;