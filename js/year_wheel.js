(() => {
    const defaultOptions = {
        initialValue: '',
        onChange: () => { }
    };

    const wheelInstances = new WeakMap();
    const raf = typeof window !== 'undefined' && window.requestAnimationFrame
        ? window.requestAnimationFrame.bind(window)
        : (cb) => setTimeout(cb, 16);
    const caf = typeof window !== 'undefined' && window.cancelAnimationFrame
        ? window.cancelAnimationFrame.bind(window)
        : clearTimeout;

    // Delay before snapping to the nearest enabled item after user scroll
    const SNAP_DELAY_MS = 120;

    class YearWheel {
        constructor(listElement, options = {}) {
            this.list = listElement;
            this.wheel = listElement.closest('.year-wheel') || listElement.parentElement;
            this.options = { ...defaultOptions, ...options };
            this.value = '';
            this.currentItem = null;
            this._scrollFrame = null;
            this._programmaticScroll = false;
            this._programmaticClear = null;
            this._snapDelayTimer = null;

            this.onScroll = this.onScroll.bind(this);
            this.onClick = this.onClick.bind(this);
            this.onKeyDown = this.onKeyDown.bind(this);
            this.onFocus = this.onFocus.bind(this);

            this.initAccessibility();
            this.attachEvents();

            const initial = this.options.initialValue == null ? '' : String(this.options.initialValue);
            if (initial) {
                this.setValue(initial, { silent: true, behavior: 'auto' });
            } else {
                this.clear({ silent: true, keepActive: true, behavior: 'auto' });
            }
            this.snap({ behavior: 'auto', silent: true });
        }

        updateOptions(next = {}) {
            if (!next || typeof next !== 'object') return;
            const needsInitial = Object.prototype.hasOwnProperty.call(next, 'initialValue');
            this.options = { ...this.options, ...next };
            if (needsInitial) {
                const val = next.initialValue == null ? '' : String(next.initialValue);
                this.setValue(val, { silent: true, behavior: 'auto' });
            }
        }

        initAccessibility() {
            if (!this.list.hasAttribute('role')) {
                this.list.setAttribute('role', 'listbox');
            }
            this.list.setAttribute('aria-orientation', 'vertical');
            if (!this.list.hasAttribute('tabindex')) {
                this.list.tabIndex = 0;
            }
        }

        attachEvents() {
            this.list.addEventListener('scroll', this.onScroll, { passive: true });
            this.list.addEventListener('click', this.onClick);
            this.list.addEventListener('keydown', this.onKeyDown);
            this.list.addEventListener('focus', this.onFocus);
        }

        onFocus() {
            // If the user has a current selection and it's selectable (e.g. "Від/До" or a year),
            // just center it; otherwise, pick the nearest selectable.
            if (this.currentItem && this.isSelectable(this.currentItem)) {
                this.scrollToItem(this.currentItem, 'auto');
            } else {
                this.syncToClosest({ silent: true });
            }
        }

        onScroll() {
            if (this._programmaticScroll) return;
            if (this._scrollFrame) caf(this._scrollFrame);
            this._scrollFrame = raf(() => {
                this._scrollFrame = null;
                // Debounce snap: wait briefly for scroll to settle
                if (this._snapDelayTimer) {
                    clearTimeout(this._snapDelayTimer);
                }
                this._snapDelayTimer = setTimeout(() => {
                    this._snapDelayTimer = null;
                    this.syncToClosest({ silent: false });
                }, SNAP_DELAY_MS);
            });
        }

        onClick(event) {
            const item = event.target.closest('li');
            if (!item || !this.list.contains(item)) return;
            event.preventDefault();
            if (!this.isSelectable(item)) return;
            this.applySelection(item, { silent: false, scroll: true, behavior: 'smooth' });
        }

        onKeyDown(event) {
            if (event.key === 'ArrowUp') {
                event.preventDefault();
                this.selectRelative(-1);
            } else if (event.key === 'ArrowDown') {
                event.preventDefault();
                this.selectRelative(1);
            }
        }

        getItems() {
            return Array.from(this.list.querySelectorAll('li'));
        }

        getValueForItem(item) {
            return item?.dataset?.value ?? '';
        }

        isSelectable(item) {
            if (!item) return false;
            if (!this.list.contains(item)) return false;
            if (item.classList.contains('disabled')) return false;
            if (item.hasAttribute('aria-hidden')) return false;
            const style = window.getComputedStyle ? window.getComputedStyle(item) : null;
            if (style && (style.display === 'none' || style.visibility === 'hidden')) return false;
            return true;
        }

        findItemByValue(value) {
            const val = value == null ? '' : String(value);
            return this.getItems().find(item => this.getValueForItem(item) === val) || null;
        }

        findPlaceholder() {
            return this.getItems().find(item => this.getValueForItem(item) === '') || null;
        }

        selectRelative(direction) {
            const selectable = this.getItems().filter(item => this.isSelectable(item));
            if (!selectable.length) return;
            const current = this.currentItem && this.isSelectable(this.currentItem)
                ? this.currentItem
                : this.findItemByValue(this.value);
            let index = selectable.indexOf(current);
            if (index === -1) {
                index = direction > 0 ? -1 : 0;
            }
            index = Math.max(0, Math.min(selectable.length - 1, index + direction));
            const next = selectable[index];
            if (next) {
                this.applySelection(next, { silent: false, scroll: true, behavior: 'smooth' });
            }
        }

        scrollToItem(item, behavior = 'smooth') {
            if (!item) return;
            const targetTop = item.offsetTop - (this.list.clientHeight / 2) + (item.offsetHeight / 2);
            const scrollBehavior = behavior === 'smooth' ? 'smooth' : 'auto';
            this._programmaticScroll = true;
            try {
                this.list.scrollTo({ top: targetTop, behavior: scrollBehavior });
            } catch (e) {
                this.list.scrollTop = targetTop;
            }
            if (this._programmaticClear) caf(this._programmaticClear);
            this._programmaticClear = raf(() => {
                this._programmaticScroll = false;
                this._programmaticClear = null;
            });
        }

        applySelection(item, opts = {}) {
            const { silent = false, scroll = true, behavior = 'smooth' } = opts;
            if (!item) return;
            const newValue = this.getValueForItem(item);
            const oldValue = this.value;
            if (this.currentItem && this.currentItem !== item) {
                this.currentItem.classList.remove('selected');
                this.currentItem.removeAttribute('aria-selected');
            }
            this.currentItem = item;
            this.value = newValue;
            item.classList.add('selected');
            item.setAttribute('aria-selected', 'true');

            if (scroll) {
                this.scrollToItem(item, behavior);
            }

            if (!silent && newValue !== oldValue) {
                this.options.onChange(newValue);
            }
        }

        syncToClosest(opts = {}) {
            const { silent = false } = opts;
            const closest = this.findClosestToCenter();
            if (!closest) return;
            // If we’re correcting away from a disabled center, also move the wheel.
            const shouldScroll = true; // safe default for a crisp snap experience
            this.applySelection(closest, { silent, scroll: shouldScroll, behavior: 'auto' });
        }

        findClosestToCenter() {
            const items = this.getItems();
            if (!items.length) return null;
            const container = this.wheel || this.list;
            const rect = container.getBoundingClientRect();
            const center = rect.top + rect.height / 2;
            let best = null;
            let minDist = Infinity;
            for (const item of items) {
                if (!this.isSelectable(item)) continue;
                const itemRect = item.getBoundingClientRect();
                if (!itemRect || !itemRect.height) continue;
                const itemCenter = itemRect.top + itemRect.height / 2;
                const dist = Math.abs(itemCenter - center);
                if (dist < minDist) {
                    minDist = dist;
                    best = item;
                }
            }
            return best || this.findPlaceholder();
        }

        findNearestSelectable(reference) {
            const items = this.getItems();
            if (!items.length) return null;
            let index = reference ? items.indexOf(reference) : -1;
            if (index === -1 && this.value) {
                index = items.findIndex(item => this.getValueForItem(item) === this.value);
            }
            if (index === -1) {
                return this.findClosestToCenter();
            }
            for (let offset = 0; offset < items.length; offset += 1) {
                const forward = items[index + offset];
                if (forward && this.isSelectable(forward)) return forward;
                const backward = items[index - offset];
                if (backward && this.isSelectable(backward)) return backward;
            }
            return this.findPlaceholder();
        }

        getValue() {
            return this.value;
        }

        setValue(value, opts = {}) {
            const { silent = false, behavior = 'smooth' } = opts;
            const val = value == null ? '' : String(value);
            if (!val) {
                this.clear({ silent, keepActive: true, behavior });
                return;
            }
            const item = this.findItemByValue(val);
            if (!item) {
                this.clear({ silent, keepActive: true, behavior });
                return;
            }
            if (!this.isSelectable(item)) {
                const fallback = this.findNearestSelectable(item);
                if (fallback) {
                    this.applySelection(fallback, { silent, scroll: true, behavior });
                }
                return;
            }
            this.applySelection(item, { silent, scroll: true, behavior });
        }

        clear(opts = {}) {
            const { silent = false, keepActive = true, behavior = 'smooth' } = opts;
            const previous = this.value;
            if (this.currentItem) {
                this.currentItem.classList.remove('selected');
                this.currentItem.removeAttribute('aria-selected');
                this.currentItem = null;
            }
            this.value = '';
            if (keepActive) {
                const placeholder = this.findPlaceholder();
                if (placeholder) {
                    this.applySelection(placeholder, { silent: true, scroll: true, behavior });
                }
            }
            if (!silent && previous !== '') {
                this.options.onChange('');
            }
        }

        snap(opts = {}) {
            const { behavior = 'smooth', silent = true } = opts;
            const target = this.currentItem || this.findItemByValue(this.value) || this.findPlaceholder() || this.findClosestToCenter();
            if (target) {
                this.scrollToItem(target, behavior);
                if (!silent) {
                    this.syncToClosest({ silent: false });
                }
            }
        }

        refresh(opts = {}) {
            const { silent = true } = opts;
            let current = this.currentItem && this.list.contains(this.currentItem) ? this.currentItem : null;
            if (current && !this.isSelectable(current)) {
                const fallback = this.findNearestSelectable(current);
                if (fallback) {
                    this.applySelection(fallback, { silent, scroll: true, behavior: 'auto' });
                } else {
                    this.clear({ silent, keepActive: false });
                }
                return;
            }
            if (!current) {
                const byValue = this.findItemByValue(this.value);
                if (byValue && this.isSelectable(byValue)) {
                    this.applySelection(byValue, { silent: true, scroll: false, behavior: 'auto' });
                    return;
                }
                const fallback = this.findClosestToCenter();
                if (fallback) {
                    this.applySelection(fallback, { silent, scroll: false, behavior: 'auto' });
                }
                return;
            }
            current.classList.add('selected');
            current.setAttribute('aria-selected', 'true');
        }
    }

    function createYearWheel(listElement, options = {}) {
        if (!listElement || !(listElement instanceof HTMLElement)) {
            throw new Error('createYearWheel expects a DOM element.');
        }
        const existing = wheelInstances.get(listElement);
        if (existing) {
            existing.updateOptions(options);
            return existing;
        }
        const instance = new YearWheel(listElement, options);
        wheelInstances.set(listElement, instance);
        return instance;
    }

    window.createYearWheel = createYearWheel;
})();
