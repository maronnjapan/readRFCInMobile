CREATE TABLE choice_answers (
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  question_id TEXT NOT NULL,
  answer INTEGER NOT NULL CHECK (answer >= 0),
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);
