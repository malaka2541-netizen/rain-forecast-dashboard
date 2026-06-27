// Rain Forecast Dashboard Logic - API Only Mode (Light Theme Only)

// Default coordinates and location name
const DEFAULT_LAT = 13.7563;
const DEFAULT_LON = 100.5018;
const DEFAULT_LOCATION_NAME = "กรุงเทพมหานคร";

// Current coordinates from localStorage
let currentLat = localStorage.getItem("appLat") ? parseFloat(localStorage.getItem("appLat")) : DEFAULT_LAT;
let currentLon = localStorage.getItem("appLon") ? parseFloat(localStorage.getItem("appLon")) : DEFAULT_LON;
let currentLocName = localStorage.getItem("appLocName") || DEFAULT_LOCATION_NAME;

// Application State Variables
let activeForecastData = [];
let selectedDate = "";
let forecastChartInstance = null;
let tmdAdvisoryState = null;
let sourceComparisonState = {
  openMeteoText: "กำลังโหลด...",
  tmdText: "รอการเชื่อมต่อ...",
  tmdConfigured: null
};

// DOM Elements
const displayLocation = document.getElementById("display-location");
const displayDateRange = document.getElementById("display-date-range");
const forecastAvgPercent = document.getElementById("forecast-avg-percent");
const kpiSelectedDate = document.getElementById("kpi-selected-date");
const kpiPeakWindow = document.getElementById("kpi-peak-window");
const kpiPeakDetail = document.getElementById("kpi-peak-detail");
const kpiAlertHeadline = document.getElementById("kpi-alert-headline");
const kpiAlertDetail = document.getElementById("kpi-alert-detail");
const kpiIntensity = document.getElementById("kpi-intensity");
const kpiIntensityDetail = document.getElementById("kpi-intensity-detail");
const weatherIconDynamic = document.getElementById("weather-icon-dynamic");

const dayTabsContainer = document.getElementById("day-tabs");
const forecastTableBody = document.getElementById("forecast-table-body");

const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const openMeteoSourceStatus = document.getElementById("openmeteo-source-status");
const tmdSourceStatus = document.getElementById("tmd-source-status");
const tableHoverTooltip = document.createElement("div");
tableHoverTooltip.className = "forecast-hover-tooltip hidden";
document.body.appendChild(tableHoverTooltip);

function clampProbability(probabilityPercent) {
  const numericValue = Number(probabilityPercent);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.min(1, parseFloat((numericValue / 100).toFixed(2))));
}

function getWeatherDetails(weatherCode, precipitationMm = 0, windGustKmh = 0, probability = null) {
  const code = Number.isFinite(Number(weatherCode)) ? Number(weatherCode) : null;
  const rainMm = Number.isFinite(Number(precipitationMm)) ? Number(precipitationMm) : 0;
  const gustKmh = Number.isFinite(Number(windGustKmh)) ? Number(windGustKmh) : 0;
  const rainProbability = typeof probability === "number" ? Math.max(0, Math.min(1, probability)) : null;
  let details;

  if ([95, 96, 99].includes(code)) {
    details = {
      iconClass: "fa-solid fa-cloud-bolt",
      label: code === 99 ? "พายุฝนฟ้าคะนองรุนแรง มีโอกาสลูกเห็บ" : "พายุฝนฟ้าคะนอง",
      severity: "storm",
      isStorm: true
    };
  } else if ([65, 80, 81, 82].includes(code)) {
    details = {
      iconClass: "fa-solid fa-cloud-showers-heavy",
      label: rainMm >= 10 ? "ฝนตกหนักมาก" : "ฝนตกหนัก",
      severity: "heavy",
      isStorm: gustKmh >= 50
    };
  } else if ([61, 63, 66, 67].includes(code)) {
    details = {
      iconClass: "fa-solid fa-cloud-showers-water",
      label: "ฝนตกปานกลาง",
      severity: "moderate",
      isStorm: false
    };
  } else if ([51, 53, 55, 56, 57].includes(code)) {
    details = {
      iconClass: "fa-solid fa-cloud-rain",
      label: "ฝนปรอยๆ",
      severity: "drizzle",
      isStorm: false
    };
  } else if ([45, 48].includes(code)) {
    details = {
      iconClass: "fa-solid fa-smog",
      label: "หมอก",
      severity: "calm",
      isStorm: false
    };
  } else if ([1, 2].includes(code)) {
    details = {
      iconClass: "fa-solid fa-cloud-sun",
      label: "เมฆบางส่วน",
      severity: "calm",
      isStorm: false
    };
  } else if (code === 3) {
    details = {
      iconClass: "fa-solid fa-cloud",
      label: "เมฆมาก",
      severity: "calm",
      isStorm: false
    };
  } else if (code === 0) {
    details = {
      iconClass: "fa-solid fa-sun",
      label: "ท้องฟ้าโปร่ง",
      severity: "calm",
      isStorm: false
    };
  } else {
    details = {
      iconClass: rainMm > 0 ? "fa-solid fa-cloud-rain" : "fa-solid fa-cloud",
      label: rainMm > 0 ? "มีฝน" : "สภาพอากาศทั่วไป",
      severity: rainMm > 0 ? "moderate" : "calm",
      isStorm: false
    };
  }

  if (rainProbability === null || details.severity === "calm") {
    return details;
  }

  if (rainProbability < 0.2) {
    return {
      iconClass: rainMm > 0 || details.severity !== "calm" ? "fa-solid fa-cloud-rain" : "fa-solid fa-cloud-sun",
      label: details.severity === "storm" ? "โอกาสฝนฟ้าคะนองต่ำ" : "โอกาสฝนต่ำ",
      severity: rainMm > 0 ? "drizzle" : "calm",
      isStorm: false
    };
  }

  if (rainProbability < 0.4 && (details.severity === "storm" || details.severity === "heavy")) {
    return {
      iconClass: "fa-solid fa-cloud-rain",
      label: details.severity === "storm" ? "มีโอกาสฝนฟ้าคะนองบางช่วง" : "มีโอกาสฝนเป็นช่วง",
      severity: "moderate",
      isStorm: false
    };
  }

  return details;
}

function buildWeatherIconHtml(weather) {
  return `<i class="${weather.iconClass} weather-icon weather-icon-${weather.severity}" aria-hidden="true"></i>`;
}

function formatMillimeters(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} มม.` : "-";
}

function formatWindKmh(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} กม./ชม.` : "-";
}

function getEntryProbability(entry) {
  return entry && typeof entry.probability === "number" ? entry.probability : null;
}

function getSelectedDayEntries() {
  const currentDayData = activeForecastData.find(day => day.date === selectedDate);
  if (!currentDayData) return [];

  return Object.keys(currentDayData.values)
    .sort()
    .map(hour => ({
      hour,
      entry: currentDayData.values[hour],
      probability: getEntryProbability(currentDayData.values[hour])
    }))
    .filter(item => item.probability !== null);
}

function formatHourRange(startHour, endHour) {
  if (!startHour || !endHour) return "-";
  return startHour === endHour ? startHour : `${startHour}-${endHour}`;
}

function getWeatherSeverityRank(severity) {
  switch (severity) {
    case "storm":
      return 4;
    case "heavy":
      return 3;
    case "moderate":
      return 2;
    case "drizzle":
      return 1;
    default:
      return 0;
  }
}

function findPeakRainWindow(entries) {
  if (!entries.length) return null;

  let peakIndex = 0;
  entries.forEach((item, index) => {
    const currentScore = (item.probability ?? 0) * 1000 + (item.entry.precipitation ?? 0);
    const bestScore = (entries[peakIndex].probability ?? 0) * 1000 + (entries[peakIndex].entry.precipitation ?? 0);
    if (currentScore > bestScore) {
      peakIndex = index;
    }
  });

  let startIndex = peakIndex;
  let endIndex = peakIndex;

  if ((entries[peakIndex].probability ?? 0) >= 0.7) {
    while (startIndex > 0 && (entries[startIndex - 1].probability ?? 0) >= 0.7) {
      startIndex--;
    }
    while (endIndex < entries.length - 1 && (entries[endIndex + 1].probability ?? 0) >= 0.7) {
      endIndex++;
    }
  }

  const peakEntry = entries[peakIndex];
    const weather = getWeatherDetails(
      peakEntry.entry.weatherCode,
      peakEntry.entry.precipitation,
      peakEntry.entry.windGust,
      peakEntry.probability
    );

  return {
    startHour: entries[startIndex].hour,
    endHour: entries[endIndex].hour,
    probability: peakEntry.probability,
    weather
  };
}

function findLongestLowRainWindow(entries, threshold = 0.3) {
  if (!entries.length) return null;

  let bestWindow = null;
  let currentStart = null;

  for (let index = 0; index <= entries.length; index++) {
    const item = entries[index];
    const isLowRain = item && (item.probability ?? 1) <= threshold;

    if (isLowRain && currentStart === null) {
      currentStart = index;
    }

    if ((!isLowRain || index === entries.length) && currentStart !== null) {
      const endIndex = index - 1;
      const segment = entries.slice(currentStart, endIndex + 1);
      const maxProbability = Math.max(...segment.map(segmentItem => segmentItem.probability ?? 0));
      const candidate = {
        startHour: entries[currentStart].hour,
        endHour: entries[endIndex].hour,
        hourCount: segment.length,
        maxProbability
      };

      if (
        !bestWindow ||
        candidate.hourCount > bestWindow.hourCount ||
        (candidate.hourCount === bestWindow.hourCount && candidate.maxProbability < bestWindow.maxProbability)
      ) {
        bestWindow = candidate;
      }

      currentStart = null;
    }
  }

  return bestWindow;
}

function findStrongestRainProfile(entries) {
  if (!entries.length) return null;

  let best = null;

  entries.forEach(item => {
    const weather = getWeatherDetails(item.entry.weatherCode, item.entry.precipitation, item.entry.windGust, item.probability);
    const candidate = {
      hour: item.hour,
      probability: item.probability ?? 0,
      precipitation: Number(item.entry.precipitation ?? 0),
      windGust: Number(item.entry.windGust ?? 0),
      weather,
      severityRank: getWeatherSeverityRank(weather.severity)
    };

    if (!best) {
      best = candidate;
      return;
    }

    const candidateScore =
      candidate.precipitation * 10000 +
      candidate.probability * 5000 +
      candidate.severityRank * 100 +
      candidate.windGust;
    const bestScore =
      best.precipitation * 10000 +
      best.probability * 5000 +
      best.severityRank * 100 +
      best.windGust;

    if (candidateScore > bestScore) {
      best = candidate;
    }
  });

  return best;
}

function buildTableTooltipHtml(hour, entry) {
  const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, entry.probability);
  const weatherIconHtml = buildWeatherIconHtml(weather);
  const stormAlert = weather.isStorm || (entry.probability >= 0.5 && entry.windGust >= 50)
    ? `<div class="forecast-hover-line forecast-hover-alert">แจ้งเตือน: เสี่ยงพายุหรือฝนรุนแรง</div>`
    : "";
  return `
    <div class="forecast-hover-title">${hour} น.</div>
    <div class="forecast-hover-line">โอกาสเกิดฝน: ${Math.round(entry.probability * 100)}%</div>
    <div class="forecast-hover-line forecast-hover-weather">สภาพอากาศ: ${weatherIconHtml}<span>${weather.label}</span></div>
    <div class="forecast-hover-line">ปริมาณฝนคาดการณ์: ${formatMillimeters(entry.precipitation)}</div>
    <div class="forecast-hover-line">ลมกระโชก: ${formatWindKmh(entry.windGust)}</div>
    ${stormAlert}
  `;
}

function showTableTooltip(html, event) {
  tableHoverTooltip.innerHTML = html;
  tableHoverTooltip.classList.remove("hidden");
  moveTableTooltip(event);
}

function moveTableTooltip(event) {
  if (tableHoverTooltip.classList.contains("hidden")) return;

  const offsetX = 18;
  const offsetY = 18;
  const tooltipWidth = tableHoverTooltip.offsetWidth || 260;
  const tooltipHeight = tableHoverTooltip.offsetHeight || 120;
  const viewportWidth = window.innerWidth;
  const viewportHeight = window.innerHeight;

  let left = event.clientX + offsetX;
  let top = event.clientY + offsetY;

  if (left + tooltipWidth > viewportWidth - 16) {
    left = event.clientX - tooltipWidth - 16;
  }

  if (top + tooltipHeight > viewportHeight - 16) {
    top = event.clientY - tooltipHeight - 16;
  }

  tableHoverTooltip.style.left = `${Math.max(12, left)}px`;
  tableHoverTooltip.style.top = `${Math.max(12, top)}px`;
}

function hideTableTooltip() {
  tableHoverTooltip.classList.add("hidden");
}

function renderSourceComparison() {
  if (!openMeteoSourceStatus || !tmdSourceStatus) return;
  openMeteoSourceStatus.textContent = sourceComparisonState.openMeteoText;
  tmdSourceStatus.textContent = sourceComparisonState.tmdText;
}

function flattenForecastEntries(forecastDays) {
  const entries = [];
  forecastDays.forEach(day => {
    Object.entries(day.values).forEach(([hour, entry]) => {
      entries.push({
        date: day.date,
        hour,
        entry
      });
    });
  });
  return entries.sort((a, b) => `${a.date}T${a.hour}`.localeCompare(`${b.date}T${b.hour}`));
}

function buildOpenMeteoStatusText(forecastDays) {
  const entries = flattenForecastEntries(forecastDays).slice(0, 24);
  const peakEntry = entries.reduce((best, current) => {
    const probability = getEntryProbability(current.entry);
    if (probability === null) return best;
    if (!best || probability > best.probability) {
      return { ...current, probability };
    }
    return best;
  }, null);

  if (!peakEntry) {
    return "ยังไม่มีข้อมูลรายชั่วโมง";
  }

  return `24 ชม. สูงสุด ${Math.round(peakEntry.probability * 100)}% ที่ ${peakEntry.hour}`;
}

function normalizeTmdDailyForecast(responseData) {
  const source = responseData?.WeatherForecasts?.[0];
  const forecasts = source?.forecasts || [];
  return forecasts.map(item => ({
    date: item.time ? item.time.substring(0, 10) : "",
    rainMm: Number(item.data?.rain ?? 0),
    tempMin: Number(item.data?.tc_min ?? 0),
    tempMax: Number(item.data?.tc_max ?? 0),
    cond: item.data?.cond ?? null
  }));
}

function normalizeTmdHourlyForecast(responseData) {
  const source = responseData?.WeatherForecasts?.[0];
  const forecasts = source?.forecasts || [];
  return forecasts.map(item => ({
    time: item.time || "",
    rainMm: Number(item.data?.rain ?? 0),
    temperature: Number(item.data?.tc ?? 0),
    humidity: Number(item.data?.rh ?? 0),
    cond: item.data?.cond ?? null
  }));
}

function buildTmdStatusText(dailyForecasts, hourlyForecasts) {
  if (!dailyForecasts.length && !hourlyForecasts.length) {
    return "ยังไม่มีข้อมูลจาก TMD";
  }

  const nextThreeDays = dailyForecasts
    .slice(0, 3)
    .map(item => `${formatDateTab(item.date)} ${item.rainMm.toFixed(1)} มม.`)
    .join(" | ");

  const next24HoursMaxRain = hourlyForecasts
    .slice(0, 24)
    .reduce((maxRain, item) => Math.max(maxRain, item.rainMm), 0);

  if (nextThreeDays) {
    return `24 ชม. สูงสุด ${next24HoursMaxRain.toFixed(1)} มม. | ${nextThreeDays}`;
  }

  return `24 ชม. สูงสุด ${next24HoursMaxRain.toFixed(1)} มม.`;
}

function getFirstReadableText(value) {
  if (Array.isArray(value)) {
    return value.find(item => typeof item === "string" && /[A-Za-z]/.test(item)) || value.find(item => typeof item === "string") || "";
  }
  return typeof value === "string" ? value : "";
}

function formatWarningEffectRange(text) {
  if (!text) return "";

  const match = text.match(/Effect during ([^)]+)\)/i);
  if (!match) return "";

  let range = match[1]
    .replace("June", "มิ.ย.")
    .replace("July", "ก.ค.")
    .replace("August", "ส.ค.")
    .replace("September", "ก.ย.")
    .replace("October", "ต.ค.")
    .replace("November", "พ.ย.")
    .replace("December", "ธ.ค.")
    .replace("January", "ม.ค.")
    .replace("February", "ก.พ.")
    .replace("March", "มี.ค.")
    .replace("April", "เม.ย.")
    .replace("May", "พ.ค.")
    .trim();

  range = range.replace(/\s+/g, " ");
  range = range.replace(/(\d{4})$/, (_, year) => String((Number(year) + 543) % 100));
  return `มีผล ${range}`;
}

function extractWarningReference(text) {
  if (!text) return "";
  const match = text.match(/No\.\s*([0-9/()-]+)/i);
  return match ? `ฉบับที่ ${match[1]}` : "";
}

function formatTmdDateTime(dateTimeString) {
  if (!dateTimeString) return "";
  const safeString = dateTimeString.replace(" ", "T");
  const date = new Date(safeString);
  if (Number.isNaN(date.getTime())) return "";

  const months = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const day = date.getDate();
  const month = months[date.getMonth()];
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${day} ${month} ${hour}:${minute} น.`;
}

function inferTmdAlertLabel(titleText, headlineText, descriptionText) {
  const combined = [titleText, headlineText, descriptionText].join(" ").toLowerCase();

  if (combined.includes("tropical storm") || combined.includes("typhoon") || combined.includes("depression")) {
    return "TMD เตือนพายุเขตร้อน";
  }
  if (combined.includes("summer storm")) {
    return "TMD เตือนพายุฤดูร้อน";
  }
  if (combined.includes("heavy to very heavy rain")) {
    return "TMD เตือนฝนหนักถึงหนักมาก";
  }
  if (combined.includes("heavy rain")) {
    return "TMD เตือนฝนหนัก";
  }
  if (combined.includes("thundershower") || combined.includes("thunderstorm")) {
    return "TMD เฝ้าระวังฝนฟ้าคะนอง";
  }
  if (combined.includes("wind-waves")) {
    return "TMD เตือนลมแรงและคลื่นสูง";
  }
  return "TMD แจ้งเตือนสภาพอากาศ";
}

function inferTmdAlertSeverity(labelText) {
  if (labelText.includes("พายุ") || labelText.includes("หนักมาก")) return "storm";
  if (labelText.includes("ฝนหนัก") || labelText.includes("ลมแรง")) return "heavy";
  if (labelText.includes("ฝนฟ้าคะนอง")) return "moderate";
  return "calm";
}

function normalizeTmdWarning(responseData) {
  const warning = responseData?.Warning;
  if (!warning || (typeof warning === "object" && !Array.isArray(warning) && Object.keys(warning).length === 0)) {
    return null;
  }

  const titleEnglish = getFirstReadableText(warning.TitleEnglish);
  const headlineEnglish = getFirstReadableText(warning.HeadlineEnglish);
  const descriptionEnglish = getFirstReadableText(warning.DescriptionEnglish);
  const label = inferTmdAlertLabel(titleEnglish, headlineEnglish, descriptionEnglish);
  const effectText = formatWarningEffectRange(titleEnglish || headlineEnglish);
  const announceText = formatTmdDateTime(warning.AnnounceDate);
  const issueText = extractWarningReference(titleEnglish || headlineEnglish);
  const detail = [
    effectText,
    announceText ? `อัปเดต ${announceText}` : issueText
  ].filter(Boolean).join(" | ") || "ประกาศเตือนล่าสุดจาก TMD";

  return {
    label,
    detail,
    severity: inferTmdAlertSeverity(label),
    source: "warning",
    url: getFirstReadableText(warning.WebUrlEnglish) || warning.WebUrlThai || "",
    publishedAt: warning.AnnounceDate || warning.EffectStartDate || ""
  };
}

function normalizeTmdDailySummary(responseData) {
  const dailyForecast = responseData?.DailyForecast;
  if (!dailyForecast) return null;

  const overviewEnglish = getFirstReadableText(dailyForecast.OverallDescriptionEnglish);
  const dateLabel = getFirstReadableText(dailyForecast.Date);
  if (!overviewEnglish) return null;

  const label = inferTmdAlertLabel("", overviewEnglish, overviewEnglish);
  return {
    label,
    detail: dateLabel ? `พยากรณ์ 24 ชม. | ${dateLabel}` : "พยากรณ์ 24 ชม. จาก TMD",
    severity: inferTmdAlertSeverity(label),
    source: "daily-summary"
  };
}

function buildModelAlert(selectedEntries) {
  const peakWindow = findPeakRainWindow(selectedEntries);
  const strongestProfile = findStrongestRainProfile(selectedEntries);

  if (!peakWindow || !strongestProfile) {
    return {
      label: "ไม่มีสัญญาณฝนหนักเด่นชัด",
      detail: "ไม่พบช่วงเสี่ยงฝนหนักจากแบบจำลอง",
      severity: "calm",
      source: "model"
    };
  }

  if (strongestProfile.weather.severity === "storm" && strongestProfile.probability >= 0.5) {
    return {
      label: "เฝ้าระวังพายุฝนฟ้าคะนอง",
      detail: `${formatHourRange(peakWindow.startHour, peakWindow.endHour)} | แบบจำลองคาดฝน ${formatMillimeters(strongestProfile.precipitation)}`,
      severity: "storm",
      source: "model"
    };
  }

  if ((strongestProfile.weather.severity === "heavy" || strongestProfile.precipitation >= 8) && strongestProfile.probability >= 0.6) {
    return {
      label: "เฝ้าระวังฝนตกหนัก",
      detail: `${formatHourRange(peakWindow.startHour, peakWindow.endHour)} | แบบจำลองคาดฝน ${formatMillimeters(strongestProfile.precipitation)}`,
      severity: "heavy",
      source: "model"
    };
  }

  if (peakWindow.probability >= 0.7) {
    return {
      label: "เฝ้าระวังฝนเป็นช่วง",
      detail: `${formatHourRange(peakWindow.startHour, peakWindow.endHour)} | โอกาสฝนสูงสุด ${Math.round(peakWindow.probability * 100)}%`,
      severity: "moderate",
      source: "model"
    };
  }

  return {
    label: "ไม่มีสัญญาณฝนหนักเด่นชัด",
    detail: "ไม่พบช่วงเสี่ยงฝนหนักจากแบบจำลอง",
    severity: "calm",
    source: "model"
  };
}

function resolveAlertCardData(selectedEntries) {
  if (tmdAdvisoryState?.warning) {
    return tmdAdvisoryState.warning;
  }
  if (tmdAdvisoryState?.dailySummary) {
    return tmdAdvisoryState.dailySummary;
  }
  return buildModelAlert(selectedEntries);
}

function applyAlertVisualState(severity) {
  const iconMap = {
    storm: "fa-solid fa-cloud-bolt",
    heavy: "fa-solid fa-cloud-showers-heavy",
    moderate: "fa-solid fa-cloud-rain",
    calm: "fa-solid fa-shield-halved"
  };

  const toneMap = {
    storm: "icon-red",
    heavy: "icon-yellow",
    moderate: "icon-blue",
    calm: "icon-green"
  };

  const alertIcon = document.getElementById("kpi-alert-icon");
  if (!alertIcon) return;

  alertIcon.className = `kpi-icon ${toneMap[severity] || "icon-yellow"}`;
  alertIcon.innerHTML = `<i class="${iconMap[severity] || "fa-solid fa-triangle-exclamation"}"></i>`;
}

async function fetchOpenMeteoForecast(lat, lon) {
  const response = await fetch(`/api/forecast/openmeteo?lat=${lat}&lon=${lon}&_t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned status ${response.status}`);
  }

  const data = await response.json();
  const hourly = data.hourly;
  const grouped = {};

  hourly.time.forEach((timeStr, index) => {
    const [datePart, timePart] = timeStr.split("T");
    const hourKey = timePart.substring(0, 5);
    if (!grouped[datePart]) grouped[datePart] = {};

    const probability = clampProbability(hourly.precipitation_probability?.[index]);
    const precipitation = Number(hourly.precipitation?.[index] ?? 0);
    const weatherCode = Number(hourly.weather_code?.[index] ?? 0);
    const windSpeed = Number(hourly.wind_speed_10m?.[index] ?? 0);
    const windGust = Number(hourly.wind_gusts_10m?.[index] ?? 0);

    grouped[datePart][hourKey] = {
      probability,
      precipitation: Number.isFinite(precipitation) ? precipitation : 0,
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : 0,
      windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
      windGust: Number.isFinite(windGust) ? windGust : 0
    };
  });

  const forecastDays = Object.keys(grouped)
    .sort()
    .map(dateStr => ({
      date: dateStr,
      values: grouped[dateStr]
    }));

  return {
    forecastDays,
    statusText: buildOpenMeteoStatusText(forecastDays)
  };
}

async function fetchJsonWithMeta(url, label) {
  const response = await fetch(url);
  const data = await response.json();

  if (!response.ok) {
    const error = new Error(data.error || `${label} returned status ${response.status}`);
    error.status = response.status;
    error.payload = data;
    throw error;
  }

  return data;
}

async function fetchTmdForecastSummary(lat, lon) {
  const [warningResult, dailySummaryResult, dailyResult, hourlyResult] = await Promise.allSettled([
    fetchJsonWithMeta(`/api/forecast/tmd/warning?_t=${Date.now()}`, "TMD warning"),
    fetchJsonWithMeta(`/api/forecast/tmd/daily-summary?_t=${Date.now()}`, "TMD daily summary"),
    fetchJsonWithMeta(`/api/forecast/tmd/daily?lat=${lat}&lon=${lon}&_t=${Date.now()}`, "TMD daily"),
    fetchJsonWithMeta(`/api/forecast/tmd/hourly?lat=${lat}&lon=${lon}&_t=${Date.now()}`, "TMD hourly")
  ]);

  const dailyForecasts = dailyResult.status === "fulfilled"
    ? normalizeTmdDailyForecast(dailyResult.value)
    : [];
  const hourlyForecasts = hourlyResult.status === "fulfilled"
    ? normalizeTmdHourlyForecast(hourlyResult.value)
    : [];

  const tokenError = [dailyResult, hourlyResult]
    .filter(result => result.status === "rejected")
    .map(result => result.reason)
    .find(reason => reason?.status === 503 || reason?.payload?.configured === false);

  const warning = warningResult.status === "fulfilled"
    ? normalizeTmdWarning(warningResult.value)
    : null;
  const dailySummary = dailySummaryResult.status === "fulfilled"
    ? normalizeTmdDailySummary(dailySummaryResult.value)
    : null;

  const statusText = dailyForecasts.length || hourlyForecasts.length
    ? buildTmdStatusText(dailyForecasts, hourlyForecasts)
    : warning?.label || dailySummary?.label || "ยังไม่มีข้อมูลจาก TMD";

  return {
    dailyForecasts,
    hourlyForecasts,
    statusText,
    alert: {
      warning,
      dailySummary
    },
    tokenConfigured: !tokenError
  };
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  // Fetch real data on load automatically
  renderSourceComparison();
  fetchDashboardData();
  
  // Auto-refresh forecast data every 30 minutes
  setInterval(() => {
    console.log("Auto-refreshing forecast data (every 30 minutes)...");
    fetchDashboardData();
  }, 30 * 60 * 1000); // 1,800,000 ms

  // --- Location Map & Autocomplete Logic ---
  let thaiLocations = [];
  let map = null;
  let marker = null;
  let tempLat = currentLat;
  let tempLon = currentLon;

  const locationCard = document.getElementById("location-card");
  const locModal = document.getElementById("location-modal");
  const btnCancelLoc = document.getElementById("btn-cancel-loc");
  const btnSaveLoc = document.getElementById("btn-save-loc");
  
  const inputProvince = document.getElementById("input-province");
  const inputDistrict = document.getElementById("input-district");
  const datalistProvince = document.getElementById("province-list");

  const btnSearchMap = document.getElementById("btn-search-map");

  // Fetch locations
  fetch("/thailand_locations.json")
    .then(res => res.json())
    .then(data => {
      thaiLocations = data;
      // Populate datalist
      data.forEach(item => {
        const option = document.createElement("option");
        option.value = item.province;
        datalistProvince.appendChild(option);
      });
    })
    .catch(err => console.error("Error loading thai locations:", err));

  // Handle Province input change
  inputProvince.addEventListener("input", (e) => {
    const selectedProv = e.target.value.trim();
    const foundProv = thaiLocations.find(p => p.province === selectedProv);
    
    inputDistrict.innerHTML = '<option value="">กรุณาเลือกอำเภอ</option>';
    if (foundProv) {
      inputDistrict.disabled = false;
      foundProv.districts.forEach(dist => {
        const opt = document.createElement("option");
        opt.value = dist;
        opt.textContent = dist;
        inputDistrict.appendChild(opt);
      });
    } else {
      inputDistrict.disabled = true;
    }
  });

  // Handle Search & Geocode
  async function searchLocationToPin() {
    const selectedDist = inputDistrict.value;
    const selectedProv = inputProvince.value;
    if (!selectedProv) return;

    // First try Nominatim (more accurate for Thailand)
    try {
      const q = selectedDist ? `${selectedDist} ${selectedProv} Thailand` : `${selectedProv} Thailand`;
      let res = await fetch(`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(q)}&format=json&limit=1`);
      let data = await res.json();
      
      if (data && data.length > 0) {
        updateMap(parseFloat(data[0].lat), parseFloat(data[0].lon));
        return;
      }
      
      // Fallback to Open-Meteo
      res = await fetch(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(q)}&count=1&language=th`);
      data = await res.json();
      
      if (data.results && data.results.length > 0) {
        updateMap(data.results[0].latitude, data.results[0].longitude);
      } else {
        alert("ไม่พบพิกัดของสถานที่นี้ กรุณาลองคลิกปักหมุดบนแผนที่แทน");
      }
    } catch(err) {
      console.error("Geocoding failed", err);
    }
  }

  inputDistrict.addEventListener("change", searchLocationToPin);
  
  if (btnSearchMap) {
    btnSearchMap.addEventListener("click", (e) => {
      e.preventDefault(); // prevent form submit if any
      searchLocationToPin();
    });
  }

  // Map Functions
  function initMap() {
    if (!map) {
      map = L.map('map-container').setView([tempLat, tempLon], 10);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);

      marker = L.marker([tempLat, tempLon]).addTo(map);

      map.on('click', async (e) => {
        const lat = e.latlng.lat;
        const lon = e.latlng.lng;
        updateMap(lat, lon);
        
        // Reverse Geocode
        try {
          const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lon}&zoom=10&accept-language=th`);
          const data = await res.json();
          if (data && data.address) {
            const p = data.address.province || data.address.state || "";
            const d = data.address.city || data.address.county || data.address.district || data.address.town || "";
            
            // Auto-fill if found
            if (p) {
              // Try to find matching province in our list
              const matchProv = thaiLocations.find(x => x.province.includes(p.replace("จังหวัด","").trim()) || p.includes(x.province));
              if (matchProv) {
                inputProvince.value = matchProv.province;
                // trigger input event to populate district
                inputProvince.dispatchEvent(new Event("input"));
                
                if (d) {
                  const matchDist = matchProv.districts.find(x => x.includes(d.replace("อำเภอ","").replace("เขต","").trim()) || d.includes(x));
                  if (matchDist) inputDistrict.value = matchDist;
                }
              }
            }
          }
        } catch (err) {
          console.error("Reverse geocoding failed", err);
        }
      });
    } else {
      updateMap(tempLat, tempLon);
    }
    
    // Fix leafet rendering issue in modals
    setTimeout(() => map.invalidateSize(), 100);
  }

  function updateMap(lat, lon) {
    tempLat = parseFloat(lat.toFixed(4));
    tempLon = parseFloat(lon.toFixed(4));
    if (map && marker) {
      marker.setLatLng([tempLat, tempLon]);
      map.setView([tempLat, tempLon]);
    }
  }

  if (locationCard && locModal) {
    locationCard.addEventListener("click", () => {
      // Try to parse existing name into Province and District
      tempLat = currentLat;
      tempLon = currentLon;
      
      const parts = currentLocName.split(" ");
      if (parts.length >= 2) {
        inputProvince.value = parts[1] || "";
        inputProvince.dispatchEvent(new Event("input"));
        inputDistrict.value = parts[0] || "";
      } else {
        inputProvince.value = currentLocName;
        inputProvince.dispatchEvent(new Event("input"));
      }

      locModal.classList.remove("hidden");
      initMap();
    });
  }

  if (btnCancelLoc) {
    btnCancelLoc.addEventListener("click", () => {
      locModal.classList.add("hidden");
    });
  }

  if (btnSaveLoc) {
    btnSaveLoc.addEventListener("click", () => {
      const p = inputProvince.value.trim();
      const d = inputDistrict.value.trim();
      
      let finalName = "";
      if (p && d) finalName = `${d} ${p}`;
      else if (p) finalName = p;
      else finalName = "พิกัดที่ปักหมุด";

      currentLocName = finalName;
      currentLat = tempLat;
      currentLon = tempLon;

      localStorage.setItem("appLocName", currentLocName);
      localStorage.setItem("appLat", currentLat.toString());
      localStorage.setItem("appLon", currentLon.toString());

      locModal.classList.add("hidden");
      
      // Clear data and fetch new location
      activeForecastData = [];
      fetchDashboardData();
    });
  }
});

// Refresh whole dashboard UI
function loadDataAndRefresh() {
  if (activeForecastData.length === 0) return;
  
  // Keep the active selected date if available in new dataset, otherwise select first date
  const dateExists = activeForecastData.some(d => d.date === selectedDate);
  if (!dateExists) {
    selectedDate = activeForecastData[0].date;
  }
  
  updateDateRangeText();
  renderDayTabs();
  renderTable();
  updateKpiAnalytics();
  renderChart();
}

// Update the Date range in Left Panel
function updateDateRangeText() {
  if (activeForecastData.length === 0) return;
  const firstDate = formatDateThai(activeForecastData[0].date);
  const lastDate = formatDateThai(activeForecastData[activeForecastData.length - 1].date);
  displayDateRange.innerText = `ช่วงพยากรณ์: ${firstDate} - ${lastDate}`;
}

// Render tabs for days
function renderDayTabs() {
  dayTabsContainer.innerHTML = "";
  activeForecastData.forEach(d => {
    const tab = document.createElement("button");
    tab.className = `day-tab ${d.date === selectedDate ? "active" : ""}`;
    tab.innerText = formatDateTab(d.date);
    tab.addEventListener("click", () => {
      selectedDate = d.date;
      // update active tab class
      document.querySelectorAll(".day-tab").forEach(t => t.classList.remove("active"));
      tab.classList.add("active");
      
      renderTable();
      renderChart();
      updateKpiAnalytics(); // Refresh average for the selected day
    });
    dayTabsContainer.appendChild(tab);
  });
}

// Update cards statistics
function updateKpiAnalytics() {
  const selectedEntries = getSelectedDayEntries();
  const selectedDaySum = selectedEntries.reduce((sum, item) => sum + item.probability, 0);
  const selectedAvg = selectedEntries.length > 0 ? Math.round((selectedDaySum / selectedEntries.length) * 100) : 0;
  forecastAvgPercent.innerText = `${selectedAvg}%`;
  if (kpiSelectedDate) {
    kpiSelectedDate.innerText = selectedDate ? formatDateContext(selectedDate) : "-";
  }
  
  updateWeatherIcon(selectedAvg);

  if (!selectedEntries.length) {
    kpiPeakWindow.innerText = "-";
    kpiPeakDetail.innerText = "ไม่พบข้อมูลรายชั่วโมง";
    kpiAlertHeadline.innerText = "ไม่มีข้อมูลเตือน";
    kpiAlertDetail.innerText = "ไม่พบข้อมูลรายชั่วโมง";
    kpiIntensity.innerText = "-";
    kpiIntensityDetail.innerText = "ไม่พบข้อมูลรายชั่วโมง";
    applyAlertVisualState("calm");
    return;
  }

  const peakWindow = findPeakRainWindow(selectedEntries);
  const strongestProfile = findStrongestRainProfile(selectedEntries);
  const alertCard = resolveAlertCardData(selectedEntries);

  if (peakWindow) {
    kpiPeakWindow.innerText = formatHourRange(peakWindow.startHour, peakWindow.endHour);
    kpiPeakDetail.innerText = `สูงสุด ${Math.round(peakWindow.probability * 100)}% | ${peakWindow.weather.label}`;
  }

  kpiAlertHeadline.innerText = alertCard.label;
  kpiAlertDetail.innerText = alertCard.detail;
  applyAlertVisualState(alertCard.severity);

  if (strongestProfile) {
    kpiIntensity.innerText = strongestProfile.weather.label;
    kpiIntensityDetail.innerText = `${strongestProfile.hour} | ${formatMillimeters(strongestProfile.precipitation)} | ลม ${formatWindKmh(strongestProfile.windGust)}`;
  }
}

// Update the weather icon visually based on selected day average rain probability
function updateWeatherIcon(avgProb) {
  let iconHtml = "";
  if (avgProb <= 30) {
    iconHtml = '<i class="fa-solid fa-cloud-sun" style="color: #4ade80;"></i>';
  } else if (avgProb <= 70) {
    iconHtml = '<i class="fa-solid fa-cloud-sun-rain" style="color: #fbbf24;"></i>';
  } else {
    iconHtml = '<i class="fa-solid fa-cloud-showers-water" style="color: #f87171;"></i>';
  }
  weatherIconDynamic.innerHTML = iconHtml;
}

// Render dynamic rows of the table
function renderTable() {
  forecastTableBody.innerHTML = "";
  
  activeForecastData.forEach((day) => {
    const row = document.createElement("tr");
    
    // Day cell
    const dateCell = document.createElement("td");
    dateCell.innerText = formatDateThai(day.date);
    row.appendChild(dateCell);
    
    // Render 24 cells for all hours, each with colspan="1"
    const sortedHours = Object.keys(day.values).sort();
    sortedHours.forEach(hour => {
      const cell = document.createElement("td");
      const entry = day.values[hour];
      const val = getEntryProbability(entry);
      
      if (val === null || val === undefined) {
        cell.innerText = "-";
      } else {
        const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, val);
        const valueWrapper = document.createElement("span");
        valueWrapper.className = "table-value";
        valueWrapper.textContent = `${Math.round(val * 100)}%`;

        const iconWrapper = document.createElement("span");
        iconWrapper.className = "table-icon";
        iconWrapper.innerHTML = buildWeatherIconHtml(weather);

        cell.appendChild(valueWrapper);

        if (weather.severity !== "calm" || entry.precipitation > 0) {
          cell.appendChild(iconWrapper);
        }
        cell.setAttribute("aria-label", `${hour} ${weather.label}`);
        cell.addEventListener("mouseenter", (event) => {
          showTableTooltip(buildTableTooltipHtml(hour, entry), event);
        });
        cell.addEventListener("mousemove", moveTableTooltip);
        cell.addEventListener("mouseleave", hideTableTooltip);
        
        if (val <= 0.30) {
          cell.className = "cell-low";
        } else if (val <= 0.70) {
          cell.className = "cell-med";
        } else {
          cell.className = "cell-high";
        }

        if (weather.severity === "heavy") {
          cell.classList.add("cell-heavy");
        }

        if (weather.isStorm) {
          cell.classList.add("cell-storm");
        }
      }
      row.appendChild(cell);
    });
    
    forecastTableBody.appendChild(row);
  });
}

// SVGs for sun/moon icons encoded in base64
const sunSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#f59e0b" d="M12 7c-2.76 0-5 2.24-5 5s2.24 5 5 5 5-2.24 5-5-2.24-5-5-5zM2 13h2c.55 0 1-.45 1-1s-.45-1-1-1H2c-.55 0-1 .45-1 1s.45 1 1 1zm18 0h2c.55 0 1-.45 1-1s-.45-1-1-1h-2c-.55 0-1 .45-1 1s.45 1 1 1zM11 2v2c0 .55.45 1 1 1s1-.45 1-1V2c0-.55-.45-1-1-1s-1 .45-1 1zm0 18v2c0 .55.45 1 1 1s1-.45 1-1v-2c0-.55-.45-1-1-1s-1 .45-1 1zM5.99 4.58a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41L5.99 4.58zm12.37 12.37a.996.996 0 00-1.41 0 .996.996 0 000 1.41l1.06 1.06c.39.39 1.03.39 1.41 0s.39-1.03 0-1.41l-1.06-1.06zm1.06-10.96a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06zM7.05 18.01a.996.996 0 000-1.41.996.996 0 00-1.41 0l-1.06 1.06c-.39.39-.39 1.03 0 1.41s1.03.39 1.41 0l1.06-1.06z"/></svg>`;
const moonSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path fill="#1e3a8a" d="M10 2c-1.82 0-3.53.5-5 1.35C7.99 5.08 10 8.3 10 12s-2.01 6.92-5 8.65C6.47 21.5 8.18 22 10 22c5.52 0 10-4.48 10-10S15.52 2 10 2z"/></svg>`;

const sunIcon = new Image();
sunIcon.onload = () => { if (forecastChartInstance) forecastChartInstance.draw(); };
sunIcon.src = 'data:image/svg+xml;base64,' + btoa(sunSvg);

const moonIcon = new Image();
moonIcon.onload = () => { if (forecastChartInstance) forecastChartInstance.draw(); };
moonIcon.src = 'data:image/svg+xml;base64,' + btoa(moonSvg);

// Chart.js Plugin to draw day/night background bands and sun/moon icons
const dayNightBackgroundPlugin = {
  id: 'dayNightBackground',
  beforeDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    const xAxis = scales.x;
    const labels = chart.data.labels;
    
    ctx.save();
    for (let i = 0; i < labels.length; i++) {
      const label = labels[i];
      const hour = parseInt(label.split(":")[0]);
      const isDay = hour >= 6 && hour < 18;
      
      const xStart = xAxis.getPixelForTick(i);
      let xEnd;
      if (i < labels.length - 1) {
        xEnd = xAxis.getPixelForTick(i + 1);
      } else {
        xEnd = chartArea.right;
      }
      
      ctx.fillStyle = isDay ? 'rgba(245, 158, 11, 0.06)' : 'rgba(71, 85, 105, 0.05)';
      ctx.fillRect(xStart, chartArea.top, xEnd - xStart, chartArea.bottom - chartArea.top);
    }
    ctx.restore();
  },
  afterDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    const xAxis = scales.x;
    
    // Position icons at the top of the chart (20px below chartArea.top)
    const yPos = chartArea.top + 20;
    const iconSize = 26; // size of the icon (26x26 px)
    
    // Left night region: midpoint of 00:00 to 06:00
    // Midpoint is 03:00 (tick index 3)
    const xLeftNight = xAxis.getPixelForTick(3);
    
    // Middle day region: midpoint of 06:00 to 18:00
    // Midpoint is 12:00 (tick index 12)
    const xDay = xAxis.getPixelForTick(12);
    
    // Right night region: midpoint of 18:00 to 23:00
    // Midpoint is 20:30 (halfway between 18:00 and 23:00, indices 18 and 23)
    const xRightNight = (xAxis.getPixelForTick(18) + xAxis.getPixelForTick(23)) / 2;
    
    ctx.save();
    ctx.globalAlpha = 0.6; // 60% opacity
    
    // Draw Left Moon
    if (moonIcon.complete) {
      ctx.drawImage(moonIcon, xLeftNight - iconSize/2, yPos - iconSize/2, iconSize, iconSize);
    }
    // Draw Sun
    if (sunIcon.complete) {
      ctx.drawImage(sunIcon, xDay - iconSize/2, yPos - iconSize/2, iconSize, iconSize);
    }
    // Draw Right Moon
    if (moonIcon.complete) {
      ctx.drawImage(moonIcon, xRightNight - iconSize/2, yPos - iconSize/2, iconSize, iconSize);
    }
    
    ctx.restore();
  }
};

// Draw/Update Chart.js visualization
function renderChart() {
  const currentDayData = activeForecastData.find(d => d.date === selectedDate);
  if (!currentDayData) return;

  const hours = Object.keys(currentDayData.values).sort();
  const values = hours.map(hour => {
    const probability = getEntryProbability(currentDayData.values[hour]);
    return probability !== null ? Math.round(probability * 100) : null;
  });

  const ctx = document.getElementById("forecastChart").getContext("2d");
  
  if (forecastChartInstance) {
    forecastChartInstance.destroy();
  }

  // Hardcode colors to Light Theme settings
  const textColor = "#64748b";
  const gridColor = "rgba(0, 0, 0, 0.05)";
  const gradientColor = "rgba(2, 132, 199, 0.3)";
  const borderColor = "#0284c7";

  const chartGradient = ctx.createLinearGradient(0, 0, 0, 300);
  chartGradient.addColorStop(0, gradientColor);
  chartGradient.addColorStop(1, "rgba(0, 0, 0, 0)");

  forecastChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: hours,
      datasets: [{
        label: "โอกาสการเกิดฝน (%)",
        data: values,
        borderColor: borderColor,
        borderWidth: 3,
        pointBackgroundColor: borderColor,
        pointBorderColor: "#fff",
        pointBorderWidth: 2,
        pointRadius: 4,
        pointHoverRadius: 7,
        fill: true,
        spanGaps: true,
        backgroundColor: chartGradient,
        tension: 0.35
      }]
    },
    plugins: [dayNightBackgroundPlugin],
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          display: false
        },
        tooltip: {
          backgroundColor: "rgba(255, 255, 255, 0.9)",
          titleColor: "#1e293b",
          bodyColor: "#1e293b",
          borderColor: "rgba(0, 0, 0, 0.1)",
          borderWidth: 1,
          displayColors: false,
          callbacks: {
            title: function(context) {
              const label = context[0].label;
              const hour = parseInt(label.split(":")[0]);
              const isDay = hour >= 6 && hour < 18;
              return (isDay ? "☀️ กลางวัน" : "🌙 กลางคืน") + " - " + label;
            },
            label: function(context) {
              const hour = context.label;
              const entry = currentDayData.values[hour];
              const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, entry.probability);

              return [
                `โอกาสฝน: ${context.parsed.y}%`,
                `ลักษณะอากาศ: ${weather.label}`,
                `ปริมาณฝน: ${formatMillimeters(entry.precipitation)}`,
                `ลมกระโชก: ${formatWindKmh(entry.windGust)}`
              ];
            }
          }
        }
      },
      scales: {
        x: {
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Outfit', 'Sarabun', sans-serif",
              size: 11
            }
          }
        },
        y: {
          min: 0,
          max: 100,
          grid: {
            color: gridColor
          },
          ticks: {
            color: textColor,
            font: {
              family: "'Outfit', 'Sarabun', sans-serif",
              size: 11
            },
            callback: function(value) {
              return value + "%";
            }
          }
        }
      }
    }
  });
}

async function fetchDashboardData() {
  showLoading("กำลังเรียกข้อมูลพยากรณ์ล่าสุด...");

  try {
    const [openMeteoResult, tmdResult] = await Promise.allSettled([
      fetchOpenMeteoForecast(currentLat, currentLon),
      fetchTmdForecastSummary(currentLat, currentLon)
    ]);

    if (openMeteoResult.status !== "fulfilled") {
      throw openMeteoResult.reason;
    }

    const { forecastDays, statusText } = openMeteoResult.value;
    if (!forecastDays.length) {
      throw new Error("ไม่สามารถสร้างชุดข้อมูลพยากรณ์อากาศจาก Open-Meteo ได้");
    }

    activeForecastData = forecastDays;
    sourceComparisonState.openMeteoText = statusText;
    displayLocation.innerText = currentLocName;
    console.log("Weather data loaded from Open-Meteo successfully.");
    loadDataAndRefresh();

    if (tmdResult.status === "fulfilled") {
      sourceComparisonState.tmdText = tmdResult.value.statusText;
      sourceComparisonState.tmdConfigured = tmdResult.value.tokenConfigured;
      tmdAdvisoryState = tmdResult.value.alert;
    } else {
      const errorPayload = tmdResult.reason?.payload;
      const isConfigIssue = tmdResult.reason?.status === 503 || errorPayload?.configured === false;
      sourceComparisonState.tmdConfigured = !isConfigIssue;
      sourceComparisonState.tmdText = isConfigIssue
        ? "ยังไม่ได้ตั้งค่า TMD API token บนเซิร์ฟเวอร์"
        : "เชื่อมต่อ TMD ไม่สำเร็จในรอบนี้";
      tmdAdvisoryState = null;
      console.warn("TMD cross-check unavailable:", tmdResult.reason);
    }

    updateKpiAnalytics();
    renderSourceComparison();
  } catch (error) {
    console.error(error);
    sourceComparisonState.openMeteoText = "โหลดข้อมูลไม่สำเร็จ";
    renderSourceComparison();
    alert(`ดึงข้อมูลไม่สำเร็จ: ${error.message}\nกรุณาตรวจสอบว่าเซิร์ฟเวอร์ Proxy ทำงานตามปกติ`);
  } finally {
    hideLoading();
  }
}

// Utility formatting functions
function formatDateThai(dateString) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
  const thMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
  const day = dateObj.getDate();
  const month = thMonthsShort[dateObj.getMonth()];
  const yearTh = (dateObj.getFullYear() + 543) % 100;
  
  return `${day} ${month} ${yearTh}`;
}

// Format date for tabs
function formatDateTab(dateString) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  
  const thDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const dayName = thDays[dateObj.getDay()];
  const day = dateObj.getDate();
  
  return `${dayName} ${day}`;
}

function formatDateContext(dateString) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const thDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
  const thMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];

  const dayName = thDays[dateObj.getDay()];
  const day = dateObj.getDate();
  const month = thMonthsShort[dateObj.getMonth()];
  const yearTh = (dateObj.getFullYear() + 543) % 100;

  return `${dayName} ${day} ${month} ${yearTh}`;
}

// Show loading overlay
function showLoading(text) {
  loadingText.innerText = text;
  loadingOverlay.classList.remove("hidden");
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.classList.add("hidden");
}
