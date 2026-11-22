// ux_script.js
// Manages UI chrome interactions: collapsible Part Mixer drawer,
// keyboard shortcuts modal, toast notifications, and drag-and-drop zone.

(function () {
    const PYP_UX = {
        showToast(message, type = 'info', durationMs = 2600) {
            const container = document.getElementById('toastContainer');
            if (!container) return;

            const toast = document.createElement('div');
            toast.className = `toast-item toast-${type}`;
            toast.textContent = message;
            container.appendChild(toast);

            requestAnimationFrame(() => toast.classList.add('visible'));

            window.setTimeout(() => {
                toast.classList.remove('visible');
                window.setTimeout(() => toast.remove(), 220);
            }, durationMs);
        },

        setMixerExpanded(expanded) {
            const drawer = document.getElementById('partControlsBar');
            const btn = document.getElementById('togglePartControlsButton');
            if (!drawer || !btn) return;
            drawer.classList.toggle('minimized', !expanded);
            btn.setAttribute('aria-expanded', String(expanded));
        },

        initDropZone(onFileDropped) {
            const workspace = document.getElementById('scoreWorkspace');
            const overlay = document.getElementById('dropOverlay');
            if (!workspace || !overlay) return;

            let dragCounter = 0;

            const isFileDrag = (e) => {
                if (!e.dataTransfer || !e.dataTransfer.types) return false;
                return Array.from(e.dataTransfer.types).includes('Files');
            };

            window.addEventListener('dragenter', (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                dragCounter++;
                overlay.hidden = false;
            });

            window.addEventListener('dragover', (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                e.dataTransfer.dropEffect = 'copy';
            });

            window.addEventListener('dragleave', (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                dragCounter = Math.max(0, dragCounter - 1);
                if (dragCounter === 0) {
                    overlay.hidden = true;
                }
            });

            window.addEventListener('drop', (e) => {
                if (!isFileDrag(e)) return;
                e.preventDefault();
                dragCounter = 0;
                overlay.hidden = true;

                const file = e.dataTransfer.files && e.dataTransfer.files[0];
                if (file && typeof onFileDropped === 'function') {
                    onFileDropped(file);
                }
            });
        }
    };

    window.PYP_UX = PYP_UX;

    document.addEventListener('DOMContentLoaded', () => {
        // Collapsible Part Mixer toggle
        const toggleMixerBtn = document.getElementById('togglePartControlsButton');
        const mixerDrawer = document.getElementById('partControlsBar');

        if (toggleMixerBtn && mixerDrawer) {
            toggleMixerBtn.addEventListener('click', () => {
                const isCollapsed = mixerDrawer.classList.contains('minimized');
                PYP_UX.setMixerExpanded(isCollapsed);
            });
        }

        // Keyboard shortcuts modal
        const helpBtn = document.getElementById('shortcutsHelpBtn');
        const modal = document.getElementById('shortcutsModal');
        const closeBtn = document.getElementById('closeShortcutsBtn');

        const openModal = () => {
            if (modal) modal.hidden = false;
        };
        const closeModal = () => {
            if (modal) modal.hidden = true;
        };

        if (helpBtn) helpBtn.addEventListener('click', openModal);
        if (closeBtn) closeBtn.addEventListener('click', closeModal);
        if (modal) {
            modal.addEventListener('click', (e) => {
                if (e.target === modal) closeModal();
            });
        }

        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && modal && !modal.hidden) {
                closeModal();
            } else if (e.key === '?' && !['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement?.tagName)) {
                e.preventDefault();
                if (modal) modal.hidden = !modal.hidden;
            }
        });
    });
})();
