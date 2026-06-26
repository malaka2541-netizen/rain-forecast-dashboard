// Rain Forecast Dashboard Logic - API Only Mode (Light Theme Only)

// User's Access Token (JWT) pre-populated
const userDefaultToken = "eyJ0eXAiOiJKV1QiLCJhbGciOiJSUzI1NiIsImp0aSI6IjhiNDQ0ZGIwMzUzNmY5MGE3ZTJkN2M3ZGM2YWIzYzg0YWRlYWZmN2JhZmE3MDJiNDc4ZTYwZjc5NmI3NGVmYTUwYzBhNDdjNTRlODY2NGMwIn0.eyJhdWQiOiIyIiwianRpIjoiOGI0NDRkYjAzNTM2ZjkwYTdlMmQ3YzdkYzZhYjNjODRhZGVhZmY3YmFmYTcwMmI0NzhlNjBmNzk2Yjc0ZWZhNTBjMGE0N2M1NGU4NjY0YzAiLCJpYXQiOjE3ODI0NjMwNzAsIm5iZiI6MTc4MjQ2MzA3MCwiZXhwIjoxODEzOTk5MDcwLCJzdWIiOiI1NDg5Iiwic2NvcGVzIjpbXX0.qdKrx5cJz8XU_kHCamlVOxF6pXxCSsdNgZolUkTeYlN6WyzEHhmBPr7htLD2JqBpGeiyJw2rI4OhllSsjhR5lfBWIGd2Pp38ea-AyWZePHl6J1fntFMbzTKcTIAwZAf5tuUyg37LgWpPxSAC_xWNNjVrDv05KOPuEGPMpbMBIj_G9rCo-N9ChzoPzUfUpEjto4phKH_XH7rUN3NUlIpBc9-GY7hK7I-e-HmIIRkNesOgY-BLj1xvu86qp8G_ZL4V_gKnD4JBlP1-ybeL6Pgnw8WXfd988eOfDSsjgO5q-TMWf_YuGYU6ED667RvfahqPYMR5Ar1TfWa9asWfEwM2UEWOTNaK0Ilv4QXc4vwqdx_mwpJHK4Wl_3Px3q3JQNN3e5P07fxPId3_TkBN6G0Obea6H7lNBjuYg5gUtxM6xupc0JFmkfM1NFMn-us-u331IXx_BoLVBGycJBGgfs4hpsTKEe49EslaXqoLrepIQIsASTdaTzbC_ua5K1o4S4h_woprOz11zHP6uIMi7aEt-DhLV_6_c8q4stLf2jjZaRRHYjacQjcR3edPt0W8oAdv8SOIipY3A17VFQnjdQr67m5m2r4rTNc1uEnWUPg-Pq1UnbUxoHEPqJM6XvjnSBs_DCk1hqji9pAIMvUkSc6v74vAc-afxNih8I_v_W4FlcM";

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

// DOM Elements
const displayLocation = document.getElementById("display-location");
const displayDateRange = document.getElementById("display-date-range");
const forecastAvgPercent = document.getElementById("forecast-avg-percent");
const kpiMaxChance = document.getElementById("kpi-max-chance");
const kpiMaxTime = document.getElementById("kpi-max-time");
const kpiHighRiskHours = document.getElementById("kpi-high-risk-hours");
const kpiSafeHours = document.getElementById("kpi-safe-hours");
const weatherIconDynamic = document.getElementById("weather-icon-dynamic");

const dayTabsContainer = document.getElementById("day-tabs");
const forecastTableBody = document.getElementById("forecast-table-body");

const loadingOverlay = document.getElementById("loading-overlay");
const loadingText = document.getElementById("loading-text");

// Initialize application
document.addEventListener("DOMContentLoaded", () => {
  // Fetch real data on load automatically
  fetchTmdNwpData();
  
  // Auto-refresh data from TMD API every 30 minutes
  setInterval(() => {
    console.log("Auto-refreshing weather data from TMD API (every 30 minutes)...");
    fetchTmdNwpData();
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
      fetchTmdNwpData();
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
  let totalSum = 0;
  let totalCount = 0;
  let maxChance = 0;
  let maxChanceTime = "";
  let highRiskHoursCount = 0;
  let safeHoursCount = 0;

  // Global calculations across all forecast data
  activeForecastData.forEach(day => {
    Object.entries(day.values).forEach(([hour, val]) => {
      if (val !== null) {
        totalSum += val;
        totalCount++;

        if (val > maxChance) {
          maxChance = val;
          maxChanceTime = `${formatDateTab(day.date)} (${hour})`;
        }

        if (val > 0.70) {
          highRiskHoursCount++;
        } else if (val <= 0.30) {
          safeHoursCount++;
        }
      }
    });
  });

  // Calculate current selected day's average for left panel display
  let selectedDaySum = 0;
  let selectedDayCount = 0;
  const currentDayData = activeForecastData.find(d => d.date === selectedDate);
  if (currentDayData) {
    Object.values(currentDayData.values).forEach(val => {
      if (val !== null) {
        selectedDaySum += val;
        selectedDayCount++;
      }
    });
  }

  const selectedAvg = selectedDayCount > 0 ? Math.round((selectedDaySum / selectedDayCount) * 100) : 0;
  forecastAvgPercent.innerText = `${selectedAvg}%`;
  
  // Set weather icon depending on average probability of rain
  updateWeatherIcon(selectedAvg);

  // Update KPI displays
  kpiMaxChance.innerText = `${Math.round(maxChance * 100)}%`;
  kpiMaxTime.innerText = maxChanceTime || "-";
  kpiHighRiskHours.innerText = `${highRiskHoursCount} ชม.`;
  kpiSafeHours.innerText = `${safeHoursCount} ชม.`;
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
      const val = day.values[hour];
      
      if (val === null || val === undefined) {
        cell.innerText = "-";
      } else {
        cell.innerText = `${Math.round(val * 100)}%`;
        
        if (val <= 0.30) {
          cell.className = "cell-low";
        } else if (val <= 0.70) {
          cell.className = "cell-med";
        } else {
          cell.className = "cell-high";
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
  const values = hours.map(h => currentDayData.values[h] !== null ? Math.round(currentDayData.values[h] * 100) : null);

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
              return `โอกาสฝน: ${context.parsed.y}%`;
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

// Fetch weather forecast from Open-Meteo API
async function fetchTmdNwpData() {
  showLoading("กำลังเรียกข้อมูลพยากรณ์อากาศรายชั่วโมงจาก Open-Meteo Ensemble...");
  const url = `/api/openmeteo?lat=${currentLat}&lon=${currentLon}&_t=${Date.now()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`Open-Meteo returned status ${response.status}`);
    const data = await response.json();
    const hourly = data.hourly;

    // Parse into { date: 'YYYY-MM-DD', values: { 'HH:00': pop } }
    const grouped = {};
    hourly.time.forEach((timeStr, i) => {
      // timeStr format: "2026-06-26T15:00"
      const [datePart, timePart] = timeStr.split("T");
      const hourKey = timePart.substring(0, 5); // "HH:MM"
      if (!grouped[datePart]) grouped[datePart] = {};

      const popValue = (hourly.precipitation_probability[i] ?? 0) / 100; // 0-100 -> 0.0-1.0
      grouped[datePart][hourKey] = parseFloat(popValue.toFixed(2));
    });

    // Convert grouped object to array sorted by date
    const apiParsedForecasts = [];
    const sortedDates = Object.keys(grouped).sort();
    sortedDates.forEach(dateStr => {
      apiParsedForecasts.push({
        date: dateStr,
        values: grouped[dateStr]
      });
    });

    if (apiParsedForecasts.length > 0) {
      activeForecastData = apiParsedForecasts;
      displayLocation.innerText = `${currentLocName} (พยากรณ์อากาศ Open-Meteo Ensemble 10 วัน)`;
      console.log("Weather data loaded from Open-Meteo successfully.");
      loadDataAndRefresh();
    } else {
      alert("ไม่สามารถสร้างชุดข้อมูลพยากรณ์อากาศจาก Open-Meteo ได้");
    }
  } catch (error) {
    console.error(error);
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

// Show loading overlay
function showLoading(text) {
  loadingText.innerText = text;
  loadingOverlay.classList.remove("hidden");
}

// Hide loading overlay
function hideLoading() {
  loadingOverlay.classList.add("hidden");
}
