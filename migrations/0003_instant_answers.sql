CREATE TABLE instant_answers (
  attempt_id TEXT NOT NULL REFERENCES attempts(id),
  question_id TEXT NOT NULL,
  answer_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  PRIMARY KEY (attempt_id, question_id)
);
INSERT INTO instant_answers (attempt_id, question_id, answer_json, result_json, created_at)
  SELECT attempt_id, question_id, CAST(answer AS TEXT), result_json, created_at FROM choice_answers;
