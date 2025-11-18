-- +goose Up
-- null if the lesson is not a section starter, otherwise holds the section number, with only one possible section starter per section
ALTER TABLE lessons
    ADD COLUMN section_starter BOOL NOT NULL DEFAULT FALSE;

-- +goose Down
ALTER TABLE lessons
    DROP COLUMN section_starter;