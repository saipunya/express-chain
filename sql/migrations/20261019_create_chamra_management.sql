CREATE TABLE IF NOT EXISTS chamra_indicators (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 fiscal_year SMALLINT UNSIGNED NOT NULL,
 title VARCHAR(500) NOT NULL,
 target_value DECIMAL(12,2) NOT NULL,
 actual_value DECIMAL(12,2) NOT NULL DEFAULT 0,
 unit VARCHAR(50) NOT NULL DEFAULT 'แห่ง',
 note TEXT NULL,
 updated_by VARCHAR(150) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 KEY idx_indicator_year (fiscal_year)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS chamra_targets (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 fiscal_year SMALLINT UNSIGNED NOT NULL,
 c_code VARCHAR(50) NOT NULL,
 target_type VARCHAR(30) NOT NULL,
 due_date DATE NULL,
 responsible VARCHAR(150) NOT NULL DEFAULT '',
 note TEXT NULL,
 updated_by VARCHAR(150) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_chamra_target (fiscal_year, c_code, target_type)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
CREATE TABLE IF NOT EXISTS chamra_meetings (
 id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
 fiscal_year SMALLINT UNSIGNED NOT NULL,
 meeting_no SMALLINT UNSIGNED NOT NULL,
 meeting_date DATE NOT NULL,
 title VARCHAR(500) NOT NULL,
 note TEXT NULL,
 report_path VARCHAR(500) NULL,
 updated_by VARCHAR(150) NOT NULL,
 created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
 updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
 UNIQUE KEY uq_chamra_meeting (fiscal_year, meeting_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Preserve the existing dashboard data for fiscal year 2569.
INSERT INTO chamra_indicators (fiscal_year,title,target_value,actual_value,unit,note,updated_by) SELECT 2569,'1.สหกรณ์และกลุ่มเกษตรกรที่อยู่ระหว่างการชำระบัญชี สามารถยกระดับให้สูงขึ้น ร้อยละ 100',30,13,'แห่ง','ผลเดิม สหกรณ์ 7 แห่ง กลุ่มเกษตรกร 6 แห่ง','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_indicators WHERE fiscal_year=2569 AND title='1.สหกรณ์และกลุ่มเกษตรกรที่อยู่ระหว่างการชำระบัญชี สามารถยกระดับให้สูงขึ้น ร้อยละ 100');
INSERT INTO chamra_indicators (fiscal_year,title,target_value,actual_value,unit,note,updated_by) SELECT 2569,'2.สหกรณ์และกลุ่มเกษตรกรที่อยู่ระหว่างชำระบัญชี ถอนชื่อได้ไม่น้อยกว่าร้อยละ 25',7,5,'แห่ง','ไม่รวมสหกรณ์/กลุ่มเกษตรกรที่มีคดี','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_indicators WHERE fiscal_year=2569 AND title='2.สหกรณ์และกลุ่มเกษตรกรที่อยู่ระหว่างชำระบัญชี ถอนชื่อได้ไม่น้อยกว่าร้อยละ 25');
INSERT INTO chamra_indicators (fiscal_year,title,target_value,actual_value,unit,note,updated_by) SELECT 2569,'3.สหกรณ์/กลุ่มเกษตรกรที่อยู่ระหว่างขั้นที่ 6 ดำเนินคดี ให้มีความเคลื่อนไหว',5,5,'แห่ง','','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_indicators WHERE fiscal_year=2569 AND title='3.สหกรณ์/กลุ่มเกษตรกรที่อยู่ระหว่างขั้นที่ 6 ดำเนินคดี ให้มีความเคลื่อนไหว');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์บริการและจำหน่ายสินค้าอุปโภค-บริโภคจังหวัดชัยภูมิ','สหกรณ์บริการและจำหน่ายสินค้าอุปโภค-บริโภคจังหวัดชัยภูมิ จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์การเกษตรผู้ปลูกพริกจัตุรัส','สหกรณ์การเกษตรผู้ปลูกพริกจัตุรัส จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรทำไร่บ้านชวน','กลุ่มเกษตรกรทำไร่บ้านชวน จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรทำนาวังชมภู','กลุ่มเกษตรกรทำนาวังชมภู จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรทำนาบ้านแท่น','กลุ่มเกษตรกรทำนาบ้านแท่น จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรทำนาท่าใหญ่','กลุ่มเกษตรกรทำนาท่าใหญ่ จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'withdrawal','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรเลี้ยงสัตว์หนองตูม','กลุ่มเกษตรกรเลี้ยงสัตว์หนองตูม จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='withdrawal');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'litigation','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์ผู้เลี้ยงสุกรภักดีบูรพา','สหกรณ์ผู้เลี้ยงสุกรภักดีบูรพา จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='litigation');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'litigation','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์ปศุสัตว์ชัยภูมิ','สหกรณ์ปศุสัตว์ชัยภูมิ จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='litigation');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'litigation','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์การเกษตรเนินสง่า','สหกรณ์การเกษตรเนินสง่า จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='litigation');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'litigation','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('สหกรณ์การเกษตรปฏิรูปที่ดินบ้านเป้าหนองโพนงาม','สหกรณ์การเกษตรปฏิรูปที่ดินบ้านเป้าหนองโพนงาม จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='litigation');
INSERT INTO chamra_targets (fiscal_year,c_code,target_type,updated_by) SELECT 2569,ac.c_code,'litigation','migration' FROM active_coop ac WHERE TRIM(ac.c_name) IN ('กลุ่มเกษตรกรเลี้ยงสัตว์หนองบัวบาน','กลุ่มเกษตรกรเลี้ยงสัตว์หนองบัวบาน จำกัด') AND NOT EXISTS (SELECT 1 FROM chamra_targets t WHERE t.fiscal_year=2569 AND t.c_code=ac.c_code AND t.target_type='litigation');
INSERT INTO chamra_meetings (fiscal_year,meeting_no,meeting_date,title,report_path,updated_by) SELECT 2569,1,'2025-12-26','ประชุมติดตามความก้าวหน้า','/images/meeting/meeting1.pdf','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_meetings WHERE fiscal_year=2569 AND meeting_no=1);
INSERT INTO chamra_meetings (fiscal_year,meeting_no,meeting_date,title,report_path,updated_by) SELECT 2569,2,'2026-03-17','ประชุมติดตามความก้าวหน้า','/file/meeting22569.pdf','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_meetings WHERE fiscal_year=2569 AND meeting_no=2);
INSERT INTO chamra_meetings (fiscal_year,meeting_no,meeting_date,title,report_path,updated_by) SELECT 2569,3,'2026-06-23','ประชุมติดตามความก้าวหน้า','/file/meeting32569.pdf','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_meetings WHERE fiscal_year=2569 AND meeting_no=3);
INSERT INTO chamra_meetings (fiscal_year,meeting_no,meeting_date,title,report_path,updated_by) SELECT 2569,4,'2026-08-05','ประชุมติดตามความก้าวหน้า','/images/meeting/meeting4_2569.pdf','migration' WHERE NOT EXISTS (SELECT 1 FROM chamra_meetings WHERE fiscal_year=2569 AND meeting_no=4);
