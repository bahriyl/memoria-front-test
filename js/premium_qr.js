document.addEventListener('DOMContentLoaded', () => {
    const purchaseBtn = document.querySelector('.submit-btn');
    if (purchaseBtn) {
        purchaseBtn.addEventListener('click', (e) => {
            e.preventDefault();
            // if you ever pass a personId in the URL you can preserve it:
            const params = new URLSearchParams(window.location.search);
            const personId = params.get('personId');
            const target = personId
                ? `premium_qr_person.html?personId=${personId}`
                : `premium_qr_person.html`;
            window.location.href = target;
        });
    }

    // menu toggle (same as other pages)
    const btn = document.getElementById('menu-btn');
    const drawer = document.getElementById('side-menu');
    const overlay = document.getElementById('overlay');

    btn.addEventListener('click', () => {
        drawer.classList.toggle('open');
        overlay.classList.toggle('open');
    });
    overlay.addEventListener('click', () => {
        drawer.classList.remove('open');
        overlay.classList.remove('open');
    });

    // grab everything
    const video = document.getElementById('premiumVideo');
    const overlayPlay = document.getElementById('overlayPlay');
    const progress = document.getElementById('progress');
    const controls = document.getElementById('controls');

    video.controls = false

    function showPlayingUi() {
        overlayPlay.style.display = 'none';
        controls.classList.add('is-playing');   // show controls bar
    }

    function showPausedUi() {
        overlayPlay.style.display = 'flex';
        controls.classList.remove('is-playing'); // hide controls bar
    }

    video.addEventListener('play', showPlayingUi);
    video.addEventListener('pause', showPausedUi);
    video.addEventListener('ended', showPausedUi);

    // allow click-anywhere on the video to toggle
    video.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
    });

    // initialize state
    showPausedUi();

    // toggle play/pause
    function togglePlay() {
        if (video.paused) video.play();
        else video.pause();
    }

    // big overlay click → play
    overlayPlay.addEventListener('click', () => {
        togglePlay();
    });

    // update progress bar
    video.addEventListener('timeupdate', () => {
        const pct = video.duration
            ? (video.currentTime / video.duration) * 100
            : 0;
        progress.value = pct;
    });

    // seeker
    progress.addEventListener('input', () => {
        video.currentTime = (progress.value / 100) * video.duration;
    });
});
