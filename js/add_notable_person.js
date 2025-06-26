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
    // Filters & results
    const nameInput = document.getElementById('searchName');
    const birthSelect = document.getElementById('birthYearFilter');
    const deathSelect = document.getElementById('deathYearFilter');
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

    // Populate years
    const thisYear = new Date().getFullYear();
    for (let y = thisYear; y >= 1900; y--) {
        birthSelect.add(new Option(y, y));
        deathSelect.add(new Option(y, y));
    }
    [birthSelect, deathSelect].forEach(sel => {
        sel.addEventListener('change', () => {
            const btn = sel === birthSelect ? clearBirthBtn : clearDeathBtn;
            btn.style.display = sel.value ? 'flex' : 'none';
            triggerFetch();
        });
    });
    [clearBirthBtn, clearDeathBtn].forEach(btn => {
        btn.addEventListener('click', () => {
            const sel = btn.id === 'clearBirth' ? birthSelect : deathSelect;
            sel.value = '';
            btn.style.display = 'none';
            triggerFetch();
        });
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
            foundList.innerHTML = data.people.map(p => `
        <li data-id="${p.id}">
          <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="">
          <div class="info">
            <div class="name">${p.name}</div>
            <div class="years">${p.birthYear} - ${p.deathYear}</div>
          </div>
          <button aria-label="Select">+</button>
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
        } else {
            foundList.innerHTML = '';
            noResults.hidden = false;
        }
    }
    const triggerFetch = debounce(fetchPeople, 300);
    [nameInput, birthSelect, deathSelect].forEach(el => {
        const ev = el.tagName === 'SELECT' ? 'change' : 'input';
        el.addEventListener(ev, triggerFetch);
    });

    // Select / Deselect
    function selectPerson(p) {
        selectedPerson = p;
        selectedList.innerHTML = `
      <li data-id="${p.id}">
        <img src="${p.avatarUrl || '/img/default-avatar.png'}" alt="">
        <div class="info">
          <div class="name">${p.name}</div>
          <div class="years">${p.birthYear} - ${p.deathYear}</div>
        </div>
        <button aria-label="Deselect">–</button>
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
    }

    closeBtn.addEventListener('click', hideModal);
    okBtn.addEventListener('click', hideModal);

    submitBtn.addEventListener('click', async e => {
        e.preventDefault();

        // gather values
        const name = document.getElementById('searchName').value.trim();
        const birthYear = document.getElementById('birthYearFilter').value;
        const deathYear = document.getElementById('deathYearFilter').value;
        const area = document.getElementById('areaFilter').value.trim();
        const cemetery = document.getElementById('cemeteryFilter').value.trim();

        let occupation = '';
        let link = '';
        let bio = '';

        occupation = document.getElementById('activityArea').value;
        link = document.getElementById('internetLinks').value.trim();
        bio = document.getElementById('achievements').value.trim();

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

});
