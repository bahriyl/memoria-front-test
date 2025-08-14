// global.js — forward & back page transitions (safe, BFCache-aware)
// Requires GSAP on every page.

(function () {
    const DIR_KEY = "pt:dir";
    const FORWARD = "forward";
    const BACKWARD = "back";

    // Create/find the wrapper that we animate
    function getPageWrapper() {
        let page = document.querySelector(".page-content");
        if (page) return page;

        // Create wrapper and move safe nodes into it
        const wrapper = document.createElement("div");
        wrapper.className = "page-content";

        const nodes = Array.from(document.body.children);
        nodes.forEach((node) => {
            // leave transition overlays, scripts, and styles outside
            if (node.id === "page-transition") return;
            if (node.tagName === "SCRIPT" || node.tagName === "STYLE" || node.tagName === "LINK") return;
            wrapper.appendChild(node);
        });

        document.body.insertBefore(wrapper, document.body.firstChild);
        return wrapper;
    }

    function haveGSAP() {
        return typeof window.gsap !== "undefined";
    }

    function playEnter(dir) {
        const page = getPageWrapper();
        if (!haveGSAP()) {
            page.style.transform = "none";
            sessionStorage.removeItem(DIR_KEY);
            return;
        }
        // Start position (set in JS so the page is never hidden if JS fails)
        const startX = dir === FORWARD ? "100%" : dir === BACKWARD ? "-30%" : null;
        if (!startX) return;

        page.style.willChange = "transform";
        page.style.transform = `translateX(${startX})`;

        gsap.to(page, {
            x: "0%",
            duration: 0.5,
            ease: "power2.out",
            onComplete: () => {
                page.style.willChange = "";
                page.style.transform = ""; // clear inline
                sessionStorage.removeItem(DIR_KEY);
            },
        });
    }

    // Eligibility for in-site links
    function isEligibleLink(a) {
        if (!a || !a.href) return false;
        if (a.target && a.target !== "_self") return false;       // new tab/window
        const href = a.getAttribute("href") || "";
        if (href.startsWith("#")) return false;                   // anchors
        if (a.hasAttribute("download")) return false;             // downloads
        const url = new URL(a.href, location.href);
        if (url.origin !== location.origin) return false;         // external
        // same page → no-op
        if (url.pathname === location.pathname && url.search === location.search) return false;
        return true;
    }

    function navigateWithTransition(href, dir) {
        const page = getPageWrapper();
        if (!haveGSAP()) {
            window.location.href = href;
            return;
        }
        sessionStorage.setItem(DIR_KEY, dir);
        page.style.willChange = "transform";

        // Forward leaves slightly left; Back leaves to the right
        const leaveX = dir === FORWARD ? "-30%" : "100%";
        gsap.to(page, {
            x: leaveX,
            opacity: dir === FORWARD ? 0.85 : 1,
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => {
                window.location.href = href;
            },
        });
    }

    function historyBackWithTransition() {
        const page = getPageWrapper();
        if (!haveGSAP()) {
            history.back();
            return;
        }
        sessionStorage.setItem(DIR_KEY, BACKWARD);
        page.style.willChange = "transform";
        gsap.to(page, {
            x: "100%",
            duration: 0.4,
            ease: "power2.in",
            onComplete: () => history.back(),
        });
    }

    // ENTER (on load or BFCache restore)
    function handleEnter() {
        const dir = sessionStorage.getItem(DIR_KEY);
        if (dir === FORWARD || dir === BACKWARD) {
            playEnter(dir);
        }
    }

    document.addEventListener("DOMContentLoaded", handleEnter);
    // BFCache restore (Safari/Firefox/Chrome)
    window.addEventListener("pageshow", (e) => {
        if (e.persisted || (performance.getEntriesByType("navigation")[0]?.type === "back_forward")) {
            handleEnter();
        }
    });

    // LEAVE (intercept clicks)
    document.addEventListener("click", (e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;

        // 1) Back links explicitly marked
        const backLink = e.target.closest('a[data-nav="back"]');
        if (backLink) {
            e.preventDefault();
            navigateWithTransition(backLink.href, BACKWARD);
            return;
        }

        // 2) A generic back button that should do history.back()
        const backBtn = e.target.closest(".back-button");
        if (backBtn && (!backBtn.getAttribute("href") || backBtn.getAttribute("href") === "#")) {
            e.preventDefault();
            historyBackWithTransition();
            return;
        }

        // 3) Normal forward links
        const a = e.target.closest("a[href]");
        if (!isEligibleLink(a)) return;
        e.preventDefault();
        navigateWithTransition(a.href, FORWARD);
    });

    // Expose helper for programmatic nav
    window.navigateWithTransition = navigateWithTransition;
    window.historyBackWithTransition = historyBackWithTransition;
})();
