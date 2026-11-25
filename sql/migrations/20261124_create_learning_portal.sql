CREATE TABLE IF NOT EXISTS learning_learners (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  username VARCHAR(60) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  password_hash CHAR(60) CHARACTER SET ascii NOT NULL,
  full_name VARCHAR(150) NOT NULL,
  cooperative_id BIGINT UNSIGNED NOT NULL,
  cooperative_name VARCHAR(255) NOT NULL,
  member_number VARCHAR(50) NOT NULL,
  approved_member_number VARCHAR(50) DEFAULT NULL,
  status ENUM('pending', 'active', 'rejected') NOT NULL DEFAULT 'pending',
  reviewed_by BIGINT UNSIGNED DEFAULT NULL,
  reviewed_at DATETIME DEFAULT NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_learning_learner_username (username),
  UNIQUE KEY uq_learning_approved_member (cooperative_id, approved_member_number),
  KEY idx_learning_learner_status (status, id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_courses (
  id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  draft JSON NOT NULL,
  revision INT UNSIGNED NOT NULL DEFAULT 1,
  published_revision INT UNSIGNED DEFAULT NULL,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE IF NOT EXISTS learning_course_versions (
  course_id CHAR(36) CHARACTER SET ascii COLLATE ascii_bin NOT NULL,
  revision INT UNSIGNED NOT NULL,
  content JSON NOT NULL,
  PRIMARY KEY (course_id, revision),
  CONSTRAINT fk_learning_version_course FOREIGN KEY (course_id) REFERENCES learning_courses (id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
