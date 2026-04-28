-- +goose Up
CREATE TABLE users_activities (
    id uuid PRIMARY KEY,
    user_id uuid NOT NULL,
    xp_gained int NOT NULL,
    activity_type varchar(255) NOT NULL,
    created_at timestamptz NOT NULL DEFAULT NOW(),
    updated_at timestamptz NOT NULL DEFAULT NOW(),
    FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
);

-- +goose Down
DROP TABLE users_activities;