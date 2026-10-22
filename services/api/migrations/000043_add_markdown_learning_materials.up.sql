ALTER TABLE pattern_learning_materials
    ADD COLUMN content_md TEXT NOT NULL DEFAULT '';

COMMENT ON COLUMN pattern_learning_materials.content_md IS
    'Optional full Markdown article. Empty content keeps the legacy structured material.';
