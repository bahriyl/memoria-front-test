// js/people.js

const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app/api/people';
const LOC_API = 'https://memoria-test-app-ifisk.ondigitalocean.app/api/locations';
const CEM_API = 'https://memoria-test-app-ifisk.ondigitalocean.app/api/cemeteries';

let activeFilter = 'person';
let renderTimer;
let suggestionTimerArea;
let suggestionTimerCem;

const controlsEl = document.getElementById('filter-controls');
const totalEl = document.getElementById('total');
const listEl = document.getElementById('people-list');
const loadingEl = document.getElementById('loading');

const filterState = {
    search: '',
    birthYear: '',
    deathYear: '',
    area: '',
    cemetery: '',
    notableOnly: true
};

// cache the header and its default text
const headerEl = document.querySelector('main h2');
const defaultHeader = headerEl.textContent;

function initPhotoSlider() {
    const sliderEl = document.getElementById('photo-slider');
    if (!sliderEl) return;

    // 1) Очищаємо контейнер
    sliderEl.innerHTML = '';

    fetch(API_URL)
        .then(res => {
            if (!res.ok) throw new Error('Network error');
            return res.json();
        })
        .then(json => {
            const people = Array.isArray(json.people) ? json.people : [];
            if (!people.length) return;

            const notablePeople = people.filter(p => p.id && p.notable);

            // Якщо таких менше ніж 1, нічого не показуємо
            if (!notablePeople.length) return;

            // 2) Перемішуємо й беремо перших 6
            const randomSix = notablePeople
                .filter(p => p.id)                      // на всякий випадок лишаємо тих, в кого є id
                .sort(() => 0.5 - Math.random())
                .slice(0, 6);

            // 3) Рендеримо кожного
            randomSix.forEach(person => {
                const slide = document.createElement('div');
                slide.className = 'photo-slide';

                const img = document.createElement('img');
                img.src = person.avatarUrl || 'img/default-avatar.png';
                img.alt = person.name || '';
                slide.append(img);

                // 4) На клік — редірект
                slide.addEventListener('click', () => {
                    window.location.href = `profile.html?personId=${person.id}`;
                });

                sliderEl.append(slide);
            });
        })
        .catch(err => console.error('Cannot load slider:', err));
}

document.addEventListener('DOMContentLoaded', () => {
    initPhotoSlider();
});

// Ініціалізація табів
document.querySelectorAll('.filter').forEach(btn => {
    btn.addEventListener('click', () => {
        document.querySelector('.filter.active').classList.remove('active');
        btn.classList.add('active');
        activeFilter = btn.dataset.filter;
        renderFilterControls();
        fetchAndRender();
    });
});

// Малюємо контролси під поточний фільтр
function renderFilterControls() {
    controlsEl.innerHTML = '';
    controlsEl.classList.remove("search-bar");

    switch (activeFilter) {
        case 'person': {
            controlsEl.classList.add("search-bar");
            controlsEl.innerHTML = `
        <button class="icon-btn search-btn" aria-label="Пошук">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <input
          type="text"
          id="search"
          placeholder="Введіть ПІБ…"
          value="${filterState.search}"
        />
        <button class="icon-btn plus-btn" id="plus-btn" title="Додати особу">
            <svg viewBox="0 0 24 24" stroke="currentColor" fill="none" stroke-width="2"
                stroke-linecap="round" stroke-linejoin="round">
                <line x1="12" y1="5" x2="12" y2="19"/>
                <line x1="5" y1="12" x2="19" y2="12"/>
            </svg>
        </button>
      `;
            // Пошук за ПІБ
            const searchInput = controlsEl.querySelector('#search');
            searchInput.addEventListener('input', () => {
                filterState.search = searchInput.value;
                clearTimeout(renderTimer);
                renderTimer = setTimeout(fetchAndRender, 300);
            });
            // Триггер пошуку по кліку на іконку
            const searchBtn = controlsEl.querySelector('.search-btn');
            searchBtn.addEventListener('click', () => {
                clearTimeout(renderTimer);
                renderTimer = setTimeout(fetchAndRender, 0);
            });
            // plus button
            const plusBtn = controlsEl.querySelector('#plus-btn');
            plusBtn.addEventListener('click', () => {
                window.location.href = 'add_notable_person.html';
            });
            break;
        }

        case 'years': {
            // 1️⃣ Render two year-pills each with a clear button
            controlsEl.innerHTML = `
        <div class="years-controls">
          <div class="year-pill">
            <select id="birthYear" required>
              <option value="" disabled selected>Рік народження</option>
            </select>
            <button class="icon-btn clear-btn" id="clear-birth" aria-label="Скинути рік народження">
              <!-- simple “×” icon -->
              <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"
                   stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
          <div class="year-pill">
            <select id="deathYear" required>
              <option value="" disabled selected>Рік смерті</option>
            </select>
            <button class="icon-btn clear-btn" id="clear-death" aria-label="Скинути рік смерті">
              <svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none"
                   stroke-linecap="round" stroke-linejoin="round">
                <line x1="18" y1="6" x2="6" y2="18"/>
                <line x1="6" y1="6" x2="18" y2="18"/>
              </svg>
            </button>
          </div>
        </div>
      `;

            // 2️⃣ Grab elements
            const by = controlsEl.querySelector('#birthYear');
            const clearBy = controlsEl.querySelector('#clear-birth');
            const dy = controlsEl.querySelector('#deathYear');
            const clearDy = controlsEl.querySelector('#clear-death');

            // 3️⃣ Populate the selects
            for (let y = 1900; y <= 2025; y++) {
                by.append(new Option(y, y));
                dy.append(new Option(y, y));
            }
            // restore previous state
            by.value = filterState.birthYear;
            dy.value = filterState.deathYear;

            // 4️⃣ Initialize clear-button visibility
            clearBy.style.display = by.value ? 'flex' : 'none';
            clearDy.style.display = dy.value ? 'flex' : 'none';

            // 5️⃣ Handlers for selecting a year
            by.addEventListener('change', () => {
                filterState.birthYear = by.value;
                clearBy.style.display = by.value ? 'flex' : 'none';
                fetchAndRender();
            });
            dy.addEventListener('change', () => {
                filterState.deathYear = dy.value;
                clearDy.style.display = dy.value ? 'flex' : 'none';
                fetchAndRender();
            });

            // 6️⃣ Click handlers for clearing
            clearBy.addEventListener('click', () => {
                filterState.birthYear = '';
                by.value = '';
                clearBy.style.display = 'none';
                fetchAndRender();
            });
            clearDy.addEventListener('click', () => {
                filterState.deathYear = '';
                dy.value = '';
                clearDy.style.display = 'none';
                fetchAndRender();
            });

            break;
        }

        case 'area': {
            // 1. Switch into “search‐bar” mode and position it
            controlsEl.classList.add('search-bar');
            controlsEl.style.position = 'relative';

            // 2. Render the input, clear button, and suggestion <ul>
            controlsEl.innerHTML = `
        <button class="icon-btn search-btn" aria-label="Пошук">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <input
          type="text"
          id="area"
          placeholder="Введіть населений пункт..."
          autocomplete="off"
          value="${filterState.area}"
        />
        <button class="icon-btn clear-btn" id="clear-area" aria-label="Очистити">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <ul class="suggestions-list"></ul>
      `;

            // 3. Grab references
            const areaInput = controlsEl.querySelector('#area');
            const clearBtn = controlsEl.querySelector('#clear-area');
            const suggestions = controlsEl.querySelector('.suggestions-list');
            const areaTab = document.querySelector('.filter[data-filter="area"]');
            const cemTab = document.querySelector('.filter[data-filter="cemetery"]');

            // 4. Initial clear‐button visibility
            clearBtn.style.display = filterState.area ? 'flex' : 'none';

            // 5. Show/hide dropdown on focus/blur
            areaInput.addEventListener('focus', () => {
                if (suggestions.children.length) suggestions.style.display = 'block';
            });
            areaInput.addEventListener('blur', () => {
                setTimeout(() => suggestions.style.display = 'none', 200);
            });

            // 6. Debounced fetch & render
            areaInput.addEventListener('input', () => {
                filterState.area = areaInput.value;
                clearTimeout(suggestionTimerArea);
                suggestionTimerArea = setTimeout(async () => {
                    // a) Refresh main list
                    fetchAndRender();

                    // b) Fetch area suggestions
                    try {
                        const res = await fetch(`${LOC_API}?search=${encodeURIComponent(areaInput.value)}`);
                        const items = await res.json();

                        // c) Populate the <ul>
                        if (!items.length) {
                            suggestions.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                        } else {
                            suggestions.innerHTML = items.map(a => `<li>${a}</li>`).join('');
                        }
                        // decide whether to show or hide based on exact match
                        const isExact = items.includes(areaInput.value);
                        suggestions.style.display = isExact ? 'none' : 'block';

                        // d) If exact match, lock it in
                        if (items.includes(areaInput.value)) {
                            const shortName = areaInput.value.split(',')[0].trim();
                            areaTab.textContent = shortName;
                            headerEl.textContent = shortName;
                            clearBtn.style.display = 'flex';
                        } else {
                            areaTab.textContent = 'Населений пункт';
                            headerEl.textContent = defaultHeader;
                            clearBtn.style.display = 'none';
                        }
                    } catch (e) {
                        console.error('Area suggestions error', e);
                    }
                }, 300);
            });

            // 7. Clicking a suggestion fills the input and blurs it
            suggestions.addEventListener('click', e => {
                if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
                    areaInput.value = e.target.textContent;
                    areaInput.dispatchEvent(new Event('input'));
                    // hide dropdown
                    suggestions.style.display = 'none';
                    // blur input so it’s considered inactive
                    areaInput.blur();
                }
            });

            // 8. Clear button resets area only
            clearBtn.addEventListener('click', () => {
                // 1) reset both filters in state
                filterState.area = '';
                filterState.cemetery = '';

                // 2) clear the Area field & dropdown
                areaInput.value = '';
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';

                // 3) reset the tabs & header
                areaTab.textContent = 'Населений пункт';
                cemTab.textContent = 'Кладовище';
                headerEl.textContent = defaultHeader;

                // 4) **only** clear the Cemetery input if it exists right now**
                const cemInput = document.getElementById('cemetery');
                const clearCemBtn = document.getElementById('clear-cem');
                if (cemInput) cemInput.value = '';
                if (clearCemBtn) clearCemBtn.style.display = 'none';

                // 5) hide the Area clear button
                clearBtn.style.display = 'none';

                fetchAndRender();
            });
            break;
        }

        case 'cemetery': {
            // 1. Switch into “search‐bar” mode and position it
            controlsEl.classList.add('search-bar');
            controlsEl.style.position = 'relative';

            // 2. Render the input, clear button, and suggestion <ul>
            controlsEl.innerHTML = `
        <button class="icon-btn search-btn" aria-label="Пошук">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <circle cx="11" cy="11" r="8"/>
            <line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </button>
        <input
          type="text"
          id="cemetery"
          placeholder="Введіть назву кладовища…"
          autocomplete="off"
          value="${filterState.cemetery}"
        />
        <button class="icon-btn clear-btn" id="clear-cem" aria-label="Очистити">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor"
               stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="18" y1="6" x2="6" y2="18"/>
            <line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
        <ul class="suggestions-list"></ul>
      `;

            // 3. Grab references
            const cemInput = controlsEl.querySelector('#cemetery');
            const clearCem = controlsEl.querySelector('#clear-cem');
            const suggestions = controlsEl.querySelector('.suggestions-list');
            const cemTab = document.querySelector('.filter[data-filter="cemetery"]');
            const areaTab = document.querySelector('.filter[data-filter="area"]');

            // Fetch all cemeteries for a given area (uses existing CEM_API)
            async function fetchCemeteriesForArea(area) {
                if (!area) return [];
                try {
                    const params = new URLSearchParams({ area });
                    const res = await fetch(`${CEM_API}?${params.toString()}`);
                    if (!res.ok) return [];
                    const arr = await res.json();
                    return Array.isArray(arr) ? arr : [];
                } catch {
                    return [];
                }
            }

            // If Area is selected and Cemetery input is empty → show full list for that Area
            async function showCemeteriesForSelectedAreaIfEmpty() {
                const area = (filterState.area || '').trim();
                const val = cemInput.value.trim();

                // If no area or user already typed something, just show the existing list (if any)
                if (!area || val) {
                    if (suggestions.children.length) suggestions.style.display = 'block';
                    return;
                }

                suggestions.innerHTML = '<li class="loading">Завантаження…</li>';
                suggestions.style.display = 'block';

                const items = await fetchCemeteriesForArea(area);
                suggestions.innerHTML = items.length
                    ? items.map(c => `<li>${c}</li>`).join('')
                    : '<li class="no-results">Нічого не знайдено</li>';
            }

            // Trigger on focus/click when the input is empty
            cemInput.addEventListener('focus', showCemeteriesForSelectedAreaIfEmpty);
            cemInput.addEventListener('click', showCemeteriesForSelectedAreaIfEmpty);

            // 4. Initial clear‐button visibility
            clearCem.style.display = filterState.cemetery ? 'flex' : 'none';

            // 5. Show/hide dropdown on focus/blur
            cemInput.addEventListener('focus', () => {
                if (suggestions.children.length) suggestions.style.display = 'block';
            });
            cemInput.addEventListener('blur', () => {
                setTimeout(() => suggestions.style.display = 'none', 200);
            });

            // 6. Debounced fetch & render
            cemInput.addEventListener('input', () => {
                filterState.cemetery = cemInput.value;
                clearTimeout(suggestionTimerCem);
                suggestionTimerCem = setTimeout(async () => {
                    // a) Refresh main list
                    fetchAndRender();

                    // b) Fetch cemetery suggestions
                    try {
                        const params = new URLSearchParams({
                            search: cemInput.value,
                            area: filterState.area || ''
                        });
                        const res = await fetch(`${CEM_API}?${params}`);
                        const items = await res.json();

                        // c) Populate the <ul>
                        if (!items.length) {
                            suggestions.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                        } else {
                            suggestions.innerHTML = items.map(c => `<li>${c}</li>`).join('');
                        }
                        // only show when no exact match
                        const isExact = items.includes(cemInput.value);
                        suggestions.style.display = isExact ? 'none' : 'block';

                        // d) If exact match, lock it in
                        if (isExact) {
                            // split out cemeteryName & areaNameFull
                            const parts = cemInput.value.split(',').map(s => s.trim());
                            const cemeteryName = parts.shift();
                            const areaNameFull = parts.join(', ');

                            // update state
                            filterState.cemetery = cemeteryName;
                            filterState.area = areaNameFull;

                            // update tabs & header
                            cemTab.textContent = cemeteryName;
                            areaTab.textContent = parts[0] || areaTab.textContent;
                            headerEl.textContent = cemeteryName;
                            clearCem.style.display = 'flex';

                            // re-render people list with new area filter
                            fetchAndRender();
                        } else {
                            cemTab.textContent = 'Кладовище';
                            clearCem.style.display = 'none';
                        }
                    } catch (e) {
                        console.error('Cemetery suggestions error', e);
                    }
                }, 300);
            });

            // 7. Clicking a suggestion fills the input and blurs it
            suggestions.addEventListener('click', e => {
                if (e.target.tagName === 'LI' && !e.target.classList.contains('no-results')) {
                    cemInput.value = e.target.textContent;
                    cemInput.dispatchEvent(new Event('input'));
                    suggestions.style.display = 'none';
                    cemInput.blur();
                }
            });

            // 8. Clear button resets cemetery only
            clearCem.addEventListener('click', () => {
                filterState.cemetery = '';
                cemInput.value = '';
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                cemTab.textContent = 'Кладовище';
                headerEl.textContent = (filterState.area
                    ? areaTab.textContent
                    : defaultHeader);
                clearCem.style.display = 'none';
                fetchAndRender();
            });

            break;
        }


    }
}

// Збираємо params і виконуємо запит
async function fetchAndRender() {
    loadingEl.style.display = 'block';
    const params = new URLSearchParams();

    if (filterState.search) params.set('search', filterState.search);
    if (filterState.birthYear) params.set('birthYear', filterState.birthYear);
    if (filterState.deathYear) params.set('deathYear', filterState.deathYear);
    if (filterState.area) params.set('area', filterState.area);
    if (filterState.cemetery) params.set('cemetery', filterState.cemetery);

    try {
        const res = await fetch(`${API_URL}?${params.toString()}`);
        if (!res.ok) throw new Error(res.statusText);
        const { total, people } = await res.json();

        // apply notable-only filter if requested
        let listToShow = people;
        if (filterState.notableOnly) {
            listToShow = listToShow.filter(p => p.notable);
        }

        // update the counter
        totalEl.textContent = listToShow.length;

        // render only the filtered list
        listEl.innerHTML = '';
        listToShow.forEach(p => {
            const li = document.createElement('li');
            li.innerHTML = `
      <img src="${p.avatarUrl || 'https://i.ibb.co/mrQJL133/Frame-519.jpg'}" alt="${p.name}" />
      <div class="person-info">
        <p class="person-name">${p.name}</p>
        <p class="person-years">${p.birthYear} – ${p.deathYear || ''} 
           ${p.notable ? '<span class="notable">Видатна особа</span>' : ''}
        </p>
      </div>
    `;
            li.addEventListener('click', () => {
                window.location.href = `profile.html?personId=${p.id}`;
            });
            listEl.appendChild(li);
        });
    } catch (e) {
        console.error(e);
        listEl.innerHTML = '<li>Помилка завантаження</li>';
    } finally {
        loadingEl.style.display = 'none';
    }
}

window.addEventListener('orientationchange', () => {
    window.location.reload();
});

// Стартова ініціалізація
renderFilterControls();
fetchAndRender();
