-- Apply before deploying the authentication plugin/routes.
-- Store only a digest; retain revocations until the original JWT expires.
CREATE TABLE IF NOT EXISTS revoked_admin_tokens (
  token_hash CHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL PRIMARY KEY,
  expires_at DATETIME NOT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_revoked_admin_tokens_expiry (expires_at)
) ENGINE=InnoDB;
