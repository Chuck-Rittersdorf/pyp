// ux_script.js
// This script is dedicated to managing the User Experience (UX) related to the
// bottom control bars in the web application. Its main responsibilities are:
// 1. Allowing users to minimize and maximize the main controls bar and the part controls bar.
// 2. Dynamically adjusting the bottom padding of the webpage's body. This ensures that
//    content at the bottom of the page is not hidden underneath these fixed-position control bars,
//    especially when their height changes (due to minimizing/maximizing).

// The entire script is wrapped in a 'DOMContentLoaded' event listener.
// This means the script will only execute after the entire HTML document
// has been fully loaded and parsed by the browser. This is important because
// the script needs to interact with HTML elements, and those elements must
// exist in the document before the script tries to find and use them.
document.addEventListener('DOMContentLoaded', () => {

    // --- SVG Icon Definitions ---
    // These are string representations of SVG (Scalable Vector Graphics) images.
    // SVGs are used for icons because they are lightweight and scale perfectly
    // without losing quality (unlike traditional image formats like JPG or PNG).
    // 'iconMinimizeSVG': An upward-pointing arrow, typically used to indicate "collapse" or "minimize".
    // 'iconMaximizeSVG': A downward-pointing arrow, typically used to indicate "expand" or "maximize".
    const iconMinimizeSVG = `<svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 15.41L12 10.83l4.59 4.58L18 14l-6-6-6 6 1.41 1.41z"/></svg>`;
    const iconMaximizeSVG = `<svg class="toggle-icon" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" width="18px" height="18px"><path d="M0 0h24v24H0V0z" fill="none"/><path d="M7.41 8.59L12 13.17l4.59-4.58L18 10l-6 6-6-6 1.41-1.41z"/></svg>`;

    // --- State Variables ---
    // These variables keep track of whether each control bar is currently minimized or not.
    // 'isMainControlsMinimized': true if the main controls bar is minimized, false otherwise.
    // 'isPartsControlsMinimized': true if the part controls bar is minimized, false otherwise.
    let isMainControlsMinimized = false;
    let isPartsControlsMinimized = false;

    // --- DOM Element References ---
    // These constants store references to specific HTML elements from the page.
    // Using `document.getElementById()` is a common way to access an element by its unique ID.
    // Storing these in variables makes the code cleaner and slightly more efficient,
    // as the browser doesn't have to search for the element every time it's needed.
    const body = document.body; // Reference to the <body> element of the page.
    const mainControlsBar = document.getElementById('mainControlsBar'); // The main control bar itself.
    const mainControlsContentWrapper = document.getElementById('mainControlsContentWrapper'); // The content area within the main bar.
    const toggleMainControlsButton = document.getElementById('toggleMainControlsButton'); // The button to minimize/maximize the main bar.
    const partControlsBar = document.getElementById('partControlsBar'); // The part controls bar.
    const partControlsContentWrapper = document.getElementById('partControlsContentWrapper'); // The content area within the part bar.
    const togglePartControlsButton = document.getElementById('togglePartControlsButton'); // The button for the part bar.

    // --- Dimension Variables ---
    // These variables will store height values (in pixels) read from CSS custom properties.
    // This allows the JavaScript to be aware of the dimensions defined in the CSS,
    // making the layout calculations more flexible and maintainable (styling is kept in CSS).
    let mainControlsNormalHeight = 0, mainControlsMinimizedHeight = 0; // Heights for the main bar.
    let partsControlsNormalHeight = 0, partsControlsMinimizedHeight = 0; // Heights for the parts bar.
    let pageFixedBottomOffset = 0; // An additional offset for the body padding.
    let interBarGap = 0; // The gap defined between the two control bars.

    /**
     * Parses a CSS dimension string (e.g., "70px", "15rem") into a floating-point number.
     * It extracts the numeric part of the string.
     * @param {string | null | undefined} value - The CSS dimension string to parse.
     * @returns {number} The parsed numeric value, or 0 if the value is null, undefined, or cannot be parsed.
     */
    function parseCssDimension(value) {
        if (value === null || typeof value === 'undefined') return 0; // Handle null or undefined input
        // `parseFloat()` attempts to convert the beginning of the string to a number.
        // If it fails (e.g., the string doesn't start with a number), it returns NaN (Not a Number).
        // The `|| 0` ensures that if `parseFloat` returns NaN, we use 0 instead.
        return parseFloat(value) || 0;
    }

    /**
     * Loads various dimension values from CSS custom properties (also known as CSS variables).
     * CSS custom properties (like `--main-bar-min-height`) are defined in the `style.css` file.
     * This function reads these values at runtime, allowing the JavaScript to adapt to
     * styling changes without needing code modifications.
     */
    function loadDimensions() {
        // `getComputedStyle(document.documentElement)` gets the actual styles applied to the root element (<html>).
        // This is where CSS custom properties are often defined globally.
        const rootStyle = getComputedStyle(document.documentElement);

        // For each dimension, get the property value from CSS and parse it into a number.
        mainControlsNormalHeight = parseCssDimension(rootStyle.getPropertyValue('--main-bar-min-height'));
        mainControlsMinimizedHeight = parseCssDimension(rootStyle.getPropertyValue('--main-bar-minimized-height'));
        partsControlsNormalHeight = parseCssDimension(rootStyle.getPropertyValue('--parts-bar-min-height'));
        partsControlsMinimizedHeight = parseCssDimension(rootStyle.getPropertyValue('--parts-bar-minimized-height'));
        pageFixedBottomOffset = parseCssDimension(rootStyle.getPropertyValue('--page-fixed-bottom-offset'));
        interBarGap = parseCssDimension(rootStyle.getPropertyValue('--inter-bar-gap'));
    }

    /**
     * Updates the bottom padding of the `<body>` element.
     * This is crucial because the control bars are fixed at the bottom of the screen.
     * Without this padding, content at the very bottom of the page might be covered by the bars.
     * The padding amount is calculated based on the current heights of both control bars
     * (whether they are minimized or expanded), the gap between them, and a general offset.
     */
    function updateBodyPadding() {
        if (!body) return; // Safety check: do nothing if the body element isn't found.

        // Determine the current height of the main controls bar based on its minimized state.
        const mainHeight = isMainControlsMinimized ? mainControlsMinimizedHeight : mainControlsNormalHeight;
        // Determine the current height of the part controls bar.
        const partsHeight = isPartsControlsMinimized ? partsControlsMinimizedHeight : partsControlsNormalHeight;

        // Calculate the total height required for the padding.
        const totalRequiredHeight = mainHeight + partsHeight + interBarGap + pageFixedBottomOffset;

        // Apply the calculated padding to the bottom of the body.
        // The `${totalRequiredHeight}px` creates a string like "150px".
        body.style.paddingBottom = `${totalRequiredHeight}px`;
    }

    /**
     * Sets up a toggle button for a specific control bar.
     * This function configures a button to minimize or maximize a given bar.
     * It handles:
     * - Setting the initial icon and title of the button.
     * - Adding a click event listener to the button.
     * - Toggling CSS classes on the bar to change its appearance (minimized/maximized).
     * - Updating the button's icon and title based on the bar's state.
     * - Updating the internal state variable for the bar (e.g., `isMainControlsMinimized`).
     * - Calling `updateBodyPadding()` to adjust page layout.
     *
     * @param {HTMLElement} buttonEl - The HTML element of the toggle button.
     * @param {HTMLElement} barEl - The HTML element of the control bar to be toggled.
     * @param {HTMLElement} contentWrapperEl - The HTML element that wraps the content inside the bar (this is often hidden/shown).
     * @param {string} minimizedClassName - The CSS class name (e.g., "minimized") to add/remove from `barEl`.
     * @param {function(boolean):void} stateUpdaterCallback - A function to call to update the global minimized state for this bar. It receives `true` if minimized, `false` otherwise.
     * @param {string} barNameIdentifier - A user-friendly name for the bar (e.g., "Main Controls") used in button titles.
     */
    function setupToggleButton(buttonEl, barEl, contentWrapperEl, minimizedClassName, stateUpdaterCallback, barNameIdentifier) {
        // Safety check: ensure all required HTML elements are provided.
        if (!buttonEl || !barEl || !contentWrapperEl) {
            console.error(`UX Script: Missing elements for '${barNameIdentifier}' toggle. Check IDs.`);
            return; // Stop if elements are missing.
        }

        // Set the initial appearance of the toggle button.
        // It starts by showing the "minimize" icon (upward arrow) because bars are initially expanded.
        buttonEl.innerHTML = iconMinimizeSVG;
        // The `title` attribute provides tooltip text when a user hovers over the button.
        buttonEl.title = `Minimize ${barNameIdentifier}`;

        // Add an event listener that triggers when the button is clicked.
        buttonEl.addEventListener('click', () => {
            // Check if the bar currently has the 'minimized' CSS class.
            const isCurrentlyMinimized = barEl.classList.contains(minimizedClassName);

            if (isCurrentlyMinimized) {
                // If the bar IS currently minimized, then expand it:
                barEl.classList.remove(minimizedClassName); // Remove the 'minimized' class.
                buttonEl.innerHTML = iconMinimizeSVG;      // Change icon to "minimize" (up arrow).
                buttonEl.title = `Minimize ${barNameIdentifier}`; // Update tooltip.
                stateUpdaterCallback(false); // Update the global state to indicate it's no longer minimized.
            } else {
                // If the bar IS NOT currently minimized (i.e., it's expanded), then minimize it:
                barEl.classList.add(minimizedClassName);    // Add the 'minimized' class.
                buttonEl.innerHTML = iconMaximizeSVG;       // Change icon to "maximize" (down arrow).
                buttonEl.title = `Maximize ${barNameIdentifier}`; // Update tooltip.
                stateUpdaterCallback(true);  // Update the global state to indicate it is now minimized.
            }

            // After toggling the bar's state, update the body padding to reflect any height changes.
            updateBodyPadding();
        });
    }

    // --- Initialization Block ---
    // This is where the script starts its main setup sequence.

    // First, perform a crucial check to ensure all essential HTML elements for the script exist.
    // If any of these are missing, the script cannot function correctly, so it logs an error and stops.
    if (!body || !mainControlsBar || !toggleMainControlsButton || !mainControlsContentWrapper ||
        !partControlsBar || !togglePartControlsButton || !partControlsContentWrapper) {
        console.error("UX Script: Crucial elements for bar toggling not found. Initialization aborted.");
        return; // Exit the script if key elements are missing.
    }
    
    // Load the dimension values (heights, gaps, offsets) from the CSS custom properties.
    // This needs to be done before setting up toggle buttons or updating padding,
    // as those functions rely on these dimension values.
    loadDimensions();

    // Set up the toggle button for the Main Controls Bar.
    setupToggleButton(
        toggleMainControlsButton,       // The button element
        mainControlsBar,                // The bar element
        mainControlsContentWrapper,     // The content wrapper inside the bar
        'minimized',                    // The CSS class for the minimized state
        (isMinimized) => { isMainControlsMinimized = isMinimized; }, // Function to update its state variable
        'Main Controls'                 // Name for tooltips
    );

    // Set up the toggle button for the Part Controls Bar.
    setupToggleButton(
        togglePartControlsButton,       // The button element
        partControlsBar,                // The bar element
        partControlsContentWrapper,     // The content wrapper inside the bar
        'minimized',                    // The CSS class for the minimized state
        (isMinimized) => { isPartsControlsMinimized = isMinimized; }, // Function to update its state variable
        'Part Controls'                 // Name for tooltips
    );

    // Call `updateBodyPadding()` once at the start to set the initial correct
    // bottom padding for the body, based on the initial (expanded) state of the bars.
    updateBodyPadding();

    // Log a message to the browser's developer console to confirm that the script has initialized.
    // This is helpful for debugging.
    console.log("UX Script: Initialized successfully for bottom bar toggling.");
});