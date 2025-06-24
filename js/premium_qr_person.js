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
                listEl.innerHTML = arr.map(item => `<li>${item}</li>`).join('');
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
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
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
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <line x1="6"  y1="12" x2="18" y2="12"/>
          </svg>
        </button>
      </li>`;
        selectedList.querySelector('button').addEventListener('click', () => {
            selectedContainer.hidden = true;
            foundContainer.hidden = false;
        });
        foundContainer.hidden = true;
        selectedContainer.hidden = false;
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
    mainSubmitBtn.addEventListener('click', e => {
        e.preventDefault();
        // only open if someone is selected
        // if (!selectedPerson) return;
        deliveryModal.hidden = false;
    });

    //
    // 9) FINAL SUBMIT INSIDE THE MODAL
    //
    modalSubmitBtn.addEventListener('click', e => {
        e.preventDefault();
        // TODO: fire your delivery‐details API call here...
        // for now, just close
        deliveryModal.hidden = true;
        alert('Заявку прийнято! Ми з вами зв’яжемося.');
    });

    // ————————————————————————————————————————
    // 10) Nova Poshta “delCity” auto-suggestions
    // ————————————————————————————————————————
    const delCityInput = document.getElementById('delCity');
    const clearDelCityBtn = document.getElementById('clearDelCity');
    const delCitySuggest = document.getElementById('delCitySuggestions');

    let selectedCityRef = null;

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
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
                console.log('Selected branch Ref:', selectedBranchRef);
            }
        });
    }

    // initialize
    setupNPBranchSuggestions(delBranchInput, clearDelBranchBtn, delBranchSuggest);
});
