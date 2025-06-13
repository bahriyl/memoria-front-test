// js/profile.js

document.addEventListener('DOMContentLoaded', () => {
    const API_BASE = 'https://memoria-test-app-ifisk.ondigitalocean.app/api/people';
    const params = new URLSearchParams(window.location.search);
    const personId = params.get('personId');
    if (!personId) return;

    // grab all of the elements we'll populate
    const avatarEl = document.querySelector('.profile-avatar');
    const heroEl = document.querySelector('.profile-hero');
    const nameEl = document.querySelector('.profile-name');
    const yearsEl = document.querySelector('.profile-years');
    const cemeteryEl = document.querySelector('.profile-cemetery');
    const actionBtn = document.getElementById('action-btn');
    const bioContentEl = document.getElementById('bio-content');
    const bioToggleEl = document.getElementById('bio-toggle');
    const bioEditBtn = document.getElementById('bio-edit');

    (async () => {
        try {
            const res = await fetch(`${API_BASE}/${personId}`);
            if (!res.ok) throw new Error(res.statusText);
            const data = await res.json();

            // Avatar & hero background
            avatarEl.src = data.avatarUrl || 'img/default-avatar.jpg';
            if (data.backgroundUrl) {
                heroEl.style.backgroundImage = `url(${data.backgroundUrl})`;
            }

            // Name, years, cemetery
            nameEl.textContent = data.name;
            yearsEl.textContent = `${data.birthYear} – ${data.deathYear || ''}`.trim();
            cemeteryEl.textContent = data.cemetery || '';

            // Action button (view vs add location)
            if (data.location?.lat && data.location?.lng) {
                actionBtn.textContent = 'Локація місця поховання';
                actionBtn.href = `location.html?personId=${personId}`;
            } else {
                actionBtn.textContent = 'Додати локацію місця поховання';
                actionBtn.href = `add-location.html?personId=${personId}`;
            }

            // Biography text + toggle logic
            const fullBio = data.bio || '';

            // A. Temporarily remove toggle to measure content correctly
            bioToggleEl.remove();
            bioContentEl.textContent = fullBio;

            // B. Check if the content is actually taller than its collapsed container
            const isOverflowing = bioContentEl.scrollHeight > bioContentEl.clientHeight;

            if (isOverflowing) {
                // If it overflows, re-attach the toggle and make it work
                bioContentEl.appendChild(bioToggleEl); // Append INSIDE the paragraph
                bioToggleEl.style.display = 'inline'; // Make it visible
                bioToggleEl.textContent = '... більше'; // Set initial text

                // Wire up the “більше / менше” toggle
                bioToggleEl.addEventListener('click', () => {
                    const isNowExpanded = bioContentEl.classList.toggle('expanded');
                    // Update text based on new state
                    bioToggleEl.textContent = isNowExpanded ? 'менше' : '... більше';
                });

            } else {
                // If it doesn't overflow, the toggle is already removed, so we do nothing.
            }

            // “Змінити” button for the bio (this part remains the same)
            if (bioEditBtn) {
                bioEditBtn.addEventListener('click', () => {
                    window.location.href = `edit-bio.html?personId=${personId}`;
                });
            }

            //  ─── Photographs gallery ───
            const photosListEl = document.querySelector('.photos-list');
            const addPhotoBtn = document.getElementById('add-photo-btn');
            const choosePhotoBtn = document.getElementById('choose-photo-btn');

            if (Array.isArray(data.photos) && data.photos.length) {
                data.photos.forEach(url => {
                    const li = document.createElement('li');
                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = data.name + ' — фото';
                    li.appendChild(img);
                    photosListEl.appendChild(li);
                });
            } else {
                // optionally show a placeholder
                const li = document.createElement('li');
                li.textContent = 'Немає фото';
                li.style.padding = '1rem';
                photosListEl.appendChild(li);
            }

            // Wire up the photo buttons
            choosePhotoBtn.addEventListener('click', () => {
                window.location.href = `choose-photo.html?personId=${personId}`;
            });
        } catch (err) {
            console.error(err);
            document.querySelector('.profile-info').innerHTML =
                '<p>Не вдалося завантажити профіль.</p>';
        }
    })();

    // ─── Add Photo Modal (select + preview only) ───
    const addBtn = document.getElementById('add-photo-btn');
    const modal = document.getElementById('addPhotoModal');
    const closeBtn = modal.querySelector('.modal-close');
    const pickBtn = document.getElementById('pickPhotosBtn');
    const fileInput = document.getElementById('photo-input');
    const photoList = modal.querySelector('.modal-photo-list');
    const photoScroll = modal.querySelector('.modal-photo-scroll'); // Add this reference
    let filesToUpload = [];

    // Function to update photo list visibility
    function updatePhotoListVisibility() {
        if (filesToUpload.length > 0) {
            photoScroll.classList.add('has-photos');
        } else {
            photoScroll.classList.remove('has-photos');
        }
    }

    // Open modal
    addBtn.addEventListener('click', () => {
        filesToUpload = [];
        photoList.innerHTML = '';
        updatePhotoListVisibility(); // Hide photo list when modal opens
        modal.classList.add('open');
    });

    // Close modal
    closeBtn.addEventListener('click', () => {
        modal.classList.remove('open');
    });

    // Click "Вибрати фото" → trigger hidden file input
    pickBtn.addEventListener('click', () => fileInput.click());

    // When user picks files, show previews & store them
    fileInput.addEventListener('change', evt => {
        Array.from(evt.target.files).forEach(file => {
            const url = URL.createObjectURL(file);
            filesToUpload.push({ file, url });

            const li = document.createElement('li');
            const img = document.createElement('img');
            img.src = url;
            const rm = document.createElement('button');
            rm.className = 'remove-btn';
            rm.innerHTML = '&times;';
            rm.addEventListener('click', () => {
                // remove from array + DOM
                filesToUpload = filesToUpload.filter(f => f.url !== url);
                li.remove();
                URL.revokeObjectURL(url);
                updatePhotoListVisibility(); // Update visibility after removal
            });
            li.append(img, rm);
            photoList.append(li);
        });

        updatePhotoListVisibility(); // Show photo list after adding photos

        // reset input so same file can be re‐picked if needed
        fileInput.value = '';
    });

    // ─── Liturgy Section Functionality ───

    // Generate dynamic dates (today + 7 days)
    function generateDates() {
        const dateCalendar = document.querySelector('.date-calendar');
        const selectedDateEl = document.querySelector('.selected-date');

        if (!dateCalendar) return;

        // Clear existing date items
        dateCalendar.innerHTML = '';

        const today = new Date();
        const dayNames = ['Нд', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб'];

        for (let i = 0; i < 7; i++) {
            const date = new Date(today);
            date.setDate(today.getDate() + i);

            const dateItem = document.createElement('div');
            dateItem.className = 'date-item' + (i === 0 ? ' selected' : '');

            const dateNumber = document.createElement('span');
            dateNumber.className = 'date-number';
            dateNumber.textContent = date.getDate();

            const dateDay = document.createElement('span');
            dateDay.className = 'date-day';
            dateDay.textContent = dayNames[date.getDay()];

            dateItem.appendChild(dateNumber);
            dateItem.appendChild(dateDay);
            dateCalendar.appendChild(dateItem);

            // Store the full date for later use
            dateItem.dataset.fullDate = date.toISOString().split('T')[0];
        }

        // Set initial selected date (today)
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        selectedDateEl.textContent = todayFormatted;

        // Initial update of liturgy details
        setTimeout(() => {
            updateLiturgyDetails();
        }, 100);
    }

    // Generate dates on page load
    generateDates();

    // Date selection
    document.addEventListener('click', (e) => {
        if (e.target.closest('.date-item')) {
            const clickedItem = e.target.closest('.date-item');
            const selectedDateEl = document.querySelector('.selected-date');

            // Remove selected class from all items
            document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked item
            clickedItem.classList.add('selected');

            // Update selected date display
            const fullDate = new Date(clickedItem.dataset.fullDate);
            const formattedDate = `${String(fullDate.getDate()).padStart(2, '0')}.${String(fullDate.getMonth() + 1).padStart(2, '0')}.${fullDate.getFullYear()}`;
            selectedDateEl.textContent = formattedDate;

            // Update liturgy details
            updateLiturgyDetails();
        }
    });

    // Update liturgy details
    function updateLiturgyDetails() {
        const personNameEl = document.querySelector('.person-name');
        const serviceInfoEl = document.querySelector('.service-info');
        const profileNameEl = document.querySelector('.profile-name');
        const selectedChurchEl = document.querySelector('.church-btn.selected');
        const selectedDateEl = document.querySelector('.selected-date');

        if (personNameEl && profileNameEl) {
            personNameEl.textContent = profileNameEl.textContent;
        }

        if (serviceInfoEl && selectedChurchEl && selectedDateEl) {
            const churchName = selectedChurchEl.textContent;
            const selectedDate = selectedDateEl.textContent;

            serviceInfoEl.textContent = `Божественна Літургія за упокій відбудеться у ${churchName}, ${selectedDate} р.`;
        }
    }

    // Church selection
    const churchBtns = document.querySelectorAll('.church-btn');

    churchBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected class from all buttons
            churchBtns.forEach(b => b.classList.remove('selected'));
            // Add selected class to clicked button
            btn.classList.add('selected');

            // Update liturgy details
            updateLiturgyDetails();
        });
    });

    // Donation amount selection
    const donationBtns = document.querySelectorAll('.donation-btn');

    donationBtns.forEach(btn => {
        btn.addEventListener('click', () => {
            // Remove selected class from all buttons
            donationBtns.forEach(b => b.classList.remove('selected'));
            // Add selected class to clicked button
            btn.classList.add('selected');
        });
    });

    // Submit liturgy request
    const liturgySubmitBtn = document.querySelector('.liturgy-submit');

    liturgySubmitBtn.addEventListener('click', () => {
        // Get selected values
        const selectedDate = selectedDateEl.textContent;
        const selectedChurch = document.querySelector('.church-btn.selected').textContent;
        const selectedDonation = document.querySelector('.donation-btn.selected').textContent;

        // Here you would typically send this data to your API
        console.log('Liturgy request:', {
            personId,
            date: selectedDate,
            church: selectedChurch,
            donation: selectedDonation
        });

        // Show success message or redirect
        alert('Записка надіслана до церкви!');
    });

    // ─── Comments Section ───
    function loadComments(personData) {
        const commentsListEl = document.querySelector('.comments-list');

        // Sample comments data - replace with actual API call
        const comments = [
            {
                author: 'Петро',
                date: '05.02.2025',
                text: 'Вічна пам\'ять та слава герою'
            },
            {
                author: 'Олександр',
                date: '05.02.2025',
                text: 'Щирі співчуття'
            },
            {
                author: 'Степан',
                date: '05.02.2025',
                text: 'Добавте локацію'
            },
            {
                author: 'Андрій',
                date: '05.02.2025',
                text: 'Співчуття рідним та близьким'
            }
        ];

        commentsListEl.innerHTML = '';

        comments.forEach(comment => {
            const commentEl = document.createElement('div');
            commentEl.className = 'comment-item';
            commentEl.innerHTML = `
            <div class="comment-header">
                <span class="comment-author">${comment.author}</span>
                <span class="comment-date">${comment.date}</span>
            </div>
            <p class="comment-text">${comment.text}</p>
        `;
            commentsListEl.appendChild(commentEl);
        });

        // Template buttons functionality
        const templateBtns = document.querySelectorAll('.template-btn');
        templateBtns.forEach(btn => {
            btn.addEventListener('click', () => {
                // Here you would typically open a modal or form to submit the comment
                const template = btn.textContent;
                console.log('Selected comment template:', template);
                // For now, just show an alert
                alert(`Коментар "${template}" буде додано`);
            });
        });
    }

    // ─── Relatives Section ───
    function loadRelatives(personData) {
        const relativesListEl = document.querySelector('.relatives-list');
        const addRelativeBtn = document.getElementById('add-relative-btn');
        const chooseRelativeBtn = document.getElementById('choose-relative-btn');

        // Sample relatives data - replace with actual API call
        const relatives = [
            {
                id: 1,
                name: 'Кравчук Леонід Макарович',
                years: '1975 - 2000',
                relationship: 'Батько',
                avatarUrl: 'https://via.placeholder.com/60x60'
            },
            {
                id: 2,
                name: 'Фаріон Ірина Олегівна',
                years: '1982 - 2012',
                relationship: 'Мати',
                avatarUrl: 'https://via.placeholder.com/60x60'
            },
            {
                id: 3,
                name: 'Кенседі Валерій Петрович',
                years: '1982 - 2012',
                relationship: 'Брат',
                avatarUrl: 'https://via.placeholder.com/60x60'
            }
        ];

        relativesListEl.innerHTML = '';

        relatives.forEach(relative => {
            const relativeEl = document.createElement('div');
            relativeEl.className = 'relative-item';
            relativeEl.innerHTML = `
            <img class="relative-avatar" src="${relative.avatarUrl}" alt="${relative.name}">
            <div class="relative-info">
                <h3 class="relative-name">${relative.name}</h3>
                <p class="relative-details">${relative.years}</p>
            </div>
            <span class="relative-relationship">${relative.relationship}</span>
        `;

            // Add click handler to navigate to relative's profile
            relativeEl.addEventListener('click', () => {
                window.location.href = `profile.html?personId=${relative.id}`;
            });

            relativesListEl.appendChild(relativeEl);
        });

        // Button handlers
        if (addRelativeBtn) {
            addRelativeBtn.addEventListener('click', () => {
                window.location.href = `add-relative.html?personId=${personId}`;
            });
        }

        if (chooseRelativeBtn) {
            chooseRelativeBtn.addEventListener('click', () => {
                window.location.href = `choose-relative.html?personId=${personId}`;
            });
        }
    }

    // Call these functions after loading the main person data
    // Add these lines after the liturgy code in your main async function:

    // Load comments
    loadComments();

    // Load relatives  
    loadRelatives();
});
