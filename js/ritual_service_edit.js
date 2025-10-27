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

function parseJwt(t) {
  try {
    const b64 = t.split(".")[1] || "";
    const b64url = b64.replace(/-/g, "+").replace(/_/g, "/");
    const pad = "=".repeat((4 - (b64url.length % 4)) % 4);
    return JSON.parse(atob(b64url + pad));
  } catch {
    return {};
  }
}

function doLogout() {
  localStorage.removeItem("token");
  window.location.href = `/ritual_service_profile.html?id=${ritualId}`;
}

let __logoutTimer;
function scheduleLogout(expSeconds) {
  clearTimeout(__logoutTimer);
  const ms = expSeconds * 1000 - Date.now();
  if (ms <= 0) return doLogout();
  __logoutTimer = setTimeout(doLogout, ms);
}

// Decode token once on load and schedule logout if exp exists
(() => {
  if (!token) return;
  const { exp } = parseJwt(token);
  if (exp) {
    if (exp * 1000 <= Date.now()) return doLogout();
    scheduleLogout(exp);
  }
})();

// Fallback: if exp couldn't be parsed, ask backend to verify and 401 → logout
(async () => {
  const t = localStorage.getItem("token");
  if (!t) return;
  const { exp } = parseJwt(t) || {};
  if (typeof exp === "number") return; // already handled
  try {
    const res = await fetch(`${API}/ritual_services/verify_token`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token: t })
    });
    if (!res.ok) doLogout();
  } catch {
    doLogout();
  }
})();

// Wrap fetch to always attach Authorization and auto-logout on 401/403
async function fetchWithAuth(url, opts = {}) {
  const t = localStorage.getItem("token");
  const headers = { ...(opts.headers || {}) };
  if (t) headers.Authorization = `Bearer ${t}`;
  const res = await fetch(url, { ...opts, headers });
  if (res.status === 401 || res.status === 403) {
    doLogout(); // token missing/expired/invalid → logout immediately
    throw new Error("Unauthorized");
  }
  return res;
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

function renderJointContacts(addressEl, phoneEl, rawAddresses, rawPhones) {
  const toList = v => Array.isArray(v)
    ? v.map(String).map(s => s.trim()).filter(Boolean)
    : (v ? [String(v).trim()] : []);
  const joiner = "\n";

  const addresses = toList(rawAddresses);
  const phones = toList(rawPhones);

  let addressText = addressEl.querySelector(".contacts-address-text");
  if (!addressText) {
    addressEl.textContent = "";
    addressText = document.createElement("span");
    addressText.className = "contacts-address-text";
    addressEl.appendChild(addressText);
  }

  let phoneText = phoneEl.querySelector(".contacts-phone-text");
  if (!phoneText) {
    phoneEl.textContent = "";
    phoneText = document.createElement("span");
    phoneText.className = "contacts-phone-text";
    phoneEl.appendChild(phoneText);
  }

  let btn = phoneEl.querySelector(".joint-toggle");
  if (!btn) {
    btn = document.createElement("button");
    btn.type = "button";
    btn.className = "bio-toggle joint-toggle";
    btn.textContent = "... більше";
    phoneEl.appendChild(document.createTextNode(" "));
    phoneEl.appendChild(btn);
  }

  const hasMore = (addresses.length > 1) || (phones.length > 1);

  // helper: A1, B1, A2, B2, ...
  const makeInterleaved = (A, B) => {
    const n = Math.max(A.length, B.length);
    const out = [];
    for (let i = 0; i < n; i++) {
      if (A[i]) out.push(A[i]);
      if (B[i]) out.push(B[i]);
    }
    return out;
  };

  let expanded = false;

  const collapse = () => {
    expanded = false;
    // compact: show first address + first phone (as before)
    addressText.textContent = addresses[0] || "";
    phoneText.textContent = phones[0] || "";
    if (hasMore) {
      btn.textContent = "... більше";
      btn.setAttribute("aria-expanded", "false");
    } else {
      btn.remove();
    }
  };

  const expand = () => {
    expanded = true;
    // expanded: interleave lines into address block, clear phone text
    const lines = makeInterleaved(addresses, phones);
    addressText.textContent = lines.join(joiner);
    phoneText.textContent = ""; // avoid duplicated content
    btn.textContent = "... менше";
    btn.setAttribute("aria-expanded", "true");
  };

  if (hasMore) {
    btn.onclick = () => (expanded ? collapse() : expand());
    btn.onkeydown = (e) => {
      if (e.key === "Enter" || e.key === " ") { e.preventDefault(); btn.click(); }
    };
    collapse(); // start collapsed
  } else {
    btn.remove();
    addressText.textContent = addresses[0] || "";
    phoneText.textContent = phones[0] || "";
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
  const createToggle = (label = "більше") => {
    const t = document.createElement("span");
    t.className = "bio-toggle";
    t.setAttribute("role", "button");
    t.tabIndex = 0;
    t.textContent = label;
    return t;
  };

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
    aboutEl.classList.add("__measure");
    aboutEl.innerHTML = "";
    const s = document.createElement("span");
    s.textContent = text.slice(0, prefixLen).trimEnd() + " … ";
    s.appendChild(createToggle()); // toggle inside the same span
    aboutEl.appendChild(s);
    const h = aboutEl.clientHeight;
    aboutEl.innerHTML = "";
    aboutEl.classList.remove("__measure");
    return h;
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
  const toggle = createToggle(moreLabel);
  textSpan.textContent = text.slice(0, best).trimEnd() + " … ";
  toggle.textContent = moreLabel;
  textSpan.appendChild(toggle);
  aboutEl.innerHTML = "";
  aboutEl.appendChild(textSpan);

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

document.addEventListener("visibilitychange", () => {
  if (document.hidden) return;
  const t = localStorage.getItem("token");
  if (!t) return;
  const { exp } = parseJwt(t) || {};
  if (exp) {
    if (exp * 1000 <= Date.now()) return doLogout();
    scheduleLogout(exp);
  }
});

function renderData(data) {
  document.querySelector(".ritual-banner").src = data.banner;
  document.querySelector(".ritual-name").textContent = data.name;
  document.querySelector(".ritual-link-btn").href = data.link;
  document.querySelector(".ritual-link-text").textContent = data.link;
  const addressEl = document.querySelector(".ritual-address");
  const phoneEl = document.querySelector(".ritual-phone");

  renderJointContacts(addressEl, phoneEl, data.address, data.phone);

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
    let canReorder = false;

    // Replace the drag'n'drop section in your renderImages() function:

    function renderImages() {
      imagesContainer.innerHTML = "";
      canReorder = albums.length > 1;

      if (albums.length === 1) {
        imagesContainer.className = "item-images single-image";
      } else if (albums.length > 1) {
        imagesContainer.className = "item-images multiple-images";
      } else {
        imagesContainer.className = "item-images";
      }

      albums.forEach((album, albumIdx) => {
        if (!album.photos?.length) return;
        const cover = album.photos[0];

        const wrap = document.createElement("div");
        wrap.className = "image-wrap";
        wrap.dataset.idx = String(albumIdx);
        wrap.draggable = canReorder;

        const handle = document.createElement("button");
        handle.type = "button";
        handle.className = "drag-handle";
        handle.title = "Перетягнути для зміни порядку";
        handle.innerHTML = `
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#333" stroke-width="2" stroke-linecap="round">
            <circle cx="7" cy="6" r="1.5"></circle><circle cx="12" cy="6" r="1.5"></circle><circle cx="17" cy="6" r="1.5"></circle>
            <circle cx="7" cy="12" r="1.5"></circle><circle cx="12" cy="12" r="1.5"></circle><circle cx="17" cy="12" r="1.5"></circle>
            <circle cx="7" cy="18" r="1.5"></circle><circle cx="12" cy="18" r="1.5"></circle><circle cx="17" cy="18" r="1.5"></circle>
          </svg>
        `;

        const img = document.createElement("img");
        img.src = cover;
        img.alt = title;
        img.className = "item-image";

        // DRAG START: only works if started from handle
        wrap.addEventListener("dragstart", (e) => {
          if (!canReorder) {
            e.preventDefault();
            return;
          }

          // Check if drag started from handle area
          const handleRect = handle.getBoundingClientRect();
          const x = e.clientX;
          const y = e.clientY;
          const fromHandle = (
            x >= handleRect.left && x <= handleRect.right &&
            y >= handleRect.top && y <= handleRect.bottom
          );

          if (!fromHandle) {
            e.preventDefault();
            return;
          }

          try {
            e.dataTransfer.setData("text/plain", wrap.dataset.idx || "");
          } catch { }
          e.dataTransfer.effectAllowed = "move";
          wrap.classList.add("dragging");
        });

        // DRAG END: reorder and save
        wrap.addEventListener("dragend", async () => {
          wrap.classList.remove("dragging");

          const newOrderWraps = [...imagesContainer.querySelectorAll(".image-wrap")];
          const newAlbums = newOrderWraps.map(w => albums[Number(w.dataset.idx)]);
          albums.splice(0, albums.length, ...newAlbums);

          [...imagesContainer.querySelectorAll(".image-wrap")].forEach((w, i) => {
            w.dataset.idx = String(i);
          });

          await updateItems(ritualData.items);
        });

        // Image counter badge
        if (album.photos.length > 1) {
          const counter = document.createElement("div");
          counter.className = "image-counter";
          counter.textContent = String(album.photos.length);
          wrap.appendChild(counter);
        }

        const badge = document.createElement("span");
        badge.className = "select-badge";

        wrap.addEventListener("click", (e) => {
          e.preventDefault();
          if (isSelecting) {
            toggleSelect(wrap);
            return;
          }
          const captions = album.photos.map(() => album.description || "");
          openSlideshow(album.photos, 0, captions);
        });

        wrap.append(handle, img, badge);
        imagesContainer.appendChild(wrap);
      });

      // Grid layout
      const totalAlbums = albums.length;
      if (totalAlbums <= 5) {
        imagesContainer.classList.add("one-row");
        imagesContainer.classList.remove("two-rows");
      } else {
        imagesContainer.classList.add("two-rows");
        imagesContainer.classList.remove("one-row");
      }
    }

    // DRAGOVER handler (attach once to container, outside renderImages)
    // Place this code AFTER the renderImages() function definition:

    imagesContainer.addEventListener("dragover", (e) => {
      if (!canReorder) return;
      e.preventDefault();

      const dragging = imagesContainer.querySelector(".dragging");
      if (!dragging) return;

      const afterEl = getAfterElement(imagesContainer, e.clientX);
      if (afterEl == null) {
        imagesContainer.appendChild(dragging);
      } else {
        imagesContainer.insertBefore(dragging, afterEl);
      }
    });
    imagesContainer.addEventListener("drop", (e) => {
      if (!canReorder) return;
      e.preventDefault();
    });

    function getAfterElement(container, x) {
      const els = [...container.querySelectorAll(".image-wrap:not(.dragging)")];
      let closest = { offset: Number.NEGATIVE_INFINITY, element: null };
      for (const child of els) {
        const box = child.getBoundingClientRect();
        const offset = x - (box.left + box.width / 2);
        if (offset < 0 && offset > closest.offset) {
          closest = { offset, element: child };
        }
      }
      return closest.element;
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

      imagesContainer.querySelectorAll(".image-wrap").forEach(w => {
        w.draggable = canReorder;
      });

      // Clear buttons row and rebuild controls
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
        const selected = Array.from(imagesContainer.querySelectorAll(".image-wrap.selected"));
        if (!selected.length) return;

        const modal = createConfirmModal(
          `Видалити ${selected.length} елемент${selected.length > 1 ? "и" : ""}?`
        );
        document.body.appendChild(modal);
        modal.showModal();

        const confirmed = await new Promise(resolve => {
          modal.querySelector(".confirm").addEventListener("click", () => resolve(true));
          modal.querySelector(".cancel").addEventListener("click", () => resolve(false));
        });
        modal.close();
        modal.remove();

        if (!confirmed) return;

        selected.forEach(el => el.remove());
        updateBadges();
        exitSelectionMode();
      });

      updateBadges();
      updateDeleteButton();
    }

    function exitSelectionMode() {
      isSelecting = false;
      selectedOrder = [];
      section.classList.remove("selection-mode");

      imagesContainer.querySelectorAll(".image-wrap").forEach(w => {
        w.draggable = canReorder;
        w.classList.remove("selected");
      });

      // Clear the control buttons
      btnRow.innerHTML = "";

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

    // ==== ADD PHOTOS HANDLER with Album/Photo modal ====
    fileInput.addEventListener("change", async (e) => {
      // collect selected files
      const files = Array.from(e.target.files || []);
      if (!files.length) return;

      // create local blob previews and temp captions
      const previews = files.map(f => URL.createObjectURL(f));
      const tempCaptions = new Array(previews.length).fill("");

      // modal nodes
      const overlay = document.getElementById("modal-overlay");
      const dlg = document.getElementById("photo-desc-modal");
      const closeX = document.getElementById("photo-desc-close");
      const thumbsEl = document.getElementById("photo-desc-thumbs");
      const textEl = document.getElementById("photo-desc-text");
      const countEl = document.getElementById("photo-desc-count");
      const okBtn = document.getElementById("photo-desc-add");
      const modeAlbum = document.getElementById("mode-album");
      const modeAlbumWrap = document.getElementById("modeAlbumWrap");
      const modePhoto = document.getElementById("mode-photo");

      if (files.length === 1) {
        // hide album option
        if (modeAlbumWrap) modeAlbumWrap.style.display = "none";
        if (modeAlbum) modeAlbum.checked = false;
        if (modePhoto) modePhoto.checked = true;
      } else {
        // show album option again
        if (modeAlbumWrap) modeAlbumWrap.style.display = "";
      }

      // react to radio switching between Album / Photo
      modeAlbum.onchange = applyModeUI;
      modePhoto.onchange = applyModeUI;

      // selection state within modal
      let sel = 0;
      let confirmed = false;

      // persist textarea text to current selected preview
      function commitCurrent() {
        if (!previews.length) return;
        tempCaptions[sel] = (textEl.value || "").trim();
      }

      // render thumbs list; disabled=true in album mode (no per-photo edits/deletes)
      function renderThumbs(disabled) {
        thumbsEl.innerHTML = "";
        previews.forEach((src, i) => {
          const wrap = document.createElement("div");
          wrap.className = "photo-desc-thumb" + (!disabled && i === sel ? " is-selected" : "");
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
              if (ev.target.closest(".thumb-x")) return; // ignore delete button
              commitCurrent();                            // keep text of previous
              sel = i;                                    // set new selection
              renderThumbs(false);                        // re-render with highlight
              textEl.value = tempCaptions[sel] || "";     // load text for new sel
            });
          }
          thumbsEl.appendChild(wrap);
        });
        countEl.textContent = String(previews.length);    // update counter
      }

      // deletion of a preview in PHOTO mode
      thumbsEl.onclick = (ev) => {
        const btn = ev.target.closest('.thumb-x');
        if (!btn) return;
        if (modeAlbum.checked) return;                   // deletion disabled in album

        const i = Number(btn.dataset.i);
        commitCurrent();                                 // keep current text

        // revoke blob, remove from all arrays so it won't upload later
        try { URL.revokeObjectURL(previews[i]); } catch { }

        previews.splice(i, 1);
        tempCaptions.splice(i, 1);
        files.splice(i, 1);

        // fix selection index
        if (sel >= previews.length) sel = Math.max(0, previews.length - 1);

        // if nothing left, close modal
        if (previews.length === 0) {
          closeModal();
          return;
        }

        // repaint and restore textarea
        renderThumbs(false);
        textEl.value = tempCaptions[sel] || '';
      };

      if (modeAlbum.checked) return;

      // open/close helpers
      function openModal() { overlay.hidden = false; dlg.hidden = false; }
      function closeModal() { overlay.hidden = true; dlg.hidden = true; }

      // toggle UI by mode (Album → one shared description; Photo → per-photo)
      function applyModeUI() {
        if (modeAlbum.checked) {
          renderThumbs(true);
          sel = 0;
          textEl.value = tempCaptions[0] || "";
          textEl.placeholder = "Додати опис альбому...";
        } else {
          renderThumbs(false);
          textEl.value = tempCaptions[sel] || "";
          textEl.placeholder = "Додати опис...";
        }
      }

      // show modal and wire controls
      openModal();
      applyModeUI();

      closeX.onclick = () => { closeModal(); };
      overlay.addEventListener("click", closeModal, { once: true });

      okBtn.onclick = () => {
        // Always persist current textarea before closing
        commitCurrent();

        // If ALBUM mode: enforce a single, joint description for all photos
        if (modeAlbum.checked) {
          const joint = (textEl.value || "").trim();
          // make every slot share the same text
          for (let i = 0; i < tempCaptions.length; i++) tempCaptions[i] = joint;
          // selection index is irrelevant in album mode
          sel = 0;
        }

        confirmed = true;
        closeModal();
      };

      // wait until modal actually closes
      await new Promise((r) => {
        const iv = setInterval(() => { if (dlg.hidden) { clearInterval(iv); r(); } }, 60);
      });

      // if cancelled or no images, clean and exit
      if (!confirmed || previews.length === 0) {
        previews.forEach(p => { try { URL.revokeObjectURL(p); } catch { } });
        e.target.value = "";
        return;
      }

      // ensure the section has a visible grid before uploading
      section.querySelector(".photos-empty")?.remove();         // drop empty-state
      if (!section.contains(imagesContainer)) section.appendChild(imagesContainer);
      imagesContainer.classList.add("one-row");                 // same as profile grid

      // create temporary "uploading" tile(s)
      const tempWraps = [];

      if (modeAlbum.checked) {
        // ONE placeholder for the whole album
        const wrap = document.createElement("div");
        wrap.className = "image-wrap uploading";

        const img = document.createElement("img");
        img.className = "item-image";
        // show first preview as cover
        img.src = previews[0];

        // counter badge with total files
        const counter = document.createElement("div");
        counter.className = "image-counter";
        counter.textContent = String(previews.length);

        // spinner overlay + hint
        const overlay = document.createElement("div");
        overlay.className = "uploading-overlay";
        overlay.innerHTML = `<div class="spinner"></div><div class="uploading-hint">Завантаження…</div>`;

        wrap.append(img, overlay, counter);
        imagesContainer.prepend(wrap);
        tempWraps.push(wrap);
      } else {
        // N placeholders (one per photo) for Photo mode
        previews.forEach((src) => {
          const wrap = document.createElement("div");
          wrap.className = "image-wrap uploading";

          const img = document.createElement("img");
          img.className = "item-image";
          img.src = src;

          const overlay = document.createElement("div");
          overlay.className = "uploading-overlay";
          overlay.innerHTML = `<div class="spinner"></div><div class="uploading-hint">Завантаження…</div>`;

          wrap.append(img, overlay);
          imagesContainer.prepend(wrap);
          tempWraps.push(wrap);
        });
      }

      // uploader (ImgBB)
      async function uploadToImgBB(file) {
        const formData = new FormData();
        formData.append("image", file);
        const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, { method: "POST", body: formData });
        const json = await res.json();
        if (!json?.success) throw new Error("IMGBB upload failed");
        return json.data.url;
      }

      // perform uploads in selected mode and persist
      try {
        if (modeAlbum.checked) {
          // one album with N photos and a single shared description
          const urls = [];
          for (let i = 0; i < files.length; i++) {
            const u = await uploadToImgBB(files[i]);
            urls.push(u);
          }
          const commonDesc = (tempCaptions[0] || "").trim();
          albums.push({ photos: urls, description: commonDesc });
        } else {
          // N albums, each with 1 photo and its own description
          for (let i = 0; i < files.length; i++) {
            const u = await uploadToImgBB(files[i]);
            const d = (tempCaptions[i] || "").trim();
            albums.push({ photos: [u], description: d });
          }
        }

        // rebuild UI from canonical data (removes temp tiles)
        renderImages();

        // persist to backend
        await updateItems(ritualData.items);

        // belt-and-suspenders: ensure temp tiles are gone
        tempWraps.forEach(w => w.remove());
      } catch (err) {
        console.error("Upload failed", err);
        alert("Не вдалося завантажити фото");
        // remove temp tiles on error
        tempWraps.forEach(w => w.remove());
      } finally {
        // free blobs and reset input
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
    const res = await fetchWithAuth(`${API}/ritual_services/${ritualId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
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
    const res = await fetchWithAuth(`${API}/ritual_services/${ritualId}`, {
      method: "PUT",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ description: newDescription }),
    });
    if (!res.ok) throw new Error(await res.text());

    // оновлюємо джерело правди в пам’яті
    ritualData.description = newDescription;

    // 1) одразу показуємо <p>, ховаємо textarea
    p.style.display = "block";
    textarea.style.display = "none";

    // 2) кламапимо на наступному кадрі, коли лейаут уже актуальний
    requestAnimationFrame(() => {
      applyAbout((newDescription || "").trim());
    });
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

function ensureOverlay() {
  // Prefer unified overlay used by photo-desc modal
  let overlay = document.getElementById("modal-overlay");
  if (!overlay) {
    overlay = document.createElement("div");
    overlay.id = "modal-overlay";
    overlay.hidden = true; // CSS: #modal-overlay[hidden] { display:none }
    document.body.appendChild(overlay);
  }
  // Remove legacy overlay to avoid style conflicts
  const legacy = document.querySelector(".modal-overlay");
  if (legacy && legacy !== overlay) legacy.remove();
  return overlay;
}

function openRenameModal(titleEl) {
  const overlay = ensureOverlay();

  let dlg = document.getElementById("rename-modal");
  if (!dlg) {
    dlg = document.createElement("div");
    dlg.id = "rename-modal";
    dlg.className = "modal";
    dlg.hidden = true; // CSS handles [hidden]

    dlg.innerHTML = `
      <button class="modal-close" aria-label="Закрити">
        <svg viewBox="0 0 30 30" width="28" height="28" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" stroke="#90959C" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </button>
      <p class="modal-text">Змінити назву</p>
      <input id="rename-input" type="text" placeholder="Введіть назву категорії…" />
      <div class="modal-actions">
        <button id="rename-ok" class="modal-ok">Підтвердити</button>
      </div>
    `;
    document.body.appendChild(dlg);
  }

  const input = dlg.querySelector("#rename-input");
  const closeBtn = dlg.querySelector(".modal-close");
  const okBtn = dlg.querySelector("#rename-ok");

  if (!input || !closeBtn || !okBtn) {
    console.error("Rename modal structure missing required nodes");
    return;
  }

  // Open + prefill
  input.value = (titleEl.textContent || "").trim();
  overlay.hidden = false;
  dlg.hidden = false;
  input.focus();

  const close = () => { dlg.hidden = true; overlay.hidden = true; };

  // Close handlers
  closeBtn.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  const onKey = (ev) => { if (ev.key === "Escape") close(); };
  document.addEventListener("keydown", onKey, { once: true });

  // Confirm → update DOM + model + persist
  okBtn.onclick = async () => {
    const v = (input.value || "").trim();
    if (!v) { input.focus(); return; }

    // 1) update title immediately
    titleEl.textContent = v;

    // 2) update data & persist
    const section = titleEl.closest(".ritual-item-section");
    const all = [...document.querySelectorAll(".ritual-item-section")];
    const idx = all.indexOf(section);
    close();
    if (idx > -1) {
      ritualData.items[idx][0] = v;
      await updateItems(ritualData.items); // server save + reload
    }
  };

  // Enter to submit
  input.onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); okBtn.click(); }
  };
}

function openAddCategoryModal() {
  const overlay = ensureOverlay();

  let dlg = document.getElementById("newcat-modal");
  if (!dlg) {
    dlg = document.createElement("div");
    dlg.id = "newcat-modal";
    dlg.className = "modal";
    dlg.hidden = true;
    dlg.innerHTML = `
      <button class="modal-close" aria-label="Закрити">
        <svg viewBox="0 0 30 30" width="28" height="28" aria-hidden="true">
          <path d="M7 7l10 10M17 7L7 17" stroke="#90959C" stroke-width="2" stroke-linecap="round"></path>
        </svg>
      </button>
      <p class="modal-text">Нова категорія</p>
      <input type="text" id="newCatInput" placeholder="Введіть назву категорії..." />
      <div class="modal-actions">
        <button id="newcat-ok" class="modal-ok">Створити</button>
      </div>
    `;
    document.body.appendChild(dlg);
  }

  const input = dlg.querySelector("#newCatInput");
  const closeBtn = dlg.querySelector(".modal-close");
  const okBtn = dlg.querySelector("#newcat-ok");

  const close = () => { dlg.hidden = true; overlay.hidden = true; };

  overlay.hidden = false;
  dlg.hidden = false;
  input.value = "";
  input.focus();

  closeBtn.onclick = close;
  overlay.onclick = (e) => { if (e.target === overlay) close(); };
  document.addEventListener("keydown", (ev) => { if (ev.key === "Escape") close(); }, { once: true });

  okBtn.onclick = async () => {
    const title = (input.value || "").trim();
    if (!title) { input.focus(); return; }
    ritualData.items.push([title, []]);
    close();
    await updateItems(ritualData.items);
  };

  input.onkeydown = (e) => {
    if (e.key === "Enter") { e.preventDefault(); okBtn.click(); }
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

  if (images.length > 1) {
    images.forEach((_, idx) => {
      const dot = document.createElement("span");
      dot.className = "slideshow-indicator";
      dot.addEventListener("click", () => changeSlide(idx));
      indicator.appendChild(dot);
    });
  }

  function updateIndicators(index) {
    if (images.length > 1) {
      indicator
        .querySelectorAll(".slideshow-indicator")
        .forEach((dot, i) => dot.classList.toggle("active", i === index));
    }
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
    const prev = track.style.scrollBehavior;
    track.style.scrollBehavior = 'auto';
    track.scrollLeft = startIndex * track.clientWidth;
    track.style.scrollBehavior = prev;
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
