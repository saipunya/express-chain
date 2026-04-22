# Promotion Architecture Map

เอกสารนี้เป็นภาพย่อของระบบ `/promotion` เพื่อใช้เป็นโน้ตพัฒนาต่อแบบ flow-by-flow

## Scope Boundary (Important)

- เอกสารและงานพัฒนานี้ครอบคลุมเฉพาะระบบ `/promotion` เท่านั้น
- ถือว่า `/promotion` เป็น subsystem ที่แยกจากระบบหลัก
- หากจำเป็นต้องแก้ส่วนอื่นนอก `/promotion` ให้ขออนุมัติจากผู้ใช้ก่อนทุกครั้ง

## 1) Big Picture

```text
Client (play / kiosk / admin)
  -> routes/promotionRoutes.js
  -> controllers/promotionController.js | promotionAdminController.js
  -> models/promotionModel.js (facade)
     -> models/promotion/campaignModel.js
     -> models/promotion/prizeModel.js
     -> models/promotion/drawModel.js
  -> MySQL tables:
     promotion_codes, promotion_campaigns, promotion_prizes, promotion_draws
```

## 2) Route Map

### Public Web
- `GET /promotion` -> หน้า index
- `GET /promotion/play` -> หน้าเล่นสุ่ม (web)
- `GET /promotion/store/:storeCode/play` -> หน้าเล่นสุ่มแยกตาม store
- `POST /promotion/validate-code` -> validate โค้ดสำหรับหน้า web
- `POST /promotion/draw` -> ทำ draw (รองรับ HTML/JSON)
- `POST /promotion/claim` -> เคลมรางวัล
- `POST /promotion/decline` -> ปฏิเสธรางวัล
- `GET /promotion/result/:token` -> ดูผลจับรางวัล

### Kiosk API
- `GET /promotion/kiosk` -> หน้า kiosk แบบ single-screen
- `GET /promotion/store/:storeCode/kiosk` -> หน้า kiosk แยกตาม store
- `POST /promotion/kiosk/validate` -> validate โค้ด (JSON)
- `POST /promotion/kiosk/draw` -> draw (JSON)
- `POST /promotion/kiosk/claim` -> claim (JSON)
- `POST /promotion/kiosk/decline` -> decline (JSON)

### Admin
- `GET /promotion/admin/login`
- `POST /promotion/admin/login`
- `POST /promotion/admin/logout`
- `GET /promotion/admin`
- `GET /promotion/admin/campaigns`
- `GET /promotion/admin/prizes`
- `POST /promotion/admin/prizes`
- `POST /promotion/admin/prizes/:id/update`
- `POST /promotion/admin/prizes/:id/status`
- `POST /promotion/admin/prizes/:id/delete`
- `GET /promotion/admin/stores`
- `POST /promotion/admin/stores`
- `POST /promotion/admin/stores/:id/update`
- `POST /promotion/admin/stores/:id/status`
- `POST /promotion/admin/stores/:id/delete`
- `GET /promotion/admin/codes`
- `POST /promotion/admin/codes/generate`
- `GET /promotion/admin/draws`
- `GET /promotion/admin/users`
- `POST /promotion/admin/users`
- `POST /promotion/admin/users/:id/update`
- `POST /promotion/admin/users/:id/status`
- `POST /promotion/admin/users/:id/reset-password`

## 3) Core Flow: Web Draw

```text
play.ejs submit code
  -> fetch POST /promotion/draw (JSON)
  -> controller.draw()
       1) lock code row (FOR UPDATE)
       2) validate status + expiry + campaign
       3) fetch candidate prizes (active + stock, or type=other)
       4) weighted pick + lock prize row
       5) reserve prize stock (remaining--, reserved++)
       6) create draw record
       7) mark code status = drawn
       8) commit
  -> return draw_token + redirect_url
  -> client redirect /promotion/result/:token
```

## 4) Core Flow: Kiosk Draw

```text
kiosk.ejs
  -> POST /promotion/kiosk/validate
  -> POST /promotion/kiosk/draw
     (transaction pattern เดียวกับ web draw)
  -> แสดงผลใน stage-result
  -> ผู้ใช้เลือก claim หรือ decline
     -> POST /promotion/kiosk/claim | /decline
```

## 5) State Machine (Source of Truth)

### promotion_codes.status
```text
unused -> drawn -> claimed
unused -> drawn -> declined
unused -> expired
```

### promotion_draws.draw_status
```text
drawn -> claimed
drawn -> declined
```

### promotion_prizes inventory semantics
```text
reserve: remaining_qty - 1, reserved_qty + 1
claim:   reserved_qty - 1
decline: reserved_qty - 1, remaining_qty + 1
```

หมายเหตุ: `type = 'other'` ใช้แทนผล "ไม่ได้รางวัล" (no prize fallback)

## 5.1) Admin Auth + Tenant Scope

```text
promotion_admin_users
  role=super_admin -> เห็นข้อมูลทุก store
  role=coop_admin  -> เห็นเฉพาะ store_id ของตัวเอง

/promotion/admin/*
  -> middlewares/promotionAdminAuth.js
  -> req.promotionAdmin { role, store_id }
  -> controllers/promotionAdminController.js
      ส่ง scope เข้า model เพื่อกรองข้อมูลตาม store
```

## 6) Responsibility Map (จะพัฒนาต่อให้แตะที่ไหน)

### Route Wiring
- `routes/promotionRoutes.js`

### Business Logic
- `controllers/promotionController.js`
- `controllers/promotionAdminController.js`

### Data / Query Layer
- `models/promotionModel.js` (facade กลาง)
- `models/promotion/campaignModel.js`
- `models/promotion/prizeModel.js`
- `models/promotion/drawModel.js`

### View Layer
- `views/promotion/play.ejs` (web draw UX)
- `views/promotion/kiosk.ejs` (kiosk stage UX)
- `views/promotion/result.ejs` (result + claim/decline web)
- `views/promotion/admin/*` (reporting/admin pages)

## 7) Quick Extension Guide

### เพิ่มกติกา validate โค้ด
- เริ่มที่ `kioskValidate` และ `validateCode` ใน `controllers/promotionController.js`

### ปรับอัลกอริทึมสุ่ม/weight
- เริ่มที่ `draw` และ `kioskDraw` ใน `controllers/promotionController.js`
- ถ้าแตะ stock ด้วย ให้ปรับคู่กับ `models/promotion/prizeModel.js`

### เพิ่ม field ในผล draw
- เพิ่ม insert/select ใน `models/promotion/drawModel.js`
- ส่งต่อที่ controller แล้วแสดงใน `views/promotion/result.ejs` หรือ `kiosk.ejs`

### เพิ่ม dashboard/report
- เพิ่ม query helper ใน `models/promotionModel.js` หรือ `models/promotion/drawModel.js`
- แสดงผลที่ `controllers/promotionAdminController.js` และ `views/promotion/admin/*`

## 8) Suggested Next Refactor (Optional)

ถ้าจะทำระบบให้ดูแลง่ายขึ้นในระยะยาว:
- แยก transaction logic ซ้ำ (`draw/claim/decline` ของ web+kiosk) เป็น service layer กลาง
- ให้ JSON error ใช้ `code` เช่น `ERR_CODE_USED`, `ERR_CODE_EXPIRED` เพิ่มจาก `message`
- เพิ่ม integration tests สำหรับ transaction concurrency (`draw -> claim`, `draw -> decline`)

## 9) Change History (Operational Log)

ใช้ section นี้เก็บประวัติการปรับปรุงระบบแบบต่อเนื่อง เพื่อให้คน/agent ที่เข้ามาภายหลังอ่านต่อได้ทันที

### 9.1 Entry Template

```md
### YYYY-MM-DD HH:mm (ICT) - Short Title
- Goal:
- Changes:
- Files Touched:
  - path/to/file
  - path/to/another-file
- Behavior Impact:
- Open Issues:
- Next Step:
```

### 9.2 Recent Entries

### 2026-04-22 10:00 (ICT) - Stabilize draw response and error UX on play
- Goal: แก้ปัญหา `draw` สำเร็จแต่หน้า web ยังขึ้น error/ค้าง loading
- Changes:
  - ทำให้ `POST /promotion/draw` ตอบ JSON ชัดเจนเมื่อ request มาแบบ JSON
  - ปรับ `play.ejs` ให้โชว์ข้อความ error จาก server โดยตรง
  - ปรับ loading effect ให้แสดงเฉพาะกรณี draw สำเร็จ ลดอาการแว่บเหมือน refresh
- Files Touched:
  - `controllers/promotionController.js`
  - `views/promotion/play.ejs`
- Behavior Impact:
  - หน้า play ไม่เหมารวมว่า "ระบบขัดข้อง" สำหรับ business validation แล้ว
  - redirect ไป result จาก `draw_token/redirect_url` ทำงานคงที่ขึ้น
- Open Issues:
  - ควรเพิ่ม automated browser test สำหรับ draw error/success path
- Next Step:
  - ใส่ `error code` กลาง (`ERR_CODE_USED`, `ERR_CODE_EXPIRED`) ใน JSON response

### 2026-04-22 10:20 (ICT) - Fix inventory semantics with DB constraints
- Goal: แก้ root cause ที่ทำให้รางวัลจริงจอง stock ไม่ผ่านและ fallback ไป `No Prize`
- Changes:
  - เปลี่ยน reserve เป็น `remaining_qty - 1` และ `reserved_qty + 1`
  - ปรับ claim/decline ให้สอดคล้องกับ semantics ของ reserved stock
  - ปรับเงื่อนไข availability ให้ใช้ `remaining_qty > 0`
- Files Touched:
  - `models/promotion/prizeModel.js`
  - `models/promotionModel.js`
  - `controllers/promotionController.js`
- Behavior Impact:
  - draw มีโอกาสได้รางวัลจริงตาม weight ได้ถูกต้องขึ้น
  - ลดโอกาสชน check constraint ใน `promotion_prizes`
- Open Issues:
  - ควรมี migration/test ยืนยัน semantics ของ stock ในทุก flow
- Next Step:
  - เพิ่ม transaction/integration tests สำหรับ reserve/claim/decline

### 2026-04-22 10:35 (ICT) - Align kiosk draw effect with play UX
- Goal: ทำหน้า kiosk ให้มีลักษณะการสุ่มคล้ายหน้า play
- Changes:
  - เปลี่ยน spinner modal ใน kiosk เป็น overlay ควบคุมเอง
  - ทำ draw effect แบบ fetch-success -> spin -> reveal -> render result
  - เพิ่ม confetti/vibrate ในกรณีได้รางวัล
- Files Touched:
  - `views/promotion/kiosk.ejs`
- Behavior Impact:
  - ประสบการณ์ draw บน kiosk ใกล้เคียงหน้า play
  - ลดปัญหา modal state ค้างจาก Bootstrap transition
- Open Issues:
  - ควรตั้งค่าระยะเวลา effect เป็น config กลาง
- Next Step:
  - ดึง draw effect script เป็น shared helper ระหว่าง play/kiosk

### 2026-04-22 10:50 (ICT) - Add multi-tenant admin login for promotion
- Goal: รองรับ admin หลายสหกรณ์ (coop_admin) และ admin กลาง (super_admin)
- Changes:
  - เพิ่ม login/logout เฉพาะ `/promotion/admin`
  - เพิ่ม middleware auth ที่อ่าน session `promotionAdmin` และบังคับสิทธิ์
  - เพิ่มตาราง `promotion_admin_users` (SQL bootstrap) และ model/controller สำหรับ auth
  - เพิ่ม store-scope filtering ใน dashboard/campaigns/prizes/codes/draws
- Files Touched:
  - `routes/promotionRoutes.js`
  - `middlewares/promotionAdminAuth.js`
  - `controllers/promotionAdminAuthController.js`
  - `controllers/promotionAdminController.js`
  - `models/promotion/adminUserModel.js`
  - `models/promotionModel.js`
  - `models/promotion/campaignModel.js`
  - `models/promotion/prizeModel.js`
  - `models/promotion/drawModel.js`
  - `views/promotion/admin/*`
  - `docs/promotion-admin-auth.sql`
- Behavior Impact:
  - coop_admin เข้าถึงเฉพาะข้อมูลของ store ตัวเอง
  - super_admin มองเห็นและจัดการได้ทุก store
- Open Issues:
  - ควรเพิ่ม policy สำหรับ lock account / password rotation
- Next Step:
  - เพิ่มหน้าจัดการผู้ใช้งาน admin (CRUD + reset password) ใน `/promotion/admin`

### 2026-04-22 11:20 (ICT) - Add admin user management UI (super_admin only)
- Goal: ให้ super_admin จัดการบัญชีผู้ดูแลโปรโมชั่นได้เองจากหน้า admin
- Changes:
  - เพิ่มหน้า `/promotion/admin/users` พร้อมฟอร์มสร้างบัญชี, แก้ไข profile/role/store, เปิด-ปิดบัญชี และรีเซ็ตรหัสผ่าน
  - เพิ่ม action controller สำหรับ create/update/status/reset-password โดยบังคับสิทธิ์ super_admin
  - เพิ่ม model methods สำหรับ list/create/update/status/password ของ `promotion_admin_users`
  - เพิ่มลิงก์เมนู `Admin Users` ในหน้า admin อื่น ๆ (แสดงเฉพาะ super_admin)
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionAdminController.js`
  - `models/promotion/adminUserModel.js`
  - `views/promotion/admin/users.ejs`
  - `views/promotion/admin/dashboard.ejs`
  - `views/promotion/admin/campaigns.ejs`
  - `views/promotion/admin/prizes.ejs`
  - `views/promotion/admin/codes.ejs`
  - `views/promotion/admin/draws.ejs`
- Behavior Impact:
  - จัดการผู้ใช้งานแอดมินของแต่ละสหกรณ์ได้จาก UI โดยไม่ต้องยิง SQL โดยตรง
  - ลดความเสี่ยง scope ผิดพลาดด้วย validation role/store ในฝั่ง server
- Open Issues:
  - ยังไม่มี audit log ราย event (ใครแก้ user ไหน เมื่อไร)
- Next Step:
  - เพิ่มตาราง audit log สำหรับเหตุการณ์ admin user management

### 2026-04-22 11:45 (ICT) - Add prize creation flow per store/campaign
- Goal: ให้แอดมินเพิ่มของรางวัลของแต่ละแห่ง/สาขาได้จากหน้า admin
- Changes:
  - เพิ่ม endpoint `POST /promotion/admin/prizes` สำหรับสร้างของรางวัลใหม่
  - เพิ่ม validation ฝั่ง server (store/campaign scope, type, qty, weight)
  - เพิ่มฟอร์มในหน้า `Prizes` สำหรับเพิ่มของรางวัล พร้อมล็อก scope สำหรับ coop_admin
  - เพิ่ม model insert โดยตั้งค่าเริ่มต้น `remaining_qty = initial_qty` และ `reserved_qty = 0`
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionAdminController.js`
  - `models/promotion/prizeModel.js`
  - `models/promotionModel.js`
  - `views/promotion/admin/prizes.ejs`
- Behavior Impact:
  - เพิ่มของรางวัลใหม่ได้ผ่าน UI โดยเลือกสาขา/แคมเปญได้ตรงกับ tenancy
  - ลดความเสี่ยงเพิ่มรางวัลผิดสาขาด้วยการตรวจ `campaign.store_id` เทียบ `store_id`
- Open Issues:
  - ยังไม่มีหน้าแก้ไข/ลบรางวัล (มีเฉพาะ create + list)
- Next Step:
  - เพิ่ม edit/deactivate flow สำหรับของรางวัล

### 2026-04-22 12:05 (ICT) - Add prize edit/deactivate/delete management
- Goal: ให้แอดมินจัดการ lifecycle ของรางวัลได้ครบ (แก้ไข/ปิดใช้งาน/ลบ)
- Changes:
  - เพิ่ม endpoint สำหรับแก้ไข, เปลี่ยนสถานะ, และลบรางวัล
  - เพิ่ม validation ฝั่ง server พร้อมตรวจ tenant scope ตาม store ของผู้ดูแล
  - เพิ่มเงื่อนไขความปลอดภัยก่อนลบ: ห้ามลบถ้ามี `reserved_qty` หรือมี draw history อ้างอิง
  - เพิ่มปุ่ม Action และ modal แก้ไขในหน้า `Prizes`
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionAdminController.js`
  - `models/promotion/prizeModel.js`
  - `models/promotionModel.js`
  - `views/promotion/admin/prizes.ejs`
- Behavior Impact:
  - แก้ไขข้อมูลรางวัล (name/code/type/weight/description) ได้จาก UI
  - เปิด/ปิดการใช้งานรางวัลได้ทันที
  - ลบรางวัลได้เฉพาะรายการที่ปลอดภัยต่อประวัติธุรกรรม
- Open Issues:
  - ยังไม่มี audit log รายการแก้ไข/ลบรางวัลรายผู้ใช้
- Next Step:
  - เพิ่ม `promotion_admin_audit_logs` และบันทึกทุก action ของ prize management

### 2026-04-22 12:20 (ICT) - Harden admin password reset verification
- Goal: แก้ปัญหากรณีผู้ใช้แจ้งว่า reset password แล้วแต่ฐานข้อมูลไม่อัปเดต
- Changes:
  - ปรับ model `updatePasswordHash` ให้ return `affectedRows`
  - เพิ่มการตรวจผลใน controller: ต้องแก้ไขได้อย่างน้อย 1 แถว
  - เพิ่ม post-update verification โดยอ่าน hash กลับมาและ `bcrypt.compare` กับรหัสใหม่
- Files Touched:
  - `models/promotion/adminUserModel.js`
  - `controllers/promotionAdminController.js`
- Behavior Impact:
  - ถ้า update ไม่สำเร็จจะไม่แจ้ง success ผิดพลาดอีก
  - แจ้ง error ชัดเจนเมื่อไม่สามารถยืนยันผลการรีเซ็ตรหัสผ่านได้
- Open Issues:
  - ยังไม่มี audit log ว่าใครเป็นผู้รีเซ็ตรหัสผ่านให้ใคร
- Next Step:
  - บันทึก event reset password ลง audit log

### 2026-04-22 12:35 (ICT) - Add store creation in promotion admin
- Goal: ให้เพิ่ม Store/สาขาได้จาก `/promotion/admin` โดยไม่ต้องไปยิง SQL เอง
- Changes:
  - เพิ่มหน้า `Stores` สำหรับ super_admin พร้อมฟอร์มสร้างสาขาและตารางรายการสาขา
  - เพิ่ม endpoint `GET/POST /promotion/admin/stores`
  - เพิ่ม validation `store_code` และกันรหัสสาขาซ้ำก่อน insert
  - เพิ่มเมนู `Stores` ในหน้า admin หลักสำหรับ super_admin
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionAdminController.js`
  - `models/promotionModel.js`
  - `views/promotion/admin/stores.ejs`
  - `views/promotion/admin/dashboard.ejs`
  - `views/promotion/admin/campaigns.ejs`
  - `views/promotion/admin/prizes.ejs`
  - `views/promotion/admin/codes.ejs`
  - `views/promotion/admin/draws.ejs`
  - `views/promotion/admin/users.ejs`
- Behavior Impact:
  - เพิ่มสาขาใหม่ในตาราง `stores` ได้ผ่าน UI
  - สาขาใหม่สามารถนำไปใช้ใน flow สร้าง admin/campaign/prize/code ต่อได้
- Open Issues:
  - ยังไม่มีหน้าแก้ไข/ปิดใช้งาน/ลบ store
- Next Step:
  - เพิ่ม store edit flow พร้อม impact check ก่อนลบ

### 2026-04-22 12:50 (ICT) - Add store edit/deactivate/delete with impact check
- Goal: จัดการ store ได้ครบ lifecycle (แก้ไข/ปิดใช้งาน/ลบ) ใน `/promotion/admin/stores`
- Changes:
  - เพิ่ม endpoint สำหรับ update/status/delete store
  - เพิ่ม validation store code ซ้ำ และแก้ไขข้อมูลสาขาได้จาก modal
  - เพิ่ม soft-deactivate โดยบันทึก `metadata.is_active` และ `metadata.deactivated_at`
  - เพิ่ม impact check ก่อนลบ (campaigns/prizes/codes/draws/coop_admin_users ต้องเป็น 0)
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionAdminController.js`
  - `models/promotionModel.js`
  - `views/promotion/admin/stores.ejs`
- Behavior Impact:
  - super_admin ปิด/เปิดการใช้งานสาขาได้โดยไม่กระทบ historical data
  - ลบสาขาได้เฉพาะสาขาที่ไม่มีข้อมูลอ้างอิง จึงปลอดภัยต่อ FK และประวัติระบบ
- Open Issues:
  - store ที่ inactive ยังแสดงใน dropdown บางหน้า (เพื่อให้มองเห็นครบ)
- Next Step:
  - เพิ่มตัวกรอง “เฉพาะ active store” สำหรับฟอร์มที่ต้องการใช้งานสาขาใหม่

### 2026-04-22 13:20 (ICT) - Store-scoped play/kiosk + prize photo showcase
- Goal: แยกหน้า `/play` และ `/kiosk` ราย store เพื่อโชว์ของรางวัลหน้าต้อนรับแต่ละสาขา และรองรับรูปของรางวัล
- Changes:
  - เพิ่ม route แบบแยกสาขา `GET /promotion/store/:storeCode/play` และ `GET /promotion/store/:storeCode/kiosk`
  - ปรับ controller ให้รองรับ `store_code` ใน validate/draw (ทั้ง web+kiosk) และตรวจ code-store mismatch
  - เพิ่ม query `getShowcasePrizesByStore` สำหรับดึงรางวัลเด่นที่ active + มีคงเหลือ
  - ปรับหน้า `play`/`kiosk` ให้แสดงการ์ดของรางวัลเด่น (ชื่อ, คงเหลือ, รูปถ้ามี)
  - เพิ่มฟิลด์ `image_url` ในหน้า admin prizes และบันทึกใน `promotion_prizes.metadata.image_url`
- Files Touched:
  - `routes/promotionRoutes.js`
  - `controllers/promotionController.js`
  - `controllers/promotionAdminController.js`
  - `models/promotion/prizeModel.js`
  - `models/promotionModel.js`
  - `views/promotion/play.ejs`
  - `views/promotion/kiosk.ejs`
  - `views/promotion/admin/prizes.ejs`
  - `docs/promotion-architecture-map.md`
- Behavior Impact:
  - เปิด URL รายสาขาเพื่อใช้เป็นหน้าต้อนรับเฉพาะ store ได้ทันที
  - ฝั่ง client ส่ง `store_code` ไป validate/draw เพื่อล็อกขอบเขตสาขา
  - แอดมินเพิ่ม/แก้รูปของรางวัลได้จาก UI โดยไม่ต้องแก้ SQL ตรง
- Open Issues:
  - ปัจจุบันรูปเป็น URL/path เท่านั้น (ยังไม่มี uploader ในหน้า admin)
- Next Step:
  - เพิ่ม media upload endpoint ภายใน `/promotion/admin` แล้วเติม URL อัตโนมัติให้ฟอร์มรางวัล
