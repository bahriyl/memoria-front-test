const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
const IMGBB_API_KEY = "726ae764867cf6b3a259967071cbdd80";

const urlParams = new URLSearchParams(window.location.search);
const ritualId = urlParams.get("id");
const token = urlParams.get("token");

let ritualData = null;

if (!ritualId || !token) {
  alert("Недійсне посилання. Відсутній ID або токен.");
  window.location.href = "/";
}

const logoutBtn = document.querySelector(".ritual-edit-label");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    window.location.href = `/ritual_service_profile.html?id=${ritualId}`;
  });
}

async function fetchRitualService() {
  try {
    const res = await fetch(`${API}/ritual_services/${ritualId}`);
    const data = await res.json();
    ritualData = data;
    renderData(data);
  } catch (e) {
    console.error("Error loading profile:", e);
  }
}

function renderData(data) {
  document.querySelector(".ritual-banner").src = data.banner;
  document.querySelector(".ritual-name").textContent = data.name;
  document.querySelector(".ritual-address").textContent = data.address;
  document.querySelector(".ritual-phone").textContent = `тел. ${data.phone}`;
  document.querySelector(".ritual-link-btn").href = data.link;
  document.querySelector(".ritual-link-text").textContent = data.link;

  const p = document.querySelector(".ritual-description p.ritual-text");
  const textarea = document.querySelector(
    ".ritual-description textarea.ritual-text"
  );
  p.textContent = data.description;
  p.style.display = "block";
  textarea.style.display = "none";

  const container = document.querySelector(".ritual-container");
  container
    .querySelectorAll(".ritual-item-section")
    .forEach((el) => el.remove());

  data.items.forEach(([title, images], index) => {
    const section = document.createElement("section");
    section.className = "ritual-item-section";

    // Заголовок і три крапки
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "section-header";

    const heading = document.createElement("h2");
    heading.className = "item-title";
    heading.textContent = title;

    const dotsBtn = document.createElement("button");
    dotsBtn.className = "dots-btn";
    dotsBtn.innerHTML = `
  <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#585858" viewBox="0 0 24 24">
    <circle cx="12" cy="5" r="2"/>
    <circle cx="12" cy="12" r="2"/>
    <circle cx="12" cy="19" r="2"/>
  </svg>
`;

    const popupMenu = document.createElement("div");
    popupMenu.className = "popup-menu hidden";
    popupMenu.innerHTML = `
        <div class="popup-option rename">Змінити назву</div>
        <div class="popup-option delete">Видалити категорію</div>
      `;

    sectionHeader.appendChild(heading);
    sectionHeader.appendChild(dotsBtn);
    sectionHeader.appendChild(popupMenu);

    // Кнопки та картинки
    const btnRow = document.createElement("div");
    btnRow.className = "ritual-btn-row";

    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    const addBtn = document.createElement("button");
    addBtn.className = "ritual-btn";
    addBtn.textContent = "Добавити";
    addBtn.addEventListener("click", () => fileInput.click());

    let isSelecting = false;
    const selectBtn = document.createElement("button");
    selectBtn.className = "ritual-btn";
    selectBtn.textContent = "Вибрати";

    const imagesContainer = document.createElement("div");
    imagesContainer.className = "item-images";

    images.forEach((url) => {
      const img = document.createElement("img");
      img.src = url;
      img.alt = title;
      img.className = "item-image";
      img.addEventListener("click", () => {
        if (isSelecting) {
          img.classList.toggle("selected");
        }
      });
      imagesContainer.appendChild(img);
    });

    selectBtn.addEventListener("click", async () => {
      if (!isSelecting) {
        isSelecting = true;
        selectBtn.textContent = "Видалити";
      } else {
        const selectedImages = imagesContainer.querySelectorAll(".selected");
        selectedImages.forEach((img) => {
          const src = img.src;
          const indexToRemove = data.items[index][1].indexOf(src);
          if (indexToRemove > -1) {
            data.items[index][1].splice(indexToRemove, 1);
          }
        });
        await updateItems(data.items);
        isSelecting = false;
        selectBtn.textContent = "Вибрати";
      }
    });

    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files[0];
      if (!file) return;
      const formData = new FormData();
      formData.append("image", file);

      const res = await fetch(
        `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
        {
          method: "POST",
          body: formData,
        }
      );
      const result = await res.json();
      const imageUrl = result.data.url;
      data.items[index][1].push(imageUrl);
      await updateItems(data.items);
    });

    btnRow.appendChild(addBtn);
    btnRow.appendChild(selectBtn);
    btnRow.appendChild(fileInput);

    // Додаємо все в секцію
    section.appendChild(sectionHeader);
    section.appendChild(btnRow);
    section.appendChild(imagesContainer);

    container.insertBefore(
      section,
      document.querySelector(".add-category-btn")
    );
  });

  const addCategoryBtn = document.querySelector(".add-category-btn");
  addCategoryBtn.onclick = async () => {
    data.items.push(["Нова категорія", []]);
    await updateItems(data.items);
  };
}

async function updateItems(items) {
  await fetch(`${API}/ritual_services/${ritualId}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${token}`,
    },
    body: JSON.stringify({ items }),
  });
  location.reload();
}

document
  .querySelector(".edit-description-btn")
  .addEventListener("click", () => {
    const p = document.querySelector(".ritual-description p.ritual-text");
    const textarea = document.querySelector(
      ".ritual-description textarea.ritual-text"
    );
    const button = document.querySelector(".edit-description-btn");

    if (p.style.display !== "none") {
      textarea.value = p.textContent;
      textarea.style.display = "block";
      p.style.display = "none";
      button.textContent = "Зберегти";
    } else {
      updateDescription(textarea.value);
    }
  });

async function updateDescription(newDescription) {
  const p = document.querySelector(".ritual-description p.ritual-text");
  const textarea = document.querySelector(
    ".ritual-description textarea.ritual-text"
  );
  const button = document.querySelector(".edit-description-btn");

  try {
    await fetch(`${API}/ritual_services/${ritualId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: newDescription }),
    });

    p.textContent = newDescription;
    p.style.display = "block";
    textarea.style.display = "none";
    button.textContent = "Змінити";
  } catch (e) {
    alert("Помилка при оновленні опису");
  }
}

document.addEventListener("click", (e) => {
  // Відкрити popup-меню
  if (e.target.closest(".dots-btn")) {
    const btn = e.target.closest(".dots-btn");
    const menu = btn.nextElementSibling;
    document.querySelectorAll(".popup-menu").forEach((m) => {
      if (m !== menu) m.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
  } else if (!e.target.closest(".popup-menu")) {
    document
      .querySelectorAll(".popup-menu")
      .forEach((m) => m.classList.add("hidden"));
  }

  // Змінити назву
  if (e.target.classList.contains("rename")) {
    const section = e.target.closest(".ritual-item-section");
    const h2 = section.querySelector("h2");
    openRenameModal(h2);
  }

  // Видалити
  if (e.target.classList.contains("delete")) {
    const section = e.target.closest(".ritual-item-section");
    const allSections = [...document.querySelectorAll(".ritual-item-section")];
    const index = allSections.indexOf(section);
    if (index > -1) {
      ritualData.items.splice(index, 1);
      updateItems(ritualData.items);
    }
  }
});

// Модалка
function openRenameModal(titleEl) {
  let modal = document.querySelector(".modal-overlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal-overlay";
    modal.innerHTML = `
        <div class="rename-modal">
          <h2>Змінити назву</h2>
          <input type="text" id="renameInput" />
          <div class="modal-actions">
            <button class="confirm-btn">Підтвердити</button>
            <button class="cancel-btn">Скасувати</button>
          </div>
        </div>
      `;
    document.body.appendChild(modal);
  }

  modal.querySelector("#renameInput").value = titleEl.textContent;
  modal.style.display = "flex";

  modal.querySelector(".confirm-btn").onclick = () => {
    titleEl.textContent = modal.querySelector("#renameInput").value.trim();
    modal.style.display = "none";
  };

  modal.querySelector(".cancel-btn").onclick = () => {
    modal.style.display = "none";
  };
}

fetchRitualService();
