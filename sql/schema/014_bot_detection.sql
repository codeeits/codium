-- Description: Email handlers don't care for the "." in email addresses, allowing a bad actor to create
-- multiple accounts with the same email but different placements of "." characters. This migration
-- adds a new column to store a "cured" version of the email address with all "." characters removed.
-- +goose Up
ALTER TABLE users
ADD COLUMN cured_email TEXT UNIQUE DEFAULT NULL;

-- +goose Down
ALTER TABLE users
DROP COLUMN cured_email;