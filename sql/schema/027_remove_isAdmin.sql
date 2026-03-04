-- +goose Up
ALTER TABLE "users" DROP COLUMN "is_admin";

-- +goose Down
ALTER TABLE "users" ADD COLUMN "is_admin" BOOLEAN NOT NULL DEFAULT FALSE;