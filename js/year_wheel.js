(function () {
    const DEFAULT_ITEM_HEIGHT = 44;
    const DEFAULT_VISIBLE_COUNT = 5;
    const DRUM_MAX_SLICES = 3;
    const SNAP_DELAY = 120;

    const isNumber = (val) => typeof val === 'number' && !Number.isNaN(val);

    function clamp(value, min, max) {
        return Math.max(min, Math.min(max, value));
    }

    function getCssNumber(target, prop, fallback) {
        if (!target) return fallback;
        const raw = parseFloat(getComputedStyle(target).getPropertyValue(prop));
        return Number.isFinite(raw) ? raw : fallback;
    }

    function noopWheel() {
        return {
            getValue: () => '',
            setValue: () => { },
            clear: () => { },
            snap: () => { },
            refresh: () => { },
        };
    }

    function createYearWheel(listEl, options = {}) {
        if (!listEl) {
            console.warn('[year_wheel] list element is required');
            return noopWheel();
        }

        const panelEl = listEl.closest('.years-panel');
        const wheelEl = listEl.closest('.year-wheel');
        const panelStyles = panelEl ? getComputedStyle(panelEl) : null;

        const itemHeight = options.itemHeight
            || getCssNumber(panelEl, '--year-item-height', DEFAULT_ITEM_HEIGHT);
        const visibleCount = options.visibleCount
            || getCssNumber(panelEl, '--year-visible-count', DEFAULT_VISIBLE_COUNT);
        const centerOffset = (visibleCount - 1) / 2;

        if (wheelEl) {
            wheelEl.classList.add('year-wheel--enhanced');
        }

        let items = Array.from(listEl.children);
        if (!items.length) {
            console.warn('[year_wheel] list has no items');
            return noopWheel();
        }

        const onChange = typeof options.onChange === 'function' ? options.onChange : null;

        let activeIndex = 0;
        let committedValue = '';
        let rafId = null;
        let snapTimer = null;
        let suppressed = true;

        const getValueAt = (idx) => {
            const item = items[idx];
            if (!item) return '';
            return item.dataset.value ?? item.textContent.trim();
        };

        const findIndexByValue = (value) => {
            if (value == null || value === '') return -1;
            const target = String(value);
            return items.findIndex((li) => (li.dataset.value ?? li.textContent.trim()) === target);
        };

        const isDisabled = (idx) => {
            const item = items[idx];
            return !item || item.classList.contains('disabled');
        };

        const findNearestEnabled = (idx) => {
            if (!items.length) return -1;
            let target = clamp(idx, 0, items.length - 1);
            if (!isDisabled(target)) return target;
            for (let offset = 1; offset < items.length; offset += 1) {
                const prev = target - offset;
                if (prev >= 0 && !isDisabled(prev)) return prev;
                const next = target + offset;
                if (next < items.length && !isDisabled(next)) return next;
            }
            return -1;
        };

        const setCommitted = (value) => {
            committedValue = value || '';
            if (committedValue) {
                listEl.dataset.selectedValue = committedValue;
            } else {
                delete listEl.dataset.selectedValue;
            }
        };

        const setActiveIndex = (idx) => {
            if (!items.length) return -1;
            const target = findNearestEnabled(idx);
            if (target === -1) return -1;
            if (activeIndex === target) return target;
            activeIndex = target;
            items.forEach((li, i) => {
                li.classList.toggle('selected', i === target);
            });
            return target;
        };

        const scrollToIndex = (idx, behavior = 'auto') => {
            const target = clamp(idx, 0, items.length - 1);
            const top = target * itemHeight;
            if (typeof listEl.scrollTo === 'function') {
                listEl.scrollTo({ top, behavior });
            } else {
                listEl.scrollTop = top;
            }
        };

        const updateDrumStyles = () => {
            const scrollIndex = listEl.scrollTop / itemHeight;
            const centerIndex = scrollIndex + centerOffset;

            items.forEach((li, i) => {
                const delta = i - centerIndex;
                const absDelta = Math.abs(delta);
                const slice = Math.min(absDelta, DRUM_MAX_SLICES);
                const angle = delta * 18;
                const depth = Math.max(0, 56 - slice * 18);
                const scale = Math.max(0.82, 1 - slice * 0.12);
                const opacity = Math.max(0.28, 1 - slice * 0.32);
                li.style.transform = `translateZ(${depth}px) rotateX(${angle}deg) scale(${scale})`;
                li.style.opacity = opacity.toFixed(3);
                li.style.zIndex = String(100 - Math.round(slice * 10));
            });

            const nearest = clamp(Math.round(centerIndex), 0, items.length - 1);
            setActiveIndex(nearest);
        };

        const scheduleDrumUpdate = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                rafId = null;
                updateDrumStyles();
            });
        };

        const applySelected = (idx, behavior = 'auto', config = {}) => {
            const { commit = true, silent = false } = config;
            const target = setActiveIndex(idx);
            if (target === -1) return -1;

            if (behavior !== 'none') {
                scrollToIndex(target, behavior);
            }

            if (commit) {
                const previous = committedValue;
                setCommitted(getValueAt(target));
                if (!suppressed && !silent && onChange && previous !== committedValue) {
                    onChange(committedValue);
                }
            }

            scheduleDrumUpdate();
            return target;
        };

        const snapToNearest = (opts = {}) => {
            const { behavior = 'smooth', silent = false } = opts;
            const scrollIndex = listEl.scrollTop / itemHeight;
            const centerIndex = scrollIndex + centerOffset;
            const nearest = clamp(Math.round(centerIndex), 0, items.length - 1);
            return applySelected(nearest, behavior, { commit: true, silent });
        };

        const handleScroll = () => {
            scheduleDrumUpdate();
            if (!snapOnStop) return;
            if (snapTimer) clearTimeout(snapTimer);
            snapTimer = setTimeout(() => {
                snapToNearest({ behavior: 'smooth', silent: false });
            }, SNAP_DELAY);
        };


        const handleClick = (event) => {
            const li = event.target.closest('li');
            if (!li) return;
            const idx = items.indexOf(li);
            if (idx === -1 || isDisabled(idx)) return;
            applySelected(idx, 'smooth', { commit: true, silent: false });
        };

        listEl.addEventListener('scroll', handleScroll, { passive: true });
        listEl.addEventListener('click', handleClick);

        const initFromValue = () => {
            if (options.initialValue != null && options.initialValue !== '') {
                const idx = findIndexByValue(options.initialValue);
                if (idx !== -1) {
                    setCommitted(String(options.initialValue));
                    applySelected(idx, 'auto', { commit: true, silent: true });
                    return;
                }
            }

            if (listEl.dataset.selectedValue) {
                const idx = findIndexByValue(listEl.dataset.selectedValue);
                if (idx !== -1) {
                    setCommitted(listEl.dataset.selectedValue);
                    applySelected(idx, 'auto', { commit: true, silent: true });
                    return;
                }
            }

            const preselectedIdx = items.findIndex((li) => li.classList.contains('selected'));
            if (preselectedIdx !== -1) {
                const val = getValueAt(preselectedIdx);
                setCommitted(val);
                applySelected(preselectedIdx, 'auto', { commit: true, silent: true });
                return;
            }

            const fallback = clamp(Math.round(centerOffset), 0, items.length - 1);
            applySelected(fallback, 'auto', { commit: false, silent: true });
            scrollToIndex(fallback, 'auto');
        };

        initFromValue();
        scheduleDrumUpdate();
        suppressed = false;

        return {
            getValue: () => committedValue || '',
            setValue: (value, opts = {}) => {
                const { silent = false, behavior = 'auto' } = opts;
                if (value == null || value === '') {
                    const previous = committedValue;
                    setCommitted('');
                    if (!suppressed && !silent && onChange && previous !== committedValue) {
                        onChange('');
                    }
                    scheduleDrumUpdate();
                    return;
                }
                const idx = findIndexByValue(value);
                if (idx === -1) return;
                applySelected(idx, behavior, { commit: true, silent });
            },
            clear: (opts = {}) => {
                const { silent = false, keepActive = true } = opts;
                const previous = committedValue;
                setCommitted('');
                if (!keepActive) {
                    activeIndex = -1;
                    items.forEach((li) => li.classList.remove('selected'));
                } else {
                    items.forEach((li, i) => li.classList.toggle('selected', i === activeIndex));
                }
                if (!suppressed && !silent && onChange && previous !== committedValue) {
                    onChange('');
                }
                scheduleDrumUpdate();
            },
            snap: (opts = {}) => {
                snapToNearest(opts);
            },
            refresh: () => {
                items = Array.from(listEl.children);
                scheduleDrumUpdate();
            },
        };
    }

    window.createYearWheel = createYearWheel;
})();
