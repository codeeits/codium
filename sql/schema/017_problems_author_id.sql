-- +goose Up
ALTER TABLE problems
    ADD COLUMN author_id uuid NOT NULL REFERENCES users(id) ON DELETE CASCADE ;

-- +goose Down
ALTER TABLE problems
    DROP COLUMN author_id;