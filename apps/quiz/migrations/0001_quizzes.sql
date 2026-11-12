CREATE TABLE question_sets (
  id TEXT PRIMARY KEY,
  logical_id TEXT NOT NULL,
  title TEXT NOT NULL,
  spec_id TEXT NOT NULL,
  revision_json TEXT NOT NULL,
  public_json TEXT NOT NULL,
  solutions_json TEXT NOT NULL,
  materials_json TEXT NOT NULL,
  pr_json TEXT,
  check_id INTEGER,
  comment_id INTEGER,
  pr_sync_needed INTEGER NOT NULL DEFAULT 0,
  created_at INTEGER NOT NULL
);
CREATE INDEX question_sets_spec ON question_sets(spec_id, created_at);
CREATE TABLE attempts (
  id TEXT PRIMARY KEY,
  set_id TEXT NOT NULL REFERENCES question_sets(id),
  owner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'answering',
  answers_json TEXT,
  results_json TEXT,
  grading_json TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE INDEX attempts_owner ON attempts(owner, set_id, created_at);
CREATE TABLE ai_jobs (
  id TEXT PRIMARY KEY,
  operation TEXT NOT NULL CHECK(operation IN ('questions.generate', 'answers.grade')),
  target_id TEXT NOT NULL,
  owner TEXT NOT NULL,
  status TEXT NOT NULL DEFAULT 'queued',
  profile TEXT NOT NULL,
  input_json TEXT,
  context_json TEXT,
  output_json TEXT,
  error TEXT,
  created_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL
);
CREATE UNIQUE INDEX ai_jobs_active ON ai_jobs(operation, target_id) WHERE status IN ('queued', 'dispatching', 'submitted');
CREATE INDEX ai_jobs_pending ON ai_jobs(status, updated_at);
CREATE TABLE grading_history (
  job_id TEXT PRIMARY KEY REFERENCES ai_jobs(id),
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  result_json TEXT NOT NULL,
  configuration_json TEXT NOT NULL,
  created_at INTEGER NOT NULL
);
