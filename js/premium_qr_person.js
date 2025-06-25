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
    const birthSelect = document.getElementById('birthYearFilter');
    const deathSelect = document.getElementById('deathYearFilter');
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

    let selectedPerson = null;

    birthSelect.addEventListener('change', () => {
        clearBirthBtn.style.display = birthSelect.value ? 'flex' : 'none';
        triggerFetch();
    });

    clearBirthBtn.addEventListener('click', () => {
        birthSelect.value = '';
        clearBirthBtn.style.display = 'none';
        triggerFetch();
    });

    deathSelect.addEventListener('change', () => {
        clearDeathBtn.style.display = deathSelect.value ? 'flex' : 'none';
        triggerFetch();
    });

    clearDeathBtn.addEventListener('click', () => {
        deathSelect.value = '';
        clearDeathBtn.style.display = 'none';
        triggerFetch();
    });

    //
    // 3) POPULATE YEARS
    //
    const currentYear = new Date().getFullYear();
    for (let y = currentYear; y >= 1900; y--) {
        birthSelect.add(new Option(y, y));
        deathSelect.add(new Option(y, y));
    }

    //
    // 4) TYPEAHEAD SETUP
    //
    function setupSuggestions(input, clearBtn, listEl, endpoint) {
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

                if (arr.length === 0) {
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
        listEl.addEventListener('click', e => {
            if (e.target.tagName === 'LI') {
                input.value = e.target.textContent;
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
                triggerFetch();
            }
        });
    }

    setupSuggestions(cemInput, clearCemBtn, cemSuggest, 'cemeteries');
    setupSuggestions(areaInput, clearAreaBtn, areaSuggest, 'locations');

    //
    // 5) FETCH & RENDER PEOPLE
    //
    async function fetchPeople() {
        // only search if at least one filter has a value
        const hasFilter =
            nameInput.value.trim() ||
            birthSelect.value ||
            deathSelect.value ||
            cemInput.value.trim() ||
            areaInput.value.trim();

        if (!hasFilter) {
            // clear everything
            foundLabel.textContent = '';
            foundList.innerHTML = '';
            noResults.hidden = true;
            return;
        }

        // build query params
        const params = new URLSearchParams();
        if (nameInput.value.trim()) params.set('search', nameInput.value.trim());
        if (birthSelect.value) params.set('birthYear', birthSelect.value);
        if (deathSelect.value) params.set('deathYear', deathSelect.value);
        if (cemInput.value.trim()) params.set('cemetery', cemInput.value.trim());
        if (areaInput.value.trim()) params.set('area', areaInput.value.trim());

        const res = await fetch(`${API_URL}/api/people?${params}`);
        const data = await res.json();

        foundLabel.textContent = `Знайдено (${data.total}):`;

        if (data.people.length) {
            noResults.hidden = true;
            foundList.innerHTML = data.people.map(p => `
        <li data-id="${p.id}">
          <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="">
          <div class="info">
            <div class="name">${p.name}</div>
            <div class="years">${p.birthYear} - ${p.deathYear}</div>
          </div>
          <button aria-label="Select">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"/>
              <line x1="5"  y1="12" x2="19" y2="12"/>
            </svg>
          </button>
        </li>`).join('');
        } else {
            foundList.innerHTML = '';
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

    [nameInput, birthSelect, deathSelect]
        .forEach(el => el.addEventListener(
            el.tagName === 'SELECT' ? 'change' : 'input',
            triggerFetch
        ));

    //
    // 6) SELECT / DESELECT
    //
    function selectPerson(p) {
        selectedPerson = p;
        selectedList.innerHTML = `
      <li data-id="${p.id}">
        <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="">
        <div class="info">
          <div class="name">${p.name}</div>
          <div class="years">${p.birthYear} - ${p.deathYear}</div>
        </div>
        <button aria-label="Deselect">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <line x1="6"  y1="12" x2="18" y2="12"/>
          </svg>
        </button>
      </li>`;
        selectedList.querySelector('button').addEventListener('click', () => {
            // скидати вибір
            selectedPerson = null;

            // приховуємо секцію обраної особи і повертаємось до списку
            selectedContainer.hidden = true;
            foundContainer.hidden = false;

            // якщо раніше показувалася помилка — сховати її
            document.getElementById('selectError').hidden = true;
        });
        foundContainer.hidden = true;
        selectedContainer.hidden = false;
        document.getElementById('selectError').hidden = true;
    }

    //
    // 7) “Додати особу” & NAVIGATION
    //
    addPersonBtn.addEventListener('click', () => {
        window.location.href = '/add_person.html';
    });

    //
    // 8) OPEN THE MODAL
    //
    const selectError = document.getElementById('selectError');

    mainSubmitBtn.addEventListener('click', e => {
        e.preventDefault();

        // якщо ніхто не вибраний — показати помилку і нічого більше не робити
        if (!selectedPerson) {
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
