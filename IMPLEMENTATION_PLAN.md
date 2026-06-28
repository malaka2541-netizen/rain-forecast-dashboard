# IMPLEMENTATION PLAN

## Project Goal

พัฒนาระบบ Rain Forecast Dashboard ให้ก้าวจากเว็บแสดงผลพยากรณ์อากาศทั่วไป ไปสู่ระบบที่:

- ใช้ข้อมูลจากหลายแหล่งร่วมกัน
- เก็บสถิติย้อนหลังเพื่อตรวจสอบความแม่น
- ปรับการอ่านค่าพยากรณ์ด้วยข้อมูลย้อนหลังจริงในพื้นที่กรุงเทพและปริมณฑล
- แสดงผลให้อ่านง่ายสำหรับการวางแผนงานหน้างาน โดยไม่ชี้นำการตัดสินใจแทนผู้ใช้

เป้าหมายระยะกลางคือสร้าง `adjusted forecast` ที่อ่านแนวโน้มฝนได้ใกล้เคียงขึ้นกว่าการใช้ข้อมูลดิบจากแหล่งเดียว

---

## Current System Status

ระบบที่มีอยู่แล้วในปัจจุบัน:

- Frontend หลัก
  - `index.html`
  - `app-v1.6.js`
  - `style-v1.6.css`
- Backend หลัก
  - `server.py`
- Deploy แล้วบน Render
- ต่อ Supabase แล้วสำหรับเก็บข้อมูลย้อนหลัง
- มี GitHub Actions สำหรับ trigger backtest cycle แบบฟรี
- มี modal แสดงสถิติความแม่นย้อนหลังเบื้องต้น

แหล่งข้อมูลที่ใช้งานแล้ว:

- Open-Meteo
- TMD

แหล่งข้อมูลที่เสนอให้เพิ่ม:

- OpenWeather

---

## Data Source Roles

เพื่อไม่ให้ระบบสับสน จะกำหนดบทบาทของแต่ละแหล่งข้อมูลแบบถาวรดังนี้

### 1. Open-Meteo

ใช้เป็น `base forecast`

- แกนหลักของกราฟรายชั่วโมง
- แกนหลักของตารางรายชั่วโมง
- baseline สำหรับเปรียบเทียบและ backtest

### 2. TMD

ใช้เป็น `official local signal`

- แหล่งข้อมูลเตือนภัย
- แหล่งข้อมูลสภาพอากาศเชิงพื้นที่
- แหล่ง observation จริงจากสถานีวัดฝน
- ใช้ยืนยันสัญญาณฝนหนัก / พายุ / advisory

หมายเหตุ:
- จะไม่บังคับแปลงข้อมูล TMD ทุกชนิดให้เป็นเปอร์เซ็นต์ หาก source ไม่ได้ให้ probability มาโดยตรง

### 3. OpenWeather

ใช้เป็น `comparison source`

- ผู้ท้าชิงสำหรับเปรียบเทียบกับ Open-Meteo
- ใช้ค่า `pop`, `rain.1h`, `weather`, `alerts`
- ใช้ในระบบ calibration และ blending ในระยะต่อไป

---

## Target Product Design

### Design Principle

หน้าเว็บต้องยังคง “อ่านง่าย” เป็นอันดับแรก

ดังนั้นจะไม่แสดงข้อมูล 3 แหล่งเต็มๆ ซ้อนกันบนตารางหลัก แต่จะจัดเป็น 3 ชั้น

### Layer 1: Main Forecast

แสดงค่าหลักเพียงชุดเดียวบนหน้าเว็บ

ระยะแรก:
- ใช้ Open-Meteo เป็นค่าหลัก

ระยะถัดไป:
- เปลี่ยนเป็น Adjusted Forecast หลังมีสถิติย้อนหลังพอ

### Layer 2: Agreement / Divergence Signal

แสดงสถานะสั้นๆ ว่าข้อมูลจากหลายแหล่ง:

- สอดคล้องกัน
- ต่างกันเล็กน้อย
- ต่างกันมาก
- มีประกาศเตือนจาก TMD

### Layer 3: Detailed Comparison

แสดงรายละเอียดเมื่อ hover / click / open modal เท่านั้น

ตัวอย่างข้อมูลใน tooltip หรือ modal:

- Open-Meteo: probability, rain mm, weather class
- OpenWeather: probability, rain mm, weather class
- TMD: advisory / warning / local signal
- สรุปว่าค่าตรงกันหรือแตกต่างกันอย่างไร

---

## Core Statistical Strategy

ระบบต้องไม่ใช้การคาดเดาหรือเฉลี่ยแบบไม่มีหลักฐาน

แนวทางทางสถิติจะใช้ 4 ส่วนหลัก

### 1. Rain Occurrence Verification

ตรวจว่า forecast บอกว่าจะมีฝน แล้วเวลาผ่านไปตกจริงหรือไม่

ตัวชี้วัด:

- hit rate
- miss rate
- false alarm rate
- probability bucket actual rain rate

### 2. Rainfall Amount Error

ตรวจความคลาดเคลื่อนของปริมาณฝน

ตัวชี้วัด:

- absolute error
- mean absolute error
- bias
- mean observed rainfall by bucket

### 3. Probability Calibration

ตรวจว่า probability ที่ forecast ให้มาเชื่อถือได้แค่ไหน

ตัวอย่าง:

- forecast 80%
- ในอดีต เมื่อระบบบอก 80% ตกจริงกี่ครั้ง

ผลลัพธ์จะใช้สร้าง calibration curve

ตัวชี้วัดที่ต้องเพิ่ม:

- Brier score สำหรับวัดคุณภาพของ probability
- calibration by bucket เช่น 0-10, 11-30, 31-50, 51-70, 71-100
- source bias ว่าแต่ละ source มีแนวโน้มบอกฝนสูงเกินจริงหรือต่ำเกินจริง

### 4. Lead-Time Performance

วัดผลแยกตามระยะเวลาล่วงหน้า

- 0-6 ชั่วโมง
- 6-12 ชั่วโมง
- 12-24 ชั่วโมง
- 24-48 ชั่วโมง
- 48-72 ชั่วโมง
- 72+ ชั่วโมง

เพราะแต่ละ source อาจเด่นคนละช่วงเวลา

---

## Database Plan

ฐานข้อมูลต้องรองรับทั้งการเก็บ forecast, observation, และ verification

### Existing / Active Tables

ระบบมีโครงสำหรับ backtest แล้ว และควรต่อยอดให้เป็นมาตรฐานเดียวกัน

กลุ่มตารางหลักที่ต้องรองรับ:

### 1. `forecast_runs`

ใช้เก็บรอบการดึง forecast

ควรมีข้อมูล:

- source
- requested_lat
- requested_lon
- requested_at
- raw_payload

ชื่อ column จริงใน schema ปัจจุบัน:

- `source`
- `requested_lat`
- `requested_lon`
- `requested_at`
- `timezone`
- `generation_time_ms`
- `utc_offset_seconds`
- `raw_payload`
- `created_at`

### 2. `forecast_hourly_points`

ใช้เก็บค่ารายชั่วโมงของ forecast แต่ละ source

ควรมีข้อมูล:

- run_id
- forecast_time
- lead_hours
- precipitation_probability
- precipitation_mm
- weather_code
- wind_speed_10m
- wind_gusts_10m
- cape
- dewpoint_2m
- surface_pressure

หมายเหตุ:

- ตารางนี้ไม่มี `source` โดยตรง เพราะ source อยู่ที่ `forecast_runs`
- เวลา query แยก source ต้อง join ผ่าน `run_id`
- ห้ามเพิ่ม field ชื่อใหม่ซ้ำความหมายเดิมโดยไม่จำเป็น เช่น `lead_time_hours` ถ้ามี `lead_hours` อยู่แล้ว

### 3. `rain_observations`

ใช้เก็บข้อมูลฝนจริงจากสถานี

ควรมีข้อมูล:

- station_code
- station_name
- province
- district
- lat
- lon
- observed_time
- rainfall_mm
- source
- raw_payload

### 4. `verification_results`

ใช้เก็บผลการเทียบ forecast กับ observation

ควรมีข้อมูล:

- forecast_hour_id
- station_code
- observed_time
- observed_rainfall_mm
- did_rain
- rain_intensity_class
- probability_bucket
- absolute_error_mm
- created_at

ชื่อ column จริงใน schema ปัจจุบัน:

- `forecast_hour_id`
- `station_code`
- `observed_time`
- `observed_rainfall_mm`
- `did_rain`
- `rain_intensity_class`
- `probability_bucket`
- `absolute_error_mm`
- `created_at`

ข้อเสนอสำหรับ phase ถัดไป:

- เพิ่ม `lead_time_bucket` เพื่อสรุปผลตามช่วงเวลาล่วงหน้าได้ง่ายขึ้น
- เพิ่ม `forecast_source` เฉพาะใน summary view หรือ materialized view แทนการ denormalize ทันที

### 5. Future Table: `source_performance_profiles`

ใช้เก็บผลสรุป performance แยกตาม:

- source
- province / area
- lead time bucket
- season / month
- confidence metrics

ตารางนี้จะใช้สำหรับ adjusted forecast ในอนาคต

---

## Observation Matching Rule

กฎการจับคู่ forecast กับฝนจริงต้องชัด เพราะเป็นหัวใจของสถิติย้อนหลัง

### Matching Area

สำหรับไซต์งาน 1 จุด ให้ใช้พิกัดไซต์งานเป็นศูนย์กลาง

ลำดับการจับคู่:

1. ใช้สถานีวัดฝนที่อยู่ใกล้ไซต์งานที่สุด
2. ถ้ามีหลายสถานีในรัศมีที่เหมาะสม ให้เก็บทุกสถานีไว้ก่อน
3. ตอนสรุปผลให้แยกได้ทั้งแบบรายสถานีและภาพรวม

### Initial Distance Rule

ตั้งค่าเริ่มต้น:

- ใช้สถานีภายในรัศมี 25 กิโลเมตรจากไซต์งาน
- ถ้าไม่มีสถานีในรัศมีนี้ ให้ใช้สถานีที่ใกล้ที่สุด แต่ต้องติด flag ว่า `nearest_outside_radius`

### Multiple Station Aggregation

เมื่อมีหลายสถานีในช่วงเวลาเดียวกัน:

- สำหรับ rain occurrence ใช้ `มีฝนจริง` ถ้ามีสถานีใดสถานีหนึ่งมีฝนมากกว่า 0.1 มม.
- สำหรับ rainfall amount ให้เก็บทั้งค่าเฉลี่ยและค่าสูงสุด
- สำหรับงานหน้างาน ให้ค่าสูงสุดมีความสำคัญกว่า เพราะฝนเฉพาะจุดกระทบงานก่อสร้างได้มาก

### Time Matching

ให้จับคู่เป็นรายชั่วโมง:

- forecast_time ถูกปัดเป็นชั่วโมงตาม timezone Asia/Bangkok
- observed_time ถูกปัดเป็นชั่วโมงเดียวกัน
- ถ้า observation มีหลายค่าภายในชั่วโมงเดียว ให้รวม rainfall_mm ของชั่วโมงนั้น

---

## Minimum Sample Threshold

ระบบห้ามสรุปความแม่นแบบหนักแน่นจากข้อมูลน้อยเกินไป

เกณฑ์เริ่มต้น:

- น้อยกว่า 100 จุดตรวจ: แสดงเป็นข้อมูลเริ่มต้นเท่านั้น
- 100-499 จุดตรวจ: ใช้ดูแนวโน้มและ calibration เบื้องต้น
- 500-999 จุดตรวจ: เริ่มใช้เปรียบเทียบ source ได้ดีขึ้น
- 1,000 จุดตรวจขึ้นไป: เริ่มพิจารณา weighted blend ได้

เกณฑ์สำหรับ adjusted forecast:

- ห้ามใช้ adjusted forecast เป็นค่าหลักก่อนมีอย่างน้อย 500 จุดตรวจรวม
- ห้ามแยกน้ำหนักราย lead-time bucket ก่อน bucket นั้นมีอย่างน้อย 100 จุดตรวจ
- ถ้าข้อมูลยังไม่ถึงเกณฑ์ ให้ใช้ Open-Meteo เป็นค่าหลักต่อไป และแสดง comparison เท่านั้น

---

## OpenWeather Integration Plan

### Why Add OpenWeather

เพิ่ม OpenWeather ไม่ใช่เพื่อแทนของเดิมทันที แต่เพื่อ:

- เป็นแหล่งตรวจไขว้
- วัดว่าแม่นกว่าหรือไม่ในพื้นที่จริง
- ใช้เป็น source เพิ่มใน model blending

### Recommended API Usage

ใช้ OpenWeather เป็น backend-only source

หลักการ:

- frontend ไม่เรียก OpenWeather ตรง
- backend fetch และ cache
- ลดการกิน quota
- คุมต้นทุนได้

### Environment and Security

เพิ่ม environment variables:

- `OPENWEATHER_API_KEY`
- `OPENWEATHER_ENABLED`
- `OPENWEATHER_CACHE_TTL_SECONDS`

ค่าเริ่มต้นที่แนะนำ:

- `OPENWEATHER_ENABLED=true`
- `OPENWEATHER_CACHE_TTL_SECONDS=600`

ข้อกำหนดความปลอดภัย:

- ห้ามเปิดเผย OpenWeather API key ใน frontend
- ห้าม commit key ลง GitHub
- API key ต้องอยู่ใน Render Environment Variables และ GitHub Secrets เฉพาะกรณี workflow จำเป็นต้องใช้
- endpoint frontend ต้องเรียก backend ของเราเท่านั้น

### Initial Fetch Scope

ข้อมูลที่ต้องใช้:

- current
- hourly
- daily
- alerts
- pop
- rain.1h
- weather condition

### Normalization Rule

OpenWeather ต้องถูกแปลงเข้ารูปแบบกลางก่อนบันทึก:

- `pop` แปลงเป็นเปอร์เซ็นต์ 0-100 เพื่อเก็บใน `precipitation_probability`
- `rain.1h` เก็บเป็น `precipitation_mm`
- `weather[].id` map เป็น `weather_code` หรือเก็บใน `raw_payload` ถ้ายังไม่ map
- wind gust แปลงเป็น km/h ถ้า source ส่งเป็น m/s
- forecast_time ต้องเก็บเป็น timestamptz
- lead_hours คำนวณจาก requested_at ถึง forecast_time

### Initial Cache Policy

สำหรับ 1 จุดใช้งาน:

- refresh ทุก 10 นาที

เหตุผล:

- เพียงพอสำหรับงานหน้างาน
- ยังอยู่ใน free quota ได้สบาย
- ลดโหลดและลด cost

---

## Frontend Implementation Plan

### Phase A: Comparison-Ready UI

ยังคง Open-Meteo เป็นค่าหลัก

สิ่งที่ต้องเพิ่ม:

- comparison data model ใน frontend state
- tooltip / modal สำหรับแสดง comparison
- agreement badge
- source consistency label

### Phase B: Comparison Modal

เพิ่ม modal สำหรับเปรียบเทียบแหล่งข้อมูลในช่วงเวลาที่เลือก

ควรแสดง:

- ค่าหลักที่ใช้แสดงจริง
- Open-Meteo
- OpenWeather
- TMD signal
- บันทึกว่าข้อมูลสอดคล้องหรือแตกต่าง

### Phase C: Accuracy Dashboard Expansion

ขยาย modal สถิติย้อนหลังให้มี:

- total checks
- actual rain rate
- average error
- confidence label
- latest updated
- observed period
- breakdown by probability bucket
- breakdown by rain intensity
- breakdown by lead-time bucket
- breakdown by source

---

## Backend Implementation Plan

### Phase 1: Stable Data Ingestion

ต้องทำให้ forecast จากทุก source เข้า schema กลางเดียวกัน

งานหลัก:

- เพิ่ม OpenWeather fetch function
- normalize response ให้เป็นรูปแบบเดียวกับ source อื่น
- บันทึก forecast runs
- บันทึก hourly points
- cache response

### Phase 2: Comparison API

เพิ่ม API สำหรับ frontend ใช้ดู comparison

เช่น:

- endpoint สรุปค่าของแต่ละ source ในช่วงเวลาที่เลือก
- endpoint สรุป agreement / divergence

### Phase 3: Verification & Summary

ขยายระบบ backtest ให้สรุปผลแยกตาม:

- source
- lead time
- area / province
- probability bucket
- intensity class

ต้องเพิ่ม metrics:

- total checks
- rain hits
- actual rain rate
- mean observed rainfall
- mean absolute error
- false alarm rate
- miss rate
- Brier score
- calibration by probability bucket

### Phase 4: Adjusted Forecast Engine

เมื่อข้อมูลมากพอ จึงเพิ่มชั้นประมวลผล:

- probability calibration
- source weighting
- event-based adjustment
- adjusted forecast output

---

## Adjusted Forecast Strategy

จะยังไม่สร้าง adjusted forecast ทันที

ลำดับที่ถูกต้อง:

### Step 1: Collect Enough History

สะสมข้อมูล forecast vs observation ให้พอ

### Step 2: Build Calibration Curves

แยกว่า source ไหน:

- ชอบบอกสูงเกินจริง
- ชอบบอกต่ำเกินจริง

### Step 3: Build Lead-Time Weighting

เช่น:

- OpenWeather อาจแม่นใน 0-12 ชม.
- Open-Meteo อาจเสถียรกว่าใน 24-48 ชม.
- TMD advisory อาจสำคัญเมื่อเกิดฝนหนักเฉพาะกิจ

### Step 4: Produce Adjusted Forecast

แนวคิด:

- main value = calibrated blend
- warning value = TMD advisory boosted

หมายเหตุ:

จะไม่ใช้สูตร blend จริงจนกว่าจะมี sample เพียงพอ

### Initial Blend Guardrail

เมื่อถึงเวลาทดลอง adjusted forecast ให้เริ่มจาก shadow mode ก่อน:

- คำนวณ adjusted forecast หลังบ้าน
- เก็บลง log หรือ API
- ยังไม่แสดงเป็นค่าหลักทันที
- เทียบ adjusted forecast กับ raw Open-Meteo อย่างน้อย 2-4 สัปดาห์
- ถ้า adjusted forecast ไม่ดีกว่า raw forecast อย่างชัดเจน ให้ยังไม่เปลี่ยนหน้าหลัก

---

## Recommended Execution Order

นี่คือลำดับงานที่แนะนำให้ทำจริง

### Phase 1

- เพิ่ม OpenWeather ใน backend
- บันทึก forecast ลง database
- cache ทุก 10 นาที

### Phase 2

- เพิ่ม comparison tooltip / modal
- เพิ่ม source agreement status
- เพิ่ม source comparison data model ใน frontend

### Phase 3

- ขยาย backtest summary ให้แยกตาม source
- ขยาย backtest summary ให้แยกตาม lead time
- เพิ่มตารางหรือ API สำหรับ source performance

### Phase 4

- ทำ probability calibration
- วิเคราะห์ source bias
- วิเคราะห์ฝนจริงตามช่วง lead time

### Phase 5

- สร้าง adjusted forecast logic
- ทดสอบกับข้อมูลย้อนหลัง
- เปลี่ยนค่าหลักบนหน้าเว็บจาก raw forecast เป็น adjusted forecast

---

## Success Criteria

ระบบจะถือว่าเดินมาถูกทางเมื่อ:

### Technical

- forecast จาก 3 source ถูกเก็บได้ครบ
- observation จริงถูกเก็บอัตโนมัติ
- verification รันอัตโนมัติได้
- summary เรียกดูได้จากเว็บ

### Statistical

- มีการแยกผลตาม source ชัดเจน
- มีการแยกผลตาม lead time
- มี calibration curve จริง
- มี Brier score และ bias report
- มี minimum sample flag ทุกครั้งที่ข้อมูลยังน้อย
- มีหลักฐานว่าสูตร adjusted forecast ช่วยได้ดีกว่าการใช้ raw source เดี่ยว

### Product

- หน้าเว็บยังอ่านง่าย
- ผู้ใช้เข้าใจค่าหลักได้ทันที
- สามารถเปิดรายละเอียดเปรียบเทียบได้เมื่อจำเป็น
- ระบบไม่ชี้นำการตัดสินใจเกินข้อมูลจริง

---

## Risks and Controls

### Risk 1: UI รกเกินไป

Control:

- แสดงค่าหลักชุดเดียว
- comparison แสดงใน tooltip / modal

### Risk 2: รีบ blend เร็วเกินไป

Control:

- ใช้ raw Open-Meteo เป็นหลักก่อน
- blend หลังมี sample พอ

### Risk 3: TMD signal ไม่ได้อยู่ในรูปแบบ probability

Control:

- ใช้ TMD เป็น warning / local signal
- ไม่แปลงเป็น % แบบฝืนข้อมูล

### Risk 4: cost จาก OpenWeather เกินจำเป็น

Control:

- backend fetch only
- cache 10 นาที
- จำกัดเฉพาะไซต์งาน 1 จุด

### Risk 5: สถิติหลอกจากการจับคู่สถานีผิด

Control:

- ใช้ distance rule
- เก็บ station_code ทุกครั้ง
- แสดงจำนวนสถานีที่ใช้ใน summary
- แยกรายงานรายสถานีได้

### Risk 6: ใช้ adjusted forecast เร็วเกินไป

Control:

- ใช้ minimum sample threshold
- ใช้ shadow mode ก่อนขึ้นหน้าเว็บหลัก
- ต้องพิสูจน์ว่า adjusted forecast ดีกว่า baseline

---

## Immediate Next Step

งานถัดไปที่ควรเริ่มทำทันทีคือ:

1. เพิ่ม OpenWeather integration ใน backend
2. ขยาย schema ให้รองรับ forecast source ใหม่อย่างสมบูรณ์
3. เพิ่ม comparison data structure สำหรับ frontend
4. ขยาย backtest summary ให้แยกตาม source และ lead time

---

## MVP Implementation Checklist

รอบ implementation แรกควรทำให้จบตาม checklist นี้

### Backend

- เพิ่ม config สำหรับ `OPENWEATHER_API_KEY`
- เพิ่ม endpoint สำหรับ OpenWeather proxy/cache
- normalize OpenWeather hourly forecast ให้เข้ากับ schema กลาง
- บันทึก OpenWeather forecast ลง `forecast_runs`
- บันทึก OpenWeather hourly points ลง `forecast_hourly_points`
- เพิ่ม source filter ใน backtest summary
- เพิ่ม summary by source
- เพิ่ม summary by lead-time bucket

### Database

- ตรวจว่า schema ปัจจุบันรองรับ OpenWeather โดยไม่ต้องสร้าง column ซ้ำ
- เพิ่ม field หรือ view สำหรับ lead-time bucket หากจำเป็น
- เพิ่ม view สำหรับ source performance ถ้าการ query join ซ้ำเริ่มซับซ้อน

### Frontend

- เพิ่ม comparison state
- เพิ่มข้อมูล OpenWeather ใน tooltip หรือ modal เท่านั้น
- เพิ่ม agreement status
- เพิ่ม source comparison ใน accuracy modal
- ไม่เปลี่ยนค่าหลักบนตารางจนกว่าจะมีข้อมูลย้อนหลังพอ

### Automation

- GitHub Actions ต้อง trigger backtest cycle ได้ต่อเนื่อง
- backtest cycle ต้องดึง forecast และ observation แล้วบันทึกลง Supabase
- health endpoint ต้องบอกสถานะ OpenWeather configured/cache ได้

### Verification

- เรียก OpenWeather endpoint แล้วได้ข้อมูลจริง
- ตรวจ Supabase ว่า `forecast_runs` เพิ่ม source `openweather`
- ตรวจ Supabase ว่า `forecast_hourly_points` เพิ่มข้อมูลรายชั่วโมง
- เปิดหน้าเว็บแล้วยังแสดงผล Open-Meteo เหมือนเดิม
- เปิด comparison แล้วเห็น OpenWeather เพิ่มเข้ามา
- summary ยังแสดง confidence ว่าข้อมูลยังน้อยจนกว่าจะสะสมพอ

เอกสารนี้เป็นแผนหลักสำหรับการพัฒนาระบบต่อจากจุดปัจจุบัน
