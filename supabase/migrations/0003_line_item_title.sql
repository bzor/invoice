-- Line items get an optional short title; `description` becomes the detail line
-- shown small underneath. Existing rows keep their text in `description`.
alter table line_items add column if not exists title text not null default '';
