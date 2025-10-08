const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';

// debounce helper
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const searchNameInput = document.getElementById('searchName');
    const searchNameError = document.getElementById('searchNameError');

    searchNameInput.addEventListener('blur', () => {
        const name = searchNameInput.value.trim();
        const parts = name.split(/\s+/).filter(Boolean);

        if (!name) {
            searchNameError.textContent = "Введіть ПІБ";
            searchNameError.hidden = false;
        } else if (name.includes('.') || parts.some(p => p.length <= 1)) {
            searchNameError.textContent = "Введіть повне ім'я та по-батькові";
            searchNameError.hidden = false;
        } else {
            searchNameError.hidden = true;
        }
    });

    // Filters & results
    const nameInput = document.getElementById('searchName');
    const clearBirthBtn = document.getElementById('clearBirth');
    const clearDeathBtn = document.getElementById('clearDeath');
    const areaInput = document.getElementById('areaFilter');
    const clearAreaBtn = document.getElementById('clearArea');
    const areaSuggest = document.getElementById('areaSuggestions');
    const cemInput = document.getElementById('cemeteryFilter');
    const clearCemBtn = document.getElementById('clearCemetery');
    const cemSuggest = document.getElementById('cemSuggestions');

    const foundLabel = document.getElementById('foundLabel');
    const foundList = document.getElementById('foundList');
    const noResults = document.getElementById('noResults');
    const addPersonBtn = document.getElementById('addPersonBtn');
    const foundContainer = document.getElementById('foundContainer');

    const selectedContainer = document.getElementById('selectedContainer');
    const selectedList = document.getElementById('selectedList');
    const submitBtn = document.getElementById('submitBtn');
    const submitError = document.getElementById('submitError');

    let selectedPerson = null;

    // ==== Unified lifeYearsPicker (injects a single picker, keeps selects in sync) ====
    // Existing references:
    const birthSelect = document.getElementById('birthYearFilter');
    const deathSelect = document.getElementById('deathYearFilter');

    // 0) Hide the two select pills (we'll keep their values in sync for fetchPeople)
    if (birthSelect) birthSelect.closest('.year-pill').style.display = 'none';
    if (deathSelect) deathSelect.closest('.year-pill').style.display = 'none';

    // 1) Insert the picker at the beginning of the .year-group
    const yearsGroup = document.querySelector('.year-group');
    const pickerWrap = document.createElement('div');
    pickerWrap.className = 'year-pill';
    pickerWrap.id = 'lifeYearsPicker';
    pickerWrap.innerHTML = `
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
`;
    yearsGroup.prepend(pickerWrap);

    // 2) Elements
    const picker = document.getElementById('lifeYearsPicker');
    const display = document.getElementById('lifeYearsDisplay');
    const clearBtn = document.getElementById('clearYears');
    const panel = document.getElementById('yearsPanel');
    const birthUl = document.getElementById('birthYearsList');
    const deathUl = document.getElementById('deathYearsList');
    const doneBtn = document.getElementById('yearsDoneBtn');

    // 3) Selections (initialize from selects if they already have values)
    let selectedBirth = birthSelect && birthSelect.value ? Number(birthSelect.value) : undefined;
    let selectedDeath = deathSelect && deathSelect.value ? Number(deathSelect.value) : undefined;

    const updateDisplay = () => {
        const hasAny = !!(selectedBirth || selectedDeath);
        const text = hasAny
            ? `${selectedBirth ?? ''}${(selectedBirth && selectedDeath) ? ' – ' : ''}${selectedDeath ?? ''}`
            : 'Роки життя';
        display.textContent = text;
        display.classList.toggle('has-value', hasAny);
        picker.classList.toggle('has-value', hasAny);
        clearBtn.hidden = !hasAny;

        if (birthSelect) birthSelect.value = selectedBirth ?? '';
        if (deathSelect) deathSelect.value = selectedDeath ?? '';
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

    // 4) Populate years (1900..now)
    (function populateYears() {
        if (birthUl.children.length) return;

        const bPlaceholder = document.createElement('li');
        bPlaceholder.textContent = 'Від';
        bPlaceholder.dataset.value = '';
        birthUl.appendChild(bPlaceholder);

        const dPlaceholder = document.createElement('li');
        dPlaceholder.textContent = 'До';
        dPlaceholder.dataset.value = '';
        deathUl.appendChild(dPlaceholder);

        const now = new Date().getFullYear();
        for (let y = now; y >= 1900; y--) {
            const liB = document.createElement('li');
            liB.textContent = y; liB.dataset.value = String(y);
            birthUl.appendChild(liB);

            const liD = document.createElement('li');
            liD.textContent = y; liD.dataset.value = String(y);
            deathUl.appendChild(liD);
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

    // 6) Interactions
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
    document.addEventListener('click', e => { if (!picker.contains(e.target)) panel.hidden = true; });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') panel.hidden = true; });

    doneBtn.addEventListener('click', () => {
        const birthValue = birthWheel.getValue();
        const deathValue = deathWheel.getValue();

        selectedBirth = birthValue ? Number(birthValue) : undefined;
        selectedDeath = deathValue ? Number(deathValue) : undefined;

        enforceChronology('birth', 'auto');
        applyDeathConstraints();

        updateDisplay();
        panel.hidden = true;
        triggerFetch();
    });

    clearBtn.addEventListener('click', (e) => {
        e.stopPropagation();
        selectedBirth = undefined;
        selectedDeath = undefined;
        birthWheel.clear({ silent: true, keepActive: false });
        deathWheel.clear({ silent: true, keepActive: false });
        applyDeathConstraints();
        updateDisplay();
        triggerFetch();
    });

    // Simple typeahead
    function setupSuggestions(input, clearBtn, listEl, endpoint) {
        clearBtn.style.display = 'none';
        const doFetch = debounce(async () => {
            const q = input.value.trim();
            if (!q) {
                listEl.style.display = 'none';
                return;
            }
            try {
                const res = await fetch(`${API_URL}/api/${endpoint}?search=${encodeURIComponent(q)}`);
                const arr = await res.json();
                listEl.innerHTML = arr.length
                    ? arr.map(x => `<li>${x}</li>`).join('')
                    : `<li class="no-results">Збігів не знайдено</li>`;
                listEl.style.display = 'block';
            } catch (e) {
                console.error(e);
            }
        }, 300);

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            doFetch();
            triggerFetch();
        });
        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            listEl.style.display = 'none';
            triggerFetch();
        });
        listEl.addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                input.value = e.target.textContent;
                clearBtn.style.display = 'flex';
                listEl.style.display = 'none';
                triggerFetch();
            }
        });
    }
    setupSuggestions(areaInput, clearAreaBtn, areaSuggest, 'locations');
    setupSuggestions(cemInput, clearCemBtn, cemSuggest, 'cemeteries');

    // === Show all cemeteries for selected Area when cemetery input is empty ===

    // Try direct cemeteries endpoint with ?area=; if unavailable, fall back via /api/people
    async function fetchCemeteriesForArea(area) {
        if (!area) return [];
        // Attempt A: /api/cemeteries?area=
        try {
            const res = await fetch(`${API_URL}/api/cemeteries?area=${encodeURIComponent(area)}`);
            if (res.ok) {
                const arr = await res.json();
                if (Array.isArray(arr) && arr.length) return arr;
            }
        } catch { }

        // Attempt B (fallback): /api/people?area= → unique cemeteries
        try {
            const res2 = await fetch(`${API_URL}/api/people?area=${encodeURIComponent(area)}`);
            if (!res2.ok) return [];
            const data = await res2.json();
            const set = new Set(
                (Array.isArray(data?.people) ? data.people : [])
                    .map(p => p.cemetery)
                    .filter(Boolean)
            );
            return Array.from(set).sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }));
        } catch {
            return [];
        }
    }

    async function showCemeteriesForSelectedAreaIfEmpty() {
        const area = areaInput.value.trim();
        const val = cemInput.value.trim();

        // If no area or user already typed something — just show current list (if any)
        if (!area || val) {
            if (cemSuggest.children.length) cemSuggest.style.display = 'block';
            return;
        }

        cemSuggest.innerHTML = '<li class="loading">Завантаження…</li>';
        cemSuggest.style.display = 'block';

        const items = await fetchCemeteriesForArea(area);
        cemSuggest.innerHTML = items.length
            ? items.map(name => `<li>${name}</li>`).join('')
            : '<li class="no-results">Нічого не знайдено</li>';
    }

    // Trigger on focus/click when cemetery input is empty
    cemInput.addEventListener('focus', showCemeteriesForSelectedAreaIfEmpty);
    cemInput.addEventListener('click', showCemeteriesForSelectedAreaIfEmpty);

    // Fetch people
    async function fetchPeople() {
        const hasAny =
            nameInput.value.trim() ||
            birthSelect.value ||
            deathSelect.value ||
            areaInput.value.trim() ||
            cemInput.value.trim();
        if (!hasAny) {
            foundLabel.textContent = '';
            foundList.innerHTML = '';
            noResults.hidden = true;
            foundLabel.hidden = false;
            return;
        }
        const params = new URLSearchParams();
        if (nameInput.value.trim()) params.set('search', nameInput.value.trim());
        if (birthSelect.value) params.set('birthYear', birthSelect.value);
        if (deathSelect.value) params.set('deathYear', deathSelect.value);
        if (areaInput.value.trim()) params.set('area', areaInput.value.trim());
        if (cemInput.value.trim()) params.set('cemetery', cemInput.value.trim());

        const res = await fetch(`${API_URL}/api/people?${params}`);
        const data = await res.json();
        foundLabel.textContent = `Знайдено (${data.total}):`;

        if (data.people.length) {
            noResults.hidden = true;
            foundLabel.hidden = false;
            foundList.innerHTML = data.people.map(p => `
        <li data-id="${p.id}">
          <img src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
          <div class="info">
            <div class="name">${p.name}</div>
            <div class="years">${p.birthYear} - ${p.deathYear}</div>
          </div>
          <button type="button" aria-label="Select"><img src="/img/plus-icon.png" alt="Додати" class="plus-icon" width="24" height="24"></button>
        </li>
      `).join('');
            foundList.querySelectorAll('li button').forEach(btn => {
                btn.addEventListener('click', () => {
                    const li = btn.closest('li');
                    const id = li.dataset.id;
                    const person = data.people.find(x => x.id === id);
                    selectPerson(person);
                });
            });
            foundList.querySelectorAll('li[data-id]').forEach(li => li.tabIndex = 0);
        } else {
            foundList.innerHTML = '';
            foundLabel.hidden = true;
            noResults.hidden = false;
        }
    }
    const triggerFetch = debounce(fetchPeople, 300);
    [nameInput, birthSelect, deathSelect].forEach(el => {
        const ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, triggerFetch);
    });

    // Navigate to person profile when clicking on a person (except the + button)
    if (!foundList._profileNavBound) {
        foundList.addEventListener('click', (e) => {
            if (e.target.closest('button')) return; // ignore "+" button
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            const id = li.dataset.id;
            if (id) {
                window.location.href = `profile.html?personId=${encodeURIComponent(id)}&from=add_notable_person`;
            }
        });

        // Keyboard accessibility: Enter/Space to open profile
        foundList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('button')) return;
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            e.preventDefault();
            const id = li.dataset.id;
            if (id) {
                window.location.href = `profile.html?personId=${encodeURIComponent(id)}&from=add_notable_person`;
            }
        });

        foundList._profileNavBound = true;
    }

    // Select / Deselect
    function selectPerson(p) {
        selectedPerson = p;
        selectedList.innerHTML = `
      <li data-id="${p.id}">
        <img src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
        <div class="info">
          <div class="name">${p.name}</div>
          <div class="years">${p.birthYear} - ${p.deathYear}</div>
        </div>
        <button type="button" aria-label="Deselect"><img src="/img/minus-icon.png" alt="Видалити" class="minus-icon" width="24" height="24"></button>
      </li>`;
        selectedList.querySelector('button').addEventListener('click', () => {
            selectedPerson = null;
            selectedContainer.hidden = true;
            foundContainer.hidden = false;
            submitError.hidden = true;
        });
        foundContainer.hidden = true;
        selectedContainer.hidden = false;
        submitError.hidden = true;
    }

    // “Додати особу” fallback
    addPersonBtn.addEventListener('click', () => {
        window.location.href = '/add_person.html';
    });

    // Final submit
    const form = document.getElementById('personForm');
    const overlayEl = document.getElementById('modal-overlay');
    const modalEl = document.getElementById('success-modal');
    const closeBtn = document.getElementById('modal-close');
    const okBtn = document.getElementById('modal-ok');

    function showModal() {
        overlayEl.hidden = false;
        modalEl.style.display = 'block';
    }
    function hideModal() {
        overlayEl.hidden = true;
        modalEl.style.display = 'none';
        window.location.href = "notable.html";
    }

    closeBtn.addEventListener('click', hideModal);
    okBtn.addEventListener('click', hideModal);

    submitBtn.addEventListener('click', async e => {
        e.preventDefault();

        // ❗ Перевірка: чи вибрано особу
        if (!selectedPerson) {
            submitError.textContent = 'Будь ласка, виберіть особу';
            submitError.hidden = false;
            return;
        }

        // Очистити попередні помилки
        document.querySelectorAll('.error-message').forEach(el => el.hidden = true);

        let hasError = false;

        let occupation = '';
        let link = '';
        let bio = '';

        occupation = document.getElementById('activityArea').value;
        link = document.getElementById('internetLinks').value.trim();
        bio = document.getElementById('achievements').value.trim();

        const occupationError = document.getElementById('occupationError');
        const linkError = document.getElementById('linkError');
        const bioError = document.getElementById('bioError');

        if (!occupation) {
            occupationError.textContent = 'Оберіть сферу діяльності';
            occupationError.hidden = false;
            hasError = true;
        }

        if (!link) {
            linkError.textContent = 'Введіть посилання';
            linkError.hidden = false;
            hasError = true;
        }

        if (!bio) {
            bioError.textContent = 'Введіть опис';
            bioError.hidden = false;
            hasError = true;
        }

        if (hasError) return; // ❌ не надсилати форму


        // gather values
        const name = document.getElementById('searchName').value.trim();
        const birthYear = document.getElementById('birthYearFilter').value;
        const deathYear = document.getElementById('deathYearFilter').value;
        const area = document.getElementById('areaFilter').value.trim();
        const cemetery = document.getElementById('cemeteryFilter').value.trim();

        try {
            const res = await fetch(`${API_URL}/api/people/add_moderation`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name,
                    birthYear,
                    deathYear,
                    area,
                    cemetery,
                    occupation,
                    link,
                    bio
                })
            });
            const json = await res.json();
            if (json.success) {
                showModal();
                form.reset();
                // hide notable-fields if needed
                document.getElementById('notable-fields').style.display = 'none';
            } else {
                alert('Щось пішло не так. Спробуйте ще раз.');
            }
        } catch (err) {
            console.error(err);
            alert('Помилка мережі. Перевірте підключення.');
        }
    });

    // somewhere in your DOMContentLoaded, after you grab everything else:
    const activitySelect = document.getElementById('activityArea');
    const clearActivityBtn = document.getElementById('clear-activity');

    // hide it by default
    clearActivityBtn.style.display = 'none';

    // when the user picks an option — show the “×”
    activitySelect.addEventListener('change', () => {
        clearActivityBtn.style.display = 'flex';  // or 'block', matches your layout
    });

    // when they click the “×” — clear it out & hide the button again
    clearActivityBtn.addEventListener('click', () => {
        activitySelect.value = '';
        clearActivityBtn.style.display = 'none';
    });

    // ——— ActivityArea: custom suggestions-style dropdown ———
    (function initActivityAreaDropdown() {
        const select = document.getElementById('activityArea');
        const clearBtn = document.getElementById('clear-activity');
        if (!select || !clearBtn) return;

        const pill = select.closest('.year-pill') || select.parentElement;
        const display = document.createElement('input');
        display.classList.add('input-with-chevron');
        display.type = 'text';
        display.id = 'activityDisplay';
        display.placeholder = select.options[0]?.text || 'Сфера діяльності';
        display.readOnly = true;
        display.setAttribute('autocomplete', 'off');
        display.style.width = '100%';
        display.style.height = '49px';
        display.style.padding = '12px 12px 12px 22px';
        display.style.border = 'none';
        display.style.borderRadius = '12px';
        display.style.fontFamily = 'Montserrat, sans-serif';
        display.style.fontSize = '16px';
        display.style.fontWeight = '460';
        display.style.color = '#222';
        display.style.cursor = 'pointer';

        pill.insertBefore(display, select);
        select.style.display = 'none';

        const list = document.createElement('ul');
        list.className = 'suggestions-list';
        list.id = 'activity-suggestions';
        pill.appendChild(list);

        function populate() {
            const items = [];
            for (let i = 0; i < select.options.length; i++) {
                const opt = select.options[i];
                if (!opt.value) continue;
                items.push(`<li data-value="${opt.value}">${opt.text}</li>`);
            }
            list.innerHTML = items.join('') || `<li class="no-results">Немає опцій</li>`;
        }

        function openList() {
            populate();
            list.style.display = 'block';
            display.classList.add('open');
        }
        function closeList() {
            list.style.display = 'none';
            display.classList.remove('open');
        }

        display.addEventListener('click', (e) => {
            e.stopPropagation();
            (list.style.display === 'block') ? closeList() : openList();
        });

        list.addEventListener('click', (e) => {
            const li = e.target.closest('li');
            if (!li || li.classList.contains('no-results')) return;

            const val = li.getAttribute('data-value');
            const txt = li.textContent;

            select.value = val;
            display.value = txt;
            select.dispatchEvent(new Event('change', { bubbles: true }));

            clearBtn.style.display = 'flex';
            closeList();
        });

        document.addEventListener('click', (e) => {
            if (!pill.contains(e.target)) closeList();
        });
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') closeList();
        });

        select.addEventListener('change', () => {
            const opt = select.options[select.selectedIndex];
            if (opt && opt.value) {
                display.value = opt.text;
                clearBtn.style.display = 'flex';
                display.classList.add('has-value');
            } else {
                display.value = '';
                display.placeholder = select.options[0]?.text || 'Сфера діяльності';
                clearBtn.style.display = 'none';
                display.classList.remove('has-value');
            }
        });

        clearBtn.addEventListener('click', () => {
            select.selectedIndex = 0;
            select.dispatchEvent(new Event('change', { bubbles: true }));
        });
    })();
});
