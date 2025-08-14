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
    const playPause = document.getElementById('playPause');
    const progress = document.getElementById('progress');
    const timeLabel = document.getElementById('timeLabel');
    const controls = document.getElementById('controls');

    video.controls = false

    // when video plays
    video.addEventListener('play', () => {
        overlayPlay.style.display = 'none';
        controls.classList.add('is-playing');   // show controls bar
        setSmallIcon(true);
    });

    // when video pauses or ends
    function hideUiForPause() {
        overlayPlay.style.display = 'flex';
        controls.classList.remove('is-playing'); // hide controls bar
        setSmallIcon(false);
    }
    video.addEventListener('pause', hideUiForPause);
    video.addEventListener('ended', hideUiForPause);

    // allow click-anywhere on the video to toggle
    video.addEventListener('click', () => {
        if (video.paused) video.play();
        else video.pause();
    });

    // initialize state
    overlayPlay.style.display = 'flex';  // show big play
    playPause.style.display = 'none';  // hide small button

    // helper to swap small button icon
    function setSmallIcon(isPlaying) {
        if (isPlaying) {
            playPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M6 19h4V5H6zm8-14v14h4V5z"/></svg>';
        } else {
            playPause.innerHTML = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z"/></svg>';
        }
    }

    // toggle play/pause
    function togglePlay() {
        if (video.paused) video.play();
        else video.pause();
    }

    // big overlay click → play
    overlayPlay.addEventListener('click', () => {
        togglePlay();
    });

    // small button click → toggle
    playPause.addEventListener('click', togglePlay);

    // when video plays
    video.addEventListener('play', () => {
        overlayPlay.style.display = 'none';   // hide big
        playPause.style.display = 'flex';   // show small
        setSmallIcon(true);
    });

    // when video pauses
    video.addEventListener('pause', () => {
        overlayPlay.style.display = 'flex';   // show big
        playPause.style.display = 'none';   // hide small
        setSmallIcon(false);
    });

    // update progress bar + time
    video.addEventListener('timeupdate', () => {
        const pct = video.duration
            ? (video.currentTime / video.duration) * 100
            : 0;
        progress.value = pct;
        const m = Math.floor(video.currentTime / 60);
        const s = String(Math.floor(video.currentTime % 60)).padStart(2, '0');
        timeLabel.textContent = `${m}:${s}`;
    });

    // seeker
    progress.addEventListener('input', () => {
        video.currentTime = (progress.value / 100) * video.duration;
    });
});