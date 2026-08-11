# ระบบติดตามหนี้สหกรณ์ (`/debt`)

โมดูลภาษาไทยสำหรับติดตามหนี้ กพส. และหนี้สมาชิก โดยใช้ `active_coop.c_id` เป็นรหัสสหกรณ์กลาง และใช้ session login เดิมของ CoopChain

## Routes

- `/debt/dashboard` ภาพรวมและงานเร่งด่วน
- `/debt/login` ทางเข้าเจ้าหน้าที่จังหวัด/สหกรณ์ (ใช้บัญชี `member3` เดิม)
- `/debt/cdf` Dashboard และ Drill-down หนี้ กพส.
- `/debt/member-debt` Dashboard และ Drill-down หนี้สมาชิก
- `/debt/tasks` คิวงานที่ต้องดำเนินการ
- `/debt/member-debt/imports` หน้าสถานะงาน Import (ยังไม่เปิดการเขียนไฟล์ใน Milestone 1)
- `/debt/member/login` ทางเข้า Member Portal
- `/debt/member/overview` สมาชิกดูข้อมูลหนี้ของตนเอง

## ติดตั้งฐานข้อมูล Demo ใหม่

สำรองฐานข้อมูลก่อนเสมอ สคริปต์ติดตั้งจะตรวจว่ามี `active_coop` และจะหยุดทันทีถ้าพบ object `cdf_*` หรือ `md_*` อยู่แล้ว

```bash
node scripts/installDebtDemo.js /absolute/path/coop_monitoring_codex_handoff.zip
node scripts/smokeDebt.js
```

ลำดับ SQL ที่ installer ใช้:

1. `10_cdf_module_active_coop_2569.sql`
2. `20_member_debt_demo_2coops.sql`
3. `database/migrations/20260809_create_md_member_portal_users.sql`

ห้ามรัน `01_active_coop_reference.sql` เมื่อฐานเดิมมี `active_coop` แล้ว และห้ามใช้ `cdf_debt_monitoring_2569.sql` ฉบับยกเลิก

## สิทธิ์

- ผู้ใช้จังหวัด: เห็นข้อมูลทุกสหกรณ์
- ผู้ใช้สหกรณ์/กลุ่ม: ระบบจับคู่ `member3.m_org` กับ `active_coop.c_code` หรือ `active_coop.c_name` และจำกัด query เฉพาะสหกรณ์นั้น
- ถ้าจับคู่สังกัดไม่ได้ ระบบจะไม่เปิดข้อมูลรายสหกรณ์ให้โดยอัตโนมัติ
- สมาชิกใช้ session แยกและทุก query บังคับ `member_id` จาก session ไม่รับ `member_id` จาก URL

## บัญชีสมาชิก Demo

- `demo-bh-0001` / `Demo@2569`
- `demo-nb-0001` / `Demo@2569`

ข้อมูลและบัญชีชุดนี้ใช้เพื่อสาธิตเท่านั้น หน้า Login จะไม่แสดงรหัส Demo เมื่อ `NODE_ENV=production`

## ทดสอบ

```bash
npm test
node scripts/smokeDebt.js
```

กฎความเสี่ยงรวมไว้ที่ `config/debtRisk.js`; ตัวเลข Dashboard อ่านจาก database views ตามชุด SQL ที่แนบ
