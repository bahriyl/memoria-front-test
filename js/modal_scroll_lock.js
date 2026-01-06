(function () {
    const MODAL_SELECTOR = [
        '.modal',
        '.modal-overlay',
        '.login-modal',
        '.rs-video-modal',
        '.avatar-cropper',
        '.avatar-cropper-overlay',
        '.hero-picker',
        '.modal-progress',
        '.photo-desc-modal'
    ].join(',');

    const isVisible = (el) => {
        if (!el) return false;
        if (el.hidden || el.hasAttribute('hidden')) return false;
        const style = window.getComputedStyle(el);
        if (style.display === 'none' || style.visibility === 'hidden') return false;
        return true;
    };

    const updateScrollLock = () => {
        const nodes = document.querySelectorAll(MODAL_SELECTOR);
        let hasOpenModal = false;
        for (const node of nodes) {
            if (isVisible(node)) {
                hasOpenModal = true;
                break;
            }
        }
        document.documentElement.classList.toggle('modal-open', hasOpenModal);
        document.body.classList.toggle('modal-open', hasOpenModal);
    };

    const ensureStyle = () => {
        if (document.getElementById('modal-scroll-lock-style')) return;
        const style = document.createElement('style');
        style.id = 'modal-scroll-lock-style';
        style.textContent = `
html.modal-open,
body.modal-open {
    overflow: hidden !important;
}
`;
        document.head.appendChild(style);
    };

    const init = () => {
        if (!document.body) return;
        ensureStyle();
        updateScrollLock();

        const observer = new MutationObserver(updateScrollLock);
        observer.observe(document.body, {
            attributes: true,
            childList: true,
            subtree: true,
            attributeFilter: ['class', 'style', 'hidden', 'aria-hidden', 'open']
        });

        window.addEventListener('pageshow', updateScrollLock);
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})();
