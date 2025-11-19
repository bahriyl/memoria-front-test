// js/people.js

const API_URL = 'http://localhost:5000/api/people';
const LOC_API = 'http://localhost:5000/api/locations';
const CEM_API = 'http://localhost:5000/api/cemeteries';

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
  birthYear: undefined,
  deathYear: undefined,
  area: '',
  areaId: '',
  cemetery: '',
  notableOnly: false
};

// cache the header and its default text
const headerEl = document.querySelector('main h2');
const defaultHeader = headerEl.textContent;

headerEl.classList.remove('clickable');
headerEl.onclick = null;

// Відновлюємо збережений у сесії фільтр за кладовищем (та його area) — тільки для головної
try {
  const savedCemetery = sessionStorage.getItem('memoria_cemetery_filter');
  const savedArea = sessionStorage.getItem('memoria_cemetery_area');
  const savedAreaId = sessionStorage.getItem('memoria_cemetery_area_id');

  if (savedCemetery) {
    filterState.cemetery = savedCemetery;
  }
  if (savedArea) {
    filterState.area = savedArea;
  }
  if (savedAreaId) {
    filterState.areaId = savedAreaId;
  }

  if (savedCemetery) {
    const cemTab = document.querySelector('.filter[data-filter="cemetery"]');
    const areaTab = document.querySelector('.filter[data-filter="area"]');

    if (cemTab) {
      cemTab.textContent = savedCemetery;
    }

    if (savedArea && areaTab) {
      const shortArea = savedArea.split(',')[0].trim();
      areaTab.textContent = shortArea || 'Населений пункт';
    }

    headerEl.textContent = savedCemetery;
    headerEl.classList.add('clickable');
    headerEl.onclick = () => {
      window.location.href = `cemetery.html?name=${encodeURIComponent(savedCemetery)}`;
    };
  }
} catch (e) {
  console.warn('Cannot access sessionStorage for cemetery filter', e);
}

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

  if (window._yearsDocHandlers) {
    for (const { type, handler } of window._yearsDocHandlers) {
      document.removeEventListener(type, handler);
    }
    window._yearsDocHandlers = null;
  }

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
        <button class="icon-btn favorite-btn" id="fav-toggle" title="У обране">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polygon points="12 17.27 18.18 21 16.54 13.97 22 9.24 14.81 8.63 12 2 9.19 8.63 2 9.24 7.46 13.97 5.82 21 12 17.27"/>
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
      // favorite-only toggle
      const favBtn = controlsEl.querySelector('.favorite-btn');
      favBtn.classList.toggle('active', filterState.notableOnly);
      favBtn.addEventListener('click', () => {
        // flip the flag
        filterState.notableOnly = !filterState.notableOnly;
        // visually mark the button active/inactive
        favBtn.classList.toggle('active', filterState.notableOnly);
        // re-fetch & render
        fetchAndRender();
      });
      break;
    }

    case 'years': {
      // Рендеримо такий самий HTML, як на преміум-сторінці
      controlsEl.innerHTML = `
        <div class="year-pill" id="lifeYearsPicker">
          <div class="year-display" id="lifeYearsDisplay">Роки життя</div>

          <button type="button" id="clearYears" class="icon-btn clear-btn" aria-label="Очистити роки життя" hidden>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          </button>

          <div class="years-panel" id="yearsPanel" hidden>
            <h3 class="years-panel__title">Рік народження та смерті</h3>
            <div class="years-body">
              <div class="year-column">
                <div class="year-wheel year-wheel--flat">
                  <ul class="year-list" id="birthYearsList"></ul>
                  <div class="year-focus" aria-hidden="true"></div>
                </div>
              </div>
              <div class="year-column">
                <div class="year-wheel year-wheel--flat">
                  <ul class="year-list" id="deathYearsList"></ul>
                  <div class="year-focus" aria-hidden="true"></div>
                </div>
              </div>
            </div>
            <button type="button" class="done-btn" id="yearsDoneBtn">Готово</button>
          </div>
        </div>
      `;

      // Елементи
      const panel = controlsEl.querySelector('#yearsPanel');
      const birthList = controlsEl.querySelector('#birthYearsList');
      const deathList = controlsEl.querySelector('#deathYearsList');
      const display = controlsEl.querySelector('#lifeYearsDisplay');
      const doneBtn = controlsEl.querySelector('#yearsDoneBtn');
      const clearBtn = controlsEl.querySelector('#clearYears');

      // Локальні вибори (початково — зі стану фільтра, якщо є)
      let selectedBirth = filterState.birthYear ? Number(filterState.birthYear) : undefined;
      let selectedDeath = filterState.deathYear ? Number(filterState.deathYear) : undefined;

      const picker = controlsEl.querySelector('#lifeYearsPicker');

      const updateDisplay = () => {
        const hasAny = !!(selectedBirth || selectedDeath);
        let text;

        if (selectedBirth && selectedDeath) {
          // both years
          text = `${selectedBirth} – ${selectedDeath}`;
        } else if (selectedBirth) {
          // only birth
          text = `${selectedBirth} – `;
        } else if (selectedDeath) {
          // only death
          text = ` – ${selectedDeath}`;
        } else {
          // none
          text = 'Роки життя';
        }

        display.textContent = text;
        display.classList.toggle('has-value', hasAny);
        picker.classList.toggle('has-value', hasAny);
        clearBtn.hidden = !hasAny;
      };

      const enforceChronology = (source = 'birth', behavior = 'smooth') => {
        if (!selectedBirth || !selectedDeath) return false;
        if (selectedBirth === selectedDeath) return false;

        if (selectedBirth > selectedDeath) {
          if (source === 'death') {
            birthWheel.setValue(String(selectedDeath), { silent: true, behavior });
            selectedBirth = selectedDeath;
          } else {
            deathWheel.setValue(String(selectedBirth), { silent: true, behavior });
            selectedDeath = selectedBirth;
          }
          return true;
        }
        return false;
      };

      (function populateYears() {
        if (birthList.children.length) return;

        const birthPlaceholder = document.createElement('li');
        birthPlaceholder.textContent = 'Від';
        birthPlaceholder.dataset.value = '';
        birthList.appendChild(birthPlaceholder);

        const deathPlaceholder = document.createElement('li');
        deathPlaceholder.textContent = 'До';
        deathPlaceholder.dataset.value = '';
        deathList.appendChild(deathPlaceholder);

        const now = new Date().getFullYear();
        for (let y = now; y >= 1900; y--) {
          const liB = document.createElement('li');
          liB.textContent = y; liB.dataset.value = String(y);
          birthList.append(liB);

          const liD = document.createElement('li');
          liD.textContent = y; liD.dataset.value = String(y);
          deathList.append(liD);
        }
      })();

      const applyDeathConstraints = () => {
        const birthYear = selectedBirth;
        let hasEnabledNonEmpty = false;

        Array.from(deathList.children).forEach((li) => {
          const raw = li.dataset.value ?? '';
          const year = raw === '' ? NaN : Number(raw);
          const disabled = Number.isFinite(year) && birthYear ? year < birthYear : false;
          li.classList.toggle('disabled', disabled);
          if (!disabled && raw !== '') {
            hasEnabledNonEmpty = true;
          }
        });

        if (!deathWheel) return;

        if (birthYear && !hasEnabledNonEmpty) {
          deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
          selectedDeath = undefined;
        }

        deathWheel.refresh();
      };

      let deathWheel;

      const birthWheel = window.createYearWheel(birthList, {
        initialValue: selectedBirth ? String(selectedBirth) : '',
        onChange: (value) => {
          selectedBirth = value ? Number(value) : undefined;
          enforceChronology('birth');
          applyDeathConstraints();
          updateDisplay();
        }
      });

      deathWheel = window.createYearWheel(deathList, {
        initialValue: selectedDeath ? String(selectedDeath) : '',
        onChange: (value) => {
          selectedDeath = value ? Number(value) : undefined;
          enforceChronology('death');
          applyDeathConstraints();
          updateDisplay();
        }
      });

      enforceChronology('birth', 'auto');
      applyDeathConstraints();
      updateDisplay();

      display.addEventListener('click', () => {
        panel.hidden = !panel.hidden;
        if (!panel.hidden) {
          const hasBirth = !!birthWheel.getValue();
          const hasDeath = !!deathWheel.getValue();
          if (hasBirth) birthWheel.snap({ behavior: 'auto', silent: true });
          if (hasDeath) deathWheel.snap({ behavior: 'auto', silent: true });
        }
      });
      panel.addEventListener('click', e => e.stopPropagation());

      doneBtn.addEventListener('click', () => {
        const birthValue = birthWheel.getValue();
        const deathValue = deathWheel.getValue();

        selectedBirth = birthValue ? Number(birthValue) : undefined;
        selectedDeath = deathValue ? Number(deathValue) : undefined;

        enforceChronology('birth', 'auto');
        applyDeathConstraints();

        filterState.birthYear = selectedBirth || undefined;
        filterState.deathYear = selectedDeath || undefined;

        updateDisplay();
        panel.hidden = true;
        fetchAndRender();
      });

      clearBtn.addEventListener('click', e => {
        e.stopPropagation();

        // 1) Reset state
        selectedBirth = undefined;
        selectedDeath = undefined;
        filterState.birthYear = undefined;
        filterState.deathYear = undefined;

        // 2) Reset wheels to placeholders and re-snap (UI re-render)
        //    - updateOptions ensures internal initialValue = ''
        //    - clear({ keepActive: true }) selects the placeholder ("Від"/"До")
        birthWheel.updateOptions({ initialValue: '' });
        deathWheel.updateOptions({ initialValue: '' });
        birthWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
        deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });

        // 3) Re-apply constraints (death >= birth when present)
        applyDeathConstraints();

        // 4) Keep the panel open and snap both lists so placeholders are centered
        panel.hidden = false;
        birthWheel.snap({ behavior: 'auto', silent: true });
        deathWheel.snap({ behavior: 'auto', silent: true });
        panel.hidden = true;

        // 5) Reflect in header and re-fetch list
        updateDisplay();
        fetchAndRender();
      });

      const resetYearsToFilterState = () => {
        // повертаємо локальний вибір до зафіксованого у filterState
        selectedBirth = filterState.birthYear ? Number(filterState.birthYear) : undefined;
        selectedDeath = filterState.deathYear ? Number(filterState.deathYear) : undefined;

        const birthVal = filterState.birthYear ? String(filterState.birthYear) : '';
        const deathVal = filterState.deathYear ? String(filterState.deathYear) : '';

        // оновлюємо колеса до зафіксованих значень (або плейсхолдерів)
        birthWheel.setValue(birthVal, { silent: true, behavior: 'auto' });
        deathWheel.setValue(deathVal, { silent: true, behavior: 'auto' });

        applyDeathConstraints();
        updateDisplay();
      };

      const onDocClick = (e) => {
        if (!picker.contains(e.target)) {
          // закриття кліком назовні НЕ повинно застосовувати тимчасовий вибір
          resetYearsToFilterState();
          panel.hidden = true;
        }
      };

      const onDocKeyDown = (e) => {
        if (e.key === 'Escape') {
          // закриття по Esc також скидає незастосований вибір
          resetYearsToFilterState();
          panel.hidden = true;
        }
      };

      document.addEventListener('click', onDocClick);
      document.addEventListener('keydown', onDocKeyDown);

      window._yearsDocHandlers = [
        { type: 'click', handler: onDocClick },
        { type: 'keydown', handler: onDocKeyDown },
      ];

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
      clearBtn.style.display = (filterState.area || areaInput.value.trim()) ? 'flex' : 'none';

      // 5. Show dropdown on focus (do NOT auto-hide on blur)
      areaInput.addEventListener('focus', () => {
        if (areaInput.value.trim() && suggestions.children.length) {
          suggestions.style.display = 'block';
        }
      });

      // 6. Debounced fetch & render
      areaInput.addEventListener('input', () => {
        const q = areaInput.value.trim();

        // typing cancels previously selected Area filter (and its id),
        // until a suggestion is chosen again
        if (filterState.area && q !== filterState.area) {
          filterState.area = '';
          filterState.areaId = '';
          areaTab.textContent = 'Населений пункт';
          headerEl.textContent = defaultHeader;
          fetchAndRender();
        }

        // clear button visible whenever there is text or a committed filter
        clearBtn.style.display = (q || filterState.area) ? 'flex' : 'none';

        // when input is empty → hide suggestions and, if needed, clear filter
        if (!q) {
          suggestions.innerHTML = '';
          suggestions.style.display = 'none';
          if (filterState.area || filterState.areaId) {
            filterState.area = '';
            filterState.areaId = '';
            areaTab.textContent = 'Населений пункт';
            headerEl.textContent = defaultHeader;
            fetchAndRender();
          }
          return;
        }

        clearTimeout(suggestionTimerArea);
        suggestionTimerArea = setTimeout(async () => {
          // Fetch area suggestions based on current text only;
          // do NOT filter people until a suggestion is selected.
          try {
            const res = await fetch(`${LOC_API}?search=${encodeURIComponent(q)}`);
            const items = await res.json();

            // Очікуємо масив об'єктів { id, display }
            const list = Array.isArray(items) ? items : [];

            // c) Populate the <ul>
            if (!list.length) {
              suggestions.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
            } else {
              suggestions.innerHTML = list
                .map(item => {
                  const id = (item.id ?? '').toString();
                  const display = (item.display ?? '').toString();
                  const safeDisplay = display.replace(/"/g, '&quot;');
                  return `<li class="sugg-item-area" data-area-id="${id}" data-area="${safeDisplay}">${safeDisplay}</li>`;
                })
                .join('');
            }
            // suggestions should stay visible while there is text
            suggestions.style.display = 'block';
          } catch (e) {
            console.error('Area suggestions error', e);
          }
        }, 300);
      });

      // 7. Clicking a suggestion fills the input and blurs it
      suggestions.addEventListener('mousedown', ev => {
        const li = ev.target.closest('.sugg-item-area');
        if (!li) return;

        const areaNameFull = li.dataset.area || li.textContent.trim();
        const areaId = li.dataset.areaId || '';

        // встановити значення в поле area
        areaInput.value = areaNameFull;

        // оновлюємо state — тільки тут (лише вибрана підказка фільтрує людей)
        filterState.area = areaNameFull;
        filterState.areaId = areaId;

        // оновлюємо таб і хедер
        const shortName = areaNameFull.split(',')[0].trim();
        areaTab.textContent = shortName || 'Населений пункт';
        headerEl.textContent = shortName || defaultHeader;

        // показуємо clear для area
        clearBtn.style.display = 'flex';

        // сховати список і оновити результати
        suggestions.style.display = 'none';
        fetchAndRender();
      });

      // 8. Clear button resets area only
      clearBtn.addEventListener('click', () => {
        // 1) reset both filters in state
        filterState.area = '';
        filterState.areaId = '';
        filterState.cemetery = '';
        try {
          sessionStorage.removeItem('memoria_cemetery_filter');
          sessionStorage.removeItem('memoria_cemetery_area');
          sessionStorage.removeItem('memoria_cemetery_area_id');
        } catch (e) {
          console.warn('Cannot clear cemetery filter from sessionStorage', e);
        }

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

      // helper: завантажити всі кладовища для вибраної Area
      async function fetchCemeteriesForArea(areaId, areaLabel) {
        if (!areaId && !areaLabel) return [];
        try {
          const params = new URLSearchParams();
          if (areaId) {
            params.set('areaId', areaId);
          } else if (areaLabel) {
            params.set('area', areaLabel);
          }
          const res = await fetch(`${CEM_API}?${params.toString()}`);
          if (!res.ok) return [];
          const arr = await res.json();
          return Array.isArray(arr) ? arr : [];
        } catch {
          return [];
        }
      }

      // helper: показати список для вибраної Area, якщо інпут порожній
      async function showCemeteriesForSelectedAreaIfEmpty() {
        const area = (filterState.area || '').trim();
        const areaId = (filterState.areaId || '').trim();
        const val = cemInput.value.trim();
        if (!area || val) {
          if (suggestions.children.length) suggestions.style.display = 'block';
          return;
        }
        // легкий лоадер
        suggestions.innerHTML = '<li class="loading">Завантаження…</li>';
        suggestions.style.display = 'block';

        const items = await fetchCemeteriesForArea(areaId, area);
        suggestions.innerHTML = items.length
          ? items.map(c => {
              const name = (c.name || '').replace(/"/g, '&quot;');
              const areaLabel = (c.area || '').replace(/"/g, '&quot;');
              // always take areaId from backend if present
              const rawAreaId = c.areaId != null ? String(c.areaId) : '';
              const safeAreaId = rawAreaId && rawAreaId !== 'undefined'
                ? rawAreaId.replace(/"/g, '&quot;')
                : '';
              return `
      <li class="sugg-item" 
          data-name="${name}"
          data-area="${areaLabel}"
          data-area-id="${safeAreaId}">
        <span class="cem-name">${name}</span>
      </li>`;
            }).join('')
          : '<li class="no-results">Наразі нас ще тут немає</li>';
      }

      // Тригеримо при фокусі/кліку на інпут (коли порожній і Area вибрана)
      cemInput.addEventListener('focus', showCemeteriesForSelectedAreaIfEmpty);
      cemInput.addEventListener('click', showCemeteriesForSelectedAreaIfEmpty);

      // 4. Initial clear‐button visibility
      clearCem.style.display = (filterState.cemetery || cemInput.value.trim()) ? 'flex' : 'none';

      // 5. Show dropdown on focus (do NOT auto-hide on blur)
      cemInput.addEventListener('focus', () => {
        if (cemInput.value.trim() && suggestions.children.length) {
          suggestions.style.display = 'block';
        }
      });

      // 6. Debounced fetch & render
      cemInput.addEventListener('input', () => {
        const q = cemInput.value.trim();

        // typing cancels previously selected Cemetery filter until a suggestion is chosen again
        if (filterState.cemetery && q !== filterState.cemetery) {
          filterState.cemetery = '';
          cemTab.textContent = 'Кладовище';
          headerEl.textContent = filterState.area
            ? areaTab.textContent
            : defaultHeader;

          headerEl.classList.remove('clickable');
          headerEl.onclick = null;
          try {
            sessionStorage.removeItem('memoria_cemetery_filter');
            sessionStorage.removeItem('memoria_cemetery_area');
            sessionStorage.removeItem('memoria_cemetery_area_id');
          } catch (e) {
            console.warn('Cannot clear cemetery filter from sessionStorage', e);
          }
          fetchAndRender();
        }

        // clear button visible whenever there is text or a committed filter
        clearCem.style.display = (q || filterState.cemetery) ? 'flex' : 'none';

        // when input is empty → hide suggestions and, if needed, clear filter
        if (!q) {
          suggestions.innerHTML = '';
          suggestions.style.display = 'none';
          if (filterState.cemetery) {
            filterState.cemetery = '';
            cemTab.textContent = 'Кладовище';
            headerEl.textContent = filterState.area
              ? areaTab.textContent
              : defaultHeader;
            headerEl.classList.remove('clickable');
            headerEl.onclick = null;
            fetchAndRender();
          }
          return;
        }

        // debounce
        clearTimeout(suggestionTimerCem);
        suggestionTimerCem = setTimeout(async () => {
          // тягнемо підказки (з урахуванням areaId/area, якщо вибрана);
          // але НЕ фільтруємо людей, поки користувач не вибере підказку.
          const params = new URLSearchParams();
          if (filterState.areaId) {
            params.set('areaId', filterState.areaId);
          } else if (filterState.area) {
            params.set('area', filterState.area);
          }
          params.set('search', q);
          const url = `${CEM_API}?${params.toString()}`;

          try {
            const resp = await fetch(url);
            const items = await resp.json(); // очікуємо масив об’єктів: { name, area, areaId? }

            // c) рендеримо підказки
            if (!Array.isArray(items) || !items.length) {
              suggestions.innerHTML = `<li class="no-results">Наразі нас ще тут немає</li>`;
            } else {
              suggestions.innerHTML = items
                .map(item => {
                  const name = (item.name || '').replace(/"/g, '&quot;');
                  const areaLabel = (item.area || '').replace(/"/g, '&quot;');
                  // always take areaId from backend if present
                  const rawAreaId = item.areaId != null ? String(item.areaId) : '';
                  const safeAreaId = rawAreaId && rawAreaId !== 'undefined'
                    ? rawAreaId.replace(/"/g, '&quot;')
                    : '';
                  return `
            <li class="sugg-item"
                data-name="${name}"
                data-area="${areaLabel}"
                data-area-id="${safeAreaId}">
              <span class="cem-name">${name}</span>
            </li>
          `;
                })
                .join('');
            }

            // список має залишатися видимим, поки є текст
            suggestions.style.display = 'block';
          } catch (e) {
            console.error('Cemetery suggestions error', e);
            suggestions.innerHTML = `<li class="no-results">Наразі нас ще тут немає</li>`;
            suggestions.style.display = 'block';
          }
        }, 300);
      });

      // 7. Clicking a suggestion fills the input and blurs it
      suggestions.addEventListener('click', ev => {
        const li = ev.target.closest('.sugg-item');
        if (!li) return;

        const cemeteryName = li.dataset.name;
        const areaNameFull = li.dataset.area || '';
        const rawAreaIdFromCem = li.dataset.areaId || '';
        const areaIdFromCem = rawAreaIdFromCem && rawAreaIdFromCem !== 'undefined'
          ? rawAreaIdFromCem
          : '';

        // встановити значення в поле
        cemInput.value = cemeteryName;

        // оновити state
        filterState.cemetery = cemeteryName;
        try {
          sessionStorage.setItem('memoria_cemetery_filter', cemeteryName);
          // зберігаємо area, прив'язану до кладовища
          const areaToSave = areaNameFull || filterState.area || '';
          if (areaToSave) {
            sessionStorage.setItem('memoria_cemetery_area', areaToSave);
          } else {
            sessionStorage.removeItem('memoria_cemetery_area');
          }
          // зберігаємо areaId, якщо воно є
          if (areaIdFromCem) {
            sessionStorage.setItem('memoria_cemetery_area_id', areaIdFromCem);
          } else {
            sessionStorage.removeItem('memoria_cemetery_area_id');
          }
        } catch (e) {
          console.warn('Cannot persist cemetery filter to sessionStorage', e);
        }

        // якщо area ще не вибрано вручну → підставляємо з кладовища
        const hadArea = !!(filterState.area && filterState.area.trim());
        if (!hadArea && areaNameFull) {
          filterState.area = areaNameFull;
          if (areaIdFromCem) {
            filterState.areaId = areaIdFromCem;
          }

          const areaInputEl = document.getElementById('area');
          const clearAreaBtn = document.getElementById('clear-area');
          if (areaInputEl) areaInputEl.value = areaNameFull;
          if (clearAreaBtn) clearAreaBtn.style.display = 'flex';
          areaTab.textContent = areaNameFull.split(',')[0] || 'Населений пункт';
        }

        // оновити таб/заголовок
        cemTab.textContent = cemeteryName;
        headerEl.textContent = cemeteryName;
        clearCem.style.display = 'flex';
        headerEl.classList.add('clickable');
        headerEl.onclick = () => {
          window.location.href = `cemetery.html?name=${encodeURIComponent(cemeteryName)}`;
        };

        suggestions.style.display = 'none';
        fetchAndRender();
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

        headerEl.classList.remove('clickable');
        headerEl.onclick = null;

        try {
          sessionStorage.removeItem('memoria_cemetery_filter');
          sessionStorage.removeItem('memoria_cemetery_area');
          sessionStorage.removeItem('memoria_cemetery_area_id');
        } catch (e) {
          console.warn('Cannot clear cemetery filter from sessionStorage', e);
        }

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

  if (filterState.birthYear) params.set('birthYear', filterState.birthYear);
  if (filterState.deathYear) params.set('deathYear', filterState.deathYear);
  // Передаємо і areaId, і area (якщо є) —
  // бекенд об'єднає їх через $or, щоб не загубити людей без areaId.
  if (filterState.areaId) {
    params.set('areaId', filterState.areaId);
  }
  if (filterState.area) {
    params.set('area', filterState.area);
  }
  if (filterState.cemetery) params.set('cemetery', filterState.cemetery);

  try {
    const res = await fetch(`${API_URL}?${params.toString()}`);
    if (!res.ok) throw new Error(res.statusText);
    const { total, people } = await res.json();

    // Stable randomized order per person id so that
    // switching between filters without changing them
    // does not reshuffle the visible order.
    window._peopleRandomOrder = window._peopleRandomOrder || {};
    const orderMap = window._peopleRandomOrder;
    people.forEach(p => {
      const id = p.id;
      if (!id) return;
      if (orderMap[id] == null) {
        orderMap[id] = Math.random();
      }
    });

    let listToShow = [...people].sort((a, b) => {
      const oa = orderMap[a.id] ?? 0;
      const ob = orderMap[b.id] ?? 0;
      return oa - ob;
    });

    // apply notable-only filter if requested
    if (filterState.notableOnly) {
      listToShow = listToShow.filter(p => p.notable);
    }

    // person-name filtering: only prefix of first/middle/last name
    if (activeFilter === 'person') {
      const q = (filterState.search || '').trim().toLowerCase();
      if (q) {
        listToShow = listToShow.filter(p => {
          const name = (p.name || '').toLowerCase();
          if (!name) return false;
          const parts = name.split(/\s+/).filter(Boolean);
          return parts.some(part => part.startsWith(q));
        });
      }
    }

    // update the counter
    totalEl.textContent = listToShow.length;

    // render only the filtered list
    listEl.innerHTML = '';
    listToShow.forEach(p => {
      const li = document.createElement('li');
      li.innerHTML = `
      <img src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="${p.name}" />
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
