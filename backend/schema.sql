CREATE TABLE IF NOT EXISTS requests (
 id TEXT PRIMARY KEY,
 payload_hash TEXT NOT NULL,
 payload TEXT NOT NULL,
 state TEXT NOT NULL CHECK(state IN ('processing','email_accepted','complete','needs_review')),
 email_id TEXT,
 notion_id TEXT,
 created_at TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS requests_state ON requests(state);
