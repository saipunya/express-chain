-- password_encrypted is AES-256-GCM encrypted by the application. Configure
-- INSTITUTION_CREDENTIAL_SECRET (or keep SESSION_SECRET stable) so admins can
-- continue to reveal credentials after a deployment/restart.
CREATE TABLE IF NOT EXISTS institution_credentials (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  member_id INT NOT NULL,
  c_code VARCHAR(50) NOT NULL,
  password_encrypted TEXT NOT NULL,
  created_by INT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_institution_credentials_member (member_id),
  UNIQUE KEY uq_institution_credentials_code (c_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
