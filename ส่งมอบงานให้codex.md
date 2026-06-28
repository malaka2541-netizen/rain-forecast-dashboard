# เอกสารส่งมอบงานให้ Codex

## สถานะโปรเจกต์ล่าสุด

โปรเจกต์นี้คือ Rain Forecast Dashboard สำหรับดูแนวโน้มฝนในพื้นที่ไซต์งานก่อสร้าง โดยเน้นการใช้งานจริงสำหรับวางแผนงานกลางแจ้ง เช่น งานเทคอนกรีตพื้น

หลักการสำคัญของระบบคือแสดงข้อมูลให้ครบและอ่านง่าย แต่ไม่ตัดสินใจแทนหัวหน้างาน เช่น ไม่ใช้คำว่า "เทได้" หรือ "เทไม่ได้"

URL ใช้งานจริง:

- Render: https://rain-forecast-dashboard-0dub.onrender.com
- Health check: https://rain-forecast-dashboard-0dub.onrender.com/health
- Backtest summary: https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/summary
- GitHub repository: https://github.com/malaka2541-netizen/rain-forecast-dashboard

## ไฟล์สำคัญ

- `server.py` - backend proxy, API routing, Supabase logging, backtest cycle
- `index.html` - dashboard layout และ modal ต่างๆ
- `app-v1.6.js` - frontend logic, chart/table rendering, modal accuracy summary
- `style-v1.6.css` - dashboard styling
- `supabase_schema.sql` - schema สำหรับระบบ backtest
- `.github/workflows/backtest-hourly.yml` - GitHub Actions scheduler แบบฟรี
- `IMPLEMENTATION_PLAN.md` - แผนพัฒนาหลักจากจุดปัจจุบัน

## สิ่งที่ทำเสร็จแล้ว

- สร้าง GitHub repository และผูก Render auto deploy กับ branch `main`
- Deploy เว็บบน Render สำเร็จ
- เชื่อม TMD API ผ่าน environment variable `TMD_API_TOKEN`
- เชื่อม Supabase PostgreSQL สำหรับเก็บ forecast, observation และ verification
- สร้าง schema หลัก:
  - `forecast_runs`
  - `forecast_hourly_points`
  - `rain_observations`
  - `verification_results`
- เพิ่มระบบ backtest เบื้องต้น:
  - ดึง forecast จาก Open-Meteo
  - ดึง observation จาก TMD
  - จับคู่ forecast กับฝนจริง
  - บันทึกผลลง Supabase
- เพิ่ม endpoint `/api/backtest/run-cycle`
  - ใช้ `POST` เท่านั้น
  - ต้องมี `Authorization: Bearer <BACKTEST_CRON_TOKEN>`
  - ไม่รับ token ผ่าน query string
- เพิ่ม endpoint `/api/backtest/summary`
- เพิ่ม modal สรุปสถิติความแม่นย้อนหลังในหน้าเว็บ
- เพิ่มข้อความ `อัปเดตล่าสุด` ใน modal สถิติ
- ตั้ง GitHub Actions ชื่อ `Backtest Hourly` สำหรับ trigger backtest แบบฟรี
- ทดสอบ manual run ของ GitHub Actions แล้วสำเร็จ

## Environment Variables ที่ใช้งานอยู่

บน Render:

- `TMD_API_TOKEN`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_SCHEMA`
- `BACKTEST_CRON_TOKEN`

บน GitHub Actions Secrets:

- `BACKTEST_TRIGGER_URL`
- `BACKTEST_CRON_TOKEN`

ค่าของ `BACKTEST_TRIGGER_URL` ควรเป็น:

```text
https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/run-cycle
```

## Automation ปัจจุบัน

ระบบใช้ GitHub Actions แทน Render Cron Job เพื่อประหยัดค่าใช้จ่าย

Workflow:

- ไฟล์: `.github/workflows/backtest-hourly.yml`
- ทำงานตาม schedule รายชั่วโมง
- สามารถกด Run workflow เองได้จากหน้า GitHub Actions
- หน้าที่คือยิง `POST` ไปที่ `/api/backtest/run-cycle`

หมายเหตุ:

- GitHub Actions อาจไม่รันตรงนาทีเป๊ะ แต่เพียงพอสำหรับการเก็บสถิติย้อนหลัง
- ถ้า Render free instance หลับอยู่ request แรกอาจช้า แต่ระบบยังใช้งานได้

## สถานะสถิติย้อนหลัง

ระบบเริ่มเก็บข้อมูลจริงแล้ว แต่ sample ยังน้อยมาก จึงต้องแสดงผลแบบระมัดระวัง

หลักการอ่าน:

- ข้อมูลน้อยกว่า 100 จุดตรวจ = ยังเร็วเกินไป
- 100-499 จุดตรวจ = ใช้ดูแนวโน้มเบื้องต้น
- 500-999 จุดตรวจ = เริ่มเปรียบเทียบ source ได้ดีขึ้น
- 1,000 จุดตรวจขึ้นไป = เริ่มพิจารณา calibration หรือ weighted blend ได้

ห้ามใช้สถิติช่วงแรกเพื่อสรุปว่า source ใดแม่นที่สุดแบบเด็ดขาด

## แนวทางข้อมูล 3 แหล่ง

บทบาทของแต่ละแหล่งข้อมูลที่ตกลงไว้:

- Open-Meteo = base forecast หลักของหน้าเว็บ
- TMD = official local signal, warning, observation จริง
- OpenWeather = comparison source ที่จะเพิ่มใน phase ถัดไป

ยังไม่ควรเปลี่ยน OpenWeather เป็น source หลักทันที ถึงแม้ข้อมูลอาจดูแม่นกว่าในบางช่วง เพราะต้องพิสูจน์ด้วย backtest ในพื้นที่ไซต์งานจริงก่อน

## งานที่ค้าง / งานถัดไป

ให้อ่าน `IMPLEMENTATION_PLAN.md` ก่อนเริ่มงานต่อ ไฟล์นั้นคือ roadmap หลัก

ลำดับงานที่ควรทำต่อ:

1. เพิ่ม OpenWeather integration ฝั่ง backend
2. normalize OpenWeather ให้ลง schema กลางเดียวกับ Open-Meteo
3. บันทึก source `openweather` ลง Supabase
4. เพิ่ม comparison tooltip / modal โดยยังไม่ทำให้ตารางหลักรก
5. ขยาย backtest summary ให้แยกตาม source
6. ขยาย backtest summary ให้แยกตาม lead time
7. เพิ่ม Brier score, miss rate, false alarm rate และ calibration bucket
8. ทำ adjusted forecast เฉพาะ shadow mode ก่อน

## ข้อควรระวังสำคัญ

- ห้าม commit API key หรือ secret ลง GitHub
- ห้ามให้ frontend เรียก OpenWeather ด้วย key โดยตรง
- ห้ามสรุปความแม่นจาก sample น้อย
- ห้ามแปลงข้อมูล TMD เป็นเปอร์เซ็นต์ฝนแบบฝืน ถ้า source ไม่ได้ให้ probability มา
- ห้ามให้เว็บชี้นำการตัดสินใจหน้างานแทนผู้ใช้
- ถ้าจะทำ adjusted forecast ต้องมีข้อมูลย้อนหลังพอก่อน และควรทดสอบแบบ shadow mode อย่างน้อย 2-4 สัปดาห์

## สถานะเอกสาร

ไฟล์ส่งมอบงานหลัก:

- `ส่งมอบงานให้codex.md`

ไฟล์แผนงานหลัก:

- `IMPLEMENTATION_PLAN.md`

ตรวจสอบแล้วไม่ควรสร้างไฟล์ handoff หรือ implementation plan ชื่ออื่นเพิ่ม เพื่อป้องกันความสับสน
