ALTER TABLE applications
ADD COLUMN recruitment_task_status TEXT,
ADD COLUMN recruitment_task_score INTEGER,
ADD COLUMN recruitment_task_feedback TEXT;


COMMENT ON COLUMN applications.recruitment_task_status IS 'Status of recruitment task: task_sent, task_completed, or NULL';
COMMENT ON COLUMN applications.recruitment_task_score IS 'AI evaluation score for recruitment task (0-5)';
COMMENT ON COLUMN applications.recruitment_task_feedback IS 'AI feedback comment for recruitment task solution';


SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'applications'
  AND column_name LIKE 'recruitment_task_%'
ORDER BY column_name;