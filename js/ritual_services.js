const API =
  "https://memoria-test-app-ifisk.ondigitalocean.app/api/ritual_services";
const GEONAMES_USER = "memoria";
const GEONAMES_LANG = "uk";

let allCompanies = [];
let geoSuggestions = [];

// DOM references
const container = document.getElementById("companiesContainer");
const searchInput = document.getElementById("searchInput");
const suggestionsList = document.getElementById("searchSuggestions");
const clearBtn = document.getElementById("clear-search");
const noResultsBlock = document.getElementById("noResults");
const noLocSpan = document.getElementById("noResultsLocation");

// 1) Load all companies
async function loadCompanies() {
  // menu toggle (same as other pages)
  const btn = document.getElementById("menu-btn");
  const drawer = document.getElementById("side-menu");
  const overlay = document.getElementById("overlay");

  btn.addEventListener("click", () => {
    drawer.classList.toggle("open");
    overlay.classList.toggle("open");
  });
  overlay.addEventListener("click", () => {
    drawer.classList.remove("open");
    overlay.classList.remove("open");
  });

  try {
    const res = await fetch(API);
    const data = await res.json();
    allCompanies = data.ritual_services || [];
    renderCompanies(allCompanies);
  } catch (e) {
    console.error("Error loading companies", e);
  }
}

// 2) Render grouped companies
function renderCompanies(list) {
  container.innerHTML = "";
  if (!list.length) return;
  const grouped = list.reduce((acc, c) => {
    (acc[c.category] ||= []).push(c);
    return acc;
  }, {});
  for (const [cat, items] of Object.entries(grouped)) {
    const h3 = document.createElement("h3");
    h3.className = "category-title";
    h3.textContent = cat;
    container.append(h3);

    const ul = document.createElement("ul");
    ul.className = "company-list";

    items.forEach((c) => {
      const a = document.createElement("a");
      const savedToken = localStorage.getItem("token");
      a.href = savedToken
        ? `/ritual_service_edit.html?id=${c.id}`
        : `/ritual_service_profile.html?id=${c.id}`;
      a.className = "company-link";

      const li = document.createElement("li");
      li.className = "company-item";
      li.innerHTML = `
        <img src="${c.logo}" alt="${c.name}" />
        <div class="company-info">
          <div class="company-name">${c.name}</div>
          <div class="company-address">${c.address[0]}</div>
        </div>`;

      a.appendChild(li);
      ul.appendChild(a);
    });

    container.append(ul);

    // If more than 4 — collapse and add the toggle under the list
    if (items.length > 4) {
      ul.classList.add("collapsed");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "show-more-btn";
      btn.setAttribute("aria-expanded", "false");
      btn.innerHTML = `
        <span class="label">показати більше</span>
        <svg class="chev-icon" viewBox="0 0 24 24" aria-hidden="true">
          <path d="M6 9l6 6 6-6" fill="none" stroke="currentColor"
                stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
      `;
      container.append(btn);
    }
  }
}

// 3) Haversine formula
function haversine(lat1, lon1, lat2, lon2) {
  const toRad = (v) => (v * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 4) Show/hide no-results
function showNoResults(loc, hasNearest) {
  // знаходимо другий <p> ("Найближчі до вас:")
  const nearestLabel = noResultsBlock.querySelectorAll("p")[1];
  if (hasNearest) {
    nearestLabel.style.display = "";
  } else {
    nearestLabel.style.display = "none";
  }
  noResultsBlock.style.display = "";
}
function hideNoResults() {
  noResultsBlock.style.display = "none";
}

// 5) Fetch suggestions from GeoNames
async function fetchGeoSuggestions(q) {
  try {
    const url =
      `https://secure.geonames.org/searchJSON?` +
      `name_startsWith=${encodeURIComponent(q)}` +
      `&country=UA` +
      `&featureClass=P` +
      `&maxRows=5` +
      `&lang=${GEONAMES_LANG}` +
      `&username=${GEONAMES_USER}`;
    const res = await fetch(url);
    const { geonames } = await res.json();
    geoSuggestions = (geonames || []).map((p) => ({
      lat: parseFloat(p.lat),
      lng: parseFloat(p.lng),
      display: [p.name, p.adminName1, p.countryName].filter(Boolean).join(", "),
    }));
  } catch (e) {
    console.warn("GeoNames error:", e);
    geoSuggestions = [];
  }
}

// 6) Input listener
searchInput.addEventListener("input", async (e) => {
  const q = e.target.value.trim();
  clearBtn.style.display = q ? "block" : "none";
  if (q.length < 1) {
    suggestionsList.style.display = "none";
    return;
  }
  await fetchGeoSuggestions(q);
  if (!geoSuggestions.length) {
    suggestionsList.innerHTML =
      '<li class="no-results">Збігів не знайдено</li>';
  } else {
    suggestionsList.innerHTML = geoSuggestions
      .map(
        (p) => `<li data-lat="${p.lat}" data-lng="${p.lng}">${p.display}</li>`
      )
      .join("");
  }
  suggestionsList.style.display = "block";
});

// 7) Blur hides suggestions
searchInput.addEventListener("blur", () => {
  setTimeout(() => (suggestionsList.style.display = "none"), 200);
});

// 8) Suggestion click
suggestionsList.addEventListener("click", (e) => {
  if (e.target.tagName !== "LI" || e.target.classList.contains("no-results"))
    return;
  const text = e.target.textContent;
  const lat = parseFloat(e.target.dataset.lat);
  const lon = parseFloat(e.target.dataset.lng);

  searchInput.value = text;
  clearBtn.style.display = "block";
  suggestionsList.style.display = "none";

  // розбиваємо вибране «Місто, Область, …»
  const parts = text.split(",").map((p) => p.trim());
  const cityName = parts[0] || "";
  const regionName = parts[1] || "";

  // тепер фільтруємо лише ті компанії, в яких є і місто, і область
  const direct = allCompanies.filter((c) => {
    const addr = c.address.toLowerCase();
    const cityMatch = cityName && addr.includes(cityName.toLowerCase());
    const regionMatch = regionName && addr.includes(regionName.toLowerCase());
    // якщо область не вказана (parts.length<2), просто перевіряємо по місту
    return regionName ? cityMatch && regionMatch : cityMatch;
  });

  if (direct.length) {
    hideNoResults();
    renderCompanies(direct);
    return;
  } else {
    const nearest = allCompanies
      .map((c) => ({
        ...c,
        distance: haversine(lat, lon, c.latitude, c.longitude),
      }))
      .filter((c) => c.distance <= 50)
      .sort((a, b) => a.distance - b.distance);
    showNoResults(text, nearest.length > 0);
    renderCompanies(nearest);
  }
});

// 9) Clear button
clearBtn.addEventListener("click", () => {
  searchInput.value = "";
  clearBtn.style.display = "none";
  suggestionsList.innerHTML = "";
  suggestionsList.style.display = "none";
  hideNoResults();
  renderCompanies(allCompanies);
});

// Toggle per-category "show more/less"
container.addEventListener("click", (e) => {
  const btn = e.target.closest(".show-more-btn");
  if (!btn) return;

  const ul = btn.previousElementSibling;
  if (!ul || !ul.classList.contains("company-list")) return;

  const collapsed = ul.classList.toggle("collapsed");
  const expanded = !collapsed;

  btn.setAttribute("aria-expanded", expanded ? "true" : "false");
  btn.querySelector(".label").textContent =
    expanded ? "показати менше" : "показати більше";
});

// Init
document.addEventListener("DOMContentLoaded", loadCompanies);
