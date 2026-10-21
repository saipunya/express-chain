ALTER TABLE chamra_documents ADD COLUMN is_pinned TINYINT(1) NOT NULL DEFAULT 0;
ALTER TABLE chamra_documents ADD COLUMN is_announcement TINYINT(1) NOT NULL DEFAULT 0;
