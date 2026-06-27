# Rain Forecast Dashboard - Project Handoff Summary

## 1. Project Overview

โปรเจกต์นี้คือเว็บ `Rain Forecast Dashboard` สำหรับดูพยากรณ์ฝนรายชั่วโมงและรายวัน เพื่อช่วยวางแผนงานกลางแจ้ง โดยโจทย์หลักของผู้ใช้คือใช้สำหรับวางแผน **งานเทคอนกรีตกลางแจ้ง**

หลักการสำคัญที่ตกลงกันไว้:

- เว็บต้อง **แสดงข้อมูลให้ครบและชัด**
- เว็บต้อง **ไม่ตัดสินใจแทนผู้ใช้**
- ไม่ใช้คำชี้นำประเภท `เทได้ / เทไม่ได้`
- หน้าที่ของเว็บคือช่วยให้หัวหน้างานหรือผู้ควบคุมงานใช้ข้อมูลไปตัดสินใจเอง

## 2. Current Deployment

- GitHub Repository: [malaka2541-netizen/rain-forecast-dashboard](https://github.com/malaka2541-netizen/rain-forecast-dashboard)
- Production URL: [rain-forecast-dashboard-0dub.onrender.com](https://rain-forecast-dashboard-0dub.onrender.com)
- Hosting: Render
- Auto deploy: เปิดใช้งานผ่าน branch `main`

## 3. Core Data Sources

### Open-Meteo

ใช้เป็นแหล่งข้อมูลหลักของ hourly forecast

ข้อมูลที่ใช้อยู่:

- `precipitation_probability`
- `precipitation`
- `weather_code`
- `wind_speed_10m`
- `wind_gusts_10m`
- `cape`
- `dewpoint_2m`
- `surface_pressure`

### TMD

ใช้เป็นแหล่งข้อมูลเสริมและแหล่งประกาศทางการ

ประเภทข้อมูลที่เชื่อมแล้ว:

- TMD hourly forecast
- TMD daily forecast
- TMD warning feed
- TMD daily summary feed

## 4. Important Product Direction

ผู้ใช้ต้องการเว็บสำหรับอ่านความเสี่ยงฝนในเชิงปฏิบัติ ไม่ใช่เว็บพยากรณ์ทั่วไปแบบข่าวสารอย่างเดียว

สิ่งที่สำคัญกับผู้ใช้:

- โอกาสฝนรายชั่วโมง
- ช่วงเวลาที่ฝนมีแนวโน้มสูง
- ความรุนแรงของฝน
- พายุ / ฝนฟ้าคะนอง / ประกาศเตือนจาก TMD
- ข้อมูลที่อ่านง่ายและดูเร็วบนหน้างาน

สิ่งที่ผู้ใช้ **ไม่ต้องการ**:

- ข้อความชี้นำการตัดสินใจ
- การ์ดที่กินพื้นที่เยอะแต่ข้อมูลน้อย
- ข้อความอธิบายเกินจำเป็นบนหน้าใช้งาน

## 5. Main Features Already Implemented

### 5.1 Left Summary Card

การ์ดซ้ายบนตอนนี้:

- แสดงเปอร์เซ็นต์ฝนของ **ชั่วโมงปัจจุบัน**
- แสดงข้อความ `โอกาสฝนตอนนี้`
- แสดงสภาพอากาศของเวลาปัจจุบัน
- แสดงไอคอนสภาพอากาศตามสถานะจริง
- พยายามแสดงชื่อสถานที่เป็น `อำเภอ + จังหวัด` จากพิกัดที่บันทึกไว้

### 5.2 Hourly Table

ตารางรายชั่วโมงตอนนี้:

- แสดงโอกาสฝนรายชั่วโมง
- ใช้สีแบ่งระดับความเสี่ยง
  - ต่ำ `0-30%`
  - ปานกลาง `31-70%`
  - สูง `71-100%`
- แสดงไอคอนสภาพอากาศใต้ตัวเลข
- มี tooltip เมื่อ hover

ข้อมูลใน tooltip:

- เวลา
- โอกาสเกิดฝน
- ลักษณะอากาศ
- ปริมาณฝนคาดการณ์
- ลมกระโชก
- ข้อความเตือนเสี่ยงพายุ/ฝนรุนแรงในบางกรณี

### 5.3 Chart

กราฟด้านบนตอนนี้:

- แสดงแนวโน้มโอกาสฝนรายชั่วโมง
- มี day/night background
- มี tooltip แสดง
  - โอกาสฝน
  - ลักษณะอากาศ
  - ปริมาณฝน
  - ลมกระโชก

### 5.4 Rain Intensity / Weather Interpretation

มีการตีความ `weather_code` และข้อมูลฝนเพื่อแปลเป็นสถานะที่เข้าใจง่าย เช่น:

- ฝนปรอยๆ
- ฝนตกปานกลาง
- ฝนตกหนัก
- ฝนตกหนักมาก
- พายุฝนฟ้าคะนอง
- เมฆมาก
- เมฆบางส่วน
- ท้องฟ้าโปร่ง

### 5.5 TMD Alert Card

มีการควบรวมการ์ดแจ้งเตือนกับการ์ดความรุนแรงฝนแล้ว

ปัจจุบันการ์ดแจ้งเตือน:

- ใช้พื้นที่กว้างขึ้น
- แสดงหัวข้อประกาศเตือนจาก TMD
- แสดงรายละเอียดประกาศ
- แสดงบรรทัดสรุป `จุดฝนแรงสุด`
- มี ticker ข้อความวิ่งสำหรับข้อความประกาศจริงจาก TMD

### 5.6 TMD Ticker

ข้อความวิ่งตอนนี้:

- ใช้ข้อความจริงจาก TMD feed ถ้ามี
- ซ่อนอัตโนมัติถ้าไม่มีข้อมูลประกาศ
- ความเร็วปัจจุบัน: `40 วินาที / 1 รอบ`

## 6. Current UI Decisions

### Keep

- การ์ดซ้ายสำหรับสภาพอากาศปัจจุบัน
- การ์ดช่วงฝนสูงสุด
- การ์ดแจ้งเตือน / ประกาศ TMD แบบกว้าง
- กราฟรายชั่วโมง
- ตารางรายชั่วโมง

### Removed / Reworked

- เอาแนวคิดการ์ดที่ชี้นำการตัดสินใจออก
- เอาข้อความอธิบายเกินจำเป็นออกจาก UI
- ลดการ์ดที่ข้อมูลน้อยแต่กินพื้นที่
- รวมการ์ด 3 และ 4 ให้กลายเป็นการ์ดแจ้งเตือนขนาดใหญ่

## 7. Location Logic

ระบบเลือกสถานที่ตอนนี้รองรับ:

- เลือกจังหวัด
- เลือกอำเภอ
- ค้นหาและปักหมุดบนแผนที่
- บันทึกพิกัดลง `localStorage`
- พยายาม resolve ชื่อสถานที่จากพิกัดเพื่อให้แสดง `อำเภอ จังหวัด`

หมายเหตุ:

- บางพิกัดอาจได้ข้อมูล district จาก reverse geocoding ไม่ครบ
- ถ้า reverse geocode ไม่ได้ ระบบจะ fallback เป็นชื่อเดิม

## 8. Key Files

- [server.py](C:\Users\Dell\Desktop\ตารางรายงานฝน\server.py)
  - proxy API
  - route สำหรับ Open-Meteo และ TMD

- [app.js](C:\Users\Dell\Desktop\ตารางรายงานฝน\app.js)
  - logic หลักทั้งหมดของ dashboard
  - parsing forecast
  - KPI updates
  - chart/table rendering
  - TMD alert integration
  - location handling

- [style.css](C:\Users\Dell\Desktop\ตารางรายงานฝน\style.css)
  - layout
  - card sizing
  - table styling
  - ticker animation

- [index.html](C:\Users\Dell\Desktop\ตารางรายงานฝน\index.html)
  - โครงหน้าเว็บ

- [thailand_locations.json](C:\Users\Dell\Desktop\ตารางรายงานฝน\thailand_locations.json)
  - รายชื่อจังหวัด / อำเภอ

- [render.yaml](C:\Users\Dell\Desktop\ตารางรายงานฝน\render.yaml)
  - deployment config สำหรับ Render

## 9. Current Server/API Notes

`server.py` ปัจจุบันรองรับ endpoint หลักประมาณนี้:

- `/api/forecast/openmeteo`
- `/api/forecast/tmd/hourly`
- `/api/forecast/tmd/daily`
- `/api/forecast/tmd/warning`
- `/api/forecast/tmd/daily-summary`
- `/health`

TMD ฝั่ง warning / daily summary ใช้ public feed ผ่าน `uid` / `ukey`

## 10. Recent Important Changes

การเปลี่ยนแปลงล่าสุดที่สำคัญ:

- เปลี่ยนการ์ดซ้ายให้ใช้ข้อมูลของชั่วโมงปัจจุบัน
- เพิ่มการ์ดแจ้งเตือน TMD แบบกว้าง
- เพิ่มข้อความวิ่งของประกาศ TMD
- ตั้ง auto deploy ไป Render ผ่าน `main`
- เพิ่ม logic resolve `อำเภอ + จังหวัด` จากพิกัดที่บันทึกไว้
- ปรับความเร็ว ticker เป็น `40s`

## 11. Recommended Next Steps

### High Priority

- เพิ่มลิงก์หรือปุ่มเปิด PDF ประกาศ TMD จากการ์ดแจ้งเตือนโดยตรง
- ปรับ reverse geocoding ฝั่ง server ถ้าต้องการความเสถียรมากขึ้น
- ตรวจสอบว่าทุก location ที่ใช้จริงแสดงอำเภอได้ถูกต้อง

### Medium Priority

- ปรับ calibration ของโอกาสฝนในอนาคต
- เพิ่ม cross-check logic ระหว่าง Open-Meteo กับ TMD
- ปรับหน้าจอ mobile/tablet เพิ่มเติม

### Future / Optional

- เพิ่มระบบเก็บสถิติย้อนหลัง
- เก็บประวัติ forecast เทียบกับผลจริง
- ทำ dashboard เปรียบเทียบหลายแหล่งพยากรณ์

## 12. Storage Status

ตอนนี้ **ยังไม่มีระบบ database หรือ storage สำหรับเก็บสถิติย้อนหลัง**

สถานะปัจจุบัน:

- ข้อมูล forecast ดึงสดจาก API
- ค่าพิกัดและชื่อสถานที่เก็บใน `localStorage`
- ยังไม่มี persistence สำหรับ historical weather analytics

## 13. User Preferences to Preserve

สิ่งที่ควรรักษาไว้เมื่อต่อยอด:

- ภาษาบนเว็บต้องตรงไปตรงมา
- หลีกเลี่ยงข้อความฟันธงแทนผู้ใช้
- เน้นข้อมูลที่ใช้ตัดสินใจหน้างานจริง
- หน้าเว็บต้องดูสะอาด อ่านเร็ว และไม่รก
- ใช้พื้นที่การ์ดอย่างคุ้มค่า

## 14. Latest Git Status at Handoff Time

ล่าสุดมีการ push ขึ้น `main` แล้ว และ Render ควร auto deploy ตาม commit ล่าสุด

commit ล่าสุดที่เกี่ยวข้อง:

- `a4256e7` Slow alert ticker to 40 seconds
- `92f4b43` Resolve district name from saved coordinates
- `5dfb9a0` Merge alert cards and add TMD ticker
- `52276e7` Use current-hour conditions in summary card

