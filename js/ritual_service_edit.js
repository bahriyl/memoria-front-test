const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
// const API = "http://0.0.0.0:5000/api"
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

const logoutBtn = document.querySelector(".ritual-login-btn");
if (logoutBtn) {
  logoutBtn.addEventListener("click", () => {
    localStorage.removeItem("token");
    window.location.href = `/ritual_service_profile.html?id=${ritualId}`;
  });
}

function normalizeItems(struct) {
  if (!Array.isArray(struct?.items)) return struct;
  struct.items = struct.items.map(([title, arr]) => {
    const albums = Array.isArray(arr)
      ? arr.map((x) => {
        if (typeof x === "string") return { photos: [x], description: "" };
        if (Array.isArray(x)) return { photos: x, description: "" };
        return {
          photos: Array.isArray(x?.photos) ? x.photos : [],
          description: (x?.description || "").toString(),
        };
      })
      : [];
    return [title, albums];
  });
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

async function uploadToImgBB(file) {
  const formData = new FormData();
  formData.append("image", file);
  const res = await fetch(
    `https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`,
    {
      method: "POST",
      body: formData,
    }
  );
  if (!res.ok) throw new Error(`IMGBB ${res.status}`);
  const json = await res.json();
  const url = json?.data?.url;
  if (!url) throw new Error("IMGBB: no url");
  return url;
}

function applyAbout(text) {
  const LINES = 4;
  const moreLabel = "більше";
  const lessLabel = "менше";
  const aboutEl = document.getElementById("ritual-text");

  aboutEl.innerHTML = "";

  if (!text) {
    const empty = document.createElement("div");
    empty.className = "description-empty";
    empty.textContent = "Немає опису";
    aboutEl.replaceWith(empty);
    return;
  }

  const textSpan = document.createElement("span");
  const nbsp = document.createTextNode("\u00A0");
  const toggle = document.createElement("span");
  toggle.className = "bio-toggle";
  toggle.setAttribute("role", "button");
  toggle.tabIndex = 0;

  const cs = getComputedStyle(aboutEl);
  const line = parseFloat(cs.lineHeight) || 1.5 * parseFloat(cs.fontSize) || 21;
  const maxH = Math.round(LINES * line);

  // Швидка гілка: текст вміщається — toggle не потрібен
  textSpan.textContent = text;
  aboutEl.appendChild(textSpan);
  if (aboutEl.clientHeight <= maxH + 1) {
    return;
  }

  // Вимірювач висоти для префікса
  function heightForPrefix(prefixLen) {
    aboutEl.innerHTML = "";
    textSpan.textContent = text.slice(0, prefixLen).trimEnd() + " …";
    toggle.textContent = moreLabel;
    aboutEl.append(textSpan, nbsp, toggle);
    return aboutEl.clientHeight;
  }

  // Бінарний пошук максимальної довжини, що вміщається у 4 рядки (з урахуванням toggle)
  let lo = 0,
    hi = text.length,
    best = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (heightForPrefix(mid) <= maxH + 1) {
      best = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }

  // Фінальна розмітка
  aboutEl.innerHTML = "";
  textSpan.textContent = text.slice(0, best).trimEnd() + " …";
  toggle.textContent = moreLabel;
  aboutEl.append(textSpan, document.createTextNode("\u00A0"), toggle);

  // Обробники
  let expanded = false;
  const expand = () => {
    expanded = true;
    aboutEl.innerHTML = "";
    textSpan.textContent = text + " ";
    toggle.textContent = lessLabel;
    aboutEl.append(textSpan, toggle);
  };
  const collapse = () => {
    expanded = false;
    applyAbout(text); // перерахунок і повернення toggle в кінець 4-го рядка
  };
  const onToggle = () => (expanded ? collapse() : expand());

  toggle.addEventListener("click", onToggle);
  toggle.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") {
      e.preventDefault();
      onToggle();
    }
  });
}

function renderData(data) {
  document.querySelector(".ritual-banner").src = data.banner;
  document.querySelector(".ritual-name").textContent = data.name;
  document.querySelector(".ritual-address").textContent = data.address;
  document.querySelector(".ritual-phone").textContent = `тел. ${data.phone}`;
  document.querySelector(".ritual-link-btn").href = data.link;
  document.querySelector(".ritual-link-text").textContent = data.link;

  applyAbout((data.description || "").trim());

  const container = document.querySelector(".ritual-container");
  container
    .querySelectorAll(".ritual-item-section")
    .forEach((el) => el.remove());

  data.items.forEach(([title, images], index) => {
    const section = document.createElement("section");
    section.className = "ritual-item-section";

    const albums = Array.isArray(images) ? images : [];
    const hasPhotos = albums.length > 0;

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
    ${hasPhotos ? '<div class="popup-option choose-photos">Вибрати</div>' : ""}
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
    fileInput.multiple = true;
    fileInput.style.display = "none";

    // If no photos — show "Добавити" button here; if has photos — keep row hidden (until selection mode)
    btnRow.style.display = "none";

    // === Images container (single row) ===
    const imagesContainer = document.createElement("div");
    imagesContainer.className = "item-images";

    function renderImages() {
      imagesContainer.innerHTML = "";

      if (albums.length === 1) {
        imagesContainer.className = "item-images single-image";
      } else if (albums.length > 1) {
        imagesContainer.className = "item-images multiple-images";
      } else {
        imagesContainer.className = "item-images";
      }

      albums.forEach((album) => {
        if (!album.photos?.length) return;
        const cover = album.photos[0];

        const wrap = document.createElement("div");
        wrap.className = "image-wrap";

        const img = document.createElement("img");
        img.src = cover;
        img.alt = title;
        img.className = "item-image";

        // little counter badge
        const counter = document.createElement("div");
        counter.className = "image-counter";
        counter.textContent = `${album.photos.length}`;

        const badge = document.createElement("span");
        badge.className = "select-badge";

        wrap.addEventListener("click", (e) => {
          e.preventDefault();

          if (isSelecting) {
            // select / deselect this tile
            toggleSelect(wrap);
            return;
          }

          // normal behavior: open slideshow
          const captions = album.photos.map(() => album.description || "");
          openSlideshow(album.photos, 0, captions);
        });

        wrap.append(img, badge, counter);
        imagesContainer.appendChild(wrap);
      });

      const totalAlbums = albums.length;

      if (totalAlbums <= 5) {
        imagesContainer.classList.add("one-row");
        imagesContainer.classList.remove("two-rows");
      } else {
        imagesContainer.classList.add("two-rows");
        imagesContainer.classList.remove("one-row");
      }
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
        if (selectedOrder.length === 0) {
          exitSelectionMode();
          return;
        }
        const toRemove = new Set(
          selectedOrder.map((w) => w.querySelector("img").src)
        );
        ritualData.items[index][1] = ritualData.items[index][1].filter(
          (album) => {
            const cover = album?.photos?.[0];
            return !toRemove.has(cover);
          }
        );
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
    // ==== ADD PHOTOS HANDLER with Album/Photo modal ====
    fileInput.addEventListener("change", async (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      // local previews & temp captions
      const previews = files.map(f => URL.createObjectURL(f));
      const tempCaptions = new Array(previews.length).fill("");

      // modal elements (global, one per page)
      const overlay = document.getElementById("modal-overlay");
      const dlg = document.getElementById("photo-desc-modal");
      const closeX = document.getElementById("photo-desc-close");
      const thumbsEl = document.getElementById("photo-desc-thumbs");
      const textEl = document.getElementById("photo-desc-text");
      const countEl = document.getElementById("photo-desc-count");
      const okBtn = document.getElementById("photo-desc-add");
      const modeAlbum = document.getElementById("mode-album");
      const modePhoto = document.getElementById("mode-photo");

      let sel = 0;
      let confirmed = false;

      function commitCurrent() {
        // зберігаємо textarea у підпис поточного прев’ю
        if (!previews.length) return;
        tempCaptions[sel] = (textEl.value || "").trim();
      }

      function renderThumbs(disabled) {
        thumbsEl.innerHTML = "";
        previews.forEach((src, i) => {
          const wrap = document.createElement("div");
          wrap.className = "photo-desc-thumb" + (i === sel ? " is-selected" : "");
          wrap.innerHTML = `
        <img src="${src}" alt="">
        <button class="thumb-x" data-i="${i}" ${disabled ? "disabled" : ""}>
          <svg width="18" height="18" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" fill="none">
            <line x1="18" y1="6" x2="6" y2="18"></line>
            <line x1="6" y1="6" x2="18" y2="18"></line>
          </svg>
        </button>`;
          if (!disabled) {
            wrap.addEventListener("click", (ev) => {
              if (ev.target.closest(".thumb-x")) return;
              commitCurrent();
              sel = i;
              renderThumbs(false);
              textEl.value = tempCaptions[sel] || "";
            });
          }
          thumbsEl.appendChild(wrap);
        });
        countEl.textContent = String(previews.length);
      }

      // delete via X (event delegation)
      thumbsEl.onclick = (ev) => {
        const btn = ev.target.closest('.thumb-x');
        if (!btn) return;
        // у режимі "Альбом" за задумом видалення відключене
        if (modeAlbum.checked) return;

        const i = Number(btn.dataset.i);

        // зберігаємо поточний опис перед модифікацією масивів
        commitCurrent();

        // прибираємо blob preview
        try { URL.revokeObjectURL(previews[i]); } catch { }

        // ⚠️ ВАЖЛИВО: видаляємо з УСІХ локальних масивів
        previews.splice(i, 1);
        tempCaptions.splice(i, 1);
        files.splice(i, 1);            // ← тепер файл точно не завантажиться

        // підлаштовуємо індекс вибраного
        if (sel >= previews.length) sel = Math.max(0, previews.length - 1);

        // якщо нічого не лишилось — закриваємо модал
        if (previews.length === 0) {
          closeModal();
          return;
        }

        // перемальовуємо прев’ю і відновлюємо textarea для поточного sel
        renderThumbs(false);
        textEl.value = tempCaptions[sel] || '';
      };

      function openModal() { overlay.hidden = false; dlg.hidden = false; }
      function closeModal() { overlay.hidden = true; dlg.hidden = true; }

      // switch UI by mode (album/photo)
      function applyModeUI() {
        if (modeAlbum.checked) {
          // в режимі "Альбом" вибір фото не потрібен — всі мають один опис
          renderThumbs(true);                   // без кліків і видалення
          sel = 0;
          // показуємо 1 textarea (загальний опис), підставляємо перший збережений або порожній
          textEl.value = tempCaptions[0] || "";
        } else {
          // "Фото" — індивідуальні описи
          renderThumbs(false);
          textEl.value = tempCaptions[sel] || "";
        }
      }

      modeAlbum.addEventListener("change", applyModeUI);
      modePhoto.addEventListener("change", applyModeUI);

      // open modal
      openModal();
      applyModeUI();

      closeX.onclick = () => { closeModal(); };
      overlay.addEventListener("click", closeModal, { once: true });

      okBtn.onclick = () => {
        // перед закриттям зберігаємо поточне
        commitCurrent();
        confirmed = true;
        closeModal();
      };

      // wait until closed
      await new Promise((r) => {
        const iv = setInterval(() => { if (dlg.hidden) { clearInterval(iv); r(); } }, 60);
      });

      if (!confirmed || previews.length === 0) {
        // cleanup previews
        previews.forEach(p => { try { URL.revokeObjectURL(p); } catch { } });
        e.target.value = "";
        return;
      }

      // === UPLOAD ===
      async function uploadToImgBB(file) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const json = await res.json();
        if (!json?.success) throw new Error("IMGBB upload failed");
        return json.data.url;
      }

      // albums — масив альбомів у поточній категорії
      // Кожен альбом: { photos: [urls], description: "" }
      try {
        if (modeAlbum.checked) {
          // 1 альбом з N фото і ОДНИМ описом
          const urls = [];
          for (let i = 0; i < files.length; i++) {
            const u = await uploadToImgBB(files[i]);
            urls.push(u);
          }
          const commonDesc = (tempCaptions[0] || "").trim();
          albums.push({ photos: urls, description: commonDesc });
        } else {
          // Кожне фото — окремий альбом (1 фото в альбомі) зі СВОЇМ описом
          for (let i = 0; i < files.length; i++) {
            const u = await uploadToImgBB(files[i]);
            const d = (tempCaptions[i] || "").trim();
            albums.push({ photos: [u], description: d });
          }
        }

        // оновлюємо розділ
        renderImages();

        // зберігаємо на бек
        await updateItems(ritualData.items);
      } catch (err) {
        console.error("Upload failed", err);
        alert("Не вдалося завантажити фото");
      } finally {
        previews.forEach(p => { try { URL.revokeObjectURL(p); } catch { } });
        e.target.value = "";
      }
    });

    // === Add everything into section ===
    section.appendChild(sectionHeader);
    section.appendChild(btnRow);
    section.appendChild(fileInput);

    if (!hasPhotos) {
      const empty = document.createElement("div");
      empty.className = "photos-empty";
      empty.textContent = "Немає фотографій";
      section.appendChild(empty);
    } else {
      section.appendChild(imagesContainer);
    }

    container.insertBefore(
      section,
      document.querySelector(".add-category-btn")
    );
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
  textarea.value = (ritualData?.description || "").toString();
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
  section.insertBefore(row, textarea);

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
  const p = document.querySelector(".ritual-description p.ritual-text");
  const textarea = document.querySelector(
    ".ritual-description textarea.ritual-text"
  );

  try {
    const res = await fetch(`${API}/ritual_services/${ritualId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${token}`,
      },
      body: JSON.stringify({ description: newDescription }),
    });
    if (!res.ok) throw new Error(await res.text());

    // оновлюємо джерело правди в пам’яті
    ritualData.description = newDescription;

    applyAbout((newDescription || "").trim());

    p.style.display = "block";
    textarea.style.display = "none";
  } catch (e) {
    console.error(e);
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
    document
      .querySelectorAll(".popup-menu")
      .forEach((m) => m.classList.add("hidden"));
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

  const close = () => {
    modal.style.display = "none";
  };

  // Close handlers
  modal.querySelector(".cancel-btn").onclick = close;
  modal.addEventListener("click", (e) => {
    if (e.target === modal) close();
  });
  document.addEventListener("keydown", function escClose(ev) {
    if (ev.key === "Escape") {
      close();
      document.removeEventListener("keydown", escClose);
    }
  });

  // Create category
  modal.querySelector(".confirm-btn").onclick = async () => {
    const title = (input.value || "").trim();
    if (!title) {
      input.focus();
      return;
    }
    ritualData.items.push([title, []]); // add empty category with the given name
    close();
    await updateItems(ritualData.items); // saves and reloads
  };
}

function openSlideshow(images, startIndex = 0, captions = []) {
  const modal = document.createElement("div");
  modal.className = "slideshow-modal";

  const closeBtnX = document.createElement("span");
  closeBtnX.textContent = "✕";
  closeBtnX.className = "close-slideshow";
  closeBtnX.onclick = () => {
    document.body.style.overflow = ""; // restore scroll
    document.body.removeChild(modal);
  };

  const track = document.createElement("div");
  track.className = "slideshow-track";

  images.forEach((url, i) => {
    const slide = document.createElement("div");
    slide.className = "slideshow-slide";

    const img = document.createElement("img");
    img.src = url;
    img.className = "slideshow-img";
    slide.appendChild(img);

    // Optional caption
    const text = Array.isArray(captions) ? captions[i] || "" : captions || "";
    if (text && text.trim()) {
      const cap = document.createElement("div");
      cap.className = "slideshow-caption";

      const span = document.createElement("span");
      span.className = "caption-text";
      span.textContent = text;

      const toggle = document.createElement("button");
      toggle.type = "button";
      toggle.className = "caption-toggle";
      toggle.textContent = "… більше";

      cap.append(span, toggle);
      slide.appendChild(cap);

      // Show "… більше" only if text overflows
      requestAnimationFrame(() => {
        const overflowing = span.scrollHeight > span.clientHeight + 1;
        if (overflowing) {
          cap.classList.add("has-toggle");
          toggle.addEventListener("click", () => {
            const expanded = cap.classList.toggle("expanded");
            toggle.textContent = expanded ? "менше" : "… більше";
          });
        } else {
          toggle.remove();
        }
      });
    }

    track.appendChild(slide);
  });

  // Dots
  const indicator = document.createElement("div");
  indicator.className = "slideshow-indicators";
  images.forEach((_, idx) => {
    const dot = document.createElement("span");
    dot.className = "slideshow-indicator";
    dot.addEventListener("click", () => changeSlide(idx));
    indicator.appendChild(dot);
  });

  function updateIndicators(index) {
    indicator
      .querySelectorAll(".slideshow-indicator")
      .forEach((dot, i) => dot.classList.toggle("active", i === index));
  }
  function changeSlide(newIndex) {
    const slides = track.querySelectorAll(".slideshow-slide");
    if (slides[newIndex]) {
      slides[newIndex].scrollIntoView({ behavior: "smooth", inline: "center" });
    }
  }
  track.addEventListener("scroll", () => {
    const slideWidth = track.clientWidth;
    const index = Math.round(track.scrollLeft / slideWidth);
    updateIndicators(index);
  });

  modal.append(closeBtnX, track, indicator);
  document.body.appendChild(modal);
  document.body.style.overflow = "hidden"; // prevent background scroll

  requestAnimationFrame(() => {
    changeSlide(startIndex);
    updateIndicators(startIndex);
  });
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
