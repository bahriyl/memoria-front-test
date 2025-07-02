const API = 'https://memoria-test-app-ifisk.ondigitalocean.app/api';

// кнопка «назад»
document.getElementById('back-btn').addEventListener('click', () => history.back());

// дістати назву з URL
const params = new URLSearchParams(window.location.search);
const name = params.get('name') || '';

// посилання на DOM-елементи
const titleEl = document.getElementById('cemeteryName');
const imgEl   = document.getElementById('cemeteryImage');
const addrEl  = document.getElementById('cemeteryAddress');
const phoneEl = document.getElementById('cemeteryPhone');
const descEl  = document.getElementById('cemeteryDescription');

if (!name) {
  titleEl.textContent = 'Цвинтар не знайдено';
} else {
  titleEl.textContent = name;

  // 1) Шукаємо за назвою, щоб отримати _id
  fetch(`${API}/cemeteries_page?search=${encodeURIComponent(name)}`)
    .then(r => r.json())
    .then(data => {
      const match = data.cemeteries.find(c => c.name === name);
      if (!match) throw new Error('Не знайдено');
      return fetch(`${API}/cemeteries_page/${match.id}`);
    })
    // 2) Отримуємо повні дані
    .then(r => r.json())
    .then(c => {
      imgEl.src = c.image;
      imgEl.alt = c.name;
      addrEl.textContent  = c.address;
      phoneEl.textContent = 'тел. ' + c.phone;
      descEl.textContent  = c.description;
    })
    .catch(err => {
      console.error(err);
      titleEl.textContent = 'Помилка завантаження';
    });
}
