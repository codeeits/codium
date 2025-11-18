-- +goose Up
ALTER TABLE problems
    ADD COLUMN author_id uuid DEFAULT NULL;

-- +goose Down
ALTER TABLE problems
    DROP COLUMN author_id;