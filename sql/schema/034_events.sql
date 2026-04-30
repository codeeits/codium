-- heyo js a quick explanation, we're doing an events table to simulate a quasi websocket system
-- when a user is supposed to be sent an event we'll insert a row into this table that will wait for the user to send any request
-- and then add the json payload of the event in a header of the response, and then delete the event from the table
-- +goose Up
CREATE TABLE IF NOT EXISTS events (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    type VARCHAR(255) NOT NULL,
    payload JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- +goose Down
DROP TABLE IF EXISTS events;