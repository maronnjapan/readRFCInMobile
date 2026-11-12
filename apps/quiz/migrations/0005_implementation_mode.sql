ALTER TABLE attempts ADD COLUMN implementation_mode TEXT NOT NULL DEFAULT 'code' CHECK (implementation_mode IN ('code', 'reading'));
