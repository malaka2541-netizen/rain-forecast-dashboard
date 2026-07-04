# เอกสารส่งมอบงานให้ Codex

อัปเดตล่าสุด: 5 ก.ค. 2569

## ภาพรวมโปรเจกต์

โปรเจกต์นี้คือ Rain Forecast Dashboard สำหรับดูแนวโน้มฝนของพื้นที่ไซต์งานก่อสร้าง โดยเน้นการใช้ข้อมูลพยากรณ์เพื่อวางแผนงานกลางแจ้ง เช่น งานเทคอนกรีตพื้น

หลักการออกแบบที่ต้องรักษาไว้:

- เว็บต้องให้ข้อมูลครบและอ่านง่าย
- เว็บไม่ควรตัดสินใจแทนหัวหน้างาน
- หลีกเลี่ยงคำชี้นำ เช่น "เทได้" หรือ "เทไม่ได้"
- ข้อมูลความแม่นย้อนหลังต้องแสดงอย่างระมัดระวัง โดยเฉพาะช่วงที่ sample ยังน้อย

## ลิงก์สำคัญ

- เว็บใช้งานจริง: https://rain-forecast-dashboard-0dub.onrender.com
- Health check: https://rain-forecast-dashboard-0dub.onrender.com/health
- Backtest summary API: https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/summary
- GitHub repository: https://github.com/malaka2541-netizen/rain-forecast-dashboard

## สถานะล่าสุดของระบบ

ระบบ deploy บน Render แล้ว และผูก auto deploy กับ branch `main`

Commit ล่าสุดที่ push แล้ว:

```text
c87c20c Add Google Weather forecast source
```

สถานะ endpoint หลัง deploy ล่าสุด:

- Open-Meteo: ใช้งานได้
- OpenWeather: ใช้งานได้
- TMD: ใช้งานได้เมื่อมี `TMD_API_TOKEN`
- Supabase logging/backtest: ใช้งานได้เมื่อมี Supabase env
- Google Weather: โค้ดพร้อมแล้ว แต่จะยังไม่มีข้อมูลถ้า Render ยังไม่ได้ตั้งค่า `GOOGLE_WEATHER_API_KEY`

## ไฟล์หลักที่ต้องอ่านก่อนทำงานต่อ

- `server.py` - backend proxy, API routing, TMD, Open-Meteo, OpenWeather, Google Weather, Supabase logging, backtest
- `app-v1.6.js` - frontend logic, source switching, chart/table rendering, modal comparison, modal accuracy
- `index.html` - layout, source buttons, modal ต่างๆ
- `style-v1.6.css` - styling หลัก
- `supabase_schema.sql` - schema สำหรับระบบ backtest
- `.github/workflows/backtest-hourly.yml` - GitHub Actions สำหรับรัน backtest แบบฟรี
- `IMPLEMENTATION_PLAN.md` - แผนงานเชิงระบบและสถิติ
- `SUPABASE_SETUP.md` - วิธีตั้งค่า Supabase
- `DEPLOY_RENDER.md` - วิธี deploy Render

## ฟีเจอร์ที่ทำเสร็จแล้ว

### Forecast Dashboard

- แสดงกราฟแนวโน้มฝนรายชั่วโมง
- แสดงตารางโอกาสเกิดฝนรายชั่วโมง
- แสดงสีแบ่งช่วงความเสี่ยงฝน
- แสดง / ซ่อน icon สภาพอากาศในตารางได้
- มี tooltip รายชั่วโมง
- มี modal วิธีอ่านข้อมูล
- มี modal สถิติความแม่นย้อนหลัง

### Source Switching

เพิ่มปุ่มสลับแหล่งข้อมูลบนหน้าเว็บแล้ว:

- `Open-Meteo 10 วัน`
- `OpenWeather 48 ชม.`
- `Google Weather 240 ชม.`

หมายเหตุ:

- Open-Meteo ยังเป็น source หลักสำหรับมุมมอง 10 วัน
- OpenWeather ใช้สำหรับมุมมอง 48 ชั่วโมงและการเปรียบเทียบ
- Google Weather โค้ดพร้อม แต่ต้องตั้งค่า API key ก่อนจึงจะมีข้อมูล

### Weather Provider Endpoints

Backend รองรับ endpoint เหล่านี้แล้ว:

```text
/api/forecast/openmeteo
/api/forecast/openweather
/api/forecast/googleweather
/api/forecast/tmd/hourly
/api/forecast/tmd/daily
/api/forecast/tmd/warning
/api/forecast/tmd/daily-summary
```

### Backtest / Accuracy System

ระบบเก็บและสรุปสถิติย้อนหลังเบื้องต้นแล้ว:

- ดึง forecast
- ดึง observation ฝนจริงจาก TMD AWS
- เทียบ forecast กับ observation
- บันทึกผลลง Supabase
- แสดงสถิติใน modal
- มีข้อความ `อัปเดตล่าสุด`
- มี confusion matrix / hit / miss / false alarm / correct negative
- มี Brier score และ Brier skill score ใน summary

Endpoint หลัก:

```text
POST /api/backtest/run-cycle
GET  /api/backtest/summary
```

`POST /api/backtest/run-cycle` ต้องส่ง header:

```text
Authorization: Bearer <BACKTEST_CRON_TOKEN>
```

ห้ามส่ง token ผ่าน query string

## Automation ปัจจุบัน

เลือกใช้ GitHub Actions แทน Render Cron Job เพื่อประหยัดค่าใช้จ่าย

Workflow:

```text
.github/workflows/backtest-hourly.yml
```

Schedule:

```text
7 * * * *
```

ความหมายคือรันทุกชั่วโมงที่นาที 07

Workflow นี้ยิง `POST` ไปที่:

```text
https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/run-cycle
```

GitHub Actions Secrets ที่ต้องมี:

- `BACKTEST_TRIGGER_URL`
- `BACKTEST_CRON_TOKEN`

ค่าของ `BACKTEST_TRIGGER_URL`:

```text
https://rain-forecast-dashboard-0dub.onrender.com/api/backtest/run-cycle
```

## Environment Variables

### Render Web Service

ต้องมี:

- `TMD_API_TOKEN`
- `OPENWEATHER_API_KEY`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_DB_SCHEMA`
- `BACKTEST_FORECAST_LAT`
- `BACKTEST_FORECAST_LON`
- `BACKTEST_CRON_TOKEN`

ควรเพิ่มถ้าต้องการเปิด Google Weather:

- `GOOGLE_WEATHER_API_KEY`

Optional:

- `OBSERVATION_PROVINCES`
- `TMD_WARNING_UID`
- `TMD_WARNING_UKEY`
- `TMD_PUBLIC_UID`
- `TMD_PUBLIC_UKEY`

### GitHub Actions Secrets

ต้องมี:

- `BACKTEST_TRIGGER_URL`
- `BACKTEST_CRON_TOKEN`

## สถานะ Google Weather

โค้ด backend และ frontend ถูกเพิ่มแล้ว

สิ่งที่ทำแล้ว:

- เพิ่มปุ่ม `Google Weather 240 ชม.`
- เพิ่ม endpoint `/api/forecast/googleweather`
- normalize ข้อมูล Google Weather ให้อยู่ในรูปแบบใกล้เคียง provider อื่น
- เพิ่ม comparison modal ให้รองรับ Google Weather
- เพิ่ม health field `googleweather_configured`

สถานะล่าสุด:

- ถ้า `/health` แสดง `googleweather_configured: false` แปลว่ายังไม่ได้ตั้งค่า `GOOGLE_WEATHER_API_KEY` บน Render
- ถ้าตั้งค่าแล้วต้อง redeploy หรือให้ Render redeploy อัตโนมัติ

ข้อควรระวัง:

- ห้ามใส่ Google Weather API key ใน frontend
- ห้าม commit key ลง GitHub
- ให้เก็บ key ใน Render Environment เท่านั้น

## สถานะ Open-Meteo

Open-Meteo เคยมีปัญหาจากโค้ด fallback ที่เผลอไปปนกับ Google Weather ทำให้เปิดข้อมูลไม่ได้ ปัญหานี้แก้แล้วใน commit ล่าสุด

หลังแก้:

- `/api/forecast/openmeteo` ตอบ `HTTP 200`
- หน้าเว็บสามารถกลับไปเลือก `Open-Meteo 10 วัน` ได้

ถ้าเจอ `Open-Meteo returned status 500` อีก ให้เช็กตามลำดับ:

1. ลอง reload อีกครั้ง เพราะอาจเป็น transient upstream/proxy error
2. เปิด Render Logs
3. ดูว่ามี timeout จาก Open-Meteo หรือไม่
4. ทดสอบ endpoint ตรง:

```text
https://rain-forecast-dashboard-0dub.onrender.com/api/forecast/openmeteo?lat=13.7563&lon=100.5018
```

## Supabase / Backtest

ตารางหลัก:

- `forecast_runs`
- `forecast_hourly_points`
- `rain_observations`
- `verification_results`

ตรวจจำนวนข้อมูลด้วย query:

```sql
select count(*) from public.forecast_runs;
select count(*) from public.rain_observations;
select count(*) from public.verification_results;
```

ตอนเริ่มแรก sample ยังน้อย ห้ามสรุปความแม่นแบบเด็ดขาด

เกณฑ์อ่านความน่าเชื่อถือ:

- น้อยกว่า 100 จุดตรวจ = ยังเร็วเกินไป
- 100-499 จุดตรวจ = ดูแนวโน้มเบื้องต้น
- 500-999 จุดตรวจ = เริ่มเปรียบเทียบ source ได้ดีขึ้น
- 1,000 จุดตรวจขึ้นไป = เริ่มพิจารณา calibration / weighted blend ได้

## Git / Working Tree

หลังส่งงานล่าสุด code หลักถูก commit และ push แล้ว

ยังมีไฟล์ untracked ในเครื่องที่ไม่ควร commit โดยไม่ตรวจ:

```text
api TMD.txt
bma.html
database password.txt
test_iframe.html
```

โดยเฉพาะ:

```text
database password.txt
```

ห้าม stage หรือ commit ถ้าไม่ได้ตรวจเนื้อหาและได้รับอนุญาตชัดเจน

## งานค้างที่ควรทำต่อ

### งานด่วน

1. ตั้งค่า `GOOGLE_WEATHER_API_KEY` ใน Render ถ้าต้องการใช้ Google Weather
2. ตรวจ `/health` ให้เห็น `googleweather_configured: true`
3. ทดสอบ `/api/forecast/googleweather?lat=13.7563&lon=100.5018`
4. เปิดหน้าเว็บและทดสอบปุ่ม `Google Weather 240 ชม.`
5. ตรวจว่า GitHub Actions ยังรัน backtest รายชั่วโมงได้

### งานปรับปรุงถัดไป

1. ปรับ UX source switch ให้แสดงสถานะชัดเจนเมื่อ source ยังไม่มี key
2. เพิ่มข้อความใน modal เปรียบเทียบว่าข้อมูล Google Weather ใช้งานได้เฉพาะเมื่อ API key พร้อม
3. ขยาย backtest summary ให้แยกตาม source
4. ขยาย backtest summary ให้แยกตาม lead time
5. เพิ่ม calibration bucket สำหรับแต่ละ provider
6. ทำ adjusted forecast เฉพาะ shadow mode ก่อน

## ข้อควรระวังสำคัญ

- ห้าม commit API key หรือ secret
- ห้ามให้ frontend เรียก provider API ด้วย key ตรงๆ
- ห้ามสรุปว่า provider ไหนแม่นที่สุดจาก sample น้อย
- ห้ามแปลงข้อมูล TMD เป็น probability ถ้า source ไม่ได้ให้ probability โดยตรง
- ห้ามเปลี่ยนค่าหลักเป็น adjusted forecast ก่อนมีข้อมูลย้อนหลังพอ
- ห้ามให้เว็บชี้นำการตัดสินใจหน้างานแทนหัวหน้างาน

## Prompt สำหรับนำไปเปิดแชทใหม่

คัดลอกข้อความนี้ไปให้ Codex ในแชทใหม่:

```text
โปรเจกต์อยู่ที่ C:\Users\Dell\Desktop\ตารางรายงานฝน

กรุณาอ่านไฟล์ ส่งมอบงานให้codex.md ก่อนเริ่มงาน และใช้ไฟล์นี้เป็น source of truth ล่าสุด

โปรเจกต์คือ Rain Forecast Dashboard สำหรับไซต์งานก่อสร้าง ใช้ดูแนวโน้มฝนเพื่อวางแผนงานกลางแจ้ง โดยห้ามชี้นำการตัดสินใจแทนหัวหน้างาน

สถานะล่าสุด:
- เว็บ deploy แล้วที่ Render: https://rain-forecast-dashboard-0dub.onrender.com
- GitHub repo: https://github.com/malaka2541-netizen/rain-forecast-dashboard
- branch หลักคือ main
- commit ล่าสุดที่ push แล้วคือ c87c20c Add Google Weather forecast source
- Open-Meteo และ OpenWeather ใช้งานได้
- Google Weather เพิ่มโค้ดแล้ว แต่ต้องมี GOOGLE_WEATHER_API_KEY บน Render ก่อนจึงจะมีข้อมูล
- Supabase/backtest ใช้งานแล้วผ่าน GitHub Actions รายชั่วโมง

ก่อนแก้โค้ด ให้ตรวจ git status และห้าม stage/commit ไฟล์ untracked ที่มีข้อมูลลับ เช่น database password.txt

งานถัดไปที่ควรทำ:
1. ตรวจว่า Render ตั้ง GOOGLE_WEATHER_API_KEY แล้วหรือยัง
2. ถ้าตั้งแล้ว ให้ทดสอบ /health และ /api/forecast/googleweather
3. ปรับ UX ให้ source ที่ยังไม่มี key แสดงสถานะชัดเจน
4. ขยาย backtest summary แยกตาม source และ lead time
```

## สรุปสั้นที่สุด

ระบบหลักใช้งานได้แล้ว มี Open-Meteo, OpenWeather, TMD, Supabase และ GitHub Actions backtest

งานที่เหลือสำคัญที่สุดคือเปิดใช้งาน Google Weather ด้วย `GOOGLE_WEATHER_API_KEY` บน Render แล้วต่อยอดสถิติย้อนหลังให้แยกตาม source / lead time
