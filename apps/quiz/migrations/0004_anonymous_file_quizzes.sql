ALTER TABLE attempts ADD COLUMN anonymous_owner TEXT;
CREATE INDEX attempts_anonymous ON attempts(anonymous_owner, set_id, created_at);
