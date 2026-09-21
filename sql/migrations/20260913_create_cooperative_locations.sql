CREATE TABLE IF NOT EXISTS cooperative_locations (
  id BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  c_code VARCHAR(50) NOT NULL,
  district VARCHAR(100) NULL,
  address_text VARCHAR(500) NULL,
  latitude DECIMAL(10,7) NOT NULL,
  longitude DECIMAL(10,7) NOT NULL,
  google_maps_url VARCHAR(2048) NULL,
  website_url VARCHAR(2048) NULL,
  is_verified TINYINT(1) NOT NULL DEFAULT 0,
  is_public TINYINT(1) NOT NULL DEFAULT 0,
  verified_at DATETIME NULL,
  updated_by VARCHAR(150) NULL,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (id),
  UNIQUE KEY uq_cooperative_locations_code (c_code),
  KEY idx_cooperative_locations_public (is_public, is_verified)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
