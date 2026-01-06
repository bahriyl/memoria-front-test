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
    birthYear: undefined,
    deathYear: undefined,
    area: '',
    areaId: '',
    cemetery: '',
    notableOnly: true
};

// cache the header and its default text
const headerEl = document.querySelector('main h2');
const defaultHeader = headerEl.textContent;

function matchesNamePrefix(name, query) {
    if (!query) return true;
    if (!name) return false;
    const q = query.trim().toLowerCase();
    if (!q) return true;
    const parts = name.toLowerCase().trim().split(/\s+/).filter(Boolean);
    return parts.some(part => part.startsWith(q));
}

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

            const notablePeople = people.filter(p => p.id && p.notable && p.avatarUrl);

            // Якщо таких менше ніж 1, нічого не показуємо
            if (!notablePeople.length) return;

            // 2) Перемішуємо й беремо перших 6
            const randomSix = notablePeople
                .sort(() => 0.5 - Math.random())
                .slice(0, 6);

            // 3) Рендеримо кожного
            randomSix.forEach(person => {
                if (!person.avatarUrl) return; // перестраховка

                const slide = document.createElement('div');
                slide.className = 'photo-slide';

                const img = document.createElement('img');
                img.src = person.portraitUrl || person.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png';
                img.alt = person.name || '';
                slide.append(img);

                // 4) На клік — редірект
                slide.addEventListener('click', () => {
                    window.location.href = `profile.html?personId=${person.id}&from=notable`;
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

    if (window._notableYearsDocHandlers) {
        for (const { type, handler } of window._notableYearsDocHandlers) {
            document.removeEventListener(type, handler);
        }
        window._notableYearsDocHandlers = null;
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

            const picker = controlsEl.querySelector('#lifeYearsPicker');
            const display = controlsEl.querySelector('#lifeYearsDisplay');
            const clearBtn = controlsEl.querySelector('#clearYears');
            const panel = controlsEl.querySelector('#yearsPanel');
            const birthUl = controlsEl.querySelector('#birthYearsList');
            const deathUl = controlsEl.querySelector('#deathYearsList');
            const doneBtn = controlsEl.querySelector('#yearsDoneBtn');

            let selectedBirth = filterState.birthYear ? Number(filterState.birthYear) : undefined;
            let selectedDeath = filterState.deathYear ? Number(filterState.deathYear) : undefined;
            let yearsPanelBackup = null;

            const formatYearsText = () => {
                if (selectedBirth && selectedDeath) {
                    return `${selectedBirth} – ${selectedDeath}`;
                }
                if (selectedBirth) {
                    return `${selectedBirth} –`;
                }
                if (selectedDeath) {
                    return `– ${selectedDeath}`;
                }
                return 'Роки життя';
            };

            const updateDisplay = () => {
                const text = formatYearsText();
                const hasAny = Boolean(selectedBirth || selectedDeath);
                display.textContent = text;
                display.classList.toggle('has-value', hasAny);
                picker.classList.toggle('has-value', hasAny);
                clearBtn.hidden = !hasAny;
            };

            function storeYearsState() {
                if (!birthWheel || !deathWheel) return;
                yearsPanelBackup = {
                    birthValue: birthWheel.getValue(),
                    deathValue: deathWheel.getValue(),
                    selectedBirth,
                    selectedDeath
                };
            }

            function restoreYearsState() {
                if (!yearsPanelBackup || !birthWheel || !deathWheel) return;
                selectedBirth = yearsPanelBackup.selectedBirth;
                selectedDeath = yearsPanelBackup.selectedDeath;
                birthWheel.setValue(yearsPanelBackup.birthValue || '', { silent: true, behavior: 'auto' });
                deathWheel.setValue(yearsPanelBackup.deathValue || '', { silent: true, behavior: 'auto' });
                updateDisplay();
                yearsPanelBackup = null;
            }

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
                if (birthUl.children.length) return;

                const birthPlaceholder = document.createElement('li');
                birthPlaceholder.textContent = 'Від';
                birthPlaceholder.dataset.value = '';
                birthUl.appendChild(birthPlaceholder);

                const deathPlaceholder = document.createElement('li');
                deathPlaceholder.textContent = 'До';
                deathPlaceholder.dataset.value = '';
                deathUl.appendChild(deathPlaceholder);

                const now = new Date().getFullYear();
                for (let y = now; y >= 1900; y--) {
                    const b = document.createElement('li'); b.textContent = y; b.dataset.value = String(y); birthUl.appendChild(b);
                    const d = document.createElement('li'); d.textContent = y; d.dataset.value = String(y); deathUl.appendChild(d);
                }
            })();

            const applyDeathConstraints = () => {
                const birthYear = selectedBirth;
                let hasEnabledNonEmpty = false;

                Array.from(deathUl.children).forEach((li) => {
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

            const birthWheel = window.createYearWheel(birthUl, {
                initialValue: selectedBirth ? String(selectedBirth) : '',
                onChange: (value) => {
                    selectedBirth = value ? Number(value) : undefined;
                    enforceChronology('birth');
                    applyDeathConstraints();
                    updateDisplay();
                }
            });

            deathWheel = window.createYearWheel(deathUl, {
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
                const willOpen = panel.hidden;
                panel.hidden = !panel.hidden;
                if (willOpen) {
                    storeYearsState();
                    const hasBirth = !!birthWheel.getValue();
                    const hasDeath = !!deathWheel.getValue();
                    if (hasBirth) birthWheel.snap({ behavior: 'auto', silent: true });
                    if (hasDeath) deathWheel.snap({ behavior: 'auto', silent: true });
                } else {
                    restoreYearsState();
                }
            });
            panel.addEventListener('click', e => e.stopPropagation());

            const onDocClick = (e) => {
                if (!panel || panel.hidden) return;
                if (picker.contains(e.target)) return;
                panel.hidden = true;
                restoreYearsState();
            };
            const onDocKeyDown = (e) => {
                if (!panel || panel.hidden || e.key !== 'Escape') return;
                panel.hidden = true;
                restoreYearsState();
            };

            document.addEventListener('click', onDocClick);
            document.addEventListener('keydown', onDocKeyDown);

            window._notableYearsDocHandlers = [
                { type: 'click', handler: onDocClick },
                { type: 'keydown', handler: onDocKeyDown },
            ];

            doneBtn.addEventListener('click', () => {
                const birthValue = birthWheel.getValue();
                const deathValue = deathWheel.getValue();

                selectedBirth = birthValue ? Number(birthValue) : undefined;
                selectedDeath = deathValue ? Number(deathValue) : undefined;

                enforceChronology('birth', 'auto');
                applyDeathConstraints();

                filterState.birthYear = selectedBirth ?? undefined;
                filterState.deathYear = selectedDeath ?? undefined;

                updateDisplay();
                panel.hidden = true;
                yearsPanelBackup = null;
                fetchAndRender();          // apply filter
            });

            clearBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                selectedBirth = undefined;
                selectedDeath = undefined;
                filterState.birthYear = undefined;
                filterState.deathYear = undefined;
                birthWheel.clear({ silent: true, keepActive: false });
                deathWheel.clear({ silent: true, keepActive: false });
                applyDeathConstraints();
                updateDisplay();
                yearsPanelBackup = null;
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
                filterState.areaId = '';
                clearTimeout(suggestionTimerArea);
                suggestionTimerArea = setTimeout(async () => {
                    // a) Refresh main list
                    fetchAndRender();

                    // b) Fetch area suggestions
                    try {
                        const res = await fetch(`${LOC_API}?search=${encodeURIComponent(areaInput.value)}`);
                        const items = await res.json();
                        const list = Array.isArray(items) ? items : [];

                        // c) рендеримо підказки з display
                        if (!list.length) {
                            suggestions.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                        } else {
                            suggestions.innerHTML = list
                                .map(item => {
                                    const display = (item.display ?? '').toString();
                                    const safe = display.replace(/"/g, '&quot;');
                                    return `<li data-area-id="${(item.id ?? '').toString()}">${safe}</li>`;
                                })
                                .join('');
                        }

                        // d) exact-match перевіряємо по trimmed
                        const normalized = areaInput.value.trim();
                        const matchObj = list.find(it => (it.display || '').trim() === normalized);
                        const match = matchObj ? (matchObj.display || '').trim() : null;
                        const isExact = Boolean(match);

                        // показувати дропдаун лише коли немає точного збігу
                        suggestions.style.display = isExact ? 'none' : 'block';

                        if (isExact) {
                            // 1) фіксуємо state
                            filterState.area = match;
                            filterState.areaId = (matchObj.id ?? '').toString() || '';

                            // 2) оновлюємо таб і заголовок короткою назвою до коми
                            const shortName = match.split(',')[0].trim();
                            areaTab.textContent = shortName;
                            headerEl.textContent = defaultHeader;

                            // 3) вмикаємо clear для area
                            clearBtn.style.display = 'flex';

                            // 4) перерендеримо список
                            fetchAndRender();
                        } else {
                            // коли користувач ще друкує — не збиваємо вибране,
                            // але якщо area порожня, тримаємо дефолтний таб і ховаємо clear
                            if (!filterState.area) {
                                areaTab.textContent = 'Населений пункт';
                                headerEl.textContent = defaultHeader;
                                clearBtn.style.display = 'none';
                            }
                        }
                    } catch (e) {
                        console.error('Area suggestions error', e);
                    }
                }, 300);
            });

            // 7. Clicking a suggestion fills the input and blurs it
            suggestions.addEventListener('click', e => {
                const li = e.target.closest('li');
                if (!li || li.classList.contains('no-results')) return;

                const value = li.textContent.trim();
                const rawAreaId = li.dataset.areaId || '';
                const areaId = rawAreaId && rawAreaId !== 'undefined' ? rawAreaId : '';

                // 1) фіксуємо поле та state
                areaInput.value = value;
                filterState.area = value;
                filterState.areaId = areaId;

                // 2) коротка назва в таб і заголовок
                const shortName = value.split(',')[0].trim();
                areaTab.textContent = shortName;
                headerEl.textContent = defaultHeader;

                // 3) показуємо clear для area
                clearBtn.style.display = 'flex';

                // 4) закриваємо дропдаун, блуримо інпут і перерендеримо список
                suggestions.style.display = 'none';
                areaInput.blur();
                fetchAndRender();
            });

            // 8. Clear button resets area only
            clearBtn.addEventListener('click', () => {
                // 1) reset both filters in state
                filterState.area = '';
                filterState.areaId = '';
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
            async function fetchCemeteriesForArea(area, areaId) {
                if (!area && !areaId) return [];
                try {
                    const params = new URLSearchParams();
                    if (areaId) {
                        params.set('areaId', areaId);
                    } else if (area) {
                        params.set('area', area);
                    }
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
                const areaId = (filterState.areaId || '').trim();
                const val = cemInput.value.trim();

                // If no area/areaId or user already typed something, just show the existing list (if any)
                if ((!area && !areaId) || val) {
                    if (suggestions.children.length) suggestions.style.display = 'block';
                    return;
                }

                suggestions.innerHTML = '<li class="loading">Завантаження…</li>';
                suggestions.style.display = 'block';

                const items = await fetchCemeteriesForArea(area, areaId);
                suggestions.innerHTML = items.length
                    ? items.map(c =>
                        `<li class="sugg-item" data-name="${(c.name || '').replace(/"/g, '&quot;')}" data-area="${(c.area || '').replace(/"/g, '&quot;')}"><span class="cem-name">${c.name}</span></li>`
                    ).join('')
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
                        const params = new URLSearchParams();
                        params.set('search', cemInput.value);
                        if (filterState.areaId) {
                            params.set('areaId', filterState.areaId);
                        } else if (filterState.area) {
                            params.set('area', filterState.area);
                        }
                        const res = await fetch(`${CEM_API}?${params.toString()}`);
                        const items = await res.json();

                        // c) Populate the <ul>
                        if (!items.length) {
                            suggestions.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                        } else {
                            suggestions.innerHTML = items.map(c => `<li data-area="${c.area}">${c.name}</li>`).join('');
                        }
                        // only show when no exact match
                        const match = items.find(c => c.name === cemInput.value);
                        const isExact = Boolean(match);
                        suggestions.style.display = isExact ? 'none' : 'block';

                        // d) If exact match, lock it in
                        if (isExact) {
                            const matchName = match.name;
                            const matchArea = match.area;

                            filterState.cemetery = matchName;
                            if (!filterState.area) {
                                filterState.area = matchArea;
                                // ще й оновити input area, якщо він є
                                const areaInputEl = document.getElementById('area');
                                const clearAreaBtn = document.getElementById('clear-area');
                                if (areaInputEl) areaInputEl.value = matchArea;
                                if (clearAreaBtn) clearAreaBtn.style.display = 'flex';
                            }

                            // update tabs & header
                            cemTab.textContent = matchName;
                            areaTab.textContent = (filterState.area ? filterState.area.split(',')[0].trim() : areaTab.textContent);
                            headerEl.textContent = defaultHeader;
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
                const li = e.target.closest('li');
                if (!li || li.classList.contains('no-results')) return;

                // 1) оновити інпут і стани
                const cemeteryName = li.dataset.name || li.textContent;
                const areaLabel = li.dataset.area || '';
                cemInput.value = cemeteryName;
                filterState.cemetery = cemeteryName;

                if (!filterState.area && areaLabel) {
                    filterState.area = areaLabel;
                    const areaInputEl = document.getElementById('area');
                    const clearAreaBtn = document.getElementById('clear-area');
                    if (areaInputEl) areaInputEl.value = areaLabel;
                    if (clearAreaBtn) clearAreaBtn.style.display = 'flex';
                }

                // 2) ОНОВИТИ ТАБИ та clear-кнопку негайно
                cemTab.textContent = cemeteryName;
                areaTab.textContent = (filterState.area ? filterState.area.split(',')[0].trim() : 'Населений пункт');
                headerEl.textContent = defaultHeader;
                clearCem.style.display = 'flex';

                // 3) закрити дропдаун, зняти фокус, перерендерити список
                suggestions.style.display = 'none';
                cemInput.blur();
                fetchAndRender();
            });

            // 8. Clear button resets cemetery only
            clearCem.addEventListener('click', () => {
                filterState.cemetery = '';
                cemInput.value = '';
                suggestions.innerHTML = '';
                suggestions.style.display = 'none';
                cemTab.textContent = 'Кладовище';
                headerEl.textContent = defaultHeader;
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
    if (filterState.areaId) params.set('areaId', filterState.areaId);
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

        const nameQuery = (filterState.search || '').trim();
        if (nameQuery) {
            listToShow = listToShow.filter(p => matchesNamePrefix(p.name, nameQuery));
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
                window.location.href = `profile.html?personId=${p.id}&from=notable`;
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
