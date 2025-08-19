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
    const searchNameInput = document.getElementById('searchName');
    const searchNameError = document.getElementById('searchNameError');

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

    // toggle panel only when clicking on the pill display
    display.addEventListener('click', () => {
        panel.classList.toggle('hidden');
    });
    // prevent clicks inside the panel from toggling
    panel.addEventListener('click', e => {
        e.stopPropagation();
    });

    //
    // 1) DELIVERY DETAILS MODAL SETUP
    //
    const deliveryModal = document.getElementById('deliveryModal');
    const modalCloseBtn = document.getElementById('deliveryModalClose');
    const modalSubmitBtn = document.getElementById('deliveryModalSubmit');
    const mainSubmitBtn = document.getElementById('submitBtn');

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
    // 3) POPULATE YEARS
    //
    (function populateYears() {
        if (birthList.children.length) return;
        const now = new Date().getFullYear();
        for (let y = now; y >= 1900; y--) {
            const liB = document.createElement('li');
            liB.textContent = y;
            liB.dataset.value = y;
            birthList.append(liB);

            const liD = document.createElement('li');
            liD.textContent = y;
            liD.dataset.value = y;
            deathList.append(liD);
        }
    })();

    // selection handlers
    birthList.addEventListener('click', e => {
        if (e.target.tagName !== 'LI') return;
        // очистити попередній вибір
        birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        e.target.classList.add('selected');

        // оновити змінну
        selectedBirth = Number(e.target.dataset.value);

        // підсвітити тільки допустимі роки смерті
        deathList.querySelectorAll('li').forEach(li => {
            const year = Number(li.dataset.value);
            if (year < selectedBirth) {
                li.classList.add('disabled');
            } else {
                li.classList.remove('disabled');
            }
        });

        // за потреби прокрутити
        e.target.scrollIntoView({ block: 'center' });
    });

    deathList.addEventListener('click', e => {
        // look for the nearest <li> up the tree
        const li = e.target.closest('li');
        // if there isn't one, or it isn't in our deathList, do nothing
        if (!li || !deathList.contains(li) || li.classList.contains('disabled')) return;

        // clear the old selection
        deathList.querySelectorAll('li.selected')
            .forEach(el => el.classList.remove('selected'));

        // select the one we clicked
        li.classList.add('selected');
        selectedDeath = Number(li.dataset.value);

        // scroll it into view if you like
        li.scrollIntoView({ block: 'center' });
    });

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

                if (!arr.length) {
                    listEl.innerHTML = `<li class="no-results">Збігів не знайдено</li>`;
                } else {
                    listEl.innerHTML = arr.map(item => `<li>${item}</li>`).join('');
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

        const toShow = data.people.filter(
            p => !selectedPersons.some(sel => sel.id === p.id)
        );

        foundLabel.textContent = `Знайдено (${toShow.length}):`;

        if (toShow.length) {
            noResults.hidden = true;
            foundLabel.hidden = false;
            foundList.innerHTML = toShow.map(p => `
  <li data-id="${p.id}">
    <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="" />
    <div class="info">
      <div class="name">${p.name}</div>
      <div class="years">${p.birthYear} – ${p.deathYear}</div>
    </div>
    <button class="select-btn" aria-label="Select">
      <img
        src="/img/plus-icon.png"
        alt="Додати"
        class="plus-icon"
        width="24"
        height="24"
      />
    </button>
  </li>
`).join('');
        } else {
            foundList.innerHTML = '';
            foundLabel.hidden = true;
            noResults.hidden = false;
        }

        // hook up each select button
        foundList.querySelectorAll('li button').forEach(btn => {
            btn.addEventListener('click', () => {
                const li = btn.closest('li');
                const id = li.dataset.id;
                const person = data.people.find(x => x.id === id);
                selectPerson(person);
            });
        });
    }

    const triggerFetch = debounce(fetchPeople, 300);

    if (!foundList._profileDelegation) {
        foundList.addEventListener('click', (e) => {
            if (e.target.closest('.select-btn')) return; // не чіпаємо кнопку +
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            const id = li.dataset.id;
            if (id) window.location.href = `/profile.html?personId=${encodeURIComponent(id)}`;
        });

        // Доступність з клавіатури (Enter/Space)
        foundList.addEventListener('keydown', (e) => {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            if (e.target.closest('.select-btn')) return;
            const li = e.target.closest('li[data-id]');
            if (!li) return;
            e.preventDefault();
            const id = li.dataset.id;
            if (id) window.location.href = `/profile.html?personId=${encodeURIComponent(id)}`;
        });

        foundList._profileDelegation = true;
    }

    // typing a name fires a search
    nameInput.addEventListener('input', triggerFetch);

    // Done button: validate and write to hidden inputs
    doneBtn.addEventListener('click', () => {
        // якщо смерть раніше народження — показуємо помилку
        if (selectedBirth && selectedDeath && Number(selectedDeath) < Number(selectedBirth)) {
            alert("Рік смерті не може бути раніше року народження.");
            return;
        }

        // записуємо у приховані input-и
        birthInput.value = selectedBirth || "";
        deathInput.value = selectedDeath || "";

        // формуємо відображення
        if (selectedBirth || selectedDeath) {
            display.textContent = `${selectedBirth || ""}${(selectedBirth && selectedDeath) ? " – " : ""}${selectedDeath || ""}`;
        } else {
            display.textContent = "Роки життя"; // плейсхолдер
        }

        panel.classList.add('hidden');
        if (selectedBirth || selectedDeath) display.classList.add('has-value');
        clearYearsBtn.hidden = !(selectedBirth || selectedDeath);

        triggerFetch();
    });

    clearYearsBtn.addEventListener('click', e => {
        e.stopPropagation();
        selectedBirth = selectedDeath = undefined;
        birthInput.value = '';
        deathInput.value = '';
        display.textContent = 'Роки життя';
        clearYearsBtn.hidden = true;

        display.classList.remove('has-value');

        // also clear any .selected class in the panels:
        birthList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
        deathList.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));

        triggerFetch();
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
    <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="">
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

        // якщо ніхто не вибраний — показати помилку і нічого більше не робити
        if (selectedPersons.length === 0) {
            selectError.hidden = false;
            return;
        }
        // якщо є вибір — сховати помилку і відкрити модалку
        selectError.hidden = true;
        deliveryModal.hidden = false;
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

        // Дані для вашого /api/orders
        const deliveryData = {
            personId: selectedPerson.id,
            personName: selectedPerson.name,
            name: document.getElementById('delName').value.trim(),
            cityRef: selectedCityRef,
            cityName: selectedCityName,
            branchRef: selectedBranchRef,
            branchDesc: selectedBranchDescription,
            phone: document.getElementById('delPhone').value.trim(),
            paymentMethod: paymentMethod
        };

        try {
            if (paymentMethod === 'online') {
                // 1) Створюємо інвойс через Monopay (через ваш бекенд)
                const invoiceRes = await fetch(`${API_URL}/api/merchant/invoice/create`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        amount: 100,        // сума в копійках
                        ccy: 980,           // UAH
                        // Після оплати Monopay поверне юзера сюди з invoiceId у query
                        redirectUrl: `${window.location.origin}/?invoiceQr=true`,
                        webHookUrl: `${API_URL}/api/monopay/webhook`,
                        merchantPaymInfo: {
                            // тут можна передати довільну зовнішню референцію,
                            // або залишити порожнім, якщо не потрібна
                            destination: 'Оплата QR-заявки',
                            comment: `Замовлення ${selectedPerson.name}`
                        }
                    })
                });
                if (!invoiceRes.ok) throw new Error('Не вдалось створити інвойс');
                const { invoiceId, pageUrl } = await invoiceRes.json();

                // 2) Створюємо запис у MongoDB зі статусом pending і додаємо invoiceId
                const orderPayload = {
                    ...deliveryData,
                    invoiceId,             // додаємо поле invoiceId
                    status: 'pending'      // за потреби
                };
                const orderRes = await fetch(`${API_URL}/api/orders`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(orderPayload)
                });
                if (!orderRes.ok) throw new Error('Не вдалось створити заявку');
                const { orderId } = await orderRes.json();

                // 3) Редіректимо клієнта на сторінку оплати
                // Щоб Monopay повернув correct invoiceId, можна формувати redirectUrl з уже відомим invoiceId:
                window.location.href = `${pageUrl}?redirectUrl=${encodeURIComponent(`${window.location.origin}/order-success?orderId=${orderId}&invoiceId=${invoiceId}`)}`;
            } else {
                // COD: просто створюємо заявку й закриваємо модалку
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
            errorEl.textContent = err.message;
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
