-- +goose Up
alter table users
    add column permissions smallint not null default 0;

-- +goose Down
alter table users
    drop column permissions;