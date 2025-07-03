const API = "https://memoria-test-app-ifisk.ondigitalocean.app/api";
const IMGBB_API_KEY = "726ae764867cf6b3a259967071cbdd80";

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

    const container = document.querySelector('.ritual-container');
    container.querySelectorAll('.ritual-item-section').forEach(el => el.remove());

    data.items.forEach(([title, images], index) => {
        const section = document.createElement('section');
        section.className = 'ritual-item-section';

        // Top row with title
        const heading = document.createElement('h2');
        heading.className = 'item-title';
        heading.contentEditable = true;
        heading.textContent = title;

        const topRow = document.createElement('div');
        topRow.className = 'ritual-item-top';
        topRow.appendChild(heading);

        // Buttons row
        const btnRow = document.createElement('div');
        btnRow.className = 'ritual-btn-row';

        const fileInput = document.createElement('input');
        fileInput.type = 'file';
        fileInput.accept = 'image/*';
        fileInput.style.display = 'none';

        const addBtn = document.createElement('button');
        addBtn.className = 'ritual-btn';
        addBtn.textContent = 'Добавити';
        addBtn.addEventListener('click', () => fileInput.click());

        let isSelecting = false;
        const selectBtn = document.createElement('button');
        selectBtn.className = 'ritual-btn';
        selectBtn.textContent = 'Вибрати';

        const imagesContainer = document.createElement('div');
        imagesContainer.className = 'item-images';

        images.forEach((url) => {
            const img = document.createElement('img');
            img.src = url;
            img.alt = title;
            img.className = 'item-image';
            img.addEventListener("click", () => {
                if (isSelecting) {
                    img.classList.toggle("selected");
                }
            });
            imagesContainer.appendChild(img);
        });

        selectBtn.addEventListener('click', async () => {
            if (!isSelecting) {
                isSelecting = true;
                selectBtn.textContent = 'Видалити';
            } else {
                const selectedImages = imagesContainer.querySelectorAll('.selected');
                selectedImages.forEach(img => {
                    const src = img.src;
                    const indexToRemove = data.items[index][1].indexOf(src);
                    if (indexToRemove > -1) {
                        data.items[index][1].splice(indexToRemove, 1);
                    }
                });
                await updateItems(data.items);
                isSelecting = false;
            }
        });

        fileInput.addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const formData = new FormData();
            formData.append("image", file);

            const res = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
                method: 'POST',
                body: formData
            });
            const result = await res.json();
            const imageUrl = result.data.url;
            data.items[index][1].push(imageUrl);
            await updateItems(data.items);
        });

        const deleteCategoryBtn = document.createElement('button');
        deleteCategoryBtn.textContent = 'Видалити категорію';
        deleteCategoryBtn.className = 'ritual-btn';
        deleteCategoryBtn.addEventListener('click', async () => {
            data.items.splice(index, 1);
            await updateItems(data.items);
        });

        btnRow.appendChild(addBtn);
        btnRow.appendChild(selectBtn);
        btnRow.appendChild(fileInput);

        const deleteRow = document.createElement('div');
        deleteRow.className = 'ritual-btn-row delete-row';
        deleteRow.appendChild(deleteCategoryBtn);

        section.appendChild(topRow);
        section.appendChild(btnRow);
        section.appendChild(deleteRow);
        section.appendChild(imagesContainer);
        container.insertBefore(section, document.querySelector('.add-category-btn'));
    });

    const addCategoryBtn = document.querySelector('.add-category-btn');
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