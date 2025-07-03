// ritual_service_edit.js
const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";

const urlParams = new URLSearchParams(window.location.search);
const ritualId = urlParams.get("id");
const token = urlParams.get("token");

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
    const textarea = document.querySelector(".ritual-description textarea.ritual-text");

    p.textContent = data.description;
    p.style.display = "block";
    textarea.style.display = "none";

    const container = document.querySelector(".ritual-items-container");
    container.innerHTML = "";

    data.items.forEach(([title, images], index) => {
        const section = document.createElement("section");
        section.className = "ritual-item-section";
        section.setAttribute("draggable", true);
        section.dataset.index = index;

        section.innerHTML = `
      <div class="ritual-item-header">
        <h3 class="ritual-item-title">${title}</h3>
        <div class="drag-icon">&#8942;</div>
      </div>
      <div class="ritual-btn-row">
        <button class="ritual-btn">Добавити</button>
        <button class="ritual-btn">Вибрати</button>
      </div>
      <div class="image-grid">
        ${images.map((img) => `<img src="${img}" alt="item" />`).join("")}
      </div>
    `;

        container.appendChild(section);
    });

    enableDragAndDrop();
}

function enableDragAndDrop() {
    let dragged;
    document.querySelectorAll(".ritual-item-section").forEach((section) => {
        section.addEventListener("dragstart", (e) => {
            dragged = section;
            section.style.opacity = 0.5;
        });
        section.addEventListener("dragend", (e) => {
            section.style.opacity = "";
        });
        section.addEventListener("dragover", (e) => {
            e.preventDefault();
        });
        section.addEventListener("drop", (e) => {
            e.preventDefault();
            if (dragged !== section) {
                const container = section.parentNode;
                const draggedIndex = [...container.children].indexOf(dragged);
                const droppedIndex = [...container.children].indexOf(section);
                if (draggedIndex < droppedIndex) {
                    container.insertBefore(dragged, section.nextSibling);
                } else {
                    container.insertBefore(dragged, section);
                }
            }
        });
    });
}

document.querySelector(".edit-description-btn").addEventListener("click", () => {
    const p = document.querySelector(".ritual-description p.ritual-text");
    const textarea = document.querySelector(".ritual-description textarea.ritual-text");
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

fetchRitualService();
