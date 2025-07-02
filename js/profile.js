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
            yearsEl.textContent = `${data.birthDate} ${data.birthYear} – ${data.deathDate} ${data.deathYear || ''}`.trim();
            cemeteryEl.textContent = data.cemetery.split(", ")[0] || '';

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
            console.log(isOverflowing);

            if (isOverflowing) {
                // restore the toggle *inside* the bio-content paragraph
                bioContentEl.appendChild(bioToggleEl);
                bioToggleEl.style.display = 'inline';
                bioToggleEl.textContent = '... більше';

                // make sure there’s a bit of right padding so the span doesn’t get clipped
                bioContentEl.style.paddingRight = '0.1rem';

                // wire up the “… більше / менше” toggle
                bioToggleEl.addEventListener('click', () => {
                    const expanded = bioContentEl.classList.toggle('expanded');
                    bioToggleEl.textContent = expanded ? 'менше' : '... більше';
                });
            } else {
                // If it doesn't overflow, the toggle is already removed, so we do nothing.
            }

            // 1) Switch to edit mode
            bioEditBtn.addEventListener('click', enterBioEdit);

            function enterBioEdit() {
                // Hide the “… більше” toggle if present
                bioToggleEl && (bioToggleEl.style.display = 'none');

                // Replace <p> with a <textarea>
                const textarea = document.createElement('textarea');
                textarea.id = 'bio-editor';
                textarea.value = fullBio;
                textarea.style.width = '100%';
                textarea.style.minHeight = '120px';
                textarea.style.boxSizing = 'border-box';
                bioContentEl.replaceWith(textarea);

                // Change the “Змінити” button into “Підтвердити”
                bioEditBtn.textContent = 'Підтвердити';
                bioEditBtn.removeEventListener('click', enterBioEdit);
                bioEditBtn.addEventListener('click', openBioConfirmModal);

                // Add a “Скасувати” button
                const cancel = document.createElement('button');
                cancel.id = 'bio-cancel-btn';
                cancel.type = 'button';
                cancel.className = 'btn bio-edit-btn';
                cancel.textContent = 'Скасувати';
                bioEditBtn.insertAdjacentElement('afterend', cancel);
                cancel.addEventListener('click', () => {
                    window.location.reload(); // simplest way to revert everything
                });
            }

            // 2) Open the modal to send/enter code
            function openBioConfirmModal() {
                document.getElementById('editBioModal').classList.add('open');
            }

            // 3) Handle modal “send code” + “submit”
            const bioModal = document.getElementById('editBioModal');
            const sendBioCodeBtn = document.getElementById('send-bio-code-btn');
            const bioForm = document.getElementById('editBioForm');

            sendBioCodeBtn.addEventListener('click', async () => {
                const phone = document.getElementById('edit-phone-input').value;
                // TODO: call your SMS-API here…
                alert(`Код надіслано на ${phone}`);
            });

            bioForm.addEventListener('submit', async e => {
                e.preventDefault();
                const code = document.getElementById('edit-sms-code-input').value;
                const newBio = document.getElementById('bio-editor').value;

                // TODO: verify code with your backend…
                // await fetch(`${API_BASE}/${personId}/verifyBioCode`, { … })

                // Then push updated bio
                const res = await fetch(`${API_BASE}/${personId}`, {
                    method: 'PUT',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ bio: newBio })
                });
                if (!res.ok) throw new Error(res.statusText);

                // On success: close modal & update UI
                bioModal.classList.remove('open');
                document.getElementById('bio-cancel-btn').remove();
                bioEditBtn.textContent = 'Змінити';
                bioEditBtn.removeEventListener('click', openBioConfirmModal);
                bioEditBtn.addEventListener('click', enterBioEdit);

                // Restore the <p> with updated text and re-init toggle logic
                const updatedP = document.createElement('p');
                updatedP.className = 'bio-content';
                updatedP.id = 'bio-content';
                updatedP.textContent = newBio;
                document.querySelector('.profile-bio').appendChild(updatedP);
                // (you can re-run your overflow/toggle check here if desired)
            });

            //  ─── Photographs gallery ───
            const photosListEl = document.querySelector('.photos-list');
            const addPhotoBtn = document.getElementById('add-photo-btn');
            const choosePhotoBtn = document.getElementById('choose-photo-btn');
            let isSelectionMode = false;
            let selectedPhotos = [];

            if (Array.isArray(data.photos) && data.photos.length) {
                data.photos.forEach((url, index) => {
                    const li = document.createElement('li');
                    li.dataset.photoIndex = index;
                    li.dataset.photoUrl = url;

                    const img = document.createElement('img');
                    img.src = url;
                    img.alt = data.name + ' — фото';

                    // Add selection overlay (initially hidden)
                    const overlay = document.createElement('div');
                    overlay.className = 'photo-selection-overlay';
                    overlay.innerHTML = `
                        <div class="photo-selection-circle">
                            <div class="selection-check">✓</div>
                        </div>
                    `;

                    li.appendChild(img);
                    li.appendChild(overlay);
                    photosListEl.appendChild(li);

                    // Add click handler for selection
                    li.addEventListener('click', () => {
                        if (isSelectionMode) {
                            togglePhotoSelection(li, url);
                        }
                    });
                });
            } else {
                // optionally show a placeholder
                const li = document.createElement('li');
                li.textContent = 'Немає фото';
                li.style.padding = '1rem';
                photosListEl.appendChild(li);
            }

            // Add this new function for photo selection
            function togglePhotoSelection(photoElement, photoUrl) {
                const isSelected = selectedPhotos.has(photoUrl);

                if (isSelected) {
                    selectedPhotos.delete(photoUrl);
                    photoElement.classList.remove('selected');
                } else {
                    selectedPhotos.add(photoUrl);
                    photoElement.classList.add('selected');
                }

                updateDeleteButton();
            }

            // Add this function to update delete button state
            function updateDeleteButton() {
                const deleteBtn = document.getElementById('delete-photo-btn');
                if (deleteBtn) {
                    deleteBtn.style.display = selectedPhotos.size > 0 ? 'block' : 'none';
                    deleteBtn.textContent = `Видалити (${selectedPhotos.size})`;
                }
            }

            // Add this function to toggle selection mode
            function toggleSelectionMode() {
                isSelectionMode = !isSelectionMode;
                const photosSection = document.querySelector('.profile-photos');
                const chooseBtn = document.getElementById('choose-photo-btn');
                const deleteBtn = document.getElementById('delete-photo-btn');

                if (isSelectionMode) {
                    photosSection.classList.add('selection-mode');
                    chooseBtn.textContent = 'Скасувати';
                    deleteBtn.style.display = 'none';
                } else {
                    photosSection.classList.remove('selection-mode');
                    chooseBtn.textContent = 'Вибрати';
                    deleteBtn.style.display = 'none';
                    // Clear all selections
                    selectedPhotos.clear();
                    document.querySelectorAll('.photos-list li').forEach(li => {
                        li.classList.remove('selected');
                    });
                }
            }

            // Add this function to handle photo deletion
            async function deleteSelectedPhotos() {
                if (selectedPhotos.size === 0) return;

                const confirmDelete = confirm(`Ви впевнені, що хочете видалити ${selectedPhotos.size} фото?`);
                if (!confirmDelete) return;

                try {
                    // Example API request - replace with your actual endpoint
                    const deletePromises = Array.from(selectedPhotos).map(photoUrl =>
                        fetch(`${API_BASE}/${personId}/photos`, {
                            method: 'DELETE',
                            headers: {
                                'Content-Type': 'application/json',
                            },
                            body: JSON.stringify({ photoUrl })
                        })
                    );

                    await Promise.all(deletePromises);

                    // Remove deleted photos from DOM
                    selectedPhotos.forEach(photoUrl => {
                        const photoElement = document.querySelector(`[data-photo-url="${photoUrl}"]`);
                        if (photoElement) {
                            photoElement.remove();
                        }
                    });

                    // Reset selection state
                    selectedPhotos.clear();
                    toggleSelectionMode(); // Exit selection mode

                    alert('Фото успішно видалено!');

                } catch (error) {
                    console.error('Error deleting photos:', error);
                    alert('Помилка при видаленні фото. Спробуйте ще раз.');
                }
            }

            function enterSelectionMode() {
                isSelectionMode = true;
                selectedPhotos = [];

                // Update button states
                addPhotoBtn.textContent = 'Скасувати';
                choosePhotoBtn.textContent = 'Видалити (0)';

                // Add selection mode class
                document.querySelector('.profile-photos').classList.add('selection-mode');

                // Add click handlers to photos
                const photoItems = document.querySelectorAll('.photos-list li');
                photoItems.forEach((li, index) => {
                    // Add selection circle
                    const circle = document.createElement('div');
                    circle.className = 'photo-selection-circle';
                    li.appendChild(circle);

                    // Add click handler
                    li.addEventListener('click', () => togglePhotoSelection(li, index));
                });
            }

            function exitSelectionMode() {
                isSelectionMode = false;
                selectedPhotos = [];

                // Reset button states
                addPhotoBtn.textContent = 'Додати';
                choosePhotoBtn.textContent = 'Вибрати';

                // Remove selection mode class
                document.querySelector('.profile-photos').classList.remove('selection-mode');

                // Remove selection circles and reset states
                const photoItems = document.querySelectorAll('.photos-list li');
                photoItems.forEach(li => {
                    li.classList.remove('selected');
                    const circle = li.querySelector('.photo-selection-circle');
                    if (circle) circle.remove();

                    // Remove click handlers by cloning the element
                    const newLi = li.cloneNode(true);
                    li.parentNode.replaceChild(newLi, li);
                });
            }

            function togglePhotoSelection(photoElement, photoIndex) {
                if (!isSelectionMode) return;

                const isSelected = photoElement.classList.contains('selected');
                const circle = photoElement.querySelector('.photo-selection-circle');

                if (isSelected) {
                    // Deselect
                    photoElement.classList.remove('selected');
                    const selectionIndex = selectedPhotos.indexOf(photoIndex);
                    selectedPhotos.splice(selectionIndex, 1);
                } else {
                    // Select
                    photoElement.classList.add('selected');
                    selectedPhotos.push(photoIndex);
                }

                // Update circle number and button text
                updateSelectionNumbers();
                choosePhotoBtn.textContent = `Видалити (${selectedPhotos.length})`;
            }

            function updateSelectionNumbers() {
                selectedPhotos.forEach((photoIndex, selectionOrder) => {
                    const photoElement = document.querySelectorAll('.photos-list li')[0];
                    console.log(photoIndex);
                    console.log(photoElement);
                    const circle = photoElement.querySelector('.photo-selection-circle');
                    if (circle) {
                        circle.textContent = selectionOrder + 1;
                    }
                });
            }

            addPhotoBtn.addEventListener('click', () => {
                if (isSelectionMode) {
                    // Cancel selection
                    exitSelectionMode();
                } else {
                    // Open modal (existing functionality)
                    filesToUpload = [];
                    photoList.innerHTML = '';
                    updatePhotoListVisibility();
                    modal.classList.add('open');
                }
            });

            choosePhotoBtn.addEventListener('click', () => {
                if (isSelectionMode) {
                    // Delete selected photos (implement your deletion logic here)
                    console.log('Delete photos:', selectedPhotos);
                    // Here you would typically make an API call to delete the photos
                    alert(`Видалити ${selectedPhotos.length} фото?`);
                    exitSelectionMode();
                } else {
                    // Enter selection mode
                    enterSelectionMode();
                }
            });

            // Add event listener for delete button (add this after your existing button listeners)
            document.addEventListener('click', (e) => {
                if (e.target.id === 'delete-photo-btn') {
                    deleteSelectedPhotos();
                }
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

            // Store the date components directly instead of ISO string
            dateItem.dataset.day = date.getDate();
            dateItem.dataset.month = date.getMonth() + 1; // getMonth() is 0-indexed
            dateItem.dataset.year = date.getFullYear();
        }

        // Set initial selected date (today) - use the same formatting logic
        const todayFormatted = `${String(today.getDate()).padStart(2, '0')}.${String(today.getMonth() + 1).padStart(2, '0')}.${today.getFullYear()}`;
        selectedDateEl.textContent = todayFormatted;

        // Initial update of liturgy details
        setTimeout(() => {
            updateLiturgyDetails();
        }, 100);
    }

    // Generate dates on page load
    generateDates();

    // Date selection event handler
    document.addEventListener('click', (e) => {
        if (e.target.closest('.date-item')) {
            const clickedItem = e.target.closest('.date-item');
            const selectedDateEl = document.querySelector('.selected-date');

            // Remove selected class from all items
            document.querySelectorAll('.date-item').forEach(d => d.classList.remove('selected'));
            // Add selected class to clicked item
            clickedItem.classList.add('selected');

            // Get the stored date components
            const day = parseInt(clickedItem.dataset.day);
            const month = parseInt(clickedItem.dataset.month);
            const year = parseInt(clickedItem.dataset.year);

            // Format the date using the same logic as initial date
            const formattedDate = `${String(day).padStart(2, '0')}.${String(month).padStart(2, '0')}.${year}`;
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
