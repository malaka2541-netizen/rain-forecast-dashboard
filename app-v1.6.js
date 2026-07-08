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
let showTableWeatherIcons = localStorage.getItem("showTableWeatherIcons") !== "false";
const savedForecastSource = localStorage.getItem("forecastSource");
const allowedForecastSources = ["openmeteo", "openweather", "googleweather"];
const TABLE_ICONS_ON_TEXT = t("table-icons-on");
const TABLE_ICONS_OFF_TEXT = t("table-icons-off");
const TABLE_ICONS_HIDE_TITLE = t("table-icons-hide-title");
const TABLE_ICONS_SHOW_TITLE = t("table-icons-show-title");
let sourceComparisonState = {
  activeSource: allowedForecastSources.includes(savedForecastSource) ? savedForecastSource : "openmeteo",
  openMeteoData: [],
  openWeatherData: null,
  googleWeatherData: null,
  googleWeatherText: "รอการเชื่อมต่อ...",
  openWeatherText: "à¸£à¸­à¸à¸²à¸£à¹€à¸Šà¸·à¹ˆà¸­à¸¡à¸•à¹ˆà¸­...",
  openMeteoText: "กำลังโหลด...",
  tmdText: "รอการเชื่อมต่อ...",
  tmdConfigured: null
};

// DOM Elements
const displayLocation = document.getElementById("display-location");
const tableLocationDisplay = document.getElementById("table-location-display");
const displayDateRange = document.getElementById("display-date-range");
const forecastAvgPercent = document.getElementById("forecast-avg-percent");
const forecastCurrentLabel = document.getElementById("forecast-current-label");
const kpiSelectedDate = document.getElementById("kpi-selected-date");
const activeSourceTitle = document.getElementById("active-source-title");
const activeSourceCaption = document.getElementById("active-source-caption");
const btnSourceOpenMeteo = document.getElementById("btn-source-openmeteo");
const btnSourceOpenWeather = document.getElementById("btn-source-openweather");
const btnSourceGoogleWeather = document.getElementById("btn-source-googleweather");
const btnToggleTableIcons = document.getElementById("btn-toggle-table-icons");
const kpiPeakWindow = document.getElementById("kpi-peak-window");
const kpiPeakDetail = document.getElementById("kpi-peak-detail");
const kpiPeakExtra = document.getElementById("kpi-peak-extra");
const kpiPeakTotalRain = document.getElementById("kpi-peak-total-rain");
const kpiPeakMaxWind = document.getElementById("kpi-peak-max-wind");
const kpiAlertHeadline = document.getElementById("kpi-alert-headline");
const kpiAlertDetail = document.getElementById("kpi-alert-detail");
const kpiIntensity = document.getElementById("kpi-intensity");
const kpiIntensityDetail = document.getElementById("kpi-intensity-detail");
const kpiAlertMarquee = document.getElementById("kpi-alert-marquee");
const kpiAlertMarqueeText = document.getElementById("kpi-alert-marquee-text");
const kpiAlertMarqueeTextClone = document.getElementById("kpi-alert-marquee-text-clone");
const weatherIconDynamic = document.getElementById("weather-icon-dynamic");

const dayTabsContainer = document.getElementById("day-tabs");
const forecastTableBody = document.getElementById("forecast-table-body");

const btnRadarWindy = document.getElementById("btn-radar-windy");
const btnRadarBma = document.getElementById("btn-radar-bma");
const windyRadarContainer = document.getElementById("windy-radar-container");


const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");
const openMeteoSourceStatus = document.getElementById("openmeteo-source-status");
const tmdSourceStatus = document.getElementById("tmd-source-status");
const accuracyModal = document.getElementById("accuracy-modal");
const accuracyLoading = document.getElementById("accuracy-loading");
const accuracyContent = document.getElementById("accuracy-content");
const accuracyError = document.getElementById("accuracy-error");
const accuracyTotalChecks = document.getElementById("accuracy-total-checks");
const accuracyRainHitRate = document.getElementById("accuracy-rain-hit-rate");
const accuracyAvgError = document.getElementById("accuracy-avg-error");
const accuracyConfidence = document.getElementById("accuracy-confidence");
const accuracySummaryText = document.getElementById("accuracy-summary-text");
const accuracyPeriodText = document.getElementById("accuracy-period-text");
const accuracyUpdatedText = document.getElementById("accuracy-updated-text");
const accuracyProbabilityBreakdown = document.getElementById("accuracy-probability-breakdown");
const accuracyIntensityBreakdown = document.getElementById("accuracy-intensity-breakdown");
const accuracySourceBreakdown = document.getElementById("accuracy-source-breakdown");
const accuracyLeadTimeBreakdown = document.getElementById("accuracy-lead-time-breakdown");
const accuracyDiurnalBreakdown = document.getElementById("accuracy-diurnal-breakdown");
const accuracyConfusionMatrix = document.getElementById("accuracy-confusion-matrix");
const accuracyConfidenceNotes = document.getElementById("accuracy-confidence-notes");

const comparisonModal = document.getElementById("comparison-modal");
const comparisonTimeTitle = document.getElementById("comparison-time-title");
const comparisonContent = document.getElementById("comparison-content");
const btnCloseComparisonHeader = document.getElementById("btn-close-comparison-header");
const btnCloseComparison = document.getElementById("btn-close-comparison");

const tableHoverTooltip = document.createElement("div");
tableHoverTooltip.className = "forecast-hover-tooltip hidden";
document.body.appendChild(tableHoverTooltip);

function getForecastDataBySource(sourceKey) {
  if (sourceKey === "googleweather") {
    return Array.isArray(sourceComparisonState.googleWeatherData) ? sourceComparisonState.googleWeatherData : [];
  }
  if (sourceKey === "openweather") {
    return Array.isArray(sourceComparisonState.openWeatherData) ? sourceComparisonState.openWeatherData : [];
  }
  return Array.isArray(sourceComparisonState.openMeteoData) ? sourceComparisonState.openMeteoData : [];
}

function getForecastSourceMeta(sourceKey) {
  if (sourceKey === "googleweather") {
    return {
      title: "Google Weather 240 ชม.",
      caption: "ใช้ดูแนวโน้มรายชั่วโมงระยะกลางจาก Google Weather ได้ประมาณ 10 วัน"
    };
  }
  if (sourceKey === "openweather") {
    return {
      title: "OpenWeather 48 ชม.",
      caption: "แสดงข้อมูลรายชั่วโมงระยะสั้นประมาณ 48 ชั่วโมง สำหรับเช็กเทียบแนวโน้มใกล้วันจริง"
    };
  }

  return {
    title: "Open-Meteo 10 วัน",
    caption: "ใช้เป็นข้อมูลหลักสำหรับมุมมองรายชั่วโมงและรายวันระยะยาว"
  };
}

function updateSourceToggleUI() {
  const activeSource = sourceComparisonState.activeSource || "openmeteo";
  const openMeteoAvailable = getForecastDataBySource("openmeteo").length > 0;
  const openWeatherAvailable = getForecastDataBySource("openweather").length > 0;
  const googleWeatherAvailable = getForecastDataBySource("googleweather").length > 0;
  const activeMeta = getForecastSourceMeta(activeSource);

  if (activeSourceTitle) activeSourceTitle.textContent = activeMeta.title;
  if (activeSourceCaption) activeSourceCaption.textContent = activeMeta.caption;

  if (btnSourceOpenMeteo) {
    btnSourceOpenMeteo.disabled = !openMeteoAvailable;
    btnSourceOpenMeteo.classList.toggle("active", activeSource === "openmeteo");
    btnSourceOpenMeteo.setAttribute("aria-pressed", activeSource === "openmeteo" ? "true" : "false");
    btnSourceOpenMeteo.title = openMeteoAvailable
      ? "สลับไปดูข้อมูล Open-Meteo ระยะ 10 วัน"
      : "Open-Meteo ยังไม่มีข้อมูลในรอบนี้";
  }

  if (btnSourceOpenWeather) {
    btnSourceOpenWeather.disabled = !openWeatherAvailable;
    btnSourceOpenWeather.classList.toggle("active", activeSource === "openweather");
    btnSourceOpenWeather.setAttribute("aria-pressed", activeSource === "openweather" ? "true" : "false");
    btnSourceOpenWeather.title = openWeatherAvailable
      ? "สลับไปดูข้อมูล OpenWeather ระยะ 48 ชั่วโมง"
      : "OpenWeather ยังไม่มีข้อมูลในรอบนี้";
  }

  if (btnSourceGoogleWeather) {
    btnSourceGoogleWeather.disabled = !googleWeatherAvailable;
    btnSourceGoogleWeather.classList.toggle("active", activeSource === "googleweather");
    btnSourceGoogleWeather.setAttribute("aria-pressed", activeSource === "googleweather" ? "true" : "false");
    btnSourceGoogleWeather.title = googleWeatherAvailable
      ? "สลับไปดูข้อมูล Google Weather ระยะประมาณ 240 ชั่วโมง"
      : "Google Weather ยังไม่มีข้อมูลในรอบนี้";
  }
}

function updateTableIconToggleUI() {
  if (!btnToggleTableIcons) return;
  btnToggleTableIcons.textContent = showTableWeatherIcons
    ? (currentLang === "zh" ? "隐藏表格图标" : "ซ่อนไอคอนในตาราง")
    : (currentLang === "zh" ? "显示表格图标" : "แสดงไอคอนในตาราง");
  btnToggleTableIcons.setAttribute("aria-pressed", showTableWeatherIcons ? "true" : "false");
  btnToggleTableIcons.title = showTableWeatherIcons
    ? (currentLang === "zh" ? "隐藏表格中的天气图标" : "ซ่อนไอคอนสภาพอากาศในตาราง")
    : (currentLang === "zh" ? "显示表格中的天气图标" : "แสดงไอคอนสภาพอากาศในตาราง");
}

async function fetchTmdRadarTimestamp() {
  const overlay = document.getElementById("tmd-timestamp-overlay");
  const textSpan = document.getElementById("tmd-timestamp-text");
  if (!overlay || !textSpan) return;
  
  // Due to TMD's CORS policy, we cannot read the Last-Modified header directly via browser fetch.
  // Instead, we estimate the radar time. TMD radar updates every 15 mins, with ~15 mins processing delay.
  const now = new Date();
  now.setMinutes(now.getMinutes() - 15); // subtract delay
  const m = now.getMinutes();
  const roundedM = Math.floor(m / 15) * 15; // round down to nearest 15
  now.setMinutes(roundedM);
  
  const timeStr = now.toLocaleTimeString('th-TH', { 
    timeZone: 'Asia/Bangkok', 
    hour: '2-digit', 
    minute: '2-digit' 
  });
  textSpan.textContent = timeStr + " น. (ประมาณ)";
  overlay.classList.remove("hidden");
}

function initRadarToggle() {
  if (!btnRadarWindy || !btnRadarBma) return;
  
  function resetRadarButtons() {
    [btnRadarWindy, btnRadarBma].forEach(btn => {
      btn.classList.remove("active", "btn-primary");
      btn.style.background = "transparent";
      btn.style.color = "var(--text-main)";
    });
    windyRadarContainer.classList.add("hidden");
  }

  function setActiveRadar(btn, container) {
    resetRadarButtons();
    btn.classList.add("active", "btn-primary");
    btn.style.background = "var(--primary)";
    btn.style.color = "white";
    container.classList.remove("hidden");
  }
  
  btnRadarWindy.addEventListener("click", () => {
    setActiveRadar(btnRadarWindy, windyRadarContainer);
  });

  btnRadarBma.addEventListener("click", () => {
    // กรมอุตุฯ มีระบบป้องกันการดึงหน้าเว็บไปแสดงผลใน iframe จึงต้องเปิดแท็บใหม่แทน
    window.open("https://satda.tmd.go.th/wp-content/uploads/nowcasting/bkk/bangkok.php", "_blank");
  });
}


function setTableIconVisibility(showIcons) {
  showTableWeatherIcons = Boolean(showIcons);
  localStorage.setItem("showTableWeatherIcons", showTableWeatherIcons ? "true" : "false");
  updateTableIconToggleUI();
  renderTable();
}

function setActiveForecastSource(sourceKey) {
  const sourcePriority = ["openmeteo", "openweather", "googleweather"];
  const fallbackSource = getForecastDataBySource(sourceKey).length > 0
    ? sourceKey
    : sourcePriority.find((key) => getForecastDataBySource(key).length > 0);
  if (!fallbackSource) return;
  const nextData = getForecastDataBySource(fallbackSource);
  if (!nextData.length) return;

  sourceComparisonState.activeSource = fallbackSource;
  activeForecastData = nextData;
  localStorage.setItem("forecastSource", fallbackSource);
  updateSourceToggleUI();
  loadDataAndRefresh();
}

function clampProbability(probabilityPercent) {
  const numericValue = Number(probabilityPercent);
  if (!Number.isFinite(numericValue)) return null;
  return Math.max(0, Math.min(1, parseFloat((numericValue / 100).toFixed(2))));
}

function getWeatherDetails(weatherCode, precipitationMm = 0, windGustKmh = 0, probability = null, hour = null) {
  const code = Number.isFinite(Number(weatherCode)) ? Number(weatherCode) : null;
  const rainMm = Number.isFinite(Number(precipitationMm)) ? Number(precipitationMm) : 0;
  const gustKmh = Number.isFinite(Number(windGustKmh)) ? Number(windGustKmh) : 0;
  const rainProbability = typeof probability === "number" ? Math.max(0, Math.min(1, probability)) : null;
  const lowProbability = rainProbability !== null && rainProbability < 0.4;
  
  let isNight = false;
  if (hour) {
    const hr = parseInt(hour.split(":")[0], 10);
    if (!isNaN(hr)) {
      isNight = hr >= 19 || hr <= 5;
    }
  }

  if ([95, 96, 99].includes(code)) {
    return {
      iconClass: "fa-solid fa-cloud-bolt",
      label: lowProbability ? "มีสัญญาณฟ้าคะนองบางช่วง" : (code === 99 ? "พายุฝนฟ้าคะนอง มีโอกาสลูกเห็บ" : "พายุฝนฟ้าคะนอง"),
      severity: lowProbability ? "rain" : "storm",
      isStorm: !lowProbability
    };
  }

  if ([65, 80, 81, 82].includes(code)) {
    return {
      iconClass: "fa-solid fa-cloud-showers-heavy",
      label: lowProbability ? "มีสัญญาณฝนเป็นช่วง" : "ฝนเป็นช่วง",
      severity: "rain",
      isStorm: gustKmh >= 50 && rainProbability >= 0.5
    };
  }

  if ([61, 63, 66, 67].includes(code)) {
    return {
      iconClass: "fa-solid fa-cloud-showers-water",
      label: lowProbability ? "มีสัญญาณฝนบางช่วง" : "ฝนตก",
      severity: "rain",
      isStorm: false
    };
  }

  if ([51, 53, 55, 56, 57].includes(code)) {
    return {
      iconClass: "fa-solid fa-cloud-rain",
      label: "ฝนปรอยๆ",
      severity: "rain",
      isStorm: false
    };
  }

  if ([45, 48].includes(code)) {
    return {
      iconClass: "fa-solid fa-smog",
      label: "หมอก",
      severity: "cloudy",
      isStorm: false
    };
  }

  if ([1, 2].includes(code)) {
    return {
      iconClass: isNight ? "fa-solid fa-cloud-moon weather-icon-partly-cloudy-night" : "fa-solid fa-cloud-sun weather-icon-partly-cloudy",
      stackedIcon: true,
      stackBack: isNight ? "fa-solid fa-moon" : "fa-solid fa-sun",
      stackFront: "fa-solid fa-cloud",
      stackBackColor: isNight ? "#cbd5e1" : "#f59e0b",
      stackFrontColor: "#94a3b8",
      label: "เมฆบางส่วน",
      severity: "cloudy",
      isStorm: false
    };
  }

  if (code === 3) {
    return {
      iconClass: "fa-solid fa-cloud",
      label: "เมฆมาก",
      severity: "cloudy",
      isStorm: false
    };
  }

  if (code === 0) {
    return {
      iconClass: "fa-solid fa-sun",
      label: "ท้องฟ้าโปร่ง",
      severity: "clear",
      isStorm: false
    };
  }

  return {
    iconClass: rainMm > 0 ? "fa-solid fa-cloud-rain" : "fa-solid fa-cloud",
    label: rainMm > 0 ? "มีฝน" : "สภาพอากาศทั่วไป",
    severity: rainMm > 0 ? "rain" : "cloudy",
    isStorm: false
  };
}

function getRainIntensity(precipitationMm = 0) {
  const rainMm = Number.isFinite(Number(precipitationMm)) ? Number(precipitationMm) : 0;

  if (rainMm <= 0) {
    return { label: "ไม่มีฝนคาดการณ์", severity: "none", rank: 0 };
  }
  if (rainMm < 1) {
    return { label: "ฝนปรอย/แทบไม่มีผล", severity: "drizzle", rank: 1 };
  }
  if (rainMm < 2.5) {
    return { label: "ฝนเบา", severity: "light", rank: 2 };
  }
  if (rainMm < 10) {
    return { label: "ฝนปานกลาง", severity: "moderate", rank: 3 };
  }
  if (rainMm < 25) {
    return { label: "ฝนหนัก", severity: "heavy", rank: 4 };
  }
  if (rainMm < 50) {
    return { label: "ฝนหนักมาก", severity: "very-heavy", rank: 5 };
  }
  return { label: "ฝนรุนแรงมาก", severity: "severe", rank: 6 };
}

function getStormRisk(weatherCode, windGustKmh = 0, probability = null) {
  const code = Number.isFinite(Number(weatherCode)) ? Number(weatherCode) : null;
  const gustKmh = Number.isFinite(Number(windGustKmh)) ? Number(windGustKmh) : 0;
  const rainProbability = typeof probability === "number" ? Math.max(0, Math.min(1, probability)) : null;
  const hasStormCode = [95, 96, 99].includes(code);
  const hasStrongGust = gustKmh >= 50 && (rainProbability === null || rainProbability >= 0.5);

  if (hasStormCode && (rainProbability === null || rainProbability >= 0.4)) {
    return {
      active: true,
      label: code === 99 ? "มีสัญญาณพายุฝนฟ้าคะนอง/ลูกเห็บ" : "มีสัญญาณพายุฝนฟ้าคะนอง"
    };
  }

  if (hasStrongGust) {
    return {
      active: true,
      label: "มีสัญญาณลมกระโชกแรงร่วมกับฝน"
    };
  }

  return {
    active: false,
    label: "ไม่พบสัญญาณพายุเด่นชัด"
  };
}

function buildWeatherIconHtml(weather) {
  if (weather.stackedIcon) {
    return `<span class="fa-layers fa-fw weather-icon-stacked" aria-hidden="true">
      <i class="${weather.stackBack}" style="color: ${weather.stackBackColor};"></i>
      <i class="${weather.stackFront}" style="color: ${weather.stackFrontColor}; font-size: 0.65em; transform: translate(-25%, 20%);"></i>
    </span>`;
  }
  return `<i class="${weather.iconClass} weather-icon weather-icon-${weather.severity}" aria-hidden="true"></i>`;
}

function formatMillimeters(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)} มม.` : "-";
}

function formatWindKmh(value) {
  return Number.isFinite(Number(value)) ? `${Math.round(Number(value))} กม./ชม.` : "-";
}

function stripAdministrativePrefix(value) {
  return String(value || "")
    .replace(/^(จังหวัด|อำเภอ|เขต|ตำบล|แขวง)\s*/u, "")
    .trim();
}

function hasDistrictInLocationName(locationName) {
  return String(locationName || "").trim().split(/\s+/).length >= 2;
}

function getAdministrativeAreaName(administrative, levels = []) {
  if (!Array.isArray(administrative) || !levels.length) return "";

  for (const level of levels) {
    const matched = administrative.find(item => Number(item?.adminLevel) === Number(level) && item?.name);
    if (matched?.name) {
      return matched.name;
    }
  }

  return "";
}

function parseReverseGeocodeLocation(data) {
  const administrative = Array.isArray(data?.localityInfo?.administrative)
    ? data.localityInfo.administrative
    : [];

  const province = stripAdministrativePrefix(
    data?.principalSubdivision ||
    data?.localityInfo?.principalSubdivision ||
    getAdministrativeAreaName(administrative, [4]) ||
    ""
  );

  const districtCandidate =
    getAdministrativeAreaName(administrative, [6]) ||
    (data?.city && data.city !== data?.principalSubdivision ? data.city : "") ||
    "";

  const district = stripAdministrativePrefix(districtCandidate);

  return { province, district };
}

async function fetchClientReverseGeocode(lat, lon) {
  const query = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    localityLanguage: "th"
  });

  const response = await fetch(`https://api.bigdatacloud.net/data/reverse-geocode-client?${query.toString()}`, {
    cache: "no-store"
  });

  if (!response.ok) {
    throw new Error(`Client reverse geocoding returned status ${response.status}`);
  }

  return response.json();
}

async function resolveLocationNameFromCoordinates(lat, lon, fallbackName = "") {
  if (!Number.isFinite(Number(lat)) || !Number.isFinite(Number(lon))) {
    return fallbackName || DEFAULT_LOCATION_NAME;
  }

  try {
    const data = await fetchClientReverseGeocode(lat, lon);
    const { province, district } = parseReverseGeocodeLocation(data);

    if (district && province && district !== province) {
      return `${district} ${province}`;
    }

    if (province) {
      return province;
    }
  } catch (error) {
    console.warn("Unable to resolve district from coordinates:", error);
  }

  return fallbackName || DEFAULT_LOCATION_NAME;
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

function getBangkokNowKeys() {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Bangkok",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    hourCycle: "h23"
  });

  const parts = Object.fromEntries(
    formatter.formatToParts(new Date()).map(part => [part.type, part.value])
  );

  return {
    dateKey: `${parts.year}-${parts.month}-${parts.day}`,
    hourKey: `${parts.hour}:00`
  };
}

function findNearestHourKey(values, targetHourKey) {
  const sortedHours = Object.keys(values).sort();
  if (!sortedHours.length) return null;
  if (values[targetHourKey]) return targetHourKey;

  const fallbackHour = [...sortedHours]
    .reverse()
    .find(hour => hour <= targetHourKey);

  return fallbackHour || sortedHours[0];
}

function getCurrentForecastSnapshot() {
  if (!activeForecastData.length) return null;

  const { dateKey, hourKey } = getBangkokNowKeys();
  const currentDayData = activeForecastData.find(day => day.date === dateKey) || activeForecastData[0];
  if (!currentDayData) return null;

  const resolvedHourKey = findNearestHourKey(currentDayData.values, hourKey);
  if (!resolvedHourKey) return null;

  const entry = currentDayData.values[resolvedHourKey];
  return {
    date: currentDayData.date,
    hour: resolvedHourKey,
    entry,
    probability: getEntryProbability(entry)
  };
}

function formatHourRange(startHour, endHour) {
  if (!startHour || !endHour) return "-";
  return startHour === endHour ? startHour : `${startHour}-${endHour}`;
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
    peakEntry.probability,
    peakEntry.time
  );
  const rainIntensity = getRainIntensity(peakEntry.entry.precipitation);
  const stormRisk = getStormRisk(peakEntry.entry.weatherCode, peakEntry.entry.windGust, peakEntry.probability);

  let totalRain = 0;
  let maxWind = 0;
  for (let i = startIndex; i <= endIndex; i++) {
    totalRain += (entries[i].entry.precipitation ?? 0);
    if ((entries[i].entry.windGust ?? 0) > maxWind) {
      maxWind = entries[i].entry.windGust;
    }
  }

  return {
    startHour: entries[startIndex].hour,
    endHour: entries[endIndex].hour,
    probability: peakEntry.probability,
    weather,
    rainIntensity,
    stormRisk,
    totalRain,
    maxWind
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
    const weather = getWeatherDetails(item.entry.weatherCode, item.entry.precipitation, item.entry.windGust, item.probability, item.time);
    const rainIntensity = getRainIntensity(item.entry.precipitation);
    const stormRisk = getStormRisk(item.entry.weatherCode, item.entry.windGust, item.probability);
    const candidate = {
      hour: item.hour,
      probability: item.probability ?? 0,
      precipitation: Number(item.entry.precipitation ?? 0),
      windGust: Number(item.entry.windGust ?? 0),
      weather,
      rainIntensity,
      stormRisk
    };

    if (!best) {
      best = candidate;
      return;
    }

    const candidateScore =
      candidate.precipitation * 10000 +
      candidate.rainIntensity.rank * 2000 +
      candidate.probability * 100 +
      candidate.windGust;
    const bestScore =
      best.precipitation * 10000 +
      best.rainIntensity.rank * 2000 +
      best.probability * 100 +
      best.windGust;

    if (candidateScore > bestScore) {
      best = candidate;
    }
  });

  return best;
}


function buildTableTooltipHtml(hour, entry) {
  const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, entry.probability, hour);
  const weatherIconHtml = buildWeatherIconHtml(weather);
  const rainIntensity = getRainIntensity(entry.precipitation);
  const stormRisk = getStormRisk(entry.weatherCode, entry.windGust, entry.probability);
  const stormAlert = stormRisk.active
    ? `<div class="forecast-hover-line forecast-hover-alert">สัญญาณพายุ: ${stormRisk.label}</div>`
    : "";
  return `
    <div class="forecast-hover-title">${hour} น.</div>
    <div class="forecast-hover-line">โอกาสเกิดฝน: ${Math.round(entry.probability * 100)}%</div>
    <div class="forecast-hover-line forecast-hover-weather">สภาพอากาศ: ${weatherIconHtml}<span>${weather.label}</span></div>
    <div class="forecast-hover-line">ปริมาณฝนคาดการณ์: ${formatMillimeters(entry.precipitation)}</div>
    <div class="forecast-hover-line">ความแรงฝนตามปริมาณ: ${rainIntensity.label}</div>
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

function getAgreementLevel(omEntry, owEntry) {
  if (!owEntry || omEntry.probability === null || omEntry.probability === undefined || owEntry.probability === null || owEntry.probability === undefined) return "unknown";
  
  const omRain = omEntry.probability >= 0.3; // Using 30% as threshold for rain expected
  const owRain = owEntry.probability >= 0.3;
  
  if (omRain === owRain) return "agree";
  return "disagree";
}

function openComparisonModal(dateStr, hour) {
  if (!comparisonModal || !comparisonContent) return;

  const omDay = sourceComparisonState.openMeteoData.find(d => d.date === dateStr);
  const owDay = sourceComparisonState.openWeatherData ? sourceComparisonState.openWeatherData.find(d => d.date === dateStr) : null;
  const gwDay = sourceComparisonState.googleWeatherData ? sourceComparisonState.googleWeatherData.find(d => d.date === dateStr) : null;
  
  const omEntry = omDay ? omDay.values[hour] : null;
  let owEntry = owDay ? owDay.values[hour] : null;
  let owHourUsed = hour;
  let gwEntry = gwDay ? gwDay.values[hour] : null;
  let gwHourUsed = hour;

  if (owDay && !owEntry) {
    const targetHourNum = parseInt(hour.split(':')[0], 10);
    const availableHours = Object.keys(owDay.values);
    if (availableHours.length > 0) {
      let closestHour = availableHours[0];
      let minDiff = Infinity;
      for (const avHour of availableHours) {
        const hNum = parseInt(avHour.split(':')[0], 10);
        const diff = Math.abs(hNum - targetHourNum);
        if (diff < minDiff) {
          minDiff = diff;
          closestHour = avHour;
        }
      }
      // Only use it if it's within 3 hours difference
      if (minDiff <= 3) {
        owEntry = owDay.values[closestHour];
        owHourUsed = closestHour;
      }
    }
  }

  comparisonTimeTitle.textContent = `เปรียบเทียบข้อมูล: ${formatDate(dateStr)} ${hour} น.`;

  if (gwDay && !gwEntry) {
    const targetHourNum = parseInt(hour.split(':')[0], 10);
    const availableHours = Object.keys(gwDay.values);
    if (availableHours.length > 0) {
      let closestHour = availableHours[0];
      let minDiff = Infinity;
      for (const avHour of availableHours) {
        const hNum = parseInt(avHour.split(':')[0], 10);
        const diff = Math.abs(hNum - targetHourNum);
        if (diff < minDiff) {
          minDiff = diff;
          closestHour = avHour;
        }
      }
      if (minDiff <= 3) {
        gwEntry = gwDay.values[closestHour];
        gwHourUsed = closestHour;
      }
    }
  }

  let html = '';
  
  if (omEntry) {
    const weather = getWeatherDetails(omEntry.weatherCode, omEntry.precipitation, omEntry.windGust, omEntry.probability, hour);
    html += `
      <div style="padding: 1rem; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #0ea5e9;">${sourceComparisonState.activeSource === "openmeteo" ? "Open-Meteo (หลัก)" : "Open-Meteo (เปรียบเทียบ)"}</h4>
        <div>โอกาสฝน: ${Math.round(omEntry.probability * 100)}%</div>
        <div>ปริมาณฝนคาดการณ์: ${formatMillimeters(omEntry.precipitation)}</div>
        <div>สภาพอากาศ: ${weather.label}</div>
      </div>
    `;
  }
  
  
  if (gwEntry) {
    const weather = getWeatherDetails(gwEntry.weatherCode, gwEntry.precipitation, gwEntry.windGust, gwEntry.probability, hour);
    const timeNote = (gwHourUsed !== hour) ? ` <span style="font-size: 0.8rem; color: #64748b;">(เวลาใกล้เคียง: ${gwHourUsed} น.)</span>` : '';
    html += `
      <div style="padding: 1rem; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px;">
        <h4 style="margin: 0 0 0.5rem 0; color: #2563eb;">${sourceComparisonState.activeSource === "googleweather" ? "Google Weather (หลัก)" : "Google Weather (เปรียบเทียบ)"}${timeNote}</h4>
        <div>โอกาสฝน: ${Math.round(gwEntry.probability * 100)}%</div>
        <div>ปริมาณฝนคาดการณ์: ${formatMillimeters(gwEntry.precipitation)}</div>
        <div>สภาพอากาศ: ${weather.label}</div>
      </div>
    `;
  } else {
    html += `
      <div style="padding: 1rem; background: var(--card-bg); border: 1px solid var(--card-border); border-radius: 12px; opacity: 0.7;">
        <h4 style="margin: 0 0 0.5rem 0; color: #2563eb;">${sourceComparisonState.activeSource === "googleweather" ? "Google Weather (หลัก)" : "Google Weather (เปรียบเทียบ)"}</h4>
        <div>ไม่มีข้อมูลในช่วงเวลานี้ หรือยังไม่ได้ตั้งค่า API Key</div>
      </div>
    `;
  }

  const agreement = getAgreementLevel(omEntry, owEntry);
  if (agreement === "agree") {
    html += `<div style="padding: 0.5rem; text-align: center; color: #10b981; font-weight: bold; background: rgba(16, 185, 129, 0.1); border-radius: 8px;"><i class="fa-solid fa-check-circle"></i> สองโมเดลมีความเห็นสอดคล้องกัน</div>`;
  } else if (agreement === "disagree") {
    html += `<div style="padding: 0.5rem; text-align: center; color: #ef4444; font-weight: bold; background: rgba(239, 68, 68, 0.1); border-radius: 8px;"><i class="fa-solid fa-triangle-exclamation"></i> สองโมเดลมีความเห็นขัดแย้งกัน ควรเฝ้าระวังพิเศษ</div>`;
  }
  
  if (omEntry && omEntry.adjustedProbability !== undefined && omEntry.adjustedProbability !== omEntry.probability) {
    html += `
      <div style="margin-top: 0.5rem; padding: 0.75rem; background: rgba(59, 130, 246, 0.1); border-left: 4px solid #3b82f6; border-radius: 4px; font-size: 0.9em;">
        <strong>[Shadow Mode] Adjusted Forecast:</strong><br>
        หากเปิดใช้งานระบบปรับแก้เปรียบเทียบ (Calibration) ระบบคำนวณปรับโอกาสฝนให้เป็น <strong>${Math.round(omEntry.adjustedProbability * 100)}%</strong>
      </div>
    `;
  }
  
  comparisonContent.innerHTML = html;
  comparisonModal.classList.remove("hidden");
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

function getFirstNonEmptyText(value) {
  if (Array.isArray(value)) {
    return value.find(item => typeof item === "string" && item.trim()) || "";
  }
  return typeof value === "string" ? value : "";
}

function normalizeTickerText(text) {
  return String(text || "")
    .replace(/\s+/g, " ")
    .replace(/\s+\|/g, " |")
    .trim();
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

  const months = currentLang === "th" ? ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."] : ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
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
  const titleThai = normalizeTickerText(getFirstNonEmptyText(warning.TitleThai));
  const headlineThai = normalizeTickerText(getFirstNonEmptyText(warning.HeadlineThai));
  const descriptionThai = normalizeTickerText(getFirstNonEmptyText(warning.DescriptionThai));
  const contactThai = normalizeTickerText(getFirstNonEmptyText(warning.ContactThai));
  const label = inferTmdAlertLabel(titleEnglish, headlineEnglish, descriptionEnglish);
  const effectText = formatWarningEffectRange(titleEnglish || headlineEnglish);
  const announceText = formatTmdDateTime(warning.AnnounceDate);
  const issueText = extractWarningReference(titleEnglish || headlineEnglish);
  const detail = [
    effectText,
    announceText ? `อัปเดต ${announceText}` : issueText
  ].filter(Boolean).join(" | ") || "ประกาศเตือนล่าสุดจาก TMD";
  const tickerText = normalizeTickerText(
    [titleThai, headlineThai, descriptionThai, contactThai]
      .filter(Boolean)
      .join(" | ")
  );

  return {
    label,
    detail,
    severity: inferTmdAlertSeverity(label),
    source: "warning",
    tickerText,
    url: getFirstReadableText(warning.WebUrlEnglish) || warning.WebUrlThai || "https://www.tmd.go.th/warning-and-events/warning-storm",
    pdf: warning.DocumentFile || "",
    publishedAt: warning.AnnounceDate || warning.EffectStartDate || ""
  };
}

function normalizeTmdDailySummary(responseData) {
  const dailyForecast = responseData?.DailyForecast;
  if (!dailyForecast) return null;

  const overviewEnglish = getFirstReadableText(dailyForecast.OverallDescriptionEnglish);
  const overviewThai = normalizeTickerText(getFirstNonEmptyText(dailyForecast.OverallDescriptionThai));
  const dateLabel = getFirstReadableText(dailyForecast.Date);
  if (!overviewEnglish && !overviewThai) return null;

  const label = inferTmdAlertLabel("", overviewEnglish || overviewThai, overviewEnglish || overviewThai);
  return {
    label,
    detail: dateLabel ? `พยากรณ์ 24 ชม. | ${dateLabel}` : "พยากรณ์ 24 ชม. จาก TMD",
    severity: inferTmdAlertSeverity(label),
    source: "daily-summary",
    tickerText: overviewThai,
    url: "https://www.tmd.go.th/warning-and-events/warning-storm"
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
      source: "model",
      tickerText: ""
    };
  }

  if (strongestProfile.stormRisk.active && strongestProfile.probability >= 0.5) {
    return {
      label: "เฝ้าระวังสัญญาณพายุฝนฟ้าคะนอง",
      detail: `${formatHourRange(peakWindow.startHour, peakWindow.endHour)} | ${strongestProfile.stormRisk.label} | ฝนตามปริมาณ ${strongestProfile.rainIntensity.label}`,
      severity: "storm",
      source: "model",
      tickerText: ""
    };
  }

  if (strongestProfile.rainIntensity.rank >= 4 && strongestProfile.probability >= 0.6) {
    return {
      label: "เฝ้าระวังฝนหนักตามปริมาณ",
      detail: `${strongestProfile.hour} | ${formatMillimeters(strongestProfile.precipitation)} | ${strongestProfile.rainIntensity.label}`,
      severity: "heavy",
      source: "model",
      tickerText: ""
    };
  }

  if (peakWindow.probability >= 0.7) {
    return {
      label: "เฝ้าระวังโอกาสฝนสูง",
      detail: `${formatHourRange(peakWindow.startHour, peakWindow.endHour)} | โอกาสฝนสูงสุด ${Math.round(peakWindow.probability * 100)}% | ฝนตามปริมาณ ${peakWindow.rainIntensity.label}`,
      severity: "moderate",
      source: "model",
      tickerText: ""
    };
  }

  return {
    label: "ไม่มีสัญญาณฝนหนักเด่นชัด",
    detail: "ไม่พบช่วงเสี่ยงฝนหนักจากแบบจำลอง",
    severity: "calm",
    source: "model",
    tickerText: ""
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

function updateAlertMarquee(alertCard) {
  if (!kpiAlertMarquee || !kpiAlertMarqueeText || !kpiAlertMarqueeTextClone) return;

  const tickerText = normalizeTickerText(alertCard?.tickerText);
  if (!tickerText || alertCard?.source === "model") {
    kpiAlertMarquee.classList.add("hidden");
    kpiAlertMarqueeText.textContent = "";
    kpiAlertMarqueeTextClone.textContent = "";
    return;
  }

  kpiAlertMarqueeText.textContent = tickerText;
  kpiAlertMarqueeTextClone.textContent = tickerText;
  kpiAlertMarquee.classList.remove("hidden");
}

function updateWeatherBackground(severity) {
  document.body.classList.remove('weather-clear', 'weather-cloudy', 'weather-rain', 'weather-storm');
  if (severity) {
    document.body.classList.add(`weather-${severity}`);
  }
}

function updateCurrentConditionsCard() {
  const snapshot = getCurrentForecastSnapshot();
  if (!snapshot || snapshot.probability === null) {
    forecastAvgPercent.innerText = "-";
    forecastCurrentLabel.innerText = "โอกาสฝนตอนนี้";
    displayDateRange.innerText = "ไม่พบข้อมูลสภาพอากาศปัจจุบัน";
    weatherIconDynamic.innerHTML = '<i class="fa-solid fa-cloud" style="color: #64748b;"></i>';
    return;
  }

  const weather = getWeatherDetails(
    snapshot.entry.weatherCode,
    snapshot.entry.precipitation,
    snapshot.entry.windGust,
    snapshot.probability,
    snapshot.hour
  );
  const rainIntensity = getRainIntensity(snapshot.entry.precipitation);

  forecastAvgPercent.innerText = `${Math.round(snapshot.probability * 100)}%`;
  forecastCurrentLabel.innerText = "โอกาสฝนตอนนี้";
  displayDateRange.innerText = `${weather.label} | ${rainIntensity.label}`;
  weatherIconDynamic.innerHTML = buildWeatherIconHtml(weather);
  
  updateWeatherBackground(weather.severity);
}

async function fetchOpenMeteoForecast(lat, lon) {
  const response = await fetch(`/api/forecast/openmeteo?lat=${lat}&lon=${lon}&_t=${Date.now()}`);
  if (!response.ok) {
    throw new Error(`Open-Meteo returned status ${response.status}`);
  }

  const data = await response.json();
  const hourly = data.hourly;
  if (!hourly || !Array.isArray(hourly.time)) {
    throw new Error("Open-Meteo payload missing hourly timeline");
  }
  const isStale = Boolean(data && data._meta && data._meta.stale);
  const grouped = {};

  hourly.time.forEach((timeStr, index) => {
    const [datePart, timePart] = timeStr.split("T");
    const hourKey = timePart.substring(0, 5);
    if (!grouped[datePart]) grouped[datePart] = {};

    const probability = clampProbability(hourly.precipitation_probability?.[index]);
    const adjustedProbabilityRaw = hourly.adjusted_precipitation_probability?.[index];
    const adjustedProbability = adjustedProbabilityRaw !== undefined ? clampProbability(adjustedProbabilityRaw) : probability;

    const precipitation = Number(hourly.precipitation?.[index] ?? 0);
    const weatherCode = Number(hourly.weather_code?.[index] ?? 0);
    const windSpeed = Number(hourly.wind_speed_10m?.[index] ?? 0);
    const windGust = Number(hourly.wind_gusts_10m?.[index] ?? 0);

    grouped[datePart][hourKey] = {
      probability,
      adjustedProbability,
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

  const baseStatusText = buildOpenMeteoStatusText(forecastDays);

  return {
    forecastDays,
    statusText: isStale ? `${baseStatusText} | ใช้ข้อมูลสำรองล่าสุด` : baseStatusText
  };
}

async function fetchOpenWeatherForecast(lat, lon) {
  const response = await fetch(`/api/forecast/openweather?lat=${lat}&lon=${lon}&_t=${Date.now()}`);
  if (!response.ok) {
    if (response.status === 503) {
      throw { status: 503, message: "OpenWeather API key is not configured" };
    }
    throw new Error(`OpenWeather returned status ${response.status}`);
  }

  const data = await response.json();
  const hourly = data.list || data.hourly || [];
  const grouped = {};

  hourly.forEach((item) => {
    if (!item.dt) return;
    
    // Convert to local Bangkok time
    const dateObj = new Date(item.dt * 1000);
    const dateStr = dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" }); // YYYY-MM-DD
    const hourKey = dateObj.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

    if (!grouped[dateStr]) grouped[dateStr] = {};

    const probability = item.pop !== undefined ? clampProbability(item.pop * 100) : null;
    const precipitation = Number(item.rain?.["3h"] ?? item.rain?.["1h"] ?? 0);
    const weatherCode = item.weather && item.weather[0] ? item.weather[0].id : 0; // Keeping raw code for now, mapping can be done later if needed
    
    let windSpeed = 0;
    let windGust = 0;
    
    if (item.wind) {
       windSpeed = Number(item.wind.speed ?? 0) * 3.6;
       windGust = Number(item.wind.gust ?? 0) * 3.6;
    } else {
       windSpeed = Number(item.wind_speed ?? 0) * 3.6;
       windGust = Number(item.wind_gust ?? 0) * 3.6;
    }

    grouped[dateStr][hourKey] = {
      probability,
      precipitation: Number.isFinite(precipitation) ? precipitation : 0,
      weatherCode: weatherCode,
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
    statusText: forecastDays.length ? "เชื่อมต่อ OpenWeather สำเร็จ" : "ไม่มีข้อมูลจาก OpenWeather"
  };
}

async function fetchGoogleWeatherForecast(lat, lon) {
  const response = await fetch(`/api/forecast/googleweather?lat=${lat}&lon=${lon}&_t=${Date.now()}`);
  if (!response.ok) {
    if (response.status === 503) {
      throw { status: 503, message: "Google Weather API key is not configured" };
    }
    throw new Error(`Google Weather returned status ${response.status}`);
  }

  const data = await response.json();
  const hourly = data.list || data.hourly || [];
  const grouped = {};

  hourly.forEach((item) => {
    if (!item.dt) return;

    const dateObj = new Date(item.dt * 1000);
    const dateStr = dateObj.toLocaleDateString("en-CA", { timeZone: "Asia/Bangkok" });
    const hourKey = dateObj.toLocaleTimeString("en-GB", { timeZone: "Asia/Bangkok", hour: "2-digit", minute: "2-digit" });

    if (!grouped[dateStr]) grouped[dateStr] = {};

    const probability = item.pop !== undefined ? clampProbability(item.pop * 100) : null;
    const precipitation = Number(item.rain?.["3h"] ?? item.rain?.["1h"] ?? item.precipitation ?? 0);
    const weatherCode = item.weather && item.weather[0] ? item.weather[0].id : 0;

    let windSpeed = 0;
    let windGust = 0;
    if (item.wind) {
      windSpeed = Number(item.wind.speed ?? 0) * 3.6;
      windGust = Number(item.wind.gust ?? 0) * 3.6;
    } else {
      windSpeed = Number(item.wind_speed ?? 0) * 3.6;
      windGust = Number(item.wind_gust ?? 0) * 3.6;
    }

    grouped[dateStr][hourKey] = {
      probability,
      precipitation: Number.isFinite(precipitation) ? precipitation : 0,
      weatherCode: Number.isFinite(weatherCode) ? weatherCode : 0,
      windSpeed: Number.isFinite(windSpeed) ? windSpeed : 0,
      windGust: Number.isFinite(windGust) ? windGust : 0
    };
  });

  const forecastDays = Object.keys(grouped)
    .sort()
    .map((dateStr) => ({
      date: dateStr,
      values: grouped[dateStr]
    }));

  return {
    forecastDays,
    statusText: forecastDays.length ? "เชื่อมต่อ Google Weather สำเร็จ" : "ไม่มีข้อมูลจาก Google Weather"
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

function formatBacktestPercent(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(1)}%` : "-";
}

function formatBacktestMillimeters(value) {
  return Number.isFinite(Number(value)) ? `${Number(value).toFixed(3)} มม.` : "-";
}

function formatBacktestDateTime(value) {
  if (!value) return "-";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;

  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23"
  }).format(date);
}

function getBacktestConfidenceLabel(totalChecks, confidenceFlags = []) {
  if (totalChecks >= 200 && !confidenceFlags.length) return "เริ่มน่าเชื่อถือ";
  if (totalChecks >= 100) return "พอใช้ได้";
  if (totalChecks >= 24) return "ยังต้องสะสมข้อมูล";
  return "ยังเร็วเกินไป";
}

function buildBacktestSummaryNarrative(summary, confidenceFlags = []) {
  const totalChecks = Number(summary?.total_checks || 0);
  const rainRate = Number(summary?.actual_rain_rate_pct || 0);
  const avgError = Number(summary?.avg_abs_error_mm || 0);

  if (!totalChecks) {
    return "ยังไม่มีข้อมูลตรวจเทียบจริง ระบบเก็บโครงสร้างพร้อมแล้ว แต่ยังต้องรอข้อมูลย้อนหลังเพิ่มก่อนจึงจะสรุปความแม่นได้";
  }

  const confidenceLabel = getBacktestConfidenceLabel(totalChecks, confidenceFlags);
  return `ตอนนี้ระบบตรวจเทียบแล้ว ${totalChecks} จุดตรวจ พบฝนตกจริง ${rainRate.toFixed(1)}% ของจุดที่เก็บ และมีค่าคลาดเคลื่อนปริมาณฝนเฉลี่ย ${avgError.toFixed(3)} มม. ระดับการอ่านผลตอนนี้คือ "${confidenceLabel}"`;
}

function getProbabilityBucket(key) {
  const tk = "prob-" + key;
  const val = t(tk);
  return val === tk ? key : val;
}

function getIntensity(key) {
  const tk = "int-" + key;
  const val = t(tk);
  return val === tk ? key : val;
}

function getSource(key) {
  const tk = "src-" + key;
  const val = t(tk);
  return val === tk ? key : val;
}

function getLeadTime(key) {
  const tk = "lt-" + key;
  const val = t(tk);
  return val === tk ? key : val;
}

function getDiurnal(key) {
  const tk = "diurnal-" + key;
  const val = t(tk);
  return val === tk ? key : val;
}

function buildConfusionMatrixHtml(summary) {
  const hits = summary?.hits ?? 0;
  const misses = summary?.misses ?? 0;
  const fa = summary?.false_alarms ?? 0;
  const cn = summary?.correct_negatives ?? 0;
  const total = hits + misses + fa + cn;
  if (!total) return '<div class="accuracy-breakdown-meta">ยังไม่มีข้อมูลเพียงพอ</div>';

  const bss = summary?.brier_skill_score;
  const bssText = bss !== null && bss !== undefined ? bss.toFixed(3) : '-';
  const bssColor = bss !== null && bss > 0 ? '#22c55e' : bss !== null && bss < 0 ? '#ef4444' : 'var(--text-muted)';

  return `
    <table style="width:100%; border-collapse:collapse; font-size:0.85rem; margin-bottom:0.75rem;">
      <thead>
        <tr>
          <th style="padding:6px 8px; border:1px solid var(--border-default); background:var(--bg-card);"></th>
          <th style="padding:6px 8px; border:1px solid var(--border-default); background:#dcfce7; color:#166534; text-align:center;">🌧️ ฝนตกจริง</th>
          <th style="padding:6px 8px; border:1px solid var(--border-default); background:#fef9c3; color:#854d0e; text-align:center;">☀️ ไม่ตกจริง</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td style="padding:6px 8px; border:1px solid var(--border-default); background:var(--bg-card); font-weight:600;">พยากรณ์ฝน</td>
          <td style="padding:6px 8px; border:1px solid var(--border-default); text-align:center; background:#bbf7d0; color:#166534; font-weight:700;">✅ ${hits}</td>
          <td style="padding:6px 8px; border:1px solid var(--border-default); text-align:center; background:#fecaca; color:#991b1b; font-weight:700;">⚠️ ${fa}</td>
        </tr>
        <tr>
          <td style="padding:6px 8px; border:1px solid var(--border-default); background:var(--bg-card); font-weight:600;">พยากรณ์ไม่ตก</td>
          <td style="padding:6px 8px; border:1px solid var(--border-default); text-align:center; background:#fecaca; color:#991b1b; font-weight:700;">❌ ${misses}</td>
          <td style="padding:6px 8px; border:1px solid var(--border-default); text-align:center; background:#bbf7d0; color:#166534; font-weight:700;">✅ ${cn}</td>
        </tr>
      </tbody>
    </table>
    <div class="accuracy-breakdown-meta" style="font-size:0.82rem; color:var(--text-muted);">
      Brier Skill Score (BSS): <strong style="color:${bssColor}">${bssText}</strong>
      ${bss !== null && bss > 0 ? ' — ดีกว่าการเดาสุ่ม ✅' : bss !== null && bss < 0 ? ' — แย่กว่าการเดาสุ่ม ❌' : ''}
    </div>
  `;
}

function buildBreakdownHtml(breakdown = {}, labelFormatter) {
  const entries = Object.entries(breakdown);
  if (!entries.length) {
    return '<div class="accuracy-breakdown-item"><div class="accuracy-breakdown-meta">ยังไม่มีข้อมูลเพียงพอ</div></div>';
  }

  return entries.map(([key, item]) => `
    <div class="accuracy-breakdown-item">
      <div class="accuracy-breakdown-head">
        <strong>${labelFormatter ? labelFormatter(key) : key}</strong>
        <span>${item.total_checks || 0} จุดตรวจ</span>
      </div>
      <div class="accuracy-breakdown-meta">
        ฝนตกจริง ${formatBacktestPercent(item.actual_rain_rate_pct)} |
        ปริมาณฝนจริงเฉลี่ย ${formatBacktestMillimeters(item.avg_observed_rain_mm)} |
        คลาดเคลื่อนเฉลี่ย ${formatBacktestMillimeters(item.avg_abs_error_mm)}
      </div>
      <div class="accuracy-breakdown-meta" style="margin-top: 0.2rem; color: var(--text-muted); font-size: 0.8rem;">
        Brier Score: ${item.brier_score !== null && item.brier_score !== undefined ? item.brier_score : '-'} |
        Miss Rate: ${item.miss_rate_pct !== null && item.miss_rate_pct !== undefined ? item.miss_rate_pct + '%' : '-'} |
        False Alarm: ${item.false_alarm_rate_pct !== null && item.false_alarm_rate_pct !== undefined ? item.false_alarm_rate_pct + '%' : '-'}
      </div>
    </div>
  `).join("");
}

async function openAccuracyModal() {
  if (!accuracyModal) return;

  accuracyModal.classList.remove("hidden");
  accuracyLoading?.classList.remove("hidden");
  accuracyContent?.classList.add("hidden");
  accuracyError?.classList.add("hidden");
  accuracyConfidenceNotes?.classList.add("hidden");

  try {
    const response = await fetch(`/api/backtest/summary?_t=${Date.now()}`);
    const payload = await response.json();

    if (!response.ok || !payload?.success) {
      throw new Error(payload?.error || "ไม่สามารถโหลดสถิติความแม่นได้");
    }

    const summary = payload.summary || {};
    const confidenceFlags = Array.isArray(payload.confidence_flags) ? payload.confidence_flags : [];

    accuracyTotalChecks.textContent = String(summary.total_checks ?? 0);
    accuracyRainHitRate.textContent = formatBacktestPercent(summary.actual_rain_rate_pct);
    accuracyAvgError.textContent = formatBacktestMillimeters(summary.avg_abs_error_mm);
    accuracyConfidence.textContent = getBacktestConfidenceLabel(Number(summary.total_checks || 0), confidenceFlags);
    accuracySummaryText.textContent = buildBacktestSummaryNarrative(summary, confidenceFlags);
    accuracyPeriodText.textContent = `ช่วงข้อมูลตรวจจริง: ${formatBacktestDateTime(summary.observed_start)} ถึง ${formatBacktestDateTime(summary.observed_end)}`;
    accuracyUpdatedText.textContent = `อัปเดตล่าสุด: ${formatBacktestDateTime(summary.latest_updated_at)}`;
    accuracyProbabilityBreakdown.innerHTML = buildBreakdownHtml(payload.probability_breakdown, getProbabilityBucket);
    accuracyIntensityBreakdown.innerHTML = buildBreakdownHtml(payload.rain_intensity_breakdown, getIntensity);
    accuracySourceBreakdown.innerHTML = buildBreakdownHtml(payload.source_breakdown, getSource);
    accuracyLeadTimeBreakdown.innerHTML = buildBreakdownHtml(payload.lead_time_breakdown, getLeadTime);
    
    if (accuracyDiurnalBreakdown) {
      accuracyDiurnalBreakdown.innerHTML = buildBreakdownHtml(payload.diurnal_breakdown, getDiurnal);
    }
    if (accuracyConfusionMatrix) {
      accuracyConfusionMatrix.innerHTML = buildConfusionMatrixHtml(summary);
    }

    const notes = [];
    if (confidenceFlags.includes("sample-small")) {
      notes.push("จำนวนจุดตรวจยังน้อยกว่า 24 จุด จึงยังใช้บอกแนวโน้มเบื้องต้นเท่านั้น");
    }
    if (confidenceFlags.includes("early-stage")) {
      notes.push("ฐานข้อมูลยังอยู่ช่วงเริ่มต้น ควรรอสะสมอย่างน้อยหลายสิบถึงหลักร้อยจุดตรวจ");
    }

    if (accuracyConfidenceNotes) {
      if (notes.length) {
        accuracyConfidenceNotes.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><div>${notes.join("<br>")}</div>`;
        accuracyConfidenceNotes.classList.remove("hidden");
      } else {
        accuracyConfidenceNotes.classList.add("hidden");
      }
    }

    accuracyLoading?.classList.add("hidden");
    accuracyContent?.classList.remove("hidden");
  } catch (error) {
    console.error("Unable to load backtest summary:", error);
    if (accuracyLoading) accuracyLoading.classList.add("hidden");
    if (accuracyError) {
      accuracyError.innerHTML = `<i class="fa-solid fa-triangle-exclamation"></i><div>${error.message || "โหลดข้อมูลไม่สำเร็จ"}</div>`;
      accuracyError.classList.remove("hidden");
    }
  }
}

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  if (window.__AUTH_BLOCKED) return;

  const btnToggleLang = document.getElementById("btn-toggle-lang");
  if (btnToggleLang) {
    btnToggleLang.addEventListener("click", () => {
      toggleLanguage();
      // Re-render UI components that rely on language
      updateSourceToggleUI();
      updateTableIconToggleUI();
      if (activeForecastData && activeForecastData.length > 0) {
        updateCurrentWeatherUI(activeForecastData[0]);
        renderForecastChart(activeForecastData);
        renderForecastTable(activeForecastData);
      }
      renderSourceComparison();
      
      // If we have an active TMD alert, it will re-translate on next fetch, but we can do a quick refetch
      if (typeof fetchDashboardData === 'function' && tmdAdvisoryState) {
        // Just re-displaying it is enough if we call the update func, but here we can just let it be or force update
      }
    });
  }

  if (btnCloseComparisonHeader) {
    btnCloseComparisonHeader.addEventListener("click", () => comparisonModal.classList.add("hidden"));
  }
  if (btnCloseComparison) {
    btnCloseComparison.addEventListener("click", () => comparisonModal.classList.add("hidden"));
  }
  if (btnSourceOpenMeteo) {
    btnSourceOpenMeteo.addEventListener("click", () => setActiveForecastSource("openmeteo"));
  }
  if (btnSourceOpenWeather) {
    btnSourceOpenWeather.addEventListener("click", () => setActiveForecastSource("openweather"));
  }
  if (btnSourceGoogleWeather) {
    btnSourceGoogleWeather.addEventListener("click", () => setActiveForecastSource("googleweather"));
  }
  if (btnToggleTableIcons) {
    btnToggleTableIcons.addEventListener("click", () => {
      setTableIconVisibility(!showTableWeatherIcons);
    });
  }

  // --- Download Table Logic ---
  const btnDownloadTable = document.getElementById("btn-download-table");
  const waitForTableExportFonts = async () => {
    if (!document.fonts || typeof document.fonts.load !== "function") return;
    await Promise.all([
      document.fonts.load("500 16px Sarabun"),
      document.fonts.load("600 16px Sarabun"),
      document.fonts.load("700 16px Sarabun"),
      document.fonts.load("900 16px 'Font Awesome 6 Free'").catch(() => null),
      document.fonts.ready
    ]);
  };

  const replaceFontAwesomeWithSvg = (container) => {
    const iconMap = {
      'fa-circle': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><circle cx="256" cy="256" r="256" fill="currentColor"/></svg>',
      'fa-table': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M64 32C28.7 32 0 60.7 0 96v320c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64V96c0-35.3-28.7-64-64-64H64zm0 64h384v64H64V96zm0 128h128v64H64v-64zm0 128h128v64H64v-64zm192-128h192v64H256v-64zm0 128h192v64H256v-64z"/></svg>',
      'fa-location-dot': '<svg viewBox="0 0 384 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M215.7 499.2C267 435 384 279.4 384 192C384 86 298 0 192 0S0 86 0 192c0 87.4 117 243 168.3 307.2c12.3 15.3 35.1 15.3 47.4 0zM192 128a64 64 0 1 1 0 128 64 64 0 1 1 0-128z"/></svg>',
      'fa-download': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M288 32c0-17.7-14.3-32-32-32s-32 14.3-32 32v242.7l-73.4-73.4c-12.5-12.5-32.8-12.5-45.3 0s-12.5 32.8 0 45.3l128 128c12.5 12.5 32.8 12.5 45.3 0l128-128c12.5-12.5 12.5-32.8 0-45.3s-32.8-12.5-45.3 0L288 274.7V32zM64 352c-35.3 0-64 28.7-64 64v32c0 35.3 28.7 64 64 64h384c35.3 0 64-28.7 64-64v-32c0-35.3-28.7-64-64-64H64z"/></svg>',
      'fa-circle-check': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zM369 209L241 337c-9.4 9.4-24.6 9.4-33.9 0l-64-64c-9.4-9.4-9.4-24.6 0-33.9s24.6-9.4 33.9 0l47 47L335 175c9.4-9.4 24.6-9.4 33.9 0s9.4 24.6 0 33.9z"/></svg>',
      'fa-circle-exclamation': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M256 512A256 256 0 1 0 256 0a256 256 0 1 0 0 512zm0-384c13.3 0 24 10.7 24 24v112c0 13.3-10.7 24-24 24s-24-10.7-24-24V152c0-13.3 10.7-24 24-24zm-32 224a32 32 0 1 1 64 0 32 32 0 1 1-64 0z"/></svg>',
      'fa-triangle-exclamation': '<svg viewBox="0 0 512 512" width="1em" height="1em" style="vertical-align:-0.125em;"><path fill="currentColor" d="M256 32c14.2 0 27.3 7.5 34.5 19.8l216 368c7.3 12.4 7.3 27.7 .2 40.1S486.3 480 472 480H40c-14.3 0-27.6-7.7-34.7-20.1s-7-27.8 .2-40.1l216-368C228.7 39.5 241.8 32 256 32zm0 128c-13.3 0-24 10.7-24 24v112c0 13.3 10.7 24 24 24s24-10.7 24-24V184c0-13.3-10.7-24-24-24zm-32 224a32 32 0 1 1 64 0 32 32 0 1 1-64 0z"/></svg>',
    };

    const replacements = [];
    container.querySelectorAll('i.fa-solid, i.fas, i.fa').forEach(icon => {
      for (const [faClass, svgHtml] of Object.entries(iconMap)) {
        if (icon.classList.contains(faClass)) {
          const span = document.createElement('span');
          span.innerHTML = svgHtml;
          span.style.color = icon.style.color || window.getComputedStyle(icon).color;
          span.style.fontSize = icon.style.fontSize || 'inherit';
          span.style.marginRight = icon.style.marginRight || '';
          span.style.display = 'inline-flex';
          span.style.alignItems = 'center';
          span.dataset.originalIcon = icon.outerHTML;
          replacements.push({ original: icon, replacement: span });
          break;
        }
      }
    });

    replacements.forEach(({ original, replacement }) => {
      original.parentNode.replaceChild(replacement, original);
    });

    return replacements;
  };

  const restoreFontAwesomeIcons = (replacements) => {
    replacements.forEach(({ replacement }) => {
      if (replacement.dataset.originalIcon && replacement.parentNode) {
        const temp = document.createElement('div');
        temp.innerHTML = replacement.dataset.originalIcon;
        const original = temp.firstElementChild;
        replacement.parentNode.replaceChild(original, replacement);
      }
    });
  };

  const captureForecastTableImage = async (tableCard) => {
    // Replace Font Awesome icons with inline SVGs before capture
    const replacements = replaceFontAwesomeWithSvg(tableCard);

    try {
      if (window.htmlToImage && typeof window.htmlToImage.toPng === "function") {
        return await window.htmlToImage.toPng(tableCard, {
          pixelRatio: 2,
          backgroundColor: "#f8fafc",
          cacheBust: true,
          width: tableCard.offsetWidth,
          height: tableCard.offsetHeight,
          style: {
            transform: "none"
          }
        });
      }

      if (typeof html2canvas === "undefined") {
        throw new Error("Image export library is not ready");
      }

      const canvas = await html2canvas(tableCard, {
        scale: 2,
        backgroundColor: "#f8fafc",
        useCORS: true,
        logging: false,
        onclone: (clonedDoc) => {
          const clonedTableCard = clonedDoc.querySelector(".table-card");
          if (!clonedTableCard) return;
          clonedTableCard.style.fontFamily = "'Sarabun', sans-serif";
          clonedTableCard.querySelectorAll("*").forEach((el) => {
            el.style.fontFamily = "'Sarabun', sans-serif";
            el.style.letterSpacing = "0";
          });
        }
      });

      return canvas.toDataURL("image/png");
    } finally {
      // Always restore original Font Awesome icons
      restoreFontAwesomeIcons(replacements);
    }
  };

  const waitForExportLayout = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  if (btnDownloadTable) {
    btnDownloadTable.addEventListener("click", async () => {
      if (!(window.htmlToImage && typeof window.htmlToImage.toPng === "function") && typeof html2canvas === 'undefined') {
        alert("ระบบดาวน์โหลดภาพกำลังโหลด โปรดลองใหม่อีกครั้ง");
        return;
      }
      
      const originalHtml = btnDownloadTable.innerHTML;
      const originalShowTableWeatherIcons = showTableWeatherIcons;
      btnDownloadTable.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังบันทึก...';
      btnDownloadTable.disabled = true;
      
      // We temporarily hide the download button, icon toggle button, and general note so they don't appear in the screenshot
      btnDownloadTable.style.display = 'none';
      if (btnToggleTableIcons) btnToggleTableIcons.style.display = 'none';
      const generalNote = document.querySelector('.forecast-general-note');
      const originalGeneralNoteDisplay = generalNote ? generalNote.style.display : '';
      if (generalNote) generalNote.style.display = 'none';
      
      // === Unlock ALL parent containers so the table can expand to its natural full width ===
      const tableCard = document.querySelector('.table-card');
      const tableResponsive = document.querySelector('.table-responsive');
      const appContainer = document.querySelector('.app-container');
      const dashboardGrid = document.querySelector('.dashboard-grid-full');
      const forecastTable = document.querySelector('.forecast-table');
      
      // Save original styles
      const saved = {
        tableResponsiveOverflow: tableResponsive ? tableResponsive.style.overflow : '',
        tableResponsiveMaxWidth: tableResponsive ? tableResponsive.style.maxWidth : '',
        tableCardWidth: tableCard ? tableCard.style.width : '',
        tableCardMaxWidth: tableCard ? tableCard.style.maxWidth : '',
        tableCardPadding: tableCard ? tableCard.style.padding : '',
        appContainerMaxWidth: appContainer ? appContainer.style.maxWidth : '',
        appContainerWidth: appContainer ? appContainer.style.width : '',
        dashboardGridWidth: dashboardGrid ? dashboardGrid.style.width : '',
        forecastTableWidth: forecastTable ? forecastTable.style.width : '',
        forecastTableMinWidth: forecastTable ? forecastTable.style.minWidth : '',
        forecastTableTableLayout: forecastTable ? forecastTable.style.tableLayout : ''
      };

      document.body.classList.add('is-exporting-table');
      // Weather icons are now preserved during export via SVG replacement
      
      // Unlock all width constraints
      if (tableResponsive) {
        tableResponsive.style.overflow = 'visible';
        tableResponsive.style.maxWidth = 'none';
      }
      if (tableCard) {
        tableCard.style.width = '1680px';
        tableCard.style.maxWidth = 'none';
        tableCard.style.padding = '24px';
      }
      if (appContainer) {
        appContainer.style.maxWidth = 'none';
        appContainer.style.width = 'fit-content';
      }
      if (dashboardGrid) {
        dashboardGrid.style.width = 'fit-content';
      }
      // Force table to expand beyond 100%
      if (forecastTable) {
        forecastTable.style.width = '100%';
        forecastTable.style.minWidth = '0';
        forecastTable.style.tableLayout = 'fixed';
      }
      
      try {
        await waitForTableExportFonts();
        await waitForExportLayout();
        
        const link = document.createElement('a');
        link.download = `forecast-table-${new Date().toISOString().split('T')[0]}.png`;
        link.href = await captureForecastTableImage(tableCard);
        link.click();
      } catch (error) {
        console.error("Error generating image:", error);
        alert("เกิดข้อผิดพลาดในการบันทึกรูปภาพ");
      } finally {
        document.body.classList.remove('is-exporting-table');
        // Restore ALL original styles
        if (forecastTable) {
          forecastTable.style.width = saved.forecastTableWidth;
          forecastTable.style.minWidth = saved.forecastTableMinWidth;
          forecastTable.style.tableLayout = saved.forecastTableTableLayout;
        }
        if (tableResponsive) {
          tableResponsive.style.overflow = saved.tableResponsiveOverflow;
          tableResponsive.style.maxWidth = saved.tableResponsiveMaxWidth;
        }
        if (tableCard) {
          tableCard.style.width = saved.tableCardWidth;
          tableCard.style.maxWidth = saved.tableCardMaxWidth;
          tableCard.style.padding = saved.tableCardPadding;
        }
        if (appContainer) {
          appContainer.style.maxWidth = saved.appContainerMaxWidth;
          appContainer.style.width = saved.appContainerWidth;
        }
        if (dashboardGrid) {
          dashboardGrid.style.width = saved.dashboardGridWidth;
        }
        btnDownloadTable.style.display = 'flex';
        btnDownloadTable.innerHTML = originalHtml;
        btnDownloadTable.disabled = false;
        if (btnToggleTableIcons) btnToggleTableIcons.style.display = '';
        if (generalNote) generalNote.style.display = originalGeneralNoteDisplay;
      }
    });
  }

  // Fetch real data on load automatically
  updateSourceToggleUI();
  updateTableIconToggleUI();
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
  const guideModal = document.getElementById("guide-modal");
  const btnOpenAccuracy = document.getElementById("btn-open-accuracy");
  const btnOpenGuide = document.getElementById("btn-open-guide");
  const btnCloseAccuracy = document.getElementById("btn-close-accuracy");
  const btnCloseAccuracyHeader = document.getElementById("btn-close-accuracy-header");
  const btnCloseGuide = document.getElementById("btn-close-guide");
  const btnCloseGuideHeader = document.getElementById("btn-close-guide-header");
  
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

    // Use Nominatim search (via proxy logic if needed or direct if acceptable for this search)
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
          const data = await fetchClientReverseGeocode(lat, lon);
          const { province, district } = parseReverseGeocodeLocation(data);

          if (province) {
            const normalizedProvince = stripAdministrativePrefix(province);
            const matchProv = thaiLocations.find(item => {
              const candidate = stripAdministrativePrefix(item.province);
              return candidate === normalizedProvince || candidate.includes(normalizedProvince) || normalizedProvince.includes(candidate);
            });

            if (matchProv) {
              inputProvince.value = matchProv.province;
              inputProvince.dispatchEvent(new Event("input"));

              if (district) {
                const normalizedDistrict = stripAdministrativePrefix(district);
                const matchDist = matchProv.districts.find(item => {
                  const candidate = stripAdministrativePrefix(item);
                  return candidate === normalizedDistrict || candidate.includes(normalizedDistrict) || normalizedDistrict.includes(candidate);
                });

                if (matchDist) {
                  inputDistrict.value = matchDist;
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
    initRadarToggle();
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

  if (btnOpenAccuracy && accuracyModal) {
    btnOpenAccuracy.addEventListener("click", () => {
      openAccuracyModal();
    });
  }

  [btnCloseAccuracy, btnCloseAccuracyHeader].forEach(button => {
    if (button && accuracyModal) {
      button.addEventListener("click", () => {
        accuracyModal.classList.add("hidden");
      });
    }
  });

  if (btnOpenGuide && guideModal) {
    btnOpenGuide.addEventListener("click", () => {
      guideModal.classList.remove("hidden");
    });
  }

  [btnCloseGuide, btnCloseGuideHeader].forEach(button => {
    if (button && guideModal) {
      button.addEventListener("click", () => {
        guideModal.classList.add("hidden");
      });
    }
  });

  if (accuracyModal) {
    accuracyModal.addEventListener("click", (event) => {
      if (event.target === accuracyModal) {
        accuracyModal.classList.add("hidden");
      }
    });
  }

  if (guideModal) {
    guideModal.addEventListener("click", (event) => {
      if (event.target === guideModal) {
        guideModal.classList.add("hidden");
      }
    });
  }

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape") {
      if (accuracyModal && !accuracyModal.classList.contains("hidden")) {
        accuracyModal.classList.add("hidden");
      }
      if (guideModal && !guideModal.classList.contains("hidden")) {
        guideModal.classList.add("hidden");
      }
      if (locModal && !locModal.classList.contains("hidden")) {
        locModal.classList.add("hidden");
      }
    }
  });
});

// Refresh whole dashboard UI
function loadDataAndRefresh() {
  if (activeForecastData.length === 0) return;
  
  // Keep the active selected date if available in new dataset, otherwise select first date
  const dateExists = activeForecastData.some(d => d.date === selectedDate);
  if (!dateExists) {
    selectedDate = activeForecastData[0].date;
  }
  
  updateCurrentConditionsCard();
  renderDayTabs();
  renderTable();
  updateKpiAnalytics();
  renderChart();
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
  if (kpiSelectedDate) {
    kpiSelectedDate.innerText = selectedDate ? formatDateContext(selectedDate) : "-";
  }

  if (!selectedEntries.length) {
    kpiPeakWindow.innerText = "-";
    kpiPeakDetail.innerText = "ไม่พบข้อมูลรายชั่วโมง";
    if (kpiPeakExtra) kpiPeakExtra.classList.add("hidden");
    kpiAlertHeadline.innerText = "ไม่มีข้อมูลเตือน";
    kpiAlertDetail.innerText = "ไม่พบข้อมูลรายชั่วโมง";
    kpiIntensity.innerText = "จุดฝนแรงสุด";
    kpiIntensityDetail.innerText = "ยังไม่มีข้อมูลเพียงพอ";
    applyAlertVisualState("calm");
    updateAlertMarquee(null);
    return;
  }

  const peakWindow = findPeakRainWindow(selectedEntries);
  const strongestProfile = findStrongestRainProfile(selectedEntries);
  const alertCard = resolveAlertCardData(selectedEntries);

  if (peakWindow) {
    kpiPeakWindow.innerText = formatHourRange(peakWindow.startHour, peakWindow.endHour);
    kpiPeakDetail.innerText = `สูงสุด ${Math.round(peakWindow.probability * 100)}% | ${peakWindow.weather.label} | ${peakWindow.rainIntensity.label}`;
    
    if (kpiPeakExtra && peakWindow.totalRain !== undefined) {
      kpiPeakTotalRain.innerText = formatMillimeters(peakWindow.totalRain);
      kpiPeakMaxWind.innerText = formatWindKmh(peakWindow.maxWind);
      kpiPeakExtra.classList.remove("hidden");
    }
  } else {
    kpiPeakWindow.innerText = "-";
    kpiPeakDetail.innerText = "ไม่มีฝน";
    if (kpiPeakExtra) kpiPeakExtra.classList.add("hidden");
  }

  kpiAlertHeadline.innerText = alertCard.label;
  kpiAlertDetail.innerText = alertCard.detail;
  applyAlertVisualState(alertCard.severity);
  updateAlertMarquee(alertCard);

  const alertLinkBtn = document.getElementById("kpi-alert-link");
  const alertPdfBtn = document.getElementById("kpi-alert-pdf");
  
  if (alertLinkBtn) {
    if (alertCard.url) {
      alertLinkBtn.href = alertCard.url;
      alertLinkBtn.classList.remove("hidden");
    } else {
      alertLinkBtn.href = "#";
      alertLinkBtn.classList.add("hidden");
    }
  }

  if (alertPdfBtn) {
    if (alertCard.pdf) {
      alertPdfBtn.href = alertCard.pdf;
      alertPdfBtn.classList.remove("hidden");
    } else {
      alertPdfBtn.href = "#";
      alertPdfBtn.classList.add("hidden");
    }
  }

  if (strongestProfile) {
    kpiIntensity.innerText = `จุดฝนแรงสุด: ${strongestProfile.rainIntensity.label}`;
    kpiIntensityDetail.innerText = `${strongestProfile.hour} | ${formatMillimeters(strongestProfile.precipitation)} | ${strongestProfile.weather.label} | ลม ${formatWindKmh(strongestProfile.windGust)}`;
  }
}

// Render dynamic rows of the table
function renderTable() {
  forecastTableBody.innerHTML = "";
  
  activeForecastData.forEach((day, index) => {
    const row = document.createElement("tr");
    
    // Day cell
    const dateCell = document.createElement("td");
    
    // Add reliability indicator
    let indicatorHtml = "";
    if (showTableWeatherIcons) {
      if (index <= 1) {
        indicatorHtml = `<i class="fa-solid fa-circle-check" style="color: #4ade80; margin-right: 4px; font-size: 0.8rem;" title="ความน่าเชื่อถือ สูง"></i>`;
      } else if (index <= 4) {
        indicatorHtml = `<i class="fa-solid fa-circle-exclamation" style="color: #fbbf24; margin-right: 4px; font-size: 0.8rem;" title="ความน่าเชื่อถือ ปานกลาง"></i>`;
      } else {
        indicatorHtml = `<i class="fa-solid fa-triangle-exclamation" style="color: #f97316; margin-right: 4px; font-size: 0.8rem;" title="ความน่าเชื่อถือ ต่ำ"></i>`;
      }
    }
    
    dateCell.innerHTML = `${indicatorHtml}${formatDate(day.date)}`;
    dateCell.style.whiteSpace = "nowrap";
    row.appendChild(dateCell);
    
    // Render 24 cells for all hours, each with colspan="1"
    for (let i = 0; i < 24; i++) {
      const hourNumStr = i.toString().padStart(2, '0');
      const hour = `${hourNumStr}:00`;
      
      const cell = document.createElement("td");
      const entry = day.values[hour];
      const val = entry ? getEntryProbability(entry) : null;
      
      if (val === null || val === undefined) {
        cell.innerText = "-";
      } else {
        const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, val, hour);
        const rainIntensity = getRainIntensity(entry.precipitation);
        const stormRisk = getStormRisk(entry.weatherCode, entry.windGust, val);
        const valueWrapper = document.createElement("span");
        valueWrapper.className = "table-value";
        valueWrapper.textContent = `${Math.round(val * 100)}%`;

        const iconWrapper = document.createElement("span");
        iconWrapper.className = "table-icon";
        iconWrapper.innerHTML = buildWeatherIconHtml(weather);

        cell.appendChild(valueWrapper);
        if (showTableWeatherIcons) {
          cell.appendChild(iconWrapper);
        }
        

        cell.setAttribute("aria-label", `${hour} ${weather.label} ${rainIntensity.label}`);
        cell.addEventListener("mouseenter", (event) => {
          showTableTooltip(buildTableTooltipHtml(hour, entry), event);
        });
        cell.addEventListener("mousemove", moveTableTooltip);
        cell.addEventListener("mouseleave", hideTableTooltip);
        
        // Add click listener for Comparison Modal
        cell.style.cursor = "pointer";
        cell.addEventListener("click", () => {
          hideTableTooltip();
          openComparisonModal(day.date, hour);
        });

        
        if (val <= 0.40) {
          cell.className = "cell-low";
        } else if (val <= 0.70) {
          cell.className = "cell-med";
        } else if (val <= 0.90) {
          cell.className = "cell-high";
        } else {
          cell.className = "cell-very-high";
        }

        if (rainIntensity.rank >= 4 && showTableWeatherIcons) {
          cell.classList.add("cell-heavy");
        }

        if (stormRisk.active && showTableWeatherIcons) {
          cell.classList.add("cell-storm");
        }
      }
      row.appendChild(cell);
    }
    
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

// Plugin to draw horizontal threshold lines matching table color tiers
const thresholdLinesPlugin = {
  id: 'thresholdLines',
  afterDraw: (chart) => {
    const { ctx, chartArea, scales } = chart;
    const yAxis = scales.y;

    const thresholds = [
      { value: 40, color: 'rgba(91, 140, 62, 0.4)', label: '40%' },
      { value: 70, color: 'rgba(196, 154, 26, 0.4)', label: '70%' },
      { value: 90, color: 'rgba(192, 57, 43, 0.4)', label: '90%' }
    ];

    ctx.save();
    thresholds.forEach(({ value, color, label }) => {
      const y = yAxis.getPixelForValue(value);

      // Draw dashed line
      ctx.beginPath();
      ctx.setLineDash([6, 4]);
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.moveTo(chartArea.left, y);
      ctx.lineTo(chartArea.right, y);
      ctx.stroke();

      // Draw label
      ctx.setLineDash([]);
      ctx.fillStyle = color;
      ctx.font = "bold 10px 'Outfit', sans-serif";
      ctx.textAlign = "right";
      ctx.fillText(label, chartArea.right - 4, y - 4);
    });
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

  // Colors matching the table's 4-tier system
  const textColor = "#64748b";
  const gridColor = "rgba(0, 0, 0, 0.05)";

  // Threshold colors (matching table cell colors)
  const colorLow = "#5b8c3e";         // Green (0-40%)
  const colorMed = "#c49a1a";         // Amber (41-70%)
  const colorHigh = "#d96a1b";        // Orange (71-90%)
  const colorVeryHigh = "#c0392b";    // Red (91-100%)

  // Vertical gradient fill matching table tiers (bottom=green to top=red)
  const chartGradient = ctx.createLinearGradient(0, 0, 0, 300);
  chartGradient.addColorStop(0, "rgba(192, 57, 43, 0.35)");    // Red at top (100%)
  chartGradient.addColorStop(0.1, "rgba(217, 106, 27, 0.30)");  // Orange (90%)
  chartGradient.addColorStop(0.3, "rgba(196, 154, 26, 0.25)");  // Amber (70%)
  chartGradient.addColorStop(0.6, "rgba(91, 140, 62, 0.18)");   // Green (40%)
  chartGradient.addColorStop(1, "rgba(91, 140, 62, 0.02)");     // Fade out at bottom

  // Helper: get color based on value threshold
  const getThresholdColor = (value) => {
    if (value <= 40) return colorLow;
    if (value <= 70) return colorMed;
    if (value <= 90) return colorHigh;
    return colorVeryHigh;
  };

  forecastChartInstance = new Chart(ctx, {
    type: "line",
    data: {
      labels: hours,
      datasets: [{
        label: "โอกาสการเกิดฝน (%)",
        data: values,
        borderWidth: 3,
        segment: {
          borderColor: (ctx) => {
            const yVal = ctx.p1.parsed.y;
            return getThresholdColor(yVal);
          }
        },
        pointBackgroundColor: (ctx) => {
          const val = ctx.parsed ? ctx.parsed.y : 0;
          return getThresholdColor(val || 0);
        },
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
    plugins: [dayNightBackgroundPlugin, thresholdLinesPlugin],
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
              const weather = getWeatherDetails(entry.weatherCode, entry.precipitation, entry.windGust, entry.probability, hour);
              const rainIntensity = getRainIntensity(entry.precipitation);
              const stormRisk = getStormRisk(entry.weatherCode, entry.windGust, entry.probability);
              const stormLine = stormRisk.active ? [`สัญญาณพายุ: ${stormRisk.label}`] : [];

              return [
                `โอกาสฝน: ${context.parsed.y}%`,
                `ลักษณะอากาศ: ${weather.label}`,
                `ปริมาณฝน: ${formatMillimeters(entry.precipitation)}`,
                `ความแรงฝน: ${rainIntensity.label}`,
                `ลมกระโชก: ${formatWindKmh(entry.windGust)}`,
                ...stormLine
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

function updateWindyRadar(lat, lon) {
  const iframe = document.getElementById("windy-radar");
  if (!iframe) return;
  iframe.src = `https://embed.windy.com/embed2.html`
    + `?type=map&location=coordinates`
    + `&lat=${lat}&lon=${lon}`
    + `&detailLat=${lat}&detailLon=${lon}`
    + `&zoom=8`
    + `&level=surface`
    + `&overlay=radar`
    + `&product=radar`
    + `&menu=&message=true`
    + `&marker=true`
    + `&calendar=now`
    + `&pressure=&type=map`
    + `&location=coordinates&metricWind=km%2Fh`
    + `&metricTemp=%C2%B0C`;
}

async function fetchDashboardData() {
  showLoading("กำลังเรียกข้อมูลพยากรณ์ล่าสุด...");

  try {
    if (!hasDistrictInLocationName(currentLocName)) {
      const resolvedLocationName = await resolveLocationNameFromCoordinates(currentLat, currentLon, currentLocName);
      if (resolvedLocationName && resolvedLocationName !== currentLocName) {
        currentLocName = resolvedLocationName;
        localStorage.setItem("appLocName", currentLocName);
      }
    }

    const [openMeteoResult, tmdResult, openWeatherResult, googleWeatherResult] = await Promise.allSettled([
      fetchOpenMeteoForecast(currentLat, currentLon),
      fetchTmdForecastSummary(currentLat, currentLon),
      fetchOpenWeatherForecast(currentLat, currentLon),
      fetchGoogleWeatherForecast(currentLat, currentLon)
    ]);
    
    // Fetch and display sunrise/sunset for this location
    if (typeof fetchAndDisplaySunTimes === 'function') {
      fetchAndDisplaySunTimes(currentLat, currentLon);
    }

    const openMeteoAvailable = openMeteoResult.status === "fulfilled" && openMeteoResult.value.forecastDays.length > 0;
    sourceComparisonState.openMeteoData = openMeteoAvailable ? openMeteoResult.value.forecastDays : [];
    sourceComparisonState.openMeteoText = openMeteoAvailable
      ? openMeteoResult.value.statusText
      : "Open-Meteo unavailable in this cycle";
    displayLocation.innerText = currentLocName;
    if (tableLocationDisplay) {
      const locText = tableLocationDisplay.querySelector('.loc-text');
      if (locText) locText.innerText = currentLocName;
    }
    if (openMeteoAvailable) {
      console.log("Weather data loaded from Open-Meteo successfully.");
    } else if (openMeteoResult.status !== "fulfilled") {
      console.warn("Open-Meteo unavailable for this cycle:", openMeteoResult.reason);
    } else {
      console.warn("Open-Meteo returned no forecast rows for this cycle.");
    }
    
    // Sync radar map with current coordinates
    updateWindyRadar(currentLat, currentLon);
    
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

    if (openWeatherResult && openWeatherResult.status === "fulfilled") {
      sourceComparisonState.openWeatherText = openWeatherResult.value.statusText;
      sourceComparisonState.openWeatherData = openWeatherResult.value.forecastDays;
    } else {
      sourceComparisonState.openWeatherText = (openWeatherResult && openWeatherResult.reason && openWeatherResult.reason.message) ? openWeatherResult.reason.message : "ล้มเหลว";
      sourceComparisonState.openWeatherData = null;
    }

    if (googleWeatherResult && googleWeatherResult.status === "fulfilled") {
      sourceComparisonState.googleWeatherText = googleWeatherResult.value.statusText;
      sourceComparisonState.googleWeatherData = googleWeatherResult.value.forecastDays;
    } else {
      sourceComparisonState.googleWeatherText = (googleWeatherResult && googleWeatherResult.reason && googleWeatherResult.reason.message)
        ? googleWeatherResult.reason.message
        : "ล้มเหลว";
      sourceComparisonState.googleWeatherData = null;
    }

    const hasOpenMeteoData = getForecastDataBySource("openmeteo").length > 0;
    const hasOpenWeatherData = getForecastDataBySource("openweather").length > 0;
    const hasGoogleWeatherData = getForecastDataBySource("googleweather").length > 0;
    if (!hasOpenMeteoData && !hasOpenWeatherData && !hasGoogleWeatherData) {
      if (openMeteoResult.status !== "fulfilled") {
        throw openMeteoResult.reason;
      }
      throw new Error("No forecast data available from Open-Meteo, OpenWeather, or Google Weather");
    }

    const availableSources = ["openmeteo", "openweather", "googleweather"].filter((key) => getForecastDataBySource(key).length > 0);
    const preferredSource = availableSources.includes(sourceComparisonState.activeSource)
      ? sourceComparisonState.activeSource
      : availableSources[0];
    sourceComparisonState.activeSource = preferredSource;
    activeForecastData = getForecastDataBySource(preferredSource);
    updateSourceToggleUI();
    loadDataAndRefresh();
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
function formatDate(dateString, withYear = true) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = dateObj.getDate();
  const monthIdx = dateObj.getMonth();
  
  if (currentLang === "zh") {
    const zhMonths = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    return withYear ? `${dateObj.getFullYear()}年${zhMonths[monthIdx]}${day}日` : `${zhMonths[monthIdx]}${day}日`;
  } else {
    const thMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const yearTh = (dateObj.getFullYear() + 543) % 100;
    return `${day} ${thMonthsShort[monthIdx]} ${yearTh}`;
  }
}

// Format date for tabs
function formatDateTab(dateString) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = dateObj.getDate();
  const dayIdx = dateObj.getDay();
  
  if (currentLang === "zh") {
    const zhDays = ["周日", "周一", "周二", "周三", "周四", "周五", "周六"];
    return `${day}日 (${zhDays[dayIdx]})`;
  } else {
    const thDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    return `${thDays[dayIdx]} ${day}`;
  }
}

function formatDateContext(dateString) {
  const parts = dateString.split("-");
  const dateObj = new Date(parts[0], parts[1] - 1, parts[2]);
  const day = dateObj.getDate();
  const dayIdx = dateObj.getDay();
  const monthIdx = dateObj.getMonth();
  
  if (currentLang === "zh") {
    const zhDays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const zhMonths = ["1月", "2月", "3月", "4月", "5月", "6月", "7月", "8月", "9月", "10月", "11月", "12月"];
    return `${dateObj.getFullYear()}年${zhMonths[monthIdx]}${day}日 (${zhDays[dayIdx]})`;
  } else {
    const thDays = ["อา.", "จ.", "อ.", "พ.", "พฤ.", "ศ.", "ส."];
    const thMonthsShort = ["ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค."];
    const yearTh = (dateObj.getFullYear() + 543) % 100;
    return `${thDays[dayIdx]} ${day} ${thMonthsShort[monthIdx]} ${yearTh}`;
  }
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

// ==========================================
// Client-side Radar Scanner (Nowcast Widget)
// ==========================================

const NOWCAST_ZOOM = 9;
const TILE_SIZE = 256;
const KM_PER_PIXEL = 0.3; // Approx at lat 14 for Zoom 9

function lon2px(lon, zoom) { return ((lon + 180) / 360 * Math.pow(2, zoom)) * TILE_SIZE; }
function lat2px(lat, zoom) { return ((1 - Math.log(Math.tan(lat * Math.PI / 180) + 1 / Math.cos(lat * Math.PI / 180)) / Math.PI) / 2 * Math.pow(2, zoom)) * TILE_SIZE; }

async function startRadarScanner(lat, lon) {
  const widget = document.getElementById("nowcast-widget");
  const badge = document.getElementById("nowcast-status-badge");
  const message = document.getElementById("nowcast-message");
  
  if (!widget) return;
  widget.classList.remove("hidden");
  
  badge.className = "nowcast-badge loading";
  badge.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> กำลังสแกน...';
  message.innerHTML = "กำลังเชื่อมต่อดาวเทียมและเรดาร์เพื่อค้นหากลุ่มฝนในรัศมี 30 กม...";

  try {
    const response = await fetch("https://api.rainviewer.com/public/weather-maps.json");
    const data = await response.json();
    
    const past = data.radar.past;
    if (past.length < 2) throw new Error("Not enough radar data");
    
    // Get last two frames
    const frameT = past[past.length - 1]; // Latest
    const frameT_minus = past[past.length - 2]; // Previous
    const host = data.host;
    
    const scanT = await scanRadarFrame(host, frameT.path, lat, lon);
    const scanT_minus = await scanRadarFrame(host, frameT_minus.path, lat, lon);
    
    analyzeStormMovement(scanT, scanT_minus, frameT.time - frameT_minus.time);
    
  } catch (err) {
    console.error("Radar scanner error:", err);
    badge.className = "nowcast-badge danger";
    badge.innerHTML = '<i class="fa-solid fa-circle-exclamation"></i> สแกนล้มเหลว';
    message.innerHTML = "ไม่สามารถเชื่อมต่อข้อมูลเรดาร์ได้ในขณะนี้";
  }
}

async function scanRadarFrame(host, path, lat, lon) {
  const cx = lon2px(lon, NOWCAST_ZOOM);
  const cy = lat2px(lat, NOWCAST_ZOOM);
  const tx = Math.floor(cx / TILE_SIZE);
  const ty = Math.floor(cy / TILE_SIZE);
  
  const offsetX = cx - (tx * TILE_SIZE) + TILE_SIZE;
  const offsetY = cy - (ty * TILE_SIZE) + TILE_SIZE;
  
  const canvas = document.getElementById("radar-scanner-canvas") || document.createElement("canvas");
  canvas.width = TILE_SIZE * 3;
  canvas.height = TILE_SIZE * 3;
  const ctx = canvas.getContext("2d", { willReadFrequently: true });
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  
  const promises = [];
  for (let dx = -1; dx <= 1; dx++) {
    for (let dy = -1; dy <= 1; dy++) {
      const tileUrl = `${host}${path}/256/${NOWCAST_ZOOM}/${tx + dx}/${ty + dy}/2/1_1.png`;
      promises.push(loadImageToCanvas(ctx, tileUrl, (dx + 1) * TILE_SIZE, (dy + 1) * TILE_SIZE));
    }
  }
  
  await Promise.all(promises);
  
  const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
  let nearestDist = Infinity;
  let nearestDx = 0;
  let nearestDy = 0;
  
  const maxRadius = 120; // ~36km
  
  for (let y = 0; y < canvas.height; y++) {
    for (let x = 0; x < canvas.width; x++) {
      const idx = (y * canvas.width + x) * 4;
      const r = imgData[idx];
      const g = imgData[idx+1];
      const b = imgData[idx+2];
      const a = imgData[idx+3];
      
      // Filter out light rain (cyan/blue) and noise
      const isSignificantRain = (r > 150 || g > 150) && (b < 150 || r > 150);
      
      if (a > 50 && isSignificantRain) {
        const dx = x - offsetX;
        const dy = y - offsetY;
        const dist = Math.sqrt(dx*dx + dy*dy);
        
        if (dist < nearestDist && dist <= maxRadius) {
          nearestDist = dist;
          nearestDx = dx;
          nearestDy = dy;
        }
      }
    }
  }
  
  return { dist: nearestDist, dx: nearestDx, dy: nearestDy };
}

function loadImageToCanvas(ctx, url, x, y) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = "Anonymous";
    img.onload = () => {
      ctx.drawImage(img, x, y);
      resolve();
    };
    img.onerror = () => resolve();
    img.src = url;
  });
}

function getDirectionName(dx, dy) {
  const angle = Math.atan2(dy, dx) * 180 / Math.PI;
  if (angle > -22.5 && angle <= 22.5) return "ตะวันออก";
  if (angle > 22.5 && angle <= 67.5) return "ตะวันออกเฉียงใต้";
  if (angle > 67.5 && angle <= 112.5) return "ใต้";
  if (angle > 112.5 && angle <= 157.5) return "ตะวันตกเฉียงใต้";
  if (angle > 157.5 || angle <= -157.5) return "ตะวันตก";
  if (angle > -157.5 && angle <= -112.5) return "ตะวันตกเฉียงเหนือ";
  if (angle > -112.5 && angle <= -67.5) return "เหนือ";
  if (angle > -67.5 && angle <= -22.5) return "ตะวันออกเฉียงเหนือ";
  return "ไม่ทราบทิศ";
}

function analyzeStormMovement(scanT, scanT_minus, timeDiffSec) {
  const badge = document.getElementById("nowcast-status-badge");
  const message = document.getElementById("nowcast-message");
  
  if (scanT.dist === Infinity) {
    badge.className = "nowcast-badge safe";
    badge.innerHTML = '<i class="fa-solid fa-shield-halved"></i> ปลอดโปร่ง';
    message.innerHTML = "ไม่พบกลุ่มฝนในรัศมี 30 กิโลเมตร <strong>(สถานการณ์ปกติ)</strong>";
    return;
  }
  
  const currentKm = (scanT.dist * KM_PER_PIXEL).toFixed(1);
  const dirName = getDirectionName(scanT.dx, scanT.dy);
  
  if (scanT_minus.dist === Infinity || scanT_minus.dist === scanT.dist) {
    badge.className = "nowcast-badge warning";
    badge.innerHTML = '<i class="fa-solid fa-cloud-showers-heavy"></i> พบกลุ่มฝน';
    message.innerHTML = `ตรวจพบกลุ่มฝนอยู่ทาง <strong>ทิศ${dirName}</strong> ห่างออกไปประมาณ <strong>${currentKm} กม.</strong> (ยังประเมินทิศทางการเคลื่อนที่ไม่ได้)`;
    return;
  }
  
  const diffPixels = scanT_minus.dist - scanT.dist;
  const diffKm = diffPixels * KM_PER_PIXEL;
  
  if (diffPixels > 2) { 
    const speedKmH = Math.max(5, (diffKm / (timeDiffSec / 3600))).toFixed(0);
    const timeToHit = Math.max(1, ((scanT.dist * KM_PER_PIXEL) / speedKmH * 60)).toFixed(0);
    
    badge.className = "nowcast-badge danger";
    badge.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i> พายุกำลังเข้า';
    message.innerHTML = `กลุ่มฝนกำลังพัดมาจาก <strong>ทิศ${dirName}</strong> ห่างออกไป <strong>${currentKm} กม.</strong><br>เคลื่อนตัวด้วยความเร็วประมาณ ${speedKmH} กม./ชม. <strong style="color:#f87171;">คาดว่าจะถึงพิกัดนี้ในอีก ${timeToHit} นาที!</strong>`;
  } else if (diffPixels < -2) { 
    badge.className = "nowcast-badge safe";
    badge.innerHTML = '<i class="fa-solid fa-arrow-right-from-bracket"></i> พายุพัดผ่านไปแล้ว';
    message.innerHTML = `กลุ่มฝนอยู่ทาง <strong>ทิศ${dirName}</strong> (ห่าง ${currentKm} กม.) <strong>และกำลังเคลื่อนตัวออกห่างจากคุณ</strong>`;
  } else { 
    badge.className = "nowcast-badge warning";
    badge.innerHTML = '<i class="fa-solid fa-cloud-showers-heavy"></i> พบกลุ่มฝน';
    message.innerHTML = `พบกลุ่มฝนทาง <strong>ทิศ${dirName}</strong> (ห่าง ${currentKm} กม.) <strong>กลุ่มฝนค่อนข้างทรงตัวในพื้นที่ ไม่ได้เคลื่อนตัวเข้าหาอย่างชัดเจน</strong>`;
  }
}

window.addEventListener('languagechanged', () => {
  if (activeForecastData && activeForecastData.length > 0) {
    const activeTab = document.querySelector(".tab-btn.active");
    const selectedDate = activeTab ? activeTab.dataset.date : getBangkokNowKeys().dateKey;
    kpiSelectedDate.innerText = formatDateContext(selectedDate);
    
    updateCurrentConditionsCard();
    renderForecastTabs();
    
    if (activeTab) {
      document.querySelector(`.tab-btn[data-date="${selectedDate}"]`)?.click();
    } else {
      renderForecastTable(selectedDate);
    }
  }
});
