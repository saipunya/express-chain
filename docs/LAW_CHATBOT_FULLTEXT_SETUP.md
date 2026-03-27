# ตั้งค่า FULLTEXT สำหรับระบบแชตบอทกฎหมาย

เอกสารนี้ใช้สำหรับเพิ่มดัชนี FULLTEXT ให้ระบบ `Cooperative Law Chatbot` ค้นหาได้เร็วและแม่นยำขึ้น

## 1) SQL สำหรับสร้างดัชนี

```sql
ALTER TABLE tbl_laws
  ADD FULLTEXT INDEX ft_tbl_laws_detail_search (law_detail, law_search);

ALTER TABLE tbl_glaws
  ADD FULLTEXT INDEX ft_tbl_glaws_detail (glaw_detail);
```

## 2) SQL สำหรับลบดัชนี (Rollback)

```sql
ALTER TABLE tbl_laws
  DROP INDEX ft_tbl_laws_detail_search;

ALTER TABLE tbl_glaws
  DROP INDEX ft_tbl_glaws_detail;
```

## 3) หมายเหตุ

- หากดัชนีมีอยู่แล้ว คำสั่ง `ADD FULLTEXT INDEX` จะ error ได้
- โค้ดในระบบมี fallback เป็น `LIKE` อัตโนมัติหากยังไม่มี FULLTEXT index
- แนะนำให้รันช่วงที่โหลดระบบต่ำ เพราะการสร้าง index อาจใช้เวลา
