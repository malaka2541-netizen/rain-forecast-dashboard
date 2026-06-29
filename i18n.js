const i18nConfig = {
  th: {
    "btn-stats": "สถิติความแม่น",
    "btn-guide": "วิธีอ่านข้อมูล",
    "source-label": "ชุดข้อมูลที่กำลังแสดง",
    "source-caption": "ใช้เป็นข้อมูลหลักสำหรับมุมมองรายชั่วโมงและรายวัน",
    "current-prob": "โอกาสฝนตอนนี้",
    "radar-hint": "แตะการ์ดซ้ายเพื่อเปลี่ยนพิกัดพยากรณ์",
    "alert-tmd": "แจ้งเตือน / ประกาศ TMD",
    "alert-read-full": "อ่านประกาศฉบับเต็ม",
    "chart-title": "แนวโน้มพยากรณ์รายชั่วโมง",
    "table-title": "ตารางแสดงโอกาสเกิดฝนรายชั่วโมง",
    "legend-low": "น้อย (0-40%)",
    "legend-med": "ปานกลาง (41-70%)",
    "legend-high": "สูง (71-90%)",
    "legend-very-high": "สูงมาก (91-100%)",
    "reliability-title": "ระดับความน่าเชื่อถือของข้อมูล",
    "rel-high-desc": "ความน่าเชื่อถือ <strong>สูง</strong>: ข้อมูลค่อนข้างนิ่ง สามารถใช้ตัดสินใจและเตรียมการได้",
    "rel-med-desc": "ความน่าเชื่อถือ <strong>ปานกลาง</strong>: ใช้ดู <strong>\"แนวโน้ม\"</strong> เพื่อวางแผนงานคร่าวๆ ล่วงหน้า",
    "rel-low-desc": "ความน่าเชื่อถือ <strong>ต่ำ</strong>: เป็นเพียงการคาดเดาระยะยาว ข้อมูลพลิกผันได้เสมอ <strong>ไม่ควรใช้ตัดสินใจเรื่องสำคัญ</strong>",
    "modal-loc-title": "ตั้งค่าสถานที่",
    "label-prov": "จังหวัด (Province)",
    "label-dist": "อำเภอ (District)",
    "select-prov-first": "กรุณาเลือกจังหวัดก่อน",
    "map-pin-hint": "ปักหมุดบนแผนที่ (คลิกเพื่อเลือกพิกัด)",
    "btn-cancel": "ยกเลิก",
    "btn-save-loc": "บันทึกพิกัด",
    "modal-guide-title": "วิธีอ่านข้อมูลพยากรณ์",
    "btn-understand": "เข้าใจแล้ว",
    "modal-compare-title": "เปรียบเทียบข้อมูลพยากรณ์",
    "btn-close": "ปิด",
    "modal-stats-title": "สถิติความแม่นย้อนหลัง",
    "stat-total-checks": "จำนวนจุดตรวจย้อนหลัง",
    "stat-hit-rate": "อัตราฝนตกจริง",
    "stat-avg-error": "คลาดเคลื่อนฝนเฉลี่ย",
    "stat-confidence": "ระดับความน่าเชื่อถือ",
    "stat-summary-title": "สรุปแบบอ่านเร็ว",
    "stat-breakdown-prob": "แยกตามระดับโอกาสฝน",
    "stat-breakdown-source": "แยกตามแหล่งข้อมูล (Source)",
    "stat-breakdown-lead": "แยกตามช่วงเวลาล่วงหน้า (Lead Time)",
    "stat-breakdown-intensity": "แยกตามความแรงฝนที่ตรวจจริง",
    "loading-processing": "กำลังประมวลผลข้อมูล...",
    "loading-stats": "กำลังโหลดสถิติ...",
    
    // Dynamic text
    "table-icons-on": "สัญลักษณ์: เปิด",
    "table-icons-off": "สัญลักษณ์: ปิด",
    "table-icons-hide-title": "กดเพื่อซ่อนสัญลักษณ์สภาพอากาศและจุดสีในตาราง",
    "table-icons-show-title": "กดเพื่อแสดงสัญลักษณ์สภาพอากาศและจุดสีในตาราง",
    "loc-fetching": "กำลังดึงข้อมูลจาก API...",
    "weather-processing": "กำลังประมวลผลสภาพอากาศปัจจุบัน...",
    "peak-rain-title": "ช่วงฝนสูงสุด",
    "peak-rain-detail": "สูงสุด {prob}% | {intensity}",
    "peak-rain-no-rain": "ไม่มีโอกาสฝน",
    "alert-checking": "กำลังตรวจสอบ",
    "alert-fetching": "ดึงข้อมูลล่าสุดจาก TMD",
    "alert-waiting": "กำลังรอประกาศล่าสุดจาก TMD",
    "alert-no-alert": "ไม่มีแจ้งเตือนพิเศษในพื้นที่นี้",
    "stat-confidence-high": "สูง (ใช้งานได้)",
    "stat-confidence-med": "ปานกลาง (พอใช้ได้)",
    "stat-confidence-low": "ต่ำ (ต้องระวัง)",
    "stat-confidence-very-low": "ต่ำมาก (ไม่ควรใช้อ้างอิง)",
    "stat-unknown": "ไม่ระบุข้อมูล",
    "stat-no-data": "ยังไม่มีข้อมูลเพียงพอ",
    "stat-summary": "ตอนนี้ระบบตรวจเทียบแล้ว {totalChecks} จุดตรวจ พบฝนตกจริง {rainRate}% ของจุดที่เก็บ และมีค่าคลาดเคลื่อนปริมาณฝนเฉลี่ย {avgError} มม. ระดับการอ่านผลตอนนี้คือ \"{confidenceLabel}\"",
    "compare-time-title": "เปรียบเทียบข้อมูล: {date} {hour} น.",
    "day-today": "วันนี้",
    "day-tomorrow": "พรุ่งนี้",
    
    // Probabilities
    "prob-low": "โอกาสฝนน้อย",
    "prob-med": "โอกาสฝนปานกลาง",
    "prob-high": "โอกาสฝนสูง",
    "prob-very-high": "โอกาสฝนสูงมาก",
    "prob-unknown": "ไม่ระบุช่วง",
    
    // Intensities
    "int-none": "ไม่พบฝน",
    "int-drizzle": "ฝนปรอย/เบามาก",
    "int-light": "ฝนเบา",
    "int-moderate": "ฝนปานกลาง",
    "int-heavy": "ฝนหนัก",
    "int-very-heavy": "ฝนหนักมาก",
    "int-severe": "ฝนรุนแรงมาก",
    "int-unknown": "ไม่ระบุระดับ",
    
    // Sources
    "src-openmeteo": "Open-Meteo",
    "src-openweather": "OpenWeather",
    "src-unknown": "ไม่ระบุ",
    
    // Lead times
    "lt-0-6h": "0 - 6 ชั่วโมง",
    "lt-6-12h": "6 - 12 ชั่วโมง",
    "lt-12-24h": "12 - 24 ชั่วโมง",
    "lt-24-48h": "24 - 48 ชั่วโมง",
    "lt-48-72h": "48 - 72 ชั่วโมง",
    "lt-72h+": "มากกว่า 72 ชั่วโมง",
    "lt-past": "ข้อมูลในอดีต",
    "lt-unknown": "ไม่ระบุ",

    // Diurnal (time of day)
    "diurnal-morning": "เช้า (06:00-11:59)",
    "diurnal-afternoon": "บ่าย (12:00-17:59)",
    "diurnal-evening": "เย็น-ค่ำ (18:00-23:59)",
    "diurnal-night": "ดึก-เช้ามืด (00:00-05:59)",
    "diurnal-unknown": "ไม่ระบุ",
    "stat-breakdown-diurnal": "แยกตามช่วงเวลาของวัน",
    "stat-confusion-title": "ตารางความถูกต้อง (Confusion Matrix)",

    // Months (Thai)
    "month-01": "ม.ค.", "month-02": "ก.พ.", "month-03": "มี.ค.", "month-04": "เม.ย.",
    "month-05": "พ.ค.", "month-06": "มิ.ย.", "month-07": "ก.ค.", "month-08": "ส.ค.",
    "month-09": "ก.ย.", "month-10": "ต.ค.", "month-11": "พ.ย.", "month-12": "ธ.ค."
  },
  zh: {
    "btn-stats": "历史准确率",
    "btn-guide": "使用指南",
    "source-label": "当前数据源",
    "source-caption": "主要用于小时和每日预报视图",
    "current-prob": "当前降雨概率",
    "radar-hint": "点击左侧卡片更改预报位置",
    "alert-tmd": "TMD 警报 / 公告",
    "alert-read-full": "阅读完整公告",
    "chart-title": "小时降雨概率趋势",
    "table-title": "小时降雨概率表",
    "legend-low": "低 (0-40%)",
    "legend-med": "中等 (41-70%)",
    "legend-high": "高 (71-90%)",
    "legend-very-high": "极高 (91-100%)",
    "reliability-title": "数据可靠性级别",
    "rel-high-desc": "可靠性 <strong>高</strong>：数据相对稳定，可用于决策和准备",
    "rel-med-desc": "可靠性 <strong>中等</strong>：用作 <strong>\"趋势\"</strong> 参考，适合初步提前规划",
    "rel-low-desc": "可靠性 <strong>低</strong>：仅为长期预测，容易发生变化，<strong>不应作为重要决策依据</strong>",
    "modal-loc-title": "设置位置",
    "label-prov": "省份 (Province)",
    "label-dist": "区县 (District)",
    "select-prov-first": "请先选择省份",
    "map-pin-hint": "在地图上标记 (点击选择坐标)",
    "btn-cancel": "取消",
    "btn-save-loc": "保存坐标",
    "modal-guide-title": "如何阅读预报数据",
    "btn-understand": "知道了",
    "modal-compare-title": "预报数据对比",
    "btn-close": "关闭",
    "modal-stats-title": "历史准确率统计",
    "stat-total-checks": "历史检查点总数",
    "stat-hit-rate": "实际降雨命中率",
    "stat-avg-error": "平均降雨误差",
    "stat-confidence": "可靠性级别",
    "stat-summary-title": "快速概览",
    "stat-breakdown-prob": "按降雨概率分类",
    "stat-breakdown-source": "按数据源分类 (Source)",
    "stat-breakdown-lead": "按提前时间分类 (Lead Time)",
    "stat-breakdown-intensity": "按实际降雨强度分类",
    "loading-processing": "正在处理数据...",
    "loading-stats": "正在加载统计数据...",
    
    // Dynamic text
    "table-icons-on": "天气图标: 开",
    "table-icons-off": "天气图标: 关",
    "table-icons-hide-title": "点击隐藏表格中的天气图标和颜色圆点",
    "table-icons-show-title": "点击显示表格中的天气图标和颜色圆点",
    "loc-fetching": "正在从 API 获取数据...",
    "weather-processing": "正在处理当前天气...",
    "peak-rain-title": "最大降雨时段",
    "peak-rain-detail": "最高 {prob}% | {intensity}",
    "peak-rain-no-rain": "无降雨可能",
    "alert-checking": "正在检查",
    "alert-fetching": "从 TMD 获取最新数据",
    "alert-waiting": "等待 TMD 最新公告",
    "alert-no-alert": "该地区无特殊警报",
    "stat-confidence-high": "高 (可靠)",
    "stat-confidence-med": "中等 (可用)",
    "stat-confidence-low": "低 (需谨慎)",
    "stat-confidence-very-low": "极低 (不宜参考)",
    "stat-unknown": "未知",
    "stat-no-data": "数据不足",
    "stat-summary": "目前系统已检查 {totalChecks} 个数据点，发现 {rainRate}% 的检查点有实际降雨，平均降雨量误差为 {avgError} 毫米。当前的置信度为\"{confidenceLabel}\"",
    "compare-time-title": "数据对比: {date} {hour}:00",
    "day-today": "今天",
    "day-tomorrow": "明天",
    
    // Probabilities
    "prob-low": "降雨概率低",
    "prob-med": "降雨概率中等",
    "prob-high": "降雨概率高",
    "prob-very-high": "降雨概率极高",
    "prob-unknown": "未知",
    
    // Intensities
    "int-none": "无降雨",
    "int-drizzle": "毛毛雨/极弱",
    "int-light": "小雨",
    "int-moderate": "中雨",
    "int-heavy": "大雨",
    "int-very-heavy": "暴雨",
    "int-severe": "特大暴雨",
    "int-unknown": "未知等级",
    
    // Sources
    "src-openmeteo": "Open-Meteo",
    "src-openweather": "OpenWeather",
    "src-unknown": "未知",
    
    // Lead times
    "lt-0-6h": "0 - 6 小时",
    "lt-6-12h": "6 - 12 小时",
    "lt-12-24h": "12 - 24 小时",
    "lt-24-48h": "24 - 48 小时",
    "lt-48-72h": "48 - 72 小时",
    "lt-72h+": "超过 72 小时",
    "lt-past": "历史数据",
    "lt-unknown": "未知",

    // Diurnal (time of day)
    "diurnal-morning": "上午 (06:00-11:59)",
    "diurnal-afternoon": "下午 (12:00-17:59)",
    "diurnal-evening": "傍晚 (18:00-23:59)",
    "diurnal-night": "凌晨 (00:00-05:59)",
    "diurnal-unknown": "未知",
    "stat-breakdown-diurnal": "按时间段分类",
    "stat-confusion-title": "混淆矩阵 (Confusion Matrix)",

    // Months (Chinese)
    "month-01": "1月", "month-02": "2月", "month-03": "3月", "month-04": "4月",
    "month-05": "5月", "month-06": "6月", "month-07": "7月", "month-08": "8月",
    "month-09": "9月", "month-10": "10月", "month-11": "11月", "month-12": "12月"
  }
};

let currentLang = localStorage.getItem("appLang") || "th";

function setLanguage(lang) {
  if (i18nConfig[lang]) {
    currentLang = lang;
    localStorage.setItem("appLang", lang);
    translateUI();
    document.documentElement.lang = lang;
    const indicator = document.getElementById("lang-indicator");
    if (indicator) {
      indicator.textContent = lang.toUpperCase();
    }
  }
}

function toggleLanguage() {
  const newLang = currentLang === "th" ? "zh" : "th";
  setLanguage(newLang);
}

function t(key, replacements = {}) {
  const langDict = i18nConfig[currentLang] || i18nConfig["th"];
  let text = langDict[key] !== undefined ? langDict[key] : key;
  
  for (const [k, v] of Object.entries(replacements)) {
    text = text.replace(new RegExp(`\\{${k}\\}`, 'g'), v);
  }
  
  return text;
}

function translateUI() {
  document.querySelectorAll("[data-i18n]").forEach(el => {
    const key = el.getAttribute("data-i18n");
    // Only replace HTML if we know it contains tags, otherwise textContent is safer
    if (key.startsWith("rel-") || key === "peak-rain-detail") {
      el.innerHTML = t(key);
    } else {
      el.textContent = t(key);
    }
  });
}

// Call initially
document.addEventListener("DOMContentLoaded", () => {
  setLanguage(currentLang);
});
