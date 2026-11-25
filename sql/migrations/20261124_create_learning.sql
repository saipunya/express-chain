CREATE TABLE IF NOT EXISTS learning_enrollments (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  user_id BIGINT UNSIGNED NOT NULL,
  course_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  enrolled_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  certificate_code CHAR(36) CHARACTER SET ascii COLLATE ascii_bin DEFAULT NULL,
  certificate_name VARCHAR(255) DEFAULT NULL,
  certificate_course VARCHAR(255) DEFAULT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_learning_enrollment (user_id, course_id),
  UNIQUE KEY uq_learning_certificate (certificate_code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_lesson_progress (
  enrollment_id INT UNSIGNED NOT NULL,
  lesson_id VARCHAR(64) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  elapsed_ms INT UNSIGNED NOT NULL DEFAULT 0,
  timer_key CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  last_ping_ms BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (enrollment_id, lesson_id),
  CONSTRAINT fk_learning_lesson_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES learning_enrollments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_attempts (
  id INT UNSIGNED NOT NULL AUTO_INCREMENT,
  enrollment_id INT UNSIGNED NOT NULL,
  submission_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  kind ENUM('pre', 'post') NOT NULL,
  score SMALLINT UNSIGNED NOT NULL,
  total SMALLINT UNSIGNED NOT NULL,
  passed BOOLEAN DEFAULT NULL,
  submitted_ms BIGINT UNSIGNED NOT NULL,
  PRIMARY KEY (id),
  UNIQUE KEY uq_learning_submission (enrollment_id, submission_id),
  KEY idx_learning_attempt_kind (enrollment_id, kind, id),
  CONSTRAINT fk_learning_attempt_enrollment FOREIGN KEY (enrollment_id)
    REFERENCES learning_enrollments (id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
