const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app'

// simple debounce helper
function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.addEventListener('click', () => {
            try {
                sessionStorage.removeItem('premiumQR.filters.v1');
            } catch (e) {
                console.warn('Unable to clear filters:', e);
            }
            window.location.href = 'premium_qr.html';
        });
    }

    const searchNameInput = document.getElementById('searchName');
    const searchNameClear = document.getElementById('searchNameClear');
    const searchNameError = document.getElementById('searchNameError');
    const updateSearchNameClear = () => {
        if (!searchNameClear || !searchNameInput) return;
        searchNameClear.style.display = searchNameInput.value.trim() ? 'inline-flex' : 'none';
    };
    searchNameInput?.addEventListener('input', updateSearchNameClear);
    searchNameClear?.addEventListener('click', (e) => {
        e.preventDefault();
        if (!searchNameInput) return;
        searchNameInput.value = '';
        updateSearchNameClear();
        searchNameInput.focus();
        triggerFetch();
    });
    updateSearchNameClear();

    /*searchNameInput.addEventListener('blur', () => {
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
    });*/

    // ───── Custom Years Picker Setup ─────
    const picker = document.getElementById('lifeYearsPicker');
    const panel = document.getElementById('yearsPanel');
    const birthList = document.getElementById('birthYearsList');
    const deathList = document.getElementById('deathYearsList');
    const display = document.getElementById('lifeYearsDisplay');
    const doneBtn = document.getElementById('yearsDoneBtn');
    const birthInput = document.getElementById('birthYear');
    const deathInput = document.getElementById('deathYear');
    const clearYearsBtn = document.getElementById('clearYears');
    let selectedBirth, selectedDeath;
    function matchesNamePrefix(name, query) {
        if (!query) return true;
        if (!name) return false;
        const q = query.trim().toLowerCase();
        if (!q) return true;
        const parts = name.toLowerCase().trim().split(/\s+/).filter(Boolean);
        return parts.some(part => part.startsWith(q));
    }
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
        clearYearsBtn.hidden = !hasAny;
        if (birthInput) birthInput.value = selectedBirth ?? '';
        if (deathInput) deathInput.value = selectedDeath ?? '';
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
        const birthYear = selectedBirth;
        const deathYear = selectedDeath;
        if (!birthYear || !deathYear) return false;
        if (birthYear === deathYear) return false;

        if (birthYear > deathYear) {
            if (source === 'death') {
                if (birthWheel) birthWheel.setValue(String(deathYear), { silent: true, behavior });
                selectedBirth = deathYear;
            } else {
                if (deathWheel) deathWheel.setValue(String(birthYear), { silent: true, behavior });
                selectedDeath = birthYear;
            }
            return true;
        }
        return false;
    };

    // handlers are attached later in the filter section

    // toggle panel only when clicking on the pill display
    if (display) {
        display.addEventListener('click', () => {
            if (!panel) return;
            const willOpen = panel.hidden;
            panel.hidden = !panel.hidden;
            if (willOpen) {
                storeYearsState();
                const hasBirth = !!birthWheel.getValue();
                const hasDeath = !!deathWheel.getValue();
                if (!hasBirth) birthWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
                if (!hasDeath) deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
                applyDeathConstraints();
                birthWheel.snap({ behavior: 'auto', silent: true });
                deathWheel.snap({ behavior: 'auto', silent: true });
            } else {
                restoreYearsState();
            }
        });
    }

    if (panel) {
        panel.addEventListener('click', e => {
            e.stopPropagation();
        });
    }

    const closePanelFromDoc = (e) => {
        if (!panel || panel.hidden) return;
        if (picker.contains(e.target)) return;
        panel.hidden = true;
        restoreYearsState();
    };
    document.addEventListener('click', closePanelFromDoc);
    const closePanelFromEsc = (e) => {
        if (!panel || panel.hidden || e.key !== 'Escape') return;
        panel.hidden = true;
        restoreYearsState();
    };
    document.addEventListener('keydown', closePanelFromEsc);

    //
    // 1) DELIVERY DETAILS MODAL SETUP
    //
    const deliveryModal = document.getElementById('deliveryModal');
    const modalCloseBtn = document.getElementById('deliveryModalClose');
    const modalSubmitBtn = document.getElementById('deliveryModalSubmit');
    const mainSubmitBtn = document.getElementById('submitBtn');

    if (mainSubmitBtn) {
        mainSubmitBtn.style.display = 'none'; // приховано доти, доки не обрано особу
    }

    const delEmailInput = document.getElementById('delEmail');
    const delEmailError = document.getElementById('delEmailError');

    // --- delName validation (same as on add_person page) ---
    const delNameInput = document.getElementById('delName');
    const delNameError = document.getElementById('delNameError');
    const delPhoneInput = document.getElementById('delPhone');

    const formatUaPhone = (value) => {
        let digits = String(value || '').replace(/\D/g, '');
        if (digits.startsWith('380')) digits = digits.slice(3);
        if (digits.startsWith('0')) digits = digits.slice(1);
        digits = digits.slice(0, 9);

        if (!digits.length) return '';

        const part1 = digits.slice(0, 2);
        const part2 = digits.slice(2, 5);
        const part3 = digits.slice(5, 9);
        let formatted = `+380(${part1}`;
        if (part1.length === 2) formatted += ')';
        if (part2.length) formatted += `-${part2}`;
        if (part3.length) formatted += `-${part3}`;
        return formatted;
    };

    if (delPhoneInput) {
        const applyPhoneMask = () => {
            delPhoneInput.value = formatUaPhone(delPhoneInput.value);
        };
        delPhoneInput.addEventListener('input', applyPhoneMask);
        delPhoneInput.addEventListener('blur', applyPhoneMask);
    }

    if (delNameInput && delNameError) {
        delNameInput.addEventListener('blur', () => {
            const name = delNameInput.value.trim();
            const parts = name.split(/\s+/).filter(Boolean);

            if (!name) {
                delNameError.textContent = "Введіть ПІБ";
                delNameError.hidden = false;
                delNameInput.classList.add('input-error');
            } else if (name.includes('.') || parts.length < 3 || parts.some(p => p.length <= 1)) {
                delNameError.textContent = "Введіть повне ім'я та по-батькові";
                delNameError.hidden = false;
                delNameInput.classList.add('input-error');
            } else {
                delNameError.hidden = true;
                delNameInput.classList.remove('input-error');
            }
        });

        delNameInput.addEventListener('input', () => {
            delNameError.hidden = true;
            delNameInput.classList.remove('input-error');
        });
    }

    function isValidEmail(s) {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(s);
    }

    // очищення помилки на ввід
    delEmailInput?.addEventListener('input', () => {
        delEmailInput.classList.remove('input-error');
        if (delEmailError) { delEmailError.hidden = true; delEmailError.textContent = ''; }
    });

    // ensure modal is hidden on load
    deliveryModal.hidden = true;

    // close modal on × click
    modalCloseBtn.addEventListener('click', () => {
        deliveryModal.hidden = true;
    });
    // close modal when clicking outside the content
    deliveryModal.addEventListener('click', e => {
        if (e.target === deliveryModal) deliveryModal.hidden = true;
    });

    //
    // 2) FILTER ELEMENTS & RESULT BLOCKS
    //
    const nameInput = document.getElementById('searchName');
    const clearBirthBtn = document.getElementById('clearBirth');
    const clearDeathBtn = document.getElementById('clearDeath');
    const cemInput = document.getElementById('cemeteryFilter');
    const clearCemBtn = document.getElementById('clearCemetery');
    const cemSuggest = document.getElementById('cemSuggestions');
    const areaInput = document.getElementById('areaFilter');
    const clearAreaBtn = document.getElementById('clearArea');
    const areaSuggest = document.getElementById('areaSuggestions');

    const foundLabel = document.getElementById('foundLabel');
    const foundList = document.getElementById('foundList');
    const noResults = document.getElementById('noResults');
    const addPersonBtn = document.getElementById('addPersonBtn');
    const foundContainer = document.getElementById('foundContainer');
    const selectedContainer = document.getElementById('selectedContainer');
    const selectedList = document.getElementById('selectedList');

    const selectedPersons = [];

    // зберігати на будь-які зміни
    [nameInput, areaInput, cemInput].forEach(el => {
        el?.addEventListener('input', saveFilters);
        el?.addEventListener('change', saveFilters);
    });
    clearAreaBtn?.addEventListener('click', saveFilters);
    clearCemBtn?.addEventListener('click', saveFilters);

    // === Keep filters between navigations ===
    const FILTERS_KEY = 'premiumQR.filters.v1';

    function saveFilters() {
        const payload = {
            name: (nameInput?.value || '').trim(),
            birth: birthInput?.value || (selectedBirth ?? ''),
            death: deathInput?.value || (selectedDeath ?? ''),
            area: (areaInput?.value || '').trim(),
            cemetery: (cemInput?.value || '').trim(),
        };
        try { sessionStorage.setItem(FILTERS_KEY, JSON.stringify(payload)); } catch { }
    }

    function restoreFilters() {
        try {
            const raw = sessionStorage.getItem(FILTERS_KEY);
            if (!raw) return;
            const f = JSON.parse(raw);

            if (f.name) nameInput.value = f.name;

            if (f.area) {
                areaInput.value = f.area;
                clearAreaBtn.style.display = 'flex';
            }

            if (f.cemetery) {
                cemInput.value = f.cemetery;
                clearCemBtn.style.display = 'flex';
            }

            birthInput.value = f.birth || '';
            deathInput.value = f.death || '';
            selectedBirth = f.birth ? Number(f.birth) : undefined;
            selectedDeath = f.death ? Number(f.death) : undefined;

            if (birthWheel) birthWheel.setValue(f.birth || '', { silent: true, behavior: 'auto' });
            if (deathWheel) deathWheel.setValue(f.death || '', { silent: true, behavior: 'auto' });
            enforceChronology('birth', 'auto');
            applyDeathConstraints();
            updateDisplay();
        } catch { }
    }

    /*birthInput.addEventListener('change', () => {
        clearBirthBtn.style.display = birthInput.value ? 'flex' : 'none';
        triggerFetch();
    });

    clearBirthBtn.addEventListener('click', () => {
        birthInput.value = '';
        clearBirthBtn.style.display = 'none';
        triggerFetch();
    });

    deathInput.addEventListener('change', () => {
        clearDeathBtn.style.display = deathInput.value ? 'flex' : 'none';
        triggerFetch();
    });

    clearDeathBtn.addEventListener('click', () => {
        deathInput.value = '';
        clearDeathBtn.style.display = 'none';
        triggerFetch();
    });*/

    //
    // 3) POPULATE YEARS + DRUM WHEEL SETUP
    //
    (function populateYears() {
        if (!birthList || !deathList || birthList.children.length) return;

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
            liB.textContent = y;
            liB.dataset.value = String(y);
            birthList.append(liB);

            const liD = document.createElement('li');
            liD.textContent = y;
            liD.dataset.value = String(y);
            deathList.append(liD);
        }
    })();

    const applyDeathConstraints = () => {
        if (!deathList) return;
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
            saveFilters();
        }
    });

    deathWheel = window.createYearWheel(deathList, {
        initialValue: selectedDeath ? String(selectedDeath) : '',
        onChange: (value) => {
            selectedDeath = value ? Number(value) : undefined;
            enforceChronology('death');
            applyDeathConstraints();
            updateDisplay();
            saveFilters();
        }
    });

    enforceChronology('birth', 'auto');
    applyDeathConstraints();
    updateDisplay();

    //
    // 4) TYPEAHEAD SETUP
    //
    function setupSuggestions(input, clearBtn, listEl, endpoint, opts = {}) {
        const { onSelect } = opts;
        clearBtn.style.display = 'none';

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            triggerFetch();
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            listEl.innerHTML = '';
            listEl.style.display = 'none';
            triggerFetch();
        });

        const debouncedFetch = debounce(async () => {
            const q = input.value.trim();
            if (!q) {
                listEl.innerHTML = '';
                listEl.style.display = 'none';
                return;
            }
            try {
                const res = await fetch(`${API_URL}/api/${endpoint}?search=${encodeURIComponent(q)}`);
                const arr = await res.json();
                const items = Array.isArray(arr) ? arr : [];

                if (!items.length) {
                    listEl.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                } else {
                    if (endpoint === 'locations') {
                        listEl.innerHTML = items
                            .map(item => {
                                const display = (item.display ?? '').toString();
                                const safe = display.replace(/"/g, '&quot;');
                                return `<li data-area-id="${(item.id ?? '').toString()}">${safe}</li>`;
                            })
                            .join('');
                    } else {
                        listEl.innerHTML = items
                            .map(item => {
                                if (typeof item === 'string') return `<li>${item}</li>`;
                                const name = (item.name ?? item.display ?? '').toString();
                                return name ? `<li>${name}</li>` : '';
                            })
                            .filter(Boolean)
                            .join('') || `<li class="no-results">Збігів не знайдено</li>`;
                    }
                }

                listEl.style.display = 'block';
            } catch (e) {
                console.error(e);
            }
        }, 300);

        input.addEventListener('input', debouncedFetch);

        listEl.addEventListener('click', async e => {
            if (e.target.tagName === 'LI') {
                input.value = e.target.textContent;
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
                if (onSelect) await onSelect(input.value);
                triggerFetch();
            }
        });
    }

    // Resolve Area by Cemetery name using /api/people
    async function fetchAreaForCemetery(cemeteryName) {
        if (!cemeteryName) return null;
        try {
            const res = await fetch(`${API_URL}/api/people?cemetery=${encodeURIComponent(cemeteryName)}`);
            if (!res.ok) return null;

            const data = await res.json();
            const people = Array.isArray(data?.people) ? data.people : [];
            const areas = people.map(p => p.area).filter(Boolean);

            if (areas.length === 0) return null;

            // pick the most frequent area (handles cases where same-named cemetery appears in multiple areas)
            const counts = areas.reduce((acc, a) => ((acc[a] = (acc[a] || 0) + 1), acc), {});
            let best = null, max = 0;
            for (const [a, n] of Object.entries(counts)) {
                if (n > max) { best = a; max = n; }
            }
            return best;
        } catch {
            return null;
        }
    }

    async function tryAutoFillAreaFromCemetery(cemeteryName) {
        // Do not overwrite if user already set Area
        if (!cemeteryName || areaInput.value.trim()) return;
        const area = await fetchAreaForCemetery(cemeteryName);
        if (area) {
            areaInput.value = area;
            clearAreaBtn.style.display = 'flex';
            // propagate to your search
            areaInput.dispatchEvent(new Event('input', { bubbles: true }));
            areaInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
    }

    setupSuggestions(cemInput, clearCemBtn, cemSuggest, 'cemeteries', {
        onSelect: (val) => tryAutoFillAreaFromCemetery(val)
    });
    setupSuggestions(areaInput, clearAreaBtn, areaSuggest, 'locations');

    cemInput.addEventListener('change', () => {
        tryAutoFillAreaFromCemetery(cemInput.value.trim());
    });
    cemInput.addEventListener('blur', () => {
        tryAutoFillAreaFromCemetery(cemInput.value.trim());
    });

    // 1) Отримати унікальні кладовища для обраної Area через /api/people
    async function fetchCemeteriesForArea(area) {
        if (!area) return [];
        try {
            const res = await fetch(`${API_URL}/api/people?area=${encodeURIComponent(area)}`);
            if (!res.ok) return [];
            const data = await res.json();
            const cemSet = new Set(
                (Array.isArray(data?.people) ? data.people : [])
                    .map(p => p.cemetery)
                    .filter(Boolean)
            );
            // відсортуємо для приємнішого UX
            return Array.from(cemSet).sort((a, b) => a.localeCompare(b, 'uk', { sensitivity: 'base' }));
        } catch {
            return [];
        }
    }

    // 2) Показати підказки кладовищ для вибраної Area, якщо інпут кладовища порожній
    async function showCemeteriesForSelectedAreaIfEmpty() {
        const area = areaInput.value.trim();
        const cemVal = cemInput.value.trim();
        if (!area || cemVal) return;       // показуємо лише коли area є, а cemetery — порожній

        // lightweight loader (необов’язково)
        cemSuggest.innerHTML = '<li class="loading">Завантаження…</li>';
        cemSuggest.style.display = 'block';

        const items = await fetchCemeteriesForArea(area);
        if (!items.length) {
            cemSuggest.innerHTML = '<li class="no-results">Нічого не знайдено</li>';
        } else {
            cemSuggest.innerHTML = items.map(name => `<li>${name}</li>`).join('');
        }
        // кнопку «очистити» не показуємо — інпут ще порожній
    }

    // 3) Тригеримо показ підказок при фокусі/кліку на інпут кладовищ
    cemInput.addEventListener('focus', showCemeteriesForSelectedAreaIfEmpty);
    cemInput.addEventListener('click', showCemeteriesForSelectedAreaIfEmpty);

    //
    // 5) FETCH & RENDER PEOPLE
    //
    async function fetchPeople() {
        const foundLabel = document.getElementById('foundLabel')

        // only search if at least one filter has a value
        const hasFilter =
            nameInput.value.trim() ||
            birthInput.value ||
            deathInput.value ||
            cemInput.value.trim() ||
            areaInput.value.trim();

        if (!hasFilter) {
            // no filters → hide label + clear list
            foundLabel.hidden = true;
            foundList.innerHTML = '';
            noResults.hidden = true;
            return;
        }

        // filters are active → show the label
        foundLabel.hidden = false;

        // build query params
        const params = new URLSearchParams();
        if (nameInput.value.trim()) params.set('search', nameInput.value.trim());
        if (birthInput.value) params.set('birthYear', birthInput.value);
        if (deathInput.value) params.set('deathYear', deathInput.value);
        if (cemInput.value.trim()) params.set('cemetery', cemInput.value.trim());
        if (areaInput.value.trim()) params.set('area', areaInput.value.trim());

        const res = await fetch(`${API_URL}/api/people?${params}`);
        const data = await res.json();

        const selectedIdSet = new Set(selectedPersons.map(sel => String(sel.id)));
        const toShow = data.people || [];
        const nameFilter = nameInput.value.trim();
        const filteredPeople = nameFilter
            ? toShow.filter(p => matchesNamePrefix(p.name, nameFilter))
            : toShow;

        foundLabel.textContent = `Знайдено (${filteredPeople.length}):`;

        if (filteredPeople.length) {
            noResults.hidden = true;
            foundLabel.hidden = false;
            foundList.innerHTML = filteredPeople.map(p => {
                const idStr = String(p.id);
                const isSelected = selectedIdSet.has(idStr);
                const liClassAttr = isSelected ? ' class="is-selected"' : '';
                return `
  <li data-id="${idStr}"${liClassAttr}>
    <img src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="" />
    <div class="info">
      <div class="name">${p.name}</div>
      <div class="years">${p.birthYear} – ${p.deathYear}</div>
    </div>
    <button class="select-btn${isSelected ? ' is-hidden' : ''}" aria-label="Select" ${isSelected ? 'tabindex="-1" disabled aria-hidden="true"' : ''}>
      <img
        src="/img/plus-icon.png"
        alt="Додати"
        class="plus-icon"
        width="24"
        height="24"
      />
    </button>
  </li>
`;
            }).join('');
        } else {
            foundList.innerHTML = '';
            foundLabel.hidden = true;
            noResults.hidden = false;
        }

        // hook up each select button
        foundList.querySelectorAll('li button.select-btn:not(.is-hidden)').forEach(btn => {
            btn.addEventListener('click', () => {
                const li = btn.closest('li');
                const id = li.dataset.id;
                const person = filteredPeople.find(x => String(x.id) === id);
                selectPerson(person);
            });
        });
    }

    const triggerFetch = debounce(fetchPeople, 300);

    restoreFilters();
    triggerFetch();

    if (!foundList._profileDelegation) {
        foundList.addEventListener('click', (e) => {
            if (e.target.closest('.select-btn')) return; // не чіпаємо кнопку +
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            const id = li.dataset.id;
            if (id) {
                saveFilters();
                window.location.href = `/profile.html?personId=${encodeURIComponent(id)}&from=premium`;
            }
        });

        // Доступність з клавіатури (Enter/Space)
        foundList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('.select-btn')) return;
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            e.preventDefault();
            const id = li.dataset.id;
            if (id) {
                saveFilters();
                window.location.href = `/profile.html?personId=${encodeURIComponent(id)}&from=premium`;
            }
        });

        foundList._profileDelegation = true;
    }

    if (!selectedList._profileDelegation) {
        selectedList.addEventListener('click', (e) => {
            if (e.target.closest('.deselect-btn')) return;
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            const id = li.dataset.id;
            if (id) {
                saveFilters();
                window.location.href = `/profile.html?personId=${encodeURIComponent(id)}&from=premium`;
            }
        });

        selectedList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('.deselect-btn')) return;
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            e.preventDefault();
            const id = li.dataset.id;
            if (id) {
                saveFilters();
                window.location.href = `/profile.html?personId=${encodeURIComponent(id)}&from=premium`;
            }
        });

        selectedList._profileDelegation = true;
    }

    // typing a name fires a search
    nameInput.addEventListener('input', triggerFetch);

    // Done button: validate and write to hidden inputs
    doneBtn.addEventListener('click', () => {
        const birthValue = birthWheel.getValue();
        const deathValue = deathWheel.getValue();

        selectedBirth = birthValue ? Number(birthValue) : undefined;
        selectedDeath = deathValue ? Number(deathValue) : undefined;

        enforceChronology('birth', 'auto');
        applyDeathConstraints();

        birthInput.value = birthWheel.getValue() || '';
        deathInput.value = deathWheel.getValue() || '';

        updateDisplay();
        saveFilters();

        if (panel) panel.hidden = true;

        triggerFetch();
        yearsPanelBackup = null;
    });

    clearYearsBtn.addEventListener('click', e => {
        e.stopPropagation();
        selectedBirth = undefined;
        selectedDeath = undefined;
        birthInput.value = '';
        deathInput.value = '';
        birthWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
        deathWheel.clear({ silent: true, keepActive: true, behavior: 'auto' });
        birthWheel.snap({ behavior: 'auto', silent: true });
        deathWheel.snap({ behavior: 'auto', silent: true });

        applyDeathConstraints();
        updateDisplay();
        saveFilters();

        triggerFetch();
        yearsPanelBackup = null;
    });

    /*[nameInput, birthInput, deathInput]
        .forEach(el => el.addEventListener(
            el.tagName === 'SELECT' ? 'change' : 'input',
            triggerFetch
        ));*/

    //
    // 6) SELECT / DESELECT
    //
    function renderSelected() {
        // show/hide the whole container
        selectedContainer.hidden = selectedPersons.length === 0;

        // re-render the list
        selectedList.innerHTML = selectedPersons.map(p => `
        <li data-id="${p.id}">
            <img src="${p.avatarUrl || 'https://i.ibb.co/ycrfZ29f/Frame-542.png'}" alt="">
            <div class="info">
            <div class="name">${p.name}</div>
            <div class="years">${p.birthYear} – ${p.deathYear}</div>
            </div>
            <button class="deselect-btn" aria-label="Deselect">
            <img
                src="/img/minus-icon.png"
                alt="Видалити"
                class="minus-icon"
                width="24"
                height="24"
            />
            </button>
        </li>
        `).join('');

        // wire up all deselect buttons
        selectedList.querySelectorAll('li button').forEach(btn => {
            btn.addEventListener('click', () => {
                const id = btn.closest('li').dataset.id;
                const idx = selectedPersons.findIndex(x => x.id === id);
                if (idx > -1) selectedPersons.splice(idx, 1);
                renderSelected();
                triggerFetch();  // put them back into Found
            });
        });

        if (selectedPersons.length > 0) {
            // перемістити кнопку прямо під список вибраних
            if (mainSubmitBtn) {
                mainSubmitBtn.classList.add('submit-btn--inline');
                mainSubmitBtn.style.display = ''; // показати
                // вставити одразу після #selectedList
                if (selectedList.parentNode) {
                    selectedList.after(mainSubmitBtn);
                }
            }
        } else {
            if (mainSubmitBtn) {
                mainSubmitBtn.style.display = 'none';
            }
        }

        updateSelectedCount();
    }

    function updateSelectedCount() {
        const label = document.getElementById('selectedCountLabel');
        label.textContent = `Вибрано (${selectedPersons.length}):`;
    }

    function selectPerson(p) {
        // prevent duplicates
        if (!selectedPersons.some(x => x.id === p.id)) {
            selectedPersons.push(p);
            renderSelected();
            triggerFetch();  // to remove them from Found
        }
    }

    //
    // 7) “Додати особу” & NAVIGATION
    //
    addPersonBtn.addEventListener('click', () => {
        window.location.href = '/add_person.html';
    });

    function resetCemetery() {
        if (cemInput) {
            cemInput.value = '';
            // якщо зберігаєш вибране через data-*:
            cemInput.removeAttribute('data-selected-id');
            // триггеримо твою логіку фільтра/підказок
            cemInput.dispatchEvent(new Event('input', { bubbles: true }));
            cemInput.dispatchEvent(new Event('change', { bubbles: true }));
        }
        if (cemSuggest) cemSuggest.style.display = 'none';
        if (clearCemBtn) clearCemBtn.style.display = 'none';
    }

    // 1) Клік по «очистити» в area -> чистимо cemetery
    clearAreaBtn?.addEventListener('click', () => {
        resetCemetery();
    });

    // 2) Додатково: якщо area стало порожнім вручну — теж чистимо cemetery
    areaInput?.addEventListener('input', (e) => {
        if (e.target.value.trim() === '') resetCemetery();
    });

    //
    // 8) OPEN THE MODAL
    //
    const selectError = document.getElementById('selectError');

    mainSubmitBtn.addEventListener('click', e => {
        e.preventDefault();
        if (selectedPersons.length === 0) {
            selectError.hidden = false;
            return;
        }
        selectError.hidden = true;
        deliveryModal.hidden = false;
        mainSubmitBtn.style.display = 'none';   // HIDE when modal opens
    });

    modalCloseBtn.addEventListener('click', () => {
        deliveryModal.hidden = true;
        mainSubmitBtn.style.display = '';       // SHOW again when modal closes
    });

    deliveryModal.addEventListener('click', e => {
        if (e.target === deliveryModal) {
            deliveryModal.hidden = true;
            mainSubmitBtn.style.display = '';     // SHOW again when clicking outside
        }
    });

    //
    // 9) FINAL SUBMIT INSIDE THE MODAL
    //
    modalSubmitBtn.addEventListener('click', async e => {
        e.preventDefault();

        const paymentMethod = document.querySelector('input[name="payment"]:checked').value;
        const errorEl = document.getElementById('paymentError');
        errorEl.hidden = true;
        errorEl.textContent = '';

        // ⬇️ Require ALL fields to be filled
        const delNameVal = (document.getElementById('delName')?.value || '').trim();
        const delCityVal = (document.getElementById('delCity')?.value || '').trim();
        const delBranchVal = (document.getElementById('delBranch')?.value || '').trim();
        const delPhoneVal = (document.getElementById('delPhone')?.value || '').trim();

        const email = (delEmailInput?.value || '').trim().toLowerCase();

        if (!delNameVal || !delCityVal || !delBranchVal || !delPhoneVal || !email) {
            errorEl.textContent = 'Введіть всі дані';
            errorEl.hidden = false;
            return;
        }

        // ✅ Вибір однієї особи (фікс, якщо локально зберігаєте у selectedPersons)
        const selectedPerson = (typeof window.selectedPerson !== 'undefined' && window.selectedPerson)
            ? window.selectedPerson
            : (Array.isArray(selectedPersons) && selectedPersons[0] ? selectedPersons[0] : null);

        if (!selectedPerson) {
            errorEl.textContent = 'Будь ласка, оберіть особу перед оформленням.';
            errorEl.hidden = false;
            return;
        }

        // ✅ Email: обов’язковий і валідний
        if (!email || !isValidEmail(email)) {
            delEmailError.textContent = 'Введіть коректний email (він буде логіном для Преміум-профілю).';
            delEmailError.hidden = false;
            delEmailInput.classList.add('input-error');
            return;
        }

        // Дані для вашого /api/orders
        const deliveryData = {
            personId: String(selectedPerson.id),
            personName: selectedPerson.name,
            name: document.getElementById('delName').value.trim(),
            cityRef: selectedCityRef,
            cityName: selectedCityName,
            branchRef: selectedBranchRef,
            branchDesc: selectedBranchDescription,
            phone: document.getElementById('delPhone').value.trim(),
            email,                       // ⬅️ додаємо email
            paymentMethod: paymentMethod
        };

        try {
            if (paymentMethod === 'online') {
                // 1) Створення інвойсу через бекенд
                const invoiceRes = await fetch(`${API_URL}/api/merchant/invoice/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: 100,     // копійки
                        ccy: 980,        // UAH
                        redirectUrl: `${window.location.origin}/?invoiceQr=true`,
                        webHookUrl: `${API_URL}/api/monopay/webhook`,
                        merchantPaymInfo: {
                            destination: 'Оплата QR-заявки',
                            comment: `Замовлення ${selectedPerson.name}`
                        }
                    })
                });
                if (!invoiceRes.ok) throw new Error('Не вдалось створити інвойс');
                const { invoiceId, pageUrl } = await invoiceRes.json();

                // 2) Створюємо заявку у БД зі статусом pending + invoiceId + email
                const orderPayload = { ...deliveryData, invoiceId, status: 'pending' };
                const orderRes = await fetch(`${API_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                if (!orderRes.ok) throw new Error('Не вдалось створити заявку');

                const { orderId } = await orderRes.json();

                // 3) Редірект на сторінку оплати
                window.location.href =
                    `${pageUrl}?redirectUrl=${encodeURIComponent(`${window.location.origin}/order-success?orderId=${orderId}&invoiceId=${invoiceId}`)}`;

            } else {
                // Накладний платіж: просто створюємо заявку з email
                const codRes = await fetch(`${API_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(deliveryData)
                });
                if (!codRes.ok) throw new Error('Не вдалось створити заявку');

                deliveryModal.hidden = true;
                alert('Заявку прийнято! Менеджер з вами зв’яжеться.');
            }
        } catch (err) {
            errorEl.textContent = err.message || 'Сталася помилка під час оформлення.';
            errorEl.hidden = false;
            console.error(err);
        }
    });

    // ————————————————————————————————————————
    // 10) Nova Poshta “delCity” auto-suggestions
    // ————————————————————————————————————————
    const delCityInput = document.getElementById('delCity');
    const clearDelCityBtn = document.getElementById('clearDelCity');
    const delCitySuggest = document.getElementById('delCitySuggestions');

    let selectedCityRef = null;
    let selectedCityName = '';

    function setupNPPCitySuggestions(input, clearBtn, listEl) {
        clearBtn.style.display = 'none';

        const doFetch = debounce(async () => {
            const q = input.value.trim();
            if (!q) {
                listEl.innerHTML = '';
                listEl.style.display = 'none';
                return;
            }

            try {
                const res = await fetch(`${API_URL}/api/settlements?q=${encodeURIComponent(q)}`);
                const json = await res.json();
                const addresses = (json.data?.[0]?.Addresses) || [];

                if (addresses.length === 0) {
                    listEl.innerHTML = '<li class="no-results">Нічого не знайдено</li>';
                } else {
                    listEl.innerHTML = addresses
                        .map(addr =>
                            // render Present, keep Ref in data-ref
                            `<li data-ref="${addr.Ref}">${addr.Present}</li>`
                        )
                        .join('');
                }
                listEl.style.display = 'block';
            } catch (e) {
                console.error('NP API error', e);
            }
        }, 300);

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            doFetch();
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            listEl.innerHTML = '';
            listEl.style.display = 'none';
            selectedCityRef = null;
            input.focus();
        });

        listEl.addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                // fill input with Present
                input.value = e.target.textContent;
                // store the Ref for later
                selectedCityRef = e.target.dataset.ref;
                selectedCityName = e.target.textContent;
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
                console.log('Selected city Ref:', selectedCityRef);
            }
        });
    }

    setupNPPCitySuggestions(delCityInput, clearDelCityBtn, delCitySuggest);

    // ————————————————————————————————————————
    // 11) Nova Poshta “delBranch” auto-suggestions
    // ————————————————————————————————————————
    const delBranchInput = document.getElementById('delBranch');
    const clearDelBranchBtn = document.getElementById('clearDelBranch');
    const delBranchSuggest = document.getElementById('delBranchSuggestions');

    // will hold the chosen branch Ref
    let selectedBranchRef = null;
    let selectedBranchDescription = '';

    function setupNPBranchSuggestions(input, clearBtn, listEl) {
        clearBtn.style.display = 'none';

        const doFetch = debounce(async () => {
            const q = input.value.trim();
            // nothing to do if no city yet or no q
            if (!q || !selectedCityRef) {
                listEl.innerHTML = '';
                listEl.style.display = 'none';
                selectedBranchRef = null;
                return;
            }

            try {
                const url = `${API_URL}/api/warehouses`
                    + `?cityRef=${encodeURIComponent(selectedCityRef)}`
                    + `&q=${encodeURIComponent(q)}`;
                const res = await fetch(url);
                const json = await res.json();
                const warehouses = json.data || [];

                if (warehouses.length === 0) {
                    listEl.innerHTML = '<li class="no-results">Нічого не знайдено</li>';
                } else {
                    listEl.innerHTML = warehouses
                        .map(w =>
                            // show the human-readable Description and keep Ref
                            `<li data-ref="${w.Ref}">${w.Description}</li>`
                        )
                        .join('');
                }
                listEl.style.display = 'block';
            } catch (err) {
                console.error('NP getWarehouses error', err);
            }
        }, 300);

        input.addEventListener('input', () => {
            clearBtn.style.display = input.value ? 'flex' : 'none';
            doFetch();
        });

        clearBtn.addEventListener('click', () => {
            input.value = '';
            clearBtn.style.display = 'none';
            listEl.innerHTML = '';
            listEl.style.display = 'none';
            selectedBranchRef = null;
            input.focus();
        });

        listEl.addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                input.value = e.target.textContent;
                selectedBranchRef = e.target.dataset.ref;
                selectedBranchDescription = e.target.textContent;
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
                console.log('Selected branch Ref:', selectedBranchRef);
            }
        });
    }

    // initialize
    setupNPBranchSuggestions(delBranchInput, clearDelBranchBtn, delBranchSuggest);
});
