# ฟีเจอร์รายงานการเบิกเงินงบประมาณ (Budget Disbursal Reporting)

## ภาพรวม
ฟีเจอร์นี้ช่วยให้คุณสามารถบันทึกและรายงานการเบิกเงินงบประมาณของโครงการในแต่ละเดือน โดยจะแสดงการเปรียบเทียบระหว่างเงินที่เบิกไปกับงบประมาณที่ได้รับการจัดสรร

## ขั้นตอนการติดตั้ง

### 1. สร้างตาราง Database

รันคำสั่ง SQL ต่อไปนี้เพื่อสร้างตาราง `plan_budget_disbursal`:

```sql
CREATE TABLE IF NOT EXISTS plan_budget_disbursal (
  id INT AUTO_INCREMENT PRIMARY KEY,
  pro_id INT NOT NULL,
  disbursal_date DATE NOT NULL,
  amount DECIMAL(12, 2) NOT NULL,
  description TEXT,
  disbursal_type VARCHAR(50),
  reference_no VARCHAR(100),
  created_by VARCHAR(100),
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_by VARCHAR(100),
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  
  FOREIGN KEY (pro_id) REFERENCES plan_project(pro_id) ON DELETE CASCADE,
  INDEX idx_project_date (pro_id, disbursal_date),
  INDEX idx_year_month (disbursal_date)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
```

หรือใช้ไฟล์ migration:
```bash
mysql -u [username] -p [database] < migrations/001_create_plan_budget_disbursal.sql
```

### 2. ตรวจสอบไฟล์ที่เพิ่มเข้ามา

ฟีเจอร์นี้เพิ่มไฟล์ดังต่อไปนี้:

**Models:**
- `models/planBudgetDisbursal.js` - ฟังก์ชันสำหรับจัดการข้อมูลการเบิก

**Controllers:**
- `controllers/planBudgetDisbursalController.js` - ตัวจัดการการเบิกเงิน

**Views:**
- `views/plan_project/budget_disbursal.ejs` - หน้าแสดงรายงานการเบิก

**Routes:**
- อัปเดท `routes/planProjectRoutes.js` - เพิ่มเส้นทางใหม่

## วิธีใช้งาน

### การบันทึกการเบิกเงิน

1. ไปยังหน้าสรุปโครงการ (Project Summary)
2. คลิกที่ปุ่ม "การเบิกเงิน" (Cash Flow)
3. คลิก "บันทึกการเบิก" เพื่อเปิด Modal
4. กรอกข้อมูล:
   - **วันที่เบิก**: วันที่เบิกเงิน
   - **จำนวนเงิน**: จำนวนเงินที่เบิก (บาท)
   - **หมวดหมู่**: ประเภทของการเบิก (กิจกรรม, วัสดุ, ค่าแรง, อุปกรณ์, อื่นๆ)
   - **รายละเอียด**: คำอธิบายรายการเบิก
   - **เลขอ้างอิง**: หมายเลขใบเสร็จ/PO (ถ้ามี)
5. คลิก "บันทึก"

### การดูรายงานการเบิก

1. ไปที่หน้า Budget Disbursal
2. ระบบจะแสดง:
   - **สรุปงบประมาณ**: งบประมาณทั้งหมด เบิกไปทั้งสิ้น คงเหลือ จำนวนครั้ง
   - **สรุปตามเดือน**: แสดงการเบิกแต่ละเดือน พร้อมคำนวณยอดสะสมและคงเหลือ
   - **รายละเอียด**: รายการเบิกทั้งหมดแบบเรียงลำดับ

### การส่งออก CSV

1. ในหน้า Budget Disbursal ให้คลิก "ส่งออก CSV"
2. ระบบจะดาวน์โหลดไฟล์ CSV ที่มีรายละเอียดการเบิก

### การลบการเบิก

1. ในหน้า Budget Disbursal ค้นหารายการที่ต้องการลบ
2. คลิกปุ่ม "ลบ" (ไอคอน ถังขยะ)
3. ยืนยันการลบ

## ข้อมูลที่แสดง

### ในหน้าสรุปโครงการ (Summary)
- สรุปการเบิกเงินรายเดือน
- แสดงเงินที่เบิกในเดือนนั้น เงินสะสม และคงเหลือ
- ลิงค์ไปยังหน้ารายงานการเบิกรายละเอียด

### ในหน้ารายงานการเบิก (Budget Disbursal)
- **สรุป 4 ช่อง**:
  - งบประมาณทั้งหมด
  - รวมเบิกไปทั้งสิ้น
  - คงเหลือ
  - จำนวนครั้งการเบิก

- **ตารางสรุปตามเดือน**: แสดงการเบิกในแต่ละเดือน พร้อมแถบแสดงความก้าวหน้า
  - สีเขียว (0-80%): ใช้งบประมาณไปไม่มากนัก
  - สีเหลือง (80-100%): ใช้งบประมาณไปเกือบหมด
  - สีแดง (>100%): เกินงบประมาณ

- **ตารางรายละเอียด**: รายการเบิกทั้งหมดแบบละเอียด

## หมวดหมู่การเบิก

- **กิจกรรม** (Activity): การเบิกค่าใช้สอยกิจกรรม
- **วัสดุ** (Material): การเบิกค่าวัสดุ/สินค้า
- **ค่าแรง** (Labor): การเบิกค่าจ้างแรงงาน
- **อุปกรณ์** (Equipment): การเบิกอุปกรณ์/เครื่องมือ
- **อื่นๆ** (Other): การเบิกอื่นๆ

## API Endpoints

### GET `/plan_project/budget_disbursal`
ดึงหน้ารายงานการเบิก

Query Parameters:
- `pro_code`: รหัสโครงการ (บังคับ)

### POST `/plan_project/budget_disbursal`
บันทึกการเบิกเงินใหม่

Body Parameters:
```json
{
  "pro_code": "PRJ001",
  "disbursal_date": "2025-02-06",
  "amount": "5000",
  "description": "จ่ายค่าวัสดุการสอน",
  "disbursal_type": "material",
  "reference_no": "INV-2025-001"
}
```

### DELETE `/plan_project/budget_disbursal/:id`
ลบการเบิกเงิน

Query Parameters:
- `pro_code`: รหัสโครงการ (บังคับ)

### GET `/plan_project/budget_disbursal/export`
ส่งออกรายงาน CSV

Query Parameters:
- `pro_code`: รหัสโครงการ (บังคับ)

## ฟังก์ชัน Model

### `PlanBudgetDisbursal.getByProjectId(projectId)`
ดึงข้อมูลการเบิกทั้งหมดของโครงการ

### `PlanBudgetDisbursal.getMonthlySummary(projectId)`
ดึงข้อมูลการเบิกแบบสรุปรายเดือน

### `PlanBudgetDisbursal.getMonthlyWithBalance(projectId, totalBudget)`
ดึงข้อมูลการเบิกรายเดือน พร้อมคำนวณยอดสะสมและคงเหลือ

### `PlanBudgetDisbursal.create(data)`
บันทึกการเบิกเงินใหม่

### `PlanBudgetDisbursal.update(id, data)`
อัปเดตข้อมูลการเบิก

### `PlanBudgetDisbursal.delete(id)`
ลบการเบิก

## หมายเหตุ

- การเบิกเงินจะแสดงในลำดับย้อนเวลา (ใหม่สุดก่อน)
- สามารถ Filter ได้ตามเดือนที่ต้องการ
- ระบบคำนวณยอดสะสมโดยอัตโนมัติตามลำดับเวลา
- ถ้าเบิกเกินงบประมาณจะแสดงข้อความเตือน (สีแดง)
- สามารถดาวน์โหลดข้อมูลเป็น CSV เพื่อวิเคราะห์เพิ่มเติมใน Excel ได้
