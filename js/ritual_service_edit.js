const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
const IMGBB_API_KEY = "726ae764867cf6b3a259967071cbdd80";

const urlParams = new URLSearchParams(window.location.search);
const ritualId = urlParams.get("id");
let token = urlParams.get("token") || localStorage.getItem("token");
if (urlParams.get("token")) {
  // persist token if it was passed once in the URL
  localStorage.setItem("token", token);
}

let ritualData = null;

if (!ritualId) {
  alert("Відсутній ID сервісу.");
  window.location.href = "/ritual_services.html";
}
if (!token) {
  // no token → go to public profile where user can log in
  window.location.href = `/ritual_service_profile.html?id=${ritualId}`;
}

const logoutBtn = document.querySelector(".ritual-edit-label");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = `/ritual_service_profile.html?id=${ritualId}`;
  });
}

function normalizeItems(struct) {
  if (!Array.isArray(struct?.items)) return struct;
  struct.items = struct.items.map(([title, imgs]) => [title, Array.isArray(imgs) ? imgs : []]);
  return struct;
}

async function fetchRitualService() {
  try {
    const res = await fetch(`${API}/ritual_services/${ritualId}`);
    const data = await res.json();
    ritualData = normalizeItems(data); // <-- normalize to ensure arrays
    renderData(ritualData);
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
  const textarea = document.querySelector(".ritual-description textarea.ritual-text");
  p.textContent = data.description;
  p.style.display = "block";
  textarea.style.display = "none";

  const container = document.querySelector(".ritual-container");
  container.querySelectorAll(".ritual-item-section").forEach((el) => el.remove());

  data.items.forEach(([title, images], index) => {
    const section = document.createElement("section");
    section.className = "ritual-item-section";

    const hasPhotos = Array.isArray(images) && images.length > 0;

    // === Header (title + dots + popup) ===
    const sectionHeader = document.createElement("div");
    sectionHeader.className = "section-header";

    const heading = document.createElement("h2");
    heading.className = "item-title";
    heading.textContent = title;

    const dotsBtn = document.createElement("button");
    dotsBtn.className = "dots-btn";
    dotsBtn.innerHTML = `
      <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="#585858" viewBox="0 0 24 24">
        <circle cx="12" cy="5" r="2"></circle>
        <circle cx="12" cy="12" r="2"></circle>
        <circle cx="12" cy="19" r="2"></circle>
      </svg>
    `;

    const popupMenu = document.createElement("div");
    popupMenu.className = "popup-menu hidden";
    popupMenu.innerHTML = `
    <div class="popup-option add-photo">Добавити фото</div>
    ${hasPhotos ? '<div class="popup-option choose-photos">Вибрати</div>' : ''}
    <div class="popup-option rename">Змінити назву</div>
    <div class="popup-option delete">Видалити категорію</div>
  `;

    sectionHeader.append(heading, dotsBtn, popupMenu);

    // === Actions row (used in selection mode, or “Добавити” when empty) ===
    const btnRow = document.createElement("div");
    btnRow.className = "ritual-btn-row";

    // Hidden file input for "Добавити"
    const fileInput = document.createElement("input");
    fileInput.type = "file";
    fileInput.accept = "image/*";
    fileInput.style.display = "none";

    // If no photos — show "Добавити" button here; if has photos — keep row hidden (until selection mode)
    btnRow.style.display = "none";

    // === Images container (single row) ===
    const imagesContainer = document.createElement("div");
    imagesContainer.className = "item-images";

    function renderImages() {
      imagesContainer.innerHTML = "";

      // Add appropriate class based on number of images
      if (images && images.length === 1) {
        imagesContainer.className = "item-images single-image";
      } else if (images && images.length > 1) {
        imagesContainer.className = "item-images multiple-images";
      } else {
        imagesContainer.className = "item-images";
      }

      (images || []).forEach((url) => {
        const wrap = document.createElement("div");
        wrap.className = "image-wrap";

        const img = document.createElement("img");
        img.src = url;
        img.alt = title;
        img.className = "item-image";

        const badge = document.createElement("span");
        badge.className = "select-badge";

        img.addEventListener("click", () => {
          if (!isSelecting) return;
          toggleSelect(wrap);
        });

        wrap.append(img, badge);
        imagesContainer.appendChild(wrap);
      });
    }
    if (hasPhotos) renderImages();

    // === Selection mode logic (only meaningful when hasPhotos) ===
    let isSelecting = false;
    let selectedOrder = []; // array of .image-wrap in selection order

    function updateBadges() {
      const wraps = [...imagesContainer.querySelectorAll(".image-wrap")];
      wraps.forEach((w) => {
        const idx = selectedOrder.indexOf(w);
        w.classList.toggle("is-selected", idx !== -1);
        const badge = w.querySelector(".select-badge");
        badge.textContent = idx === -1 ? "" : String(idx + 1);
      });
    }

    function updateDeleteButton() {
      const delBtn = btnRow.querySelector(".delete-btn");
      if (delBtn) delBtn.textContent = `Видалити (${selectedOrder.length})`;
    }

    function toggleSelect(wrap) {
      const i = selectedOrder.indexOf(wrap);
      if (i === -1) selectedOrder.push(wrap);
      else selectedOrder.splice(i, 1);
      updateBadges();
      updateDeleteButton();
    }

    function enterSelectionMode() {
      if (isSelecting) return;
      isSelecting = true;
      section.classList.add("selection-mode");
      btnRow.innerHTML = "";

      const cancelBtn = document.createElement("button");
      cancelBtn.type = "button";
      cancelBtn.className = "ritual-btn";
      cancelBtn.textContent = "Скасувати";

      const deleteBtn = document.createElement("button");
      deleteBtn.type = "button";
      deleteBtn.className = "ritual-btn ritual-btn--danger delete-btn";
      deleteBtn.textContent = "Видалити (0)";

      btnRow.append(cancelBtn, deleteBtn);

      cancelBtn.addEventListener("click", exitSelectionMode);
      deleteBtn.addEventListener("click", async () => {
        if (selectedOrder.length === 0) { exitSelectionMode(); return; }
        const toRemove = new Set(selectedOrder.map(w => w.querySelector("img").src));
        ritualData.items[index][1] = ritualData.items[index][1].filter(u => !toRemove.has(u));
        await updateItems(ritualData.items);
      });

      updateBadges();
      updateDeleteButton();
    }

    function exitSelectionMode() {
      isSelecting = false;
      selectedOrder = [];
      section.classList.remove("selection-mode");
      btnRow.innerHTML = ""; // row hides again via CSS
      updateBadges();
    }

    // === Popup actions (bound per-section) ===
    // Add is present in popup only when hasPhotos
    const addInPopup = popupMenu.querySelector(".add-photo");
    if (addInPopup) {
      addInPopup.addEventListener("click", () => {
        popupMenu.classList.add("hidden");
        fileInput.click();
      });
    }

    const chooseInPopup = popupMenu.querySelector(".choose-photos");
    if (chooseInPopup) {
      chooseInPopup.addEventListener("click", () => {
        popupMenu.classList.add("hidden");
        enterSelectionMode();
      });
    }

    // Upload handler
    // --- in renderData(...) inside fileInput.change handler, make the push safe and verbose ---
    fileInput.addEventListener("change", async (e) => {
      const file = e.target.files?.[0];
      if (!file) return;

      try {
        // optional client checks
        const maxMb = 20;
        if (file.size > maxMb * 1024 * 1024) {
          alert(`Файл завеликий. Ліміт ${maxMb} MB.`);
          return;
        }
        if (!file.type.startsWith("image/")) {
          alert("Оберіть файл зображення.");
          return;
        }

        const formData = new FormData();
        formData.append("image", file);

        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
          method: "POST",
          body: formData,
        });

        // ✅ check status *before* parsing JSON
        if (!res.ok) {
          let msg = `IMGBB ${res.status}`;
          try {
            const maybeJson = await res.json();
            msg = maybeJson?.error?.message || msg;
          } catch {
            const txt = await res.text();
            if (txt) msg += `: ${txt.slice(0, 140)}…`;
          }
          alert(`Не вдалось завантажити зображення на imgbb. ${msg}`);
          return;
        }

        // now it's safe to parse JSON
        const result = await res.json();
        const imageUrl = result?.data?.url;
        if (!imageUrl) {
          console.error("IMGBB unexpected response:", result);
          alert("Не вдалось отримати URL зображення від imgbb.");
          return;
        }

        // make sure the array exists, then push
        if (!Array.isArray(ritualData.items[index][1])) ritualData.items[index][1] = [];
        ritualData.items[index][1].push(imageUrl);

        await updateItems(ritualData.items); // will reload on success
      } catch (err) {
        console.error("Upload error:", err);
        alert("Сталася помилка під час завантаження зображення.");
      } finally {
        e.target.value = ""; // allow selecting the same file again
      }
    });

    // === Add everything into section ===
    section.appendChild(sectionHeader);
    section.appendChild(btnRow);
    section.appendChild(fileInput);

    if (!hasPhotos) {
      const emptyText = document.createElement("div");
      emptyText.className = "no-photos-text";
      emptyText.textContent = "Немає фотографій. Будь ласка, поділіться спогадами";
      section.appendChild(emptyText);
    } else {
      section.appendChild(imagesContainer);
    }

    container.insertBefore(section, document.querySelector(".add-category-btn"));
  });

  const addCategoryBtn = document.querySelector(".add-category-btn");
  addCategoryBtn.onclick = () => openAddCategoryModal();
}

// --- make updateItems() report server errors clearly ---
async function updateItems(items) {
  try {
    const res = await fetch(`${API}/ritual_services/${ritualId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ items }),
    });
    if (!res.ok) {
      const t = await res.text();
      throw new Error(`Save failed ${res.status}: ${t}`);
    }
    location.reload();
  } catch (err) {
    console.error(err);
    alert("Не вдалося зберегти фото. Перевірте токен доступу та мережу.");
  }
}

function openDescriptionEditor() {
  const section = document.querySelector(".ritual-description");
  const p = section.querySelector("p.ritual-text");
  const textarea = section.querySelector("textarea.ritual-text");

  // показуємо textarea
  textarea.value = p.textContent || "";
  textarea.style.display = "block";
  p.style.display = "none";

  // ряд дій під описом
  let row = section.querySelector(".desc-actions");
  if (row) row.remove();
  row = document.createElement("div");
  row.className = "ritual-btn-row desc-actions";

  const cancelBtn = document.createElement("button");
  cancelBtn.className = "ritual-btn";
  cancelBtn.textContent = "Скасувати";

  const saveBtn = document.createElement("button");
  saveBtn.className = "ritual-btn";
  saveBtn.textContent = "Зберегти";

  row.append(cancelBtn, saveBtn);
  section.appendChild(row);

  cancelBtn.addEventListener("click", () => {
    textarea.style.display = "none";
    p.style.display = "block";
    row.remove();
  });

  saveBtn.addEventListener("click", async () => {
    await updateDescription(textarea.value);
    row.remove();
  });
}

async function updateDescription(newDescription) {
  const section = document.querySelector(".ritual-description");
  const p = section.querySelector("p.ritual-text");
  const textarea = section.querySelector("textarea.ritual-text");

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
  } catch (e) {
    alert("Помилка при оновленні опису");
  }
}

async function updateDescription(newDescription) {
  const p = document.querySelector(".ritual-description p.ritual-text");
  const textarea = document.querySelector(".ritual-description textarea.ritual-text");
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

// Global popup open/close + rename/delete (category-level)
document.addEventListener("click", (e) => {
  // Open/close popup menu near dots
  if (e.target.closest(".dots-btn")) {
    const btn = e.target.closest(".dots-btn");
    const menu = btn.nextElementSibling; // .popup-menu
    document.querySelectorAll(".popup-menu").forEach((m) => {
      if (m !== menu) m.classList.add("hidden");
    });
    menu.classList.toggle("hidden");
    return;
  }

  // Відкрити редактор опису з попап-меню опису
  if (e.target.classList.contains("edit-description")) {
    // сховати це меню
    const m = e.target.closest(".popup-menu");
    if (m) m.classList.add("hidden");
    openDescriptionEditor();
  }

  // Clicked outside any popup → close all
  if (!e.target.closest(".popup-menu")) {
    document.querySelectorAll(".popup-menu").forEach((m) => m.classList.add("hidden"));
  }

  // Rename category (handled globally so we can reuse modal)
  if (e.target.classList.contains("rename")) {
    const section = e.target.closest(".ritual-item-section");
    const h2 = section.querySelector("h2");
    openRenameModal(h2);
  }

  // Delete category
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

// Rename modal (kept as in your version)
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

function openAddCategoryModal() {
  let modal = document.querySelector(".modal-overlay");
  if (!modal) {
    modal = document.createElement("div");
    modal.className = "modal-overlay";
    document.body.appendChild(modal);
  }

  modal.innerHTML = `
    <div class="rename-modal">
      <h2>Нова категорія</h2>
      <input type="text" id="newCatInput" placeholder="Введіть назву категорії" />
      <div class="modal-actions">
        <button class="confirm-btn">Створити</button>
        <button class="cancel-btn">Скасувати</button>
      </div>
    </div>
  `;
  modal.style.display = "flex";

  const input = modal.querySelector("#newCatInput");
  input.focus();

  const close = () => { modal.style.display = "none"; };

  // Close handlers
  modal.querySelector(".cancel-btn").onclick = close;
  modal.addEventListener("click", (e) => { if (e.target === modal) close(); });
  document.addEventListener("keydown", function escClose(ev) {
    if (ev.key === "Escape") { close(); document.removeEventListener("keydown", escClose); }
  });

  // Create category
  modal.querySelector(".confirm-btn").onclick = async () => {
    const title = (input.value || "").trim();
    if (!title) { input.focus(); return; }
    ritualData.items.push([title, []]);      // add empty category with the given name
    close();
    await updateItems(ritualData.items);     // saves and reloads
  };
}

// Select the back button
const backBtn = document.querySelector(".ritual-back-btn");

if (backBtn) {
  backBtn.addEventListener("click", () => {
    // Redirect to ritual services list page
    window.location.href = "/ritual_services.html";
  });
}

fetchRitualService();
