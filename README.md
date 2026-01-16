
# MySeriesVideo v3.2 (Flask + Render)

ฟีเจอร์หลัก:
- แยก "เรื่อง" (series) และ "ตอน" (episodes)
- แอดมิน:
  - ล็อกอินด้วย ชื่อผู้ใช้ + รหัสผ่าน (ค่าเริ่มต้นในโค้ด: admin / 1234)
  - เปลี่ยนชื่อผู้ใช้และรหัสผ่านชั่วคราวได้จากหน้า "บัญชีแอดมิน"
    (เมื่อรีสตาร์ทจะกลับมาเป็นค่าเริ่มต้นในโค้ด)
  - เพิ่ม / ลบ / แก้ไข เรื่อง
  - เพิ่ม / ลบ ตอน
  - ตอนรองรับ 3 โหมด: ลิงก์ mp4, Google Drive, อัปโหลด mp4
  - ตั้งรูปปกเรื่อง/ตอนได้: ใส่ลิงก์รูป หรืออัปโหลดรูปจากเครื่อง
- ระบบสำรอง/คืนค่า:
  - ดาวน์โหลดค่า (backup) เป็นไฟล์ JSON
  - คืนค่าจากไฟล์ JSON (ลบข้อมูลเดิมแล้วใส่ตามไฟล์)
- ปกเรื่องเก็บใน `static/covers/series_<id>/...`
- ปกตอนเก็บใน `static/covers/episodes/ep_<episode_id>/...`
- ทุกหน้ามีปุ่ม "ย้อนกลับ" ยกเว้นหน้าแรก (index)

## การรันในเครื่อง

```bash
python -m venv venv
source venv/bin/activate  # Windows: venv\\Scripts\\activate
pip install -r requirements.txt
python app.py
```

## การรันบน Render

- Build command: `pip install -r requirements.txt`
- Start command: `gunicorn app:app`
- Environment:
  - `SECRET_KEY` = คีย์ลับ (ถ้าไม่ตั้งจะใช้ค่า dev)

TURNSTILE_SITE_KEY=ค่านี้เอาจาก Cloudflare
TURNSTILE_SECRET_KEY=ค่านี้เอาจาก Cloudflare
SECRET_KEY = ใส่ค่าสุ่มยาวๆ เช่น hgjk2349sdfj2349sd8f7
