const API_URL = 'https://memoria-test-app-ifisk.ondigitalocean.app';

const SELECTED_KEY = 'premiumQR.selected.v1';
const PREMIUM_QR_PRICE = 700;

function debounce(fn, ms) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => fn(...args), ms);
    };
}

function formatUaPhone(value) {
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
}

function isValidName(name) {
    const value = (name || '').trim();
    const parts = value.split(/\s+/).filter(Boolean);
    if (!value) return false;
    if (value.includes('.')) return false;
    if (parts.length < 2) return false;
    return !parts.some(p => p.length <= 1);
}

document.addEventListener('DOMContentLoaded', () => {
    const backBtn = document.getElementById('backBtn');
    const personList = document.getElementById('personList');
    const summaryQty = document.getElementById('summaryQty');
    const summaryTotal = document.getElementById('summaryTotal');
    const certList = document.getElementById('certList');

    const fullNameInput = document.getElementById('fullName');
    const phoneInput = document.getElementById('phone');
    const smsInput = document.getElementById('smsCode');
    const sendCodeBtn = document.getElementById('sendCodeBtn');
    const termsCheck = document.getElementById('termsCheck');
    const payBtn = document.getElementById('payBtn');
    const orderError = document.getElementById('orderError');

    if (backBtn) {
        backBtn.addEventListener('click', () => {
            window.location.href = 'premium_qr_person.html';
        });
    }

    let selectedPersons = [];
    try {
        const raw = sessionStorage.getItem(SELECTED_KEY);
        if (raw) selectedPersons = JSON.parse(raw);
    } catch {
        selectedPersons = [];
    }

    if (!Array.isArray(selectedPersons) || selectedPersons.length === 0) {
        window.location.replace('premium_qr_person.html');
        return;
    }

    const avatarFallback = 'https://i.ibb.co/ycrfZ29f/Frame-542.png';
    personList.innerHTML = selectedPersons.map(person => `
        <div class="person-card">
            <img class="person-avatar" src="${person.avatarUrl || avatarFallback}" alt="" />
            <div class="person-info">
                <div class="person-name">${person.name || ''}</div>
                <div class="person-years">${person.birthYear || ''} - ${person.deathYear || ''}</div>
            </div>
        </div>
    `).join('');

    const count = selectedPersons.length;
    const total = count * PREMIUM_QR_PRICE;
    summaryQty.textContent = `${count} x ${PREMIUM_QR_PRICE} грн`;
    summaryTotal.textContent = `${total} грн`;

    const certLabels = selectedPersons.map((_, idx) => {
        if (count === 1) return 'Додати фото свідоцтва про смерть';
        if (count === 2) {
            return idx === 0
                ? 'Додати фото свідоцтва про смерть першої особи'
                : 'Додати фото свідоцтва про смерть другої особи';
        }
        return `Додати фото свідоцтва про смерть особи ${idx + 1}`;
    });

    const certState = new Array(count).fill(null);

    function closeAllCertMenus() {
        certList.querySelectorAll('.cert-menu-popover').forEach(pop => {
            pop.hidden = true;
        });
    }

    function renderCertCards() {
        certList.innerHTML = '';
        certLabels.forEach((label, idx) => {
            const card = document.createElement('div');
            card.className = 'cert-card';
            card.dataset.index = String(idx);

            const input = document.createElement('input');
            input.type = 'file';
            input.accept = 'image/*';
            input.hidden = true;

            const placeholder = document.createElement('div');
            placeholder.className = 'cert-placeholder';
            placeholder.textContent = label;

            const img = document.createElement('img');
            img.className = 'cert-image';
            img.hidden = true;

            const menuBtn = document.createElement('button');
            menuBtn.type = 'button';
            menuBtn.className = 'cert-menu';
            menuBtn.textContent = '⋮';
            menuBtn.hidden = true;

            const popover = document.createElement('div');
            popover.className = 'cert-menu-popover';
            popover.hidden = true;

            const removeBtn = document.createElement('button');
            removeBtn.type = 'button';
            removeBtn.textContent = 'Видалити';
            popover.appendChild(removeBtn);

            function syncView() {
                const src = certState[idx];
                if (src) {
                    img.src = src;
                    img.hidden = false;
                    placeholder.hidden = true;
                    menuBtn.hidden = false;
                } else {
                    img.hidden = true;
                    placeholder.hidden = false;
                    menuBtn.hidden = true;
                }
                popover.hidden = true;
            }

            input.addEventListener('change', () => {
                const file = input.files && input.files[0];
                if (!file) return;
                const reader = new FileReader();
                reader.onload = () => {
                    certState[idx] = reader.result;
                    syncView();
                };
                reader.readAsDataURL(file);
            });

            card.addEventListener('click', (e) => {
                if (e.target.closest('.cert-menu')) return;
                if (e.target.closest('.cert-menu-popover')) return;
                input.click();
            });

            menuBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                closeAllCertMenus();
                popover.hidden = false;
            });

            removeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                certState[idx] = null;
                input.value = '';
                syncView();
            });

            card.append(input, placeholder, img, menuBtn, popover);
            certList.appendChild(card);
            syncView();
        });
    }

    renderCertCards();

    document.addEventListener('click', (e) => {
        if (e.target.closest('.cert-menu')) return;
        if (e.target.closest('.cert-menu-popover')) return;
        closeAllCertMenus();
    });

    if (phoneInput) {
        const applyPhoneMask = () => {
            phoneInput.value = formatUaPhone(phoneInput.value);
        };
        phoneInput.addEventListener('input', applyPhoneMask);
        phoneInput.addEventListener('blur', applyPhoneMask);
    }

    if (sendCodeBtn) {
        sendCodeBtn.addEventListener('click', () => {
            sendCodeBtn.textContent = 'Надіслано';
            sendCodeBtn.disabled = true;
            setTimeout(() => {
                sendCodeBtn.textContent = 'Надіслати код';
                sendCodeBtn.disabled = false;
            }, 2500);
        });
    }

    const delCityInput = document.getElementById('delCity');
    const clearDelCityBtn = document.getElementById('clearDelCity');
    const delCitySuggest = document.getElementById('delCitySuggestions');

    const delBranchInput = document.getElementById('delBranch');
    const clearDelBranchBtn = document.getElementById('clearDelBranch');
    const delBranchSuggest = document.getElementById('delBranchSuggestions');

    let selectedCityRef = null;
    let selectedCityName = '';
    let selectedBranchRef = null;
    let selectedBranchDescription = '';

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
                        .map(addr => `<li data-ref="${addr.Ref}">${addr.Present}</li>`)
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
                input.value = e.target.textContent;
                selectedCityRef = e.target.dataset.ref;
                selectedCityName = e.target.textContent;
                listEl.style.display = 'none';
                clearBtn.style.display = 'flex';
            }
        });
    }

    function setupNPBranchSuggestions(input, clearBtn, listEl) {
        clearBtn.style.display = 'none';

        const doFetch = debounce(async () => {
            const q = input.value.trim();
            if (!q || !selectedCityRef) {
                listEl.innerHTML = '';
                listEl.style.display = 'none';
                selectedBranchRef = null;
                return;
            }

            try {
                const url = `${API_URL}/api/warehouses?cityRef=${encodeURIComponent(selectedCityRef)}&q=${encodeURIComponent(q)}`;
                const res = await fetch(url);
                const json = await res.json();
                const warehouses = json.data || [];

                if (warehouses.length === 0) {
                    listEl.innerHTML = '<li class="no-results">Нічого не знайдено</li>';
                } else {
                    listEl.innerHTML = warehouses
                        .map(w => `<li data-ref="${w.Ref}">${w.Description}</li>`)
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
            }
        });
    }

    if (delCityInput && clearDelCityBtn && delCitySuggest) {
        setupNPPCitySuggestions(delCityInput, clearDelCityBtn, delCitySuggest);
    }
    if (delBranchInput && clearDelBranchBtn && delBranchSuggest) {
        setupNPBranchSuggestions(delBranchInput, clearDelBranchBtn, delBranchSuggest);
    }

    function showError(message) {
        if (!orderError) return;
        orderError.textContent = message;
        orderError.hidden = false;
    }

    function clearError() {
        if (!orderError) return;
        orderError.textContent = '';
        orderError.hidden = true;
    }

    payBtn.addEventListener('click', async () => {
        clearError();

        const fullName = (fullNameInput?.value || '').trim();
        const phone = (phoneInput?.value || '').trim();
        const sms = (smsInput?.value || '').trim();
        const city = (delCityInput?.value || '').trim();
        const branch = (delBranchInput?.value || '').trim();
        const paymentMethod = document.querySelector('input[name="payment"]:checked')?.value || 'online';

        if (!isValidName(fullName)) {
            fullNameInput?.classList.add('input-error');
            showError('Введіть коректні ПІБ');
            return;
        }
        fullNameInput?.classList.remove('input-error');

        if (!phone) {
            phoneInput?.classList.add('input-error');
            showError('Введіть номер телефону');
            return;
        }
        phoneInput?.classList.remove('input-error');

        if (!sms) {
            smsInput?.classList.add('input-error');
            showError('Введіть код з SMS');
            return;
        }
        smsInput?.classList.remove('input-error');

        if (!city || !branch || !selectedCityRef || !selectedBranchRef) {
            showError('Оберіть населений пункт та пункт видачі');
            return;
        }

        if (!termsCheck?.checked) {
            showError('Підтвердіть умови отримання');
            return;
        }

        const personIds = selectedPersons.map(p => String(p.id));
        const personNames = selectedPersons.map(p => p.name || '');

        const deliveryData = {
            personIds,
            personNames,
            name: fullName,
            cityRef: selectedCityRef,
            cityName: selectedCityName,
            branchRef: selectedBranchRef,
            branchDesc: selectedBranchDescription,
            phone,
            paymentMethod
        };

        try {
            const amount = total * 100;
            const invoiceRes = await fetch(`${API_URL}/api/merchant/invoice/create`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    amount,
                    ccy: 980,
                    redirectUrl: `${window.location.origin}/?invoiceQr=true`,
                    webHookUrl: `${API_URL}/api/monopay/webhook`,
                    merchantPaymInfo: {
                        destination: 'Оплата QR-заявки',
                        comment: `Замовлення (${personNames.length})`
                    }
                })
            });
            if (!invoiceRes.ok) throw new Error('Не вдалось створити інвойс');
            const { invoiceId, pageUrl } = await invoiceRes.json();

            const orderPayload = { ...deliveryData, invoiceId, status: 'pending' };
            const orderRes = await fetch(`${API_URL}/api/orders`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(orderPayload)
            });
            if (!orderRes.ok) throw new Error('Не вдалось створити заявку');

            const { orderId } = await orderRes.json();
            window.location.href =
                `${pageUrl}?redirectUrl=${encodeURIComponent(`${window.location.origin}/order-success?orderId=${orderId}&invoiceId=${invoiceId}`)}`;
        } catch (err) {
            console.error(err);
            showError(err.message || 'Сталася помилка під час оформлення.');
        }
    });
});
