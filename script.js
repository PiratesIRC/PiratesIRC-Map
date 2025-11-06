/*
    Enhanced Interactive Map with 5x5 Sub-Grid System
    - Sub-grid lines appear only at max zoom (scale >= 4.5)
    - Clicking the map displays coordinates in a tooltip
    - Format: A1-3,2 (Major cell + column,row within cell)
*/
document.addEventListener('DOMContentLoaded', () => {

    // Get all UI elements
    const mapViewport = document.getElementById('map-viewport');
    const mapContainer = document.getElementById('map-container');
    const panUpBtn = document.getElementById('pan-up-btn');
    const panDownBtn = document.getElementById('pan-down-btn');
    const panLeftBtn = document.getElementById('pan-left-btn');
    const panRightBtn = document.getElementById('pan-right-btn');
    const mapTooltip = document.getElementById('map-tooltip');
    const coordinateTooltip = document.getElementById('coordinate-tooltip');

    // NEW: Sidebar and Tab elements
    const portList = document.getElementById('port-list');
    const entityList = document.getElementById('entity-list');
    const tabs = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');

    // Toggle controls
    const togglePorts = document.getElementById('toggle-ports');
    const toggleEntities = document.getElementById('toggle-entities');
    const toggleGridlines = document.getElementById('toggle-gridlines');
    const toggleTerrain = document.getElementById('toggle-terrain');

    // New UI elements
    const searchBox = document.getElementById('search-box');
    const clearSearchBtn = document.getElementById('clear-search');
    const resetViewBtn = document.getElementById('reset-view-btn');
    const helpButton = document.getElementById('help-button');
    const helpModal = document.getElementById('help-modal');
    const helpModalClose = document.getElementById('help-modal-close');
    const miniMap = document.getElementById('mini-map');
    const miniMapCanvas = document.getElementById('mini-map-canvas');
    const miniMapViewport = document.getElementById('mini-map-viewport');
    const loadingIndicator = document.getElementById('loading-indicator');
    const locationGrid = document.getElementById('location-grid');
    const locationCoords = document.getElementById('location-coords');
    const toolbarCollapseBtn = document.getElementById('toolbar-collapse-btn');
    const toolbarExpandBtn = document.getElementById('toolbar-expand-btn');
    const mapToolbar = document.querySelector('.map-toolbar');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const versionBadge = document.getElementById('version-badge');
    const jollyRoger = document.getElementById('jolly-roger');
    const cannonball = document.getElementById('cannonball');
    const krakenTentacle = document.getElementById('kraken-tentacle');

    // --- Constants ---
    const MAP_WIDTH = 3840;
    const MAP_HEIGHT = 2498;
    const SIDEBAR_WIDTH = 250;
    const MIN_SCALE = 0.25;
    const MAX_SCALE = 5;
    const ZOOM_SPEED = 0.1;
    const FOCUS_SCALE = 2.0;
    const SUBGRID_ZOOM_THRESHOLD = 0.9; // Show sub-grid only at this zoom level
    const PAN_AMOUNT = 100;

    // Grid configuration
    const GRID_COLS = 18;
    const GRID_ROWS = 16;
    const GRID_START_X = 60;
    const GRID_START_Y = 60;
    const CELL_WIDTH = MAP_WIDTH / GRID_COLS;
    const CELL_HEIGHT = MAP_HEIGHT / 17; // Based on your original code
    const SUBGRID_DIVISIONS = 5; // 5x5 sub-grid

    // --- State Variables ---
    let scale = 0.29;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX, startY;

    // Initial view for reset
    const INITIAL_SCALE = 0.29;
    let initialPanX = 0;
    let initialPanY = 0;

    // Terrain data
    let terrainData = {};

    // Double-click handling
    let lastClickTime = 0;
    const DOUBLE_CLICK_DELAY = 300;

    // --- Helper: Calculate version number from Julian date ---
    function getVersionNumber() {
        const now = new Date();
        const start = new Date(now.getFullYear(), 0, 0);
        const diff = now - start;
        const oneDay = 1000 * 60 * 60 * 24;
        const dayOfYear = Math.floor(diff / oneDay);
        const year = String(now.getFullYear()).slice(-2);
        return `${year}.${dayOfYear}`;
    }

    // --- Helper: Convert map coordinates to grid reference ---
    function getGridReference(mapX, mapY) {
        // Adjust for grid offset
        const relX = mapX - GRID_START_X;
        const relY = mapY - GRID_START_Y;

        // Major cell
        const majorCol = Math.floor(relX / CELL_WIDTH);
        const majorRow = Math.floor(relY / CELL_HEIGHT);

        // Check if within grid bounds
        if (majorCol < 0 || majorCol >= GRID_COLS || majorRow < 0 || majorRow >= GRID_ROWS) {
            return null;
        }

        // Position within the cell
        const cellX = relX - (majorCol * CELL_WIDTH);
        const cellY = relY - (majorRow * CELL_HEIGHT);

        // Sub-grid position (1-5)
        const subCol = Math.floor((cellX / CELL_WIDTH) * SUBGRID_DIVISIONS) + 1;
        const subRow = Math.floor((cellY / CELL_HEIGHT) * SUBGRID_DIVISIONS) + 1;

        // Convert to letter-number format (A-R for columns, 1-16 for rows)
        const colLetter = String.fromCharCode(65 + majorCol); // A=65
        const rowNumber = majorRow + 1;

        // Calculate latitude and longitude
        // Map covers: 30°N to 14°N (top to bottom) and 98°W to 62°W (left to right)
        const LAT_TOP = 30;
        const LAT_BOTTOM = 14;
        const LON_LEFT = 98;
        const LON_RIGHT = 62;
        
        // Calculate based on position relative to grid
        const gridTotalHeight = GRID_ROWS * CELL_HEIGHT;
        const gridTotalWidth = GRID_COLS * CELL_WIDTH;
        
        const latProgress = relY / gridTotalHeight; // 0 at top, 1 at bottom
        const lonProgress = relX / gridTotalWidth; // 0 at left, 1 at right
        
        const latitude = LAT_TOP - (latProgress * (LAT_TOP - LAT_BOTTOM));
        const longitude = LON_LEFT - (lonProgress * (LON_LEFT - LON_RIGHT));

        // Build the terrain coordinate key
        const finalSubCol = Math.min(subCol, SUBGRID_DIVISIONS);
        const finalSubRow = Math.min(subRow, SUBGRID_DIVISIONS);
        const terrainKey = `${colLetter}${rowNumber}-${finalSubCol}-${finalSubRow}`;
        const terrain = terrainData[terrainKey] || 'unknown';

        return {
            major: `${colLetter}${rowNumber}`,
            sub: `${finalSubCol}-${finalSubRow}`,
            full: `${colLetter}${rowNumber}-${finalSubCol}-${finalSubRow}`,
            latitude: latitude.toFixed(2),
            longitude: longitude.toFixed(2),
            terrain: terrain
        };
    }

    // --- 1. Map Tooltip Functions ---

    function showMapTooltip(tooltipData, targetPoint) {
        // Get the map coordinates of the target point
        const rect = targetPoint.getBoundingClientRect();
        const containerRect = mapContainer.getBoundingClientRect();
        const pointCenterX = rect.left + (rect.width / 2) - containerRect.left;
        const pointCenterY = rect.top + (rect.height / 2) - containerRect.top;

        const mapX = (pointCenterX) / scale;
        const mapY = (pointCenterY) / scale;

        // Get grid reference for this location
        const gridRef = getGridReference(mapX, mapY);

        // Check if we're in columns Q or R (rightmost columns)
        const isRightmostColumns = gridRef && (gridRef.major.startsWith('Q') || gridRef.major.startsWith('R'));

        // Check if we're in rows 1 or 2 (top rows)
        const isRow1or2 = gridRef && (gridRef.major.endsWith('1') || gridRef.major.endsWith('2'));

        // Check if we're in top rows (A1, A2) for vertical positioning
        const isTopRows = gridRef && (gridRef.major.startsWith('A1') || gridRef.major.startsWith('A2'));

        // Clear existing content
        mapTooltip.innerHTML = '';

        // Add entity image if present (safely)
        if (tooltipData.image) {
            const imageDiv = document.createElement('div');
            imageDiv.className = 'tooltip-image';
            const img = createSafeImage(tooltipData.image, tooltipData.title);
            imageDiv.appendChild(img);
            mapTooltip.appendChild(imageDiv);
        }

        // Add title and subtitle (safely)
        const h4 = document.createElement('h4');
        const safeTitle = sanitizeText(tooltipData.title || 'Unknown', 100);
        const safeSubtitle = tooltipData.subtitle ? sanitizeText(tooltipData.subtitle, 50) : '';
        h4.textContent = safeTitle + (safeSubtitle ? ` (${safeSubtitle})` : '');
        mapTooltip.appendChild(h4);

        // Add description (safely)
        const p = document.createElement('p');
        p.textContent = sanitizeText(tooltipData.description || '', 500);
        mapTooltip.appendChild(p);

        // Add coordinates if available
        if (gridRef) {
            const coordDiv = document.createElement('div');
            coordDiv.className = 'tooltip-coordinates';

            const gridDiv = document.createElement('div');
            gridDiv.className = 'tooltip-grid';
            gridDiv.textContent = gridRef.full;

            const latlonDiv = document.createElement('div');
            latlonDiv.className = 'tooltip-latlon';
            latlonDiv.textContent = `${gridRef.latitude}°N, ${gridRef.longitude}°W`;

            // Add copy button
            const copyBtn = document.createElement('button');
            copyBtn.className = 'copy-coords-btn';
            copyBtn.textContent = '📋';
            copyBtn.title = 'Copy coordinates';
            copyBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                const coordText = `${gridRef.full} (${gridRef.latitude}°N, ${gridRef.longitude}°W)`;
                navigator.clipboard.writeText(coordText).then(() => {
                    copyBtn.classList.add('copied');
                    copyBtn.textContent = '✓';
                    setTimeout(() => {
                        copyBtn.classList.remove('copied');
                        copyBtn.textContent = '📋';
                    }, 2000);
                });
            });

            coordDiv.appendChild(gridDiv);
            coordDiv.appendChild(latlonDiv);
            coordDiv.appendChild(copyBtn);
            mapTooltip.appendChild(coordDiv);
        }

        const tooltipWidth = 200;
        const tooltipHeight = mapTooltip.offsetHeight || 100;

        mapTooltip.style.left = mapX + 'px';
        mapTooltip.style.top = mapY + 'px';

        // Define GUI element boundaries
        const HELP_BUTTON_SIZE = 80; // Help button area (top-right)
        const TOOLBAR_MARGIN = 100; // Approximate toolbar height + margin

        const viewportLeft = SIDEBAR_WIDTH;
        const viewportRight = window.innerWidth;
        const viewportTop = 0;
        const viewportBottom = window.innerHeight;

        const pointCenterX_screen = rect.left + (rect.width / 2);
        const pointCenterY_screen = rect.top + (rect.height / 2);

        // Scale-aware base offset: increases with zoom for better readability
        // At min zoom (0.25): ~20px, at max zoom (5): ~12px
        const scaleRatio = (scale - MIN_SCALE) / (MAX_SCALE - MIN_SCALE);
        const baseOffsetScreen = 20 - (scaleRatio * 8); // Ranges from 20px to 12px

        // After counter-scaling, tooltip width on screen is just tooltipWidth (200px)
        const tooltipScreenWidth = tooltipWidth;
        const tooltipScreenHeight = tooltipHeight / scale;

        // Calculate offset in map space (before transforms)
        const baseOffsetMap = baseOffsetScreen / scale;
        const tooltipWidthMap = tooltipWidth / (scale * scale);

        let finalXOffset = baseOffsetMap;
        let flipToLeft = false;

        // Check if tooltip would collide with right edge, toolbar, or help button
        const wouldHitRightEdge = pointCenterX_screen + baseOffsetScreen + tooltipScreenWidth > viewportRight - 30;
        const wouldHitHelpButton = pointCenterY_screen < HELP_BUTTON_SIZE &&
                                   pointCenterX_screen + baseOffsetScreen + tooltipScreenWidth > viewportRight - HELP_BUTTON_SIZE;

        // Force tooltip to the left for columns Q/R, or if it would collide with GUI elements
        if (isRightmostColumns || wouldHitRightEdge || wouldHitHelpButton) {
            flipToLeft = true;
            // Position to the left of entity
            finalXOffset = -baseOffsetMap - tooltipWidthMap;

            // Scale-aware extra offset for rightmost columns only
            if (isRightmostColumns) {
                const extraOffsetMultiplier = scaleRatio * scaleRatio * 2.5; // 0 at min zoom, 2.5 at max zoom (quadratic)
                const extraOffsetMap = tooltipWidthMap * extraOffsetMultiplier;
                finalXOffset -= extraOffsetMap;
            }
        }

        // If flipped to left, ensure it doesn't go past the left sidebar
        if (flipToLeft && pointCenterX_screen + finalXOffset * scale < viewportLeft + 10) {
            // Reposition to the right if it would go behind sidebar
            finalXOffset = baseOffsetMap;
        }

        let finalYOffset = -50;

        // Calculate vertical boundaries considering GUI elements
        const topBoundary = viewportTop + 10;
        const bottomBoundary = viewportBottom - TOOLBAR_MARGIN;

        // Check if tooltip would hit bottom toolbar
        const wouldHitToolbar = pointCenterY_screen + (tooltipScreenHeight / 2) > bottomBoundary;

        // For top rows (A1, A2) at high zoom, position tooltip below to avoid top edge
        if (isTopRows && scale >= MAX_SCALE * 0.7) {
            finalYOffset = 50; // Position below entity
        }
        // If tooltip would hit bottom toolbar or bottom edge
        else if (wouldHitToolbar || pointCenterY_screen + (tooltipScreenHeight / 2) > viewportBottom - 10) {
            finalYOffset = -100; // Position above entity
        }
        // If tooltip would hit top edge
        else if (pointCenterY_screen - (tooltipScreenHeight / 2) < topBoundary) {
            finalYOffset = 0; // Position at entity level
        }

        mapTooltip.style.transform = `translate(${finalXOffset}px, ${finalYOffset}%) scale(${1 / scale})`;
        mapTooltip.style.visibility = 'visible';
        mapTooltip.style.opacity = '1';
    }

    function hideMapTooltip() {
        mapTooltip.style.visibility = 'hidden';
        mapTooltip.style.opacity = '0';
    }

    // --- NEW: Coordinate Tooltip Functions ---
    function showCoordinateTooltip(mapX, mapY, screenX, screenY) {
        const gridRef = getGridReference(mapX, mapY);
        
        if (!gridRef) {
            coordinateTooltip.style.visibility = 'hidden';
            return;
        }

        // Determine terrain icon/emoji
        const terrainIcons = {
            'land': '🏝️',
            'water': '🌊',
            'both': '🏖️',
            'unknown': '❓'
        };
        const terrainIcon = terrainIcons[gridRef.terrain] || '❓';

        // Display name mapping (change "both" to "Coastal")
        const terrainDisplayNames = {
            'both': 'Coastal',
            'land': 'land',
            'water': 'water',
            'unknown': 'unknown'
        };
        const terrainDisplay = terrainDisplayNames[gridRef.terrain] || gridRef.terrain;

        coordinateTooltip.innerHTML = `
            <div class="coord-main">${gridRef.full}</div>
            <div class="coord-latlon">${gridRef.latitude}°N, ${gridRef.longitude}°W</div>
            <div class="coord-terrain">${terrainIcon} ${terrainDisplay}</div>
        `;
        coordinateTooltip.style.left = mapX + 'px';
        coordinateTooltip.style.top = mapY + 'px';

        // Position relative to click point
        const tooltipWidth = 120;
        const offsetX = 15 / scale;
        coordinateTooltip.style.transform = `translate(${offsetX}px, -50%) scale(${1 / scale})`;
        coordinateTooltip.style.visibility = 'visible';
        coordinateTooltip.style.opacity = '1';
    }

    // --- 2. Data Loading & Element Creation ---

    function addInteractivity(listItem, mapElement, data) {
        const tooltipData = {
            title: data.city || data.name,
            subtitle: data.country || '',
            description: data.description,
            image: data.image || null  // Add image if present (for entities)
        };

        let hideTimeout;

        listItem.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            mapElement.classList.add('highlighted');
            showMapTooltip(tooltipData, mapElement);
        });
        listItem.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                mapElement.classList.remove('highlighted');
                hideMapTooltip();
            }, 200);
        });

        listItem.addEventListener('click', () => {
            focusOnPoint(data.x, data.y);
        });

        mapElement.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
            mapElement.classList.add('highlighted');
            showMapTooltip(tooltipData, mapElement);
        });
        mapElement.addEventListener('mouseleave', () => {
            hideTimeout = setTimeout(() => {
                mapElement.classList.remove('highlighted');
                hideMapTooltip();
            }, 200);
        });

        mapElement.addEventListener('click', () => {
            focusOnPoint(data.x, data.y);
        });

        // Keep tooltip visible when hovering over it
        mapTooltip.addEventListener('mouseenter', () => {
            clearTimeout(hideTimeout);
        });

        mapTooltip.addEventListener('mouseleave', () => {
            mapElement.classList.remove('highlighted');
            hideMapTooltip();
        });
    }

    function loadPortData(locations) {
        document.querySelectorAll('.map-point').forEach(p => p.remove());
        portList.innerHTML = '';

        const icons = {
            anchor: {
                path: "M24 8 A4 4 0 0 1 24 16 A4 4 0 0 1 24 8 M24 16 L24 40 M12 24 L36 24 M8 36 C8 36 12 44 24 44 C36 44 40 36 40 36 L38 34 C38 34 35 40 24 40 C13 40 10 34 10 34 Z M8 36 L10 34 L8 32 M40 36 L38 34 L40 32",
                viewBox: "0 0 48 48"
            },
            biohazard: {
                path: "M50.14,29.62a9,9,0,0,0-2.79.58c0,.24,0,.48,0,.73a11.21,11.21,0,0,1-5.76,9.78,9.15,9.15,0,0,0,.61,1.83A9.44,9.44,0,0,0,43.07,44,14.77,14.77,0,0,0,51,30.93c0-.44,0-.87-.06-1.3l-.35,0Z M30.76,40.71A11.2,11.2,0,0,1,25,30.93c0-.25,0-.49,0-.73a9,9,0,0,0-2.79-.58h-.41l-.34,0c0,.43-.07.86-.07,1.3A14.77,14.77,0,0,0,29.31,44a10,10,0,0,0,.84-1.45A9.83,9.83,0,0,0,30.76,40.71Z M30.19,21.49a11.11,11.11,0,0,1,12,0,9.08,9.08,0,0,0,1.86-2.22c.12-.2.22-.42.32-.63a14.73,14.73,0,0,0-16.36,0c.1.22.2.43.31.63A9.12,9.12,0,0,0,30.19,21.49Z M32.71,30.93a3.46,3.46,0,0,1,2.48-3.31V25.7H35a11.09,11.09,0,0,1-6.35-3,11.19,11.19,0,0,1-2-2.45c-.07-.12-.13-.26-.2-.39A11.06,11.06,0,0,1,32.48,4.15V2.08a16.69,16.69,0,0,0-13,16.26,16.4,16.4,0,0,0,.25,2.73,16.36,16.36,0,0,0-3,1.36A16.69,16.69,0,0,0,9.12,41.81l1.79-1A11.06,11.06,0,0,1,21.8,27.65c.17,0,.35,0,.52,0a11.24,11.24,0,0,1,8.85,5.07l.11.16,1.6-.93A3.39,3.39,0,0,1,32.71,30.93Z M55.67,22.43a16.71,16.71,0,0,0-3-1.37,16.19,16.19,0,0,0,.24-2.72,16.7,16.7,0,0,0-13-16.27V4.15a11.12,11.12,0,0,1,7.42,10.48A10.93,10.93,0,0,1,46,19.88c-.07.13-.12.27-.2.4a11.09,11.09,0,0,1-2,2.44,11,11,0,0,1-6.36,3l-.24,0v1.91a3.47,3.47,0,0,1,2.48,3.32,3.32,3.32,0,0,1-.16,1l1.6.93.1-.16a11.24,11.24,0,0,1,8.85-5.07c.18,0,.36,0,.53,0A11,11,0,0,1,61.46,40.77l1.8,1A16.7,16.7,0,0,0,55.67,22.43Z M38.39,33.59a3.37,3.37,0,0,1-4.41,0l-1.81,1a11.07,11.07,0,0,1,.43,6.88A11.25,11.25,0,0,1,32,43.37a11.75,11.75,0,0,1-.79,1.43,11.09,11.09,0,0,1-16.55,2.39l-1.79,1A16.68,16.68,0,0,0,33.4,51.34a16.3,16.3,0,0,0,2.79-2,16.65,16.65,0,0,0,23.35-1.09l-1.79-1A11.11,11.11,0,0,1,45,48.38a11,11,0,0,1-3.76-3.58,10.54,10.54,0,0,1-.79-1.43,11.25,11.25,0,0,1-.64-1.85,11,11,0,0,1,.43-6.88Z",
                viewBox: "0 -8 72 72"
            },
            pirate: {
                path: "M256 31.203c-96 .797-117.377 76.692-79.434 135.133-6.397 6.534-10.344 15.886-.566 25.664 16 16 32 16 39.852 32.42h80.296C304 208 320 208 336 192c9.778-9.778 5.831-19.13-.566-25.664C373.377 107.896 352 32 256 31.203zm-42.146 101.049c.426-.003.862.007 1.306.03 28.404 1.442 40.84 59.718-10.83 51.095-10.412-1.738-17.355-50.963 9.524-51.125zm84.292 0c26.88.162 19.936 49.387 9.524 51.125C256 192 268.436 133.724 296.84 132.28c.444-.022.88-.032 1.306-.03zM32 144c7.406 88.586 64.475 175.544 156.623 236.797 17.959-7.251 35.767-15.322 50.424-23.877C180.254 319.737 104.939 255.465 32 144zm448 0C359.2 328.605 231.863 383.797 183.908 400.797c3.177 5.374 5.997 10.98 8.711 16.432 3.878 7.789 7.581 15.251 11.184 20.986A517.457 517.457 0 0 0 256 417.973l.168.076a884.617 884.617 0 0 0 9.652-4.65C391.488 353.263 471.156 249.79 480 144zm-224 27.725l20.074 40.15L256 199.328l-20.074 12.547L256 171.725zm-65.604 57.11l15.76 51.042s31.268 24.92 49.844 24.92 49.844-24.92 49.844-24.92l15.76-51.041-27.086 19.236-8.063 16.248S267.35 279.547 256 279.547c-11.35 0-30.455-15.227-30.455-15.227l-8.063-16.248-27.086-19.236zm-59.984 152.976c-.783-.02-1.574-.011-2.375.027l.856 17.978c6.36-.302 10.814 2.416 16.11 8.64 5.298 6.222 10.32 15.707 15.24 25.589 4.918 9.882 9.707 20.12 16.122 28.45 6.415 8.327 16.202 15.446 27.969 13.89l-2.36-17.844c-4.094.541-6.78-1.099-11.349-7.031-4.57-5.933-9.275-15.46-14.268-25.489-4.992-10.029-10.297-20.604-17.644-29.234-6.888-8.09-16.556-14.686-28.3-14.976zm251.176 0c-11.745.29-21.413 6.885-28.3 14.976-7.348 8.63-12.653 19.205-17.645 29.234-4.993 10.03-9.698 19.556-14.268 25.489-4.57 5.932-7.255 7.572-11.35 7.031l-2.359 17.844c11.767 1.556 21.554-5.563 27.969-13.89 6.415-8.33 11.204-18.568 16.123-28.45 4.919-9.882 9.94-19.367 15.238-25.59 5.297-6.223 9.75-8.941 16.111-8.639l.856-17.978a32.853 32.853 0 0 0-2.375-.027zm-55.928 18.107c-13.97 10.003-30.13 18.92-47.424 27.478a524.868 524.868 0 0 0 29.961 10.819c3.603-5.735 7.306-13.197 11.184-20.986 2.714-5.453 5.534-11.058 8.71-16.432-.77-.273-1.62-.586-2.43-.879zm-191.808 23.371l-27.67 10.352 7.904 31.771 36.424-11.707c-1.418-2.814-2.81-5.649-4.207-8.457-4.048-8.131-8.169-15.961-12.451-21.959zm244.296 0c-4.282 5.998-8.403 13.828-12.45 21.959-1.399 2.808-2.79 5.643-4.208 8.457l36.424 11.707 7.904-31.771-27.67-10.352zM78.271 435.438a9.632 9.632 0 0 0-1.32.12 6.824 6.824 0 0 0-1.217.313c-11.544 4.201-25.105 18.04-21.648 29.828 3.07 10.472 19.675 13.359 30.492 11.916 3.828-.51 8.415-3.761 12.234-7.086l-8.124-32.648c-3.238-1.285-7.214-2.528-10.417-2.443zm355.458 0c-3.203-.085-7.179 1.158-10.416 2.443l-8.125 32.648c3.819 3.325 8.406 6.576 12.234 7.086 10.817 1.443 27.422-1.444 30.492-11.916 3.457-11.788-10.104-25.627-21.648-29.828a6.824 6.824 0 0 0-1.217-.312 9.632 9.632 0 0 0-1.32-.122z",
                viewBox: "0 0 512 512"
            },
            wigwam: {
                path: "M24 4 L4 44 L12 44 L12 32 L36 32 L36 44 L44 44 Z M18 18 L30 18 L30 26 L18 26 Z",
                viewBox: "0 0 48 48"
            },
            church: {
                path: "M24 4 L24 10 M20 7 L28 7 M20 38 L28 38 L28 28 L20 28 Z M16 18 L24 12 L32 18 L32 42 L16 42 Z",
                viewBox: "0 0 48 48"
            },
            flag: {
                path: "M8 6 L8 42 M8 10 L28 10 L28 26 L8 26 M12 14 L24 14 L24 22 L12 22 Z",
                viewBox: "0 0 36 36"
            }
        };
        
        // Function to get the appropriate icon for a faction
        function getIconForFaction(faction) {
            if (faction === 'infected') return icons.biohazard;
            if (faction === 'pirate') return icons.pirate;
            if (faction === 'native') return icons.wigwam;
            if (faction === 'jesuit') return icons.church;
            if (faction === 'independent') return icons.flag;
            return icons.anchor; // Default for all other factions
        }

        locations.forEach(loc => {
            // Sanitize faction name to prevent XSS
            const factionClass = sanitizeFaction(loc.country);
            const icon = getIconForFaction(factionClass);

            const point = document.createElement('div');
            point.className = `map-point ${factionClass}`;
            point.style.left = loc.x + 'px';
            point.style.top = loc.y + 'px';
            point.id = 'point-' + sanitizeText(loc.id, 50).replace(/[^a-zA-Z0-9-_]/g, '');

            // Create SVG safely using DOM methods
            const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            svg.setAttribute('class', 'map-icon');
            svg.setAttribute('viewBox', icon.viewBox);
            svg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            path.setAttribute('d', icon.path);
            path.setAttribute('fill', 'none');
            path.setAttribute('stroke-linecap', 'round');
            path.setAttribute('stroke-linejoin', 'round');

            svg.appendChild(path);
            point.appendChild(svg);
            mapContainer.appendChild(point);

            // Create sidebar item safely
            const listItem = document.createElement('div');
            listItem.className = 'port-item';
            listItem.dataset.targetId = point.id;

            const sidebarSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
            sidebarSvg.setAttribute('class', `sidebar-icon ${factionClass}`);
            sidebarSvg.setAttribute('viewBox', icon.viewBox);
            sidebarSvg.setAttribute('xmlns', 'http://www.w3.org/2000/svg');

            const sidebarPath = document.createElementNS('http://www.w3.org/2000/svg', 'path');
            sidebarPath.setAttribute('d', icon.path);
            sidebarPath.setAttribute('fill', 'none');
            sidebarPath.setAttribute('stroke-linecap', 'round');
            sidebarPath.setAttribute('stroke-linejoin', 'round');

            sidebarSvg.appendChild(sidebarPath);
            listItem.appendChild(sidebarSvg);

            // Add city name as text node (safe)
            const cityText = document.createTextNode(' ' + sanitizeText(loc.city, 100));
            listItem.appendChild(cityText);

            portList.appendChild(listItem);

            addInteractivity(listItem, point, loc);
        });

        // Update mini-map after ports are loaded
        setTimeout(() => drawMiniMap(), 100);
    }

    function loadEntityData(entities) {
        document.querySelectorAll('.map-entity').forEach(e => e.remove());
        entityList.innerHTML = '';

        entities.forEach(entity => {
            // Sanitize image path and entity data
            const safeName = sanitizeText(entity.name || 'Unknown', 100);
            const safeId = sanitizeText(entity.id, 50).replace(/[^a-zA-Z0-9-_]/g, '');

            const mapElement = document.createElement('div');
            mapElement.className = 'map-entity';
            mapElement.style.left = entity.x + 'px';
            mapElement.style.top = entity.y + 'px';
            mapElement.id = 'entity-' + safeId;

            // Create image safely
            const img = createSafeImage(entity.image || 'default.png', safeName);
            mapElement.appendChild(img);
            mapContainer.appendChild(mapElement);

            // Create sidebar item safely
            const listItem = document.createElement('div');
            listItem.className = 'port-item';
            listItem.dataset.targetId = mapElement.id;

            const sidebarImg = createSafeImage(entity.image || 'default.png', safeName);
            listItem.appendChild(sidebarImg);

            // Add entity name as text node
            const nameText = document.createTextNode(' ' + safeName);
            listItem.appendChild(nameText);

            entityList.appendChild(listItem);

            addInteractivity(listItem, mapElement, entity);
        });
    }

    function loadGridData(gridItems) {
        document.querySelectorAll('.map-grid-label').forEach(g => g.remove());

        gridItems.forEach(item => {
            if (item.type === 'label') return;
            
            const label = document.createElement('div');
            label.className = 'map-grid-label';
            label.style.left = item.x + 'px';
            label.style.top = item.y + 'px';
            label.textContent = item.name;
            mapContainer.appendChild(label);
        });
    }

    function loadAllData() {
        Promise.all([
            fetch('ports.json').then(res => res.json()),
            fetch('entities.json').then(res => res.json()),
            fetch('grid.json').then(res => res.json()),
            fetch('terrain.json').then(res => res.json())
        ])
        .then(([locations, entities, gridItems, terrain]) => {
            // Validate terrain data
            if (!validateTerrain(terrain)) {
                console.error('Invalid terrain data detected. Using defaults.');
                terrainData = {};
            } else {
                terrainData = terrain;
            }

            // Filter and validate port data
            const validLocations = Array.isArray(locations)
                ? locations.filter(loc => validatePort(loc, MAP_WIDTH, MAP_HEIGHT))
                : [];

            if (validLocations.length !== locations.length) {
                console.warn(`Filtered out ${locations.length - validLocations.length} invalid ports`);
            }

            // Extract metadata from entities (if present)
            let entitiesMetadata = null;
            const entitiesWithoutMetadata = Array.isArray(entities)
                ? entities.filter(ent => {
                    if (ent._metadata) {
                        entitiesMetadata = ent;
                        return false;
                    }
                    return true;
                })
                : [];

            // Update last-updated date from metadata
            if (entitiesMetadata && entitiesMetadata.lastUpdated) {
                const lastUpdatedElement = document.getElementById('last-updated');
                if (lastUpdatedElement) {
                    lastUpdatedElement.textContent = `Last Updated: ${entitiesMetadata.lastUpdated}`;
                }
            }

            // Filter and validate entity data
            const validEntities = entitiesWithoutMetadata.filter(ent => validateEntity(ent, MAP_WIDTH, MAP_HEIGHT));

            if (validEntities.length !== entitiesWithoutMetadata.length) {
                console.warn(`Filtered out ${entitiesWithoutMetadata.length - validEntities.length} invalid entities`);
            }

            loadPortData(validLocations);
            loadEntityData(validEntities);
            loadGridData(gridItems);
            updateTransform();
        })
        .catch(error => {
            console.error('There was a problem fetching map data:', error);
        });
    }

    // --- 3. Grid Line Functions ---

    function createGridLines() {
        document.querySelectorAll('.map-grid-line').forEach(l => l.remove());

        const gridTotalWidth = GRID_COLS * CELL_WIDTH;
        const gridTotalHeight = GRID_ROWS * CELL_HEIGHT;

        // Major grid lines
        for (let i = 0; i <= GRID_COLS; i++) {
            const line = document.createElement('div');
            line.className = 'map-grid-line vertical-line major-grid';
            line.style.left = (i * CELL_WIDTH) + GRID_START_X + 'px';
            line.style.top = GRID_START_Y + 'px';
            line.style.height = gridTotalHeight + 'px';
            mapContainer.appendChild(line);
        }

        for (let i = 0; i <= GRID_ROWS; i++) {
            const line = document.createElement('div');
            line.className = 'map-grid-line horizontal-line major-grid';
            line.style.top = (i * CELL_HEIGHT) + GRID_START_Y + 'px';
            line.style.left = GRID_START_X + 'px';
            line.style.width = gridTotalWidth + 'px';
            mapContainer.appendChild(line);
        }
    }

    function createSubGridLines() {
        // Remove existing sub-grid lines
        document.querySelectorAll('.sub-grid-line').forEach(l => l.remove());

        const subCellWidth = CELL_WIDTH / SUBGRID_DIVISIONS;
        const subCellHeight = CELL_HEIGHT / SUBGRID_DIVISIONS;

        // Create sub-grid lines for each major cell
        for (let col = 0; col < GRID_COLS; col++) {
            for (let row = 0; row < GRID_ROWS; row++) {
                const cellX = GRID_START_X + (col * CELL_WIDTH);
                const cellY = GRID_START_Y + (row * CELL_HEIGHT);

                // Vertical sub-grid lines (skip first and last to avoid overlap with major grid)
                for (let i = 1; i < SUBGRID_DIVISIONS; i++) {
                    const line = document.createElement('div');
                    line.className = 'map-grid-line vertical-line sub-grid-line';
                    line.style.left = cellX + (i * subCellWidth) + 'px';
                    line.style.top = cellY + 'px';
                    line.style.height = CELL_HEIGHT + 'px';
                    mapContainer.appendChild(line);
                }

                // Horizontal sub-grid lines
                for (let i = 1; i < SUBGRID_DIVISIONS; i++) {
                    const line = document.createElement('div');
                    line.className = 'map-grid-line horizontal-line sub-grid-line';
                    line.style.top = cellY + (i * subCellHeight) + 'px';
                    line.style.left = cellX + 'px';
                    line.style.width = CELL_WIDTH + 'px';
                    mapContainer.appendChild(line);
                }
            }
        }
    }

    function updateSubGridVisibility() {
        const showSubGrid = scale >= SUBGRID_ZOOM_THRESHOLD;
        const subGridLines = document.querySelectorAll('.sub-grid-line');
        
        if (showSubGrid && subGridLines.length === 0) {
            createSubGridLines();
        }
        
        subGridLines.forEach(line => {
            line.style.opacity = showSubGrid ? '1' : '0';
        });
    }

    // --- 4. Transformation & Focus Functions ---

    function getViewportWidth() {
        return window.innerWidth - SIDEBAR_WIDTH;
    }

    function getViewportHeight() {
        return window.innerHeight;
    }

    function clampPan() {
        const viewportWidth = getViewportWidth();
        const viewportHeight = getViewportHeight();

        const currentMapWidth = MAP_WIDTH * scale;
        const currentMapHeight = MAP_HEIGHT * scale;

        let minX, maxX, minY, maxY;

        if (currentMapWidth < viewportWidth) {
            minX = (viewportWidth - currentMapWidth) / 2;
            maxX = minX;
        } else {
            minX = viewportWidth - currentMapWidth;
            maxX = 0;
        }

        if (currentMapHeight < viewportHeight) {
            minY = (viewportHeight - currentMapHeight) / 2;
            maxY = minY;
        } else {
            minY = viewportHeight - currentMapHeight;
            maxY = 0;
        }

        panX = Math.max(minX, Math.min(maxX, panX));
        panY = Math.max(minY, Math.min(maxY, panY));
    }

    function updateTransform() {
        clampPan();

        const inverseScale = 1 / scale;

        document.querySelectorAll('.map-point').forEach(point => {
            let baseTransform = 'translate(-50%, -50%)';
            if (point.matches('.highlighted')) {
                baseTransform += ' scale(2.0)';
            } else if (point.matches(':hover')) {
                baseTransform += ' scale(1.3)';
            }
            point.style.transform = `${baseTransform} scale(${inverseScale})`;
        });

        document.querySelectorAll('.map-entity').forEach(entity => {
            let baseTransform = 'translate(-50%, -50%)';
            if (entity.matches('.highlighted')) {
                baseTransform += ' scale(1.5)';
            } else if (entity.matches(':hover')) {
                baseTransform += ' scale(1.2)';
            }
            entity.style.transform = `${baseTransform} scale(${inverseScale})`;
        });

        document.querySelectorAll('.map-grid-label').forEach(label => {
            label.style.transform = `translate(-50%, -50%) scale(${inverseScale})`;
        });

        let currentTooltipTransform = mapTooltip.style.transform || 'translate(0px, 0%)';
        let translatePart = currentTooltipTransform.match(/translate\([^)]+\)/)?.[0] || 'translate(0px, 0%)';
        mapTooltip.style.transform = `${translatePart} scale(${inverseScale})`;

        // Update sub-grid visibility
        updateSubGridVisibility();

        mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;

        // Update mini-map and current location
        updateMiniMapViewport();
        updateCurrentLocation();
    }

    function zoom(delta, clientX, clientY) {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
        if (newScale === scale) return;

        const clientX_relative = clientX - SIDEBAR_WIDTH;
        const mouseOnMapX = (clientX_relative - panX) / scale;
        const mouseOnMapY = (clientY - panY) / scale;

        panX = clientX_relative - (mouseOnMapX * newScale);
        panY = clientY - (mouseOnMapY * newScale);
        scale = newScale;

        updateTransform();
    }

    function zoomCenter(direction) {
        mapContainer.classList.add('is-transitioning');
        const delta = ZOOM_SPEED * direction * scale;
        const clientX = (getViewportWidth() / 2) + SIDEBAR_WIDTH;
        const clientY = getViewportHeight() / 2;
        zoom(delta, clientX, clientY);
    }

    function panMap(dx, dy) {
        mapContainer.classList.add('is-transitioning');
        panX += dx;
        panY += dy;
        updateTransform();
    }

    function focusOnPoint(x, y) {
        mapContainer.classList.add('is-transitioning');
        scale = FOCUS_SCALE;
        panX = (getViewportWidth() / 2) - (x * scale);
        panY = (getViewportHeight() / 2) - (y * scale);
        updateTransform();
    }

    function resetView() {
        mapContainer.classList.add('is-transitioning');
        scale = INITIAL_SCALE;
        panX = initialPanX;
        panY = initialPanY;
        updateTransform();
    }

    // --- Current Location Display ---
    function updateCurrentLocation() {
        const viewportWidth = getViewportWidth();
        const viewportHeight = getViewportHeight();

        // Calculate center of viewport in map coordinates
        const centerX = (viewportWidth / 2 - panX) / scale;
        const centerY = (viewportHeight / 2 - panY) / scale;

        const gridRef = getGridReference(centerX, centerY);
        if (gridRef) {
            locationGrid.textContent = gridRef.major;
            locationCoords.textContent = `${gridRef.latitude}°N, ${gridRef.longitude}°W`;
        }
    }

    // --- Mini-map Functions ---
    // Helper function to get faction color for minimap
    function getFactionColor(factionClass) {
        const colorMap = {
            'spain': '#ffff00',
            'spanish': '#ffff00',
            'england': '#ff0000',
            'english': '#ff0000',
            'netherlands': '#90ee90',
            'dutch': '#90ee90',
            'france': '#0000ff',
            'french': '#0000ff',
            'pirate': '#ffffff',
            'native': '#D2691E',
            'jesuit': '#0082ff',
            'infected': '#8B0000',
            'independent': '#ff00ff'
        };
        return colorMap[factionClass] || '#ffd700'; // Default gold
    }

    // Helper function to get entity type color for minimap
    function getEntityTypeColor(entityId) {
        // Check if entity has ship in its id
        if (entityId && entityId.includes('ship-')) {
            return '#00ff00'; // Green for ships
        }
        return '#ff00ff'; // Magenta for weather/other entities
    }

    function drawMiniMap() {
        const ctx = miniMapCanvas.getContext('2d');
        const canvas = miniMapCanvas;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw simplified map (just a dark background with grid outline)
        ctx.fillStyle = '#0c0a09';
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        // Draw grid outline
        ctx.strokeStyle = 'rgba(255, 215, 0, 0.3)';
        ctx.lineWidth = 1;
        const scaleX = canvas.width / MAP_WIDTH;
        const scaleY = canvas.height / MAP_HEIGHT;
        ctx.strokeRect(
            GRID_START_X * scaleX,
            GRID_START_Y * scaleY,
            (GRID_COLS * CELL_WIDTH) * scaleX,
            (GRID_ROWS * CELL_HEIGHT) * scaleY
        );

        // Draw ports as tiny dots with faction colors if toggle is on
        if (togglePorts.checked) {
            document.querySelectorAll('.map-point').forEach(point => {
                const x = parseFloat(point.style.left);
                const y = parseFloat(point.style.top);
                // Get faction class from element classes
                const factionClass = Array.from(point.classList).find(cls => cls !== 'map-point');
                ctx.fillStyle = getFactionColor(factionClass);
                ctx.beginPath();
                ctx.arc(x * scaleX, y * scaleY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw entities as tiny dots with type-based colors if toggle is on
        if (toggleEntities.checked) {
            document.querySelectorAll('.map-entity').forEach(entity => {
                const x = parseFloat(entity.style.left);
                const y = parseFloat(entity.style.top);

                // Determine color based on entity type
                const entityId = entity.id || '';
                if (entityId.includes('ship')) {
                    ctx.fillStyle = '#dc143c'; // Crimson for ships
                } else if (entityId.includes('storm')) {
                    ctx.fillStyle = '#ffffff'; // White for storms
                } else {
                    ctx.fillStyle = '#0ff'; // Cyan for other entities
                }

                ctx.beginPath();
                ctx.arc(x * scaleX, y * scaleY, 1.5, 0, Math.PI * 2);
                ctx.fill();
            });
        }

        // Draw terrain if terrain toggle is selected (regardless of other selections)
        if (toggleTerrain.checked) {
            // Iterate through terrain data to draw all terrain types
            for (const [key, terrain] of Object.entries(terrainData)) {
                if (terrain && terrain !== 'unknown') {
                    // Parse grid reference like "A1-3-2"
                    const match = key.match(/^([A-R])(\d+)-(\d)-(\d)$/);
                    if (match) {
                        const [, colLetter, rowNum, subCol, subRow] = match;
                        const majorCol = colLetter.charCodeAt(0) - 65; // A=0
                        const majorRow = parseInt(rowNum) - 1; // Convert to 0-based
                        const subColNum = parseInt(subCol);
                        const subRowNum = parseInt(subRow);

                        // Calculate pixel position
                        const x = GRID_START_X + (majorCol * CELL_WIDTH) + ((subColNum - 0.5) / SUBGRID_DIVISIONS) * CELL_WIDTH;
                        const y = GRID_START_Y + (majorRow * CELL_HEIGHT) + ((subRowNum - 0.5) / SUBGRID_DIVISIONS) * CELL_HEIGHT;

                        // Set color based on terrain type
                        if (terrain === 'land') {
                            ctx.fillStyle = '#228B22'; // Forest Green for land
                        } else if (terrain === 'water') {
                            ctx.fillStyle = '#4169E1'; // Royal Blue for water
                        } else if (terrain === 'both') {
                            ctx.fillStyle = '#D2B48C'; // Tan for coastal
                        }

                        // Draw dot on minimap
                        ctx.beginPath();
                        ctx.arc(x * scaleX, y * scaleY, 1, 0, Math.PI * 2);
                        ctx.fill();
                    }
                }
            }
        }

        updateMiniMapViewport();
    }

    function updateMiniMapViewport() {
        const scaleX = 150 / MAP_WIDTH;
        const scaleY = 98 / MAP_HEIGHT;

        // Calculate what part of the map is visible
        const viewportWidth = getViewportWidth();
        const viewportHeight = getViewportHeight();

        const visibleLeft = -panX / scale;
        const visibleTop = -panY / scale;
        const visibleWidth = viewportWidth / scale;
        const visibleHeight = viewportHeight / scale;

        // Update viewport rectangle
        miniMapViewport.style.left = (visibleLeft * scaleX) + 'px';
        miniMapViewport.style.top = (visibleTop * scaleY) + 'px';
        miniMapViewport.style.width = (visibleWidth * scaleX) + 'px';
        miniMapViewport.style.height = (visibleHeight * scaleY) + 'px';
    }

    // --- Easter Egg Dialog Function ---
    function showEasterEggDialog(message, duration = 5000) {
        // Create dialog element if it doesn't exist
        let easterEggDialog = document.getElementById('easter-egg-dialog');
        if (!easterEggDialog) {
            easterEggDialog = document.createElement('div');
            easterEggDialog.id = 'easter-egg-dialog';
            easterEggDialog.className = 'easter-egg-dialog hidden';
            document.body.appendChild(easterEggDialog);
        }

        // Set message and show dialog
        easterEggDialog.textContent = message;
        easterEggDialog.classList.remove('hidden');
        // Use setTimeout to trigger transition after display change
        setTimeout(() => {
            easterEggDialog.classList.add('visible');
        }, 10);

        // Hide after duration
        setTimeout(() => {
            easterEggDialog.classList.remove('visible');
            setTimeout(() => {
                easterEggDialog.classList.add('hidden');
            }, 300);
        }, duration);
    }

    // --- Secret Code Checker ---
    function checkSecretCode(code) {
        // Obfuscated secret codes (base64 encoded)
        const secrets = {
            // "test" encoded
            'dGVzdA==': () => {
                showEasterEggDialog("What ye testin'?", 5000);
            },
            // "show me the money" encoded
            'c2hvdyBtZSB0aGUgbW9uZXk=': () => {
                // Zoom to H4-4-3
                // H = column 7 (0-indexed), 4 = row 3 (0-indexed)
                // Sub-grid: 4-3
                const col = 7;
                const row = 3;
                const subCol = 4;
                const subRow = 3;

                const cellX = GRID_START_X + (col * CELL_WIDTH) + ((subCol - 1) * (CELL_WIDTH / SUBGRID_DIVISIONS));
                const cellY = GRID_START_Y + (row * CELL_HEIGHT) + ((subRow - 1) * (CELL_HEIGHT / SUBGRID_DIVISIONS));

                // Center on the sub-cell
                const targetX = cellX + (CELL_WIDTH / SUBGRID_DIVISIONS / 2);
                const targetY = cellY + (CELL_HEIGHT / SUBGRID_DIVISIONS / 2);

                focusOnPoint(targetX, targetY);
            },
            // Pirate tale easter egg
            'cGlyYXRlIHRhbGU=': () => {
                const pirateMessage = `Ahoy, ye swabs! Old One-Eyed Silas knows the tale ye seek: the lost hoard of Captain 'Shark-Tooth' Malone. He left no map, blast his eyes, only a riddle that twists the mind!

It starts: "Find the gold where the parrot sings at midnight, but only when the moon is a sliver of cheese."

Simple, ye say? Bah! Crews searched every roost from here to Singapore! They found parrots on Smuggler's Isle, but the moon was full! They tore apart a tavern called 'The Singing Parrot' on Tortuga... found naught but spilt rum! They were cursed, followin' a bird!

Then, one clever matey, 'Half-Wit' Finn, he finds the rest of the riddle, burned into an old powder keg:

"...And the tide forgets to turn, Look beneath the mermaid's tear, Where the island's fires burn."

"The doldrums!" cries Finn, "Where the tide stands still!" So they sailed 'til the wind died. And there, they found an isle! It had a weep-in' waterfall (the "tear"!) and a smokin' volcano (the "fire"!).

They dug like madmen beneath that waterfall. Thud! A chest! They smashed the lock, greedy hands rootin' for doubloons...

But inside? No gold. Just one soggy scrap of parchment. And on it, in Malone's own scrawl, it read:

"Ye found the spot, ye clever dogs! But this ain't it! The real treasure... that's buried where the parrot sings at midnight, but only when the moon is a sliver of cheese..."`;
                showEasterEggDialog(pirateMessage, 3000);
            }
        };

        // Encode the code to check against secrets
        // Wrap in try-catch to handle btoa() exceptions for non-Latin1 characters
        try {
            const encoded = btoa(code);
            if (secrets[encoded]) {
                secrets[encoded]();
                return true;
            }
        } catch (e) {
            // btoa() throws InvalidCharacterError for characters outside Latin1 range
            // Silently ignore - not a valid secret code
            return false;
        }
        return false;
    }

    // --- Search/Filter Functions ---
    function filterItems() {
        const searchTerm = searchBox.value.toLowerCase().trim();
        if (searchTerm) {
            clearSearchBtn.classList.remove('hidden');
        } else {
            clearSearchBtn.classList.add('hidden');
        }

        const activeTab = document.querySelector('.tab-btn.active').dataset.tab;
        const items = document.querySelectorAll(`#${activeTab}-content .port-item`);

        items.forEach(item => {
            const text = item.textContent.toLowerCase();
            if (text.includes(searchTerm)) {
                item.style.display = 'flex';
            } else {
                item.style.display = 'none';
            }
        });
    }

    function clearSearch() {
        searchBox.value = '';
        filterItems();
    }

    // --- 5. Initial Setup ---

    panX = (getViewportWidth() - (MAP_WIDTH * scale)) / 2;
    panY = (getViewportHeight() - (MAP_HEIGHT * scale)) / 2;

    if (getViewportWidth() === MAP_WIDTH && getViewportHeight() === MAP_HEIGHT) {
        mapViewport.style.cursor = 'default';
        panX = 0;
        panY = 0;
    }

    // Save initial view
    initialPanX = panX;
    initialPanY = panY;

    createGridLines();
    loadAllData();

    // Set version number
    versionBadge.textContent = `v${getVersionNumber()}`;

    setInterval(() => {
        loadingIndicator.classList.remove('hidden');
        loadAllData();
        setTimeout(() => {
            loadingIndicator.classList.add('hidden');
        }, 1000);
    }, 60000);

    // --- 6. Event Listeners ---

    tabs.forEach(tab => {
        tab.addEventListener('click', () => {
            tabs.forEach(t => t.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            tab.classList.add('active');
            document.getElementById(tab.dataset.tab + '-content').classList.add('active');
        });
    });

    // NEW: Click handler for coordinate display
    mapViewport.addEventListener('click', (e) => {
        const currentTime = Date.now();
        const isDoubleClick = (currentTime - lastClickTime) < DOUBLE_CLICK_DELAY;
        lastClickTime = currentTime;

        // Handle double-click - zoom in at click point
        if (isDoubleClick) {
            hideMapTooltip();
            coordinateTooltip.style.visibility = 'hidden';

            const containerRect = mapContainer.getBoundingClientRect();
            const clickX = e.clientX - containerRect.left;
            const clickY = e.clientY - containerRect.top;
            const mapX = clickX / scale;
            const mapY = clickY / scale;

            mapContainer.classList.add('is-transitioning');
            const newScale = Math.min(MAX_SCALE, scale * 1.5);
            const clientX_relative = e.clientX - SIDEBAR_WIDTH;
            panX = clientX_relative - (mapX * newScale);
            panY = e.clientY - (mapY * newScale);
            scale = newScale;
            updateTransform();
            return;
        }

        // Ignore clicks on interactive elements
        if (e.target.closest('.map-point') ||
            e.target.closest('.map-entity') ||
            e.target.closest('.map-toolbar')) {
            return;
        }

        // Don't show coordinate tooltip if port/entity tooltip is already visible
        if (mapTooltip.style.visibility === 'visible') {
            return;
        }

        // Convert screen click to map coordinates
        const containerRect = mapContainer.getBoundingClientRect();
        const clickX = e.clientX - containerRect.left;
        const clickY = e.clientY - containerRect.top;

        const mapX = clickX / scale;
        const mapY = clickY / scale;

        showCoordinateTooltip(mapX, mapY, e.clientX, e.clientY);
    });

    mapViewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.map-point') || e.target.closest('.map-entity')) return;
        mapContainer.classList.remove('is-transitioning');
        isDragging = true;
        mapViewport.classList.add('is-dragging');
        startX = e.pageX - panX;
        startY = e.pageY - panY;
    });

    mapViewport.addEventListener('mousemove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        panX = e.pageX - startX;
        panY = e.pageY - startY;
        updateTransform();
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        mapViewport.classList.remove('is-dragging');
    });

    mapViewport.addEventListener('touchstart', (e) => {
        if (e.target.closest('.map-point') || e.target.closest('.map-entity')) return;
        mapContainer.classList.remove('is-transitioning');
        isDragging = true;
        startX = e.touches[0].pageX - panX;
        startY = e.touches[0].pageY - panY;
    }, { passive: false });

    mapViewport.addEventListener('touchmove', (e) => {
        if (!isDragging) return;
        e.preventDefault();
        panX = e.touches[0].pageX - startX;
        panY = e.touches[0].pageY - startY;
        updateTransform();
    }, { passive: false });

    window.addEventListener('touchend', () => {
        isDragging = false;
    });

    mapViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        mapContainer.classList.remove('is-transitioning');
        const delta = -Math.sign(e.deltaY) * ZOOM_SPEED * scale;
        zoom(delta, e.clientX, e.clientY);
    }, { passive: false });

    panUpBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panMap(0, PAN_AMOUNT);
    });
    panDownBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panMap(0, -PAN_AMOUNT);
    });
    panLeftBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panMap(PAN_AMOUNT, 0);
    });
    panRightBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        panMap(-PAN_AMOUNT, 0);
    });

    window.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
            hideMapTooltip();
            coordinateTooltip.style.visibility = 'hidden';
            if (!helpModal.classList.contains('hidden')) {
                helpModal.classList.add('hidden');
                versionBadge.classList.add('hidden');
            }
        } else if (e.key === '+' || e.key === '=') {
            e.preventDefault();
            zoomCenter(1);
        } else if (e.key === '-' || e.key === '_') {
            e.preventDefault();
            zoomCenter(-1);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            panMap(0, PAN_AMOUNT);
        } else if (e.key === 'ArrowDown') {
            e.preventDefault();
            panMap(0, -PAN_AMOUNT);
        } else if (e.key === 'ArrowLeft') {
            e.preventDefault();
            panMap(PAN_AMOUNT, 0);
        } else if (e.key === 'ArrowRight') {
            e.preventDefault();
            panMap(-PAN_AMOUNT, 0);
        }
    });

    // Search box events
    searchBox.addEventListener('input', filterItems);

    // Check for secret codes on Enter key
    searchBox.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const searchTerm = searchBox.value.toLowerCase().trim();
            if (searchTerm && checkSecretCode(searchTerm)) {
                // Secret code found, clear the search box
                setTimeout(() => {
                    searchBox.value = '';
                    clearSearchBtn.classList.add('hidden');
                    filterItems();
                }, 100);
            }
        }
    });

    clearSearchBtn.addEventListener('click', clearSearch);

    // Reset view button
    resetViewBtn.addEventListener('click', resetView);

    // Help modal events
    helpButton.addEventListener('click', () => {
        helpModal.classList.remove('hidden');
        versionBadge.classList.remove('hidden');
    });

    helpModalClose.addEventListener('click', () => {
        helpModal.classList.add('hidden');
        versionBadge.classList.add('hidden');
    });

    helpModal.addEventListener('click', (e) => {
        if (e.target === helpModal) {
            helpModal.classList.add('hidden');
            versionBadge.classList.add('hidden');
        }
    });

    // Allow mouse wheel scrolling in help modal content
    const helpModalContent = document.querySelector('.help-modal-content');
    helpModalContent.addEventListener('wheel', (e) => {
        // Stop propagation to prevent map zoom when scrolling help content
        e.stopPropagation();
    }, { passive: true });

    // Easter egg: Version badge click
    versionBadge.addEventListener('click', (e) => {
        // Prevent event from bubbling to map viewport
        e.stopPropagation();

        // Close help dialog
        helpModal.classList.add('hidden');
        versionBadge.classList.add('hidden');

        const effects = [
            // Effect 1: Spin the map
            () => {
                mapContainer.style.transition = 'transform 2s ease-in-out';
                const currentTransform = mapContainer.style.transform;
                mapContainer.style.transform = currentTransform + ' rotate(360deg)';
                setTimeout(() => {
                    mapContainer.style.transition = '';
                    updateTransform();
                }, 2000);
            },
            // Effect 2: Rainbow colors on all icons
            () => {
                const points = document.querySelectorAll('.map-point');
                const colors = ['#ff0000', '#ff7f00', '#ffff00', '#00ff00', '#0000ff', '#8b00ff'];
                let colorIndex = 0;
                const interval = setInterval(() => {
                    points.forEach(point => {
                        const icon = point.querySelector('.map-icon');
                        if (icon) {
                            icon.style.stroke = colors[colorIndex % colors.length];
                            icon.style.fill = colors[colorIndex % colors.length];
                        }
                    });
                    colorIndex++;
                }, 200);
                setTimeout(() => {
                    clearInterval(interval);
                    loadAllData(); // Reload to restore original colors
                }, 3000);
            },
            // Effect 3: Shake animation
            () => {
                mapContainer.style.animation = 'shake 0.5s';
                setTimeout(() => {
                    mapContainer.style.animation = '';
                }, 500);
            },
            // Effect 4: Random teleport
            () => {
                const randomX = Math.random() * MAP_WIDTH;
                const randomY = Math.random() * MAP_HEIGHT;
                focusOnPoint(randomX, randomY);
            },
            // Effect 5: Disco zoom
            () => {
                let count = 0;
                const interval = setInterval(() => {
                    scale = MIN_SCALE + Math.random() * (MAX_SCALE - MIN_SCALE);
                    updateTransform();
                    count++;
                    if (count >= 10) {
                        clearInterval(interval);
                        resetView();
                    }
                }, 200);
            },
            // Effect 6: All entities dance
            () => {
                const entities = document.querySelectorAll('.map-entity');
                entities.forEach(entity => {
                    entity.style.animation = 'bounce 0.5s infinite';
                });
                setTimeout(() => {
                    entities.forEach(entity => {
                        entity.style.animation = '';
                    });
                }, 3000);
            },
            // Effect 7: Redirect to YouTube video
            () => {
                window.open('https://youtu.be/xMeLqP1A5O4', '_blank');
            },
            // Effect 8: Jolly Roger flag
            () => {
                jollyRoger.classList.remove('hidden');
                jollyRoger.style.animation = 'fade-in-out 4s ease-in-out, wave-flag 0.5s ease-in-out infinite';
                setTimeout(() => {
                    jollyRoger.classList.add('hidden');
                    jollyRoger.style.animation = '';
                }, 4000);
            },
            // Effect 9: Cannonball attack
            () => {
                cannonball.classList.remove('hidden');
                cannonball.style.animation = 'cannonball-flight 1.5s linear';
                setTimeout(() => {
                    // Screen shake on impact
                    document.body.style.animation = 'shake 0.3s';
                    setTimeout(() => {
                        document.body.style.animation = '';
                        cannonball.classList.add('hidden');
                        cannonball.style.animation = '';
                    }, 300);
                }, 1500);
            },
            // Effect 10: The Kraken
            () => {
                krakenTentacle.classList.remove('hidden');
                krakenTentacle.style.animation = 'tentacle-wave 3s ease-in-out';
                setTimeout(() => {
                    krakenTentacle.classList.add('hidden');
                    krakenTentacle.style.animation = '';
                }, 3000);
            },
            // Effect 11: Cannon fire sound
            () => {
                const audio = new Audio('https://piratesirc.com/sounds/cannon-fired1.mp3');
                audio.play().catch(err => console.log('Audio play failed:', err));
            },
            // Effect 12: Pirate cheer
            () => {
                const audio = new Audio('https://piratesirc.com/sounds/cheer1.mp3');
                audio.play().catch(err => console.log('Audio play failed:', err));
            },
            // Effect 13: Background music
            () => {
                const audio = new Audio('https://piratesirc.com/sounds/Drunken_Sailor.mid');
                audio.loop = true;
                audio.volume = 0.3;
                audio.play().catch(err => console.log('Audio play failed:', err));
                // Stop after 30 seconds
                setTimeout(() => {
                    audio.pause();
                    audio.currentTime = 0;
                }, 30000);
            }
        ];

        // Pick a random effect
        const randomEffect = effects[Math.floor(Math.random() * effects.length)];
        randomEffect();

        // Visual feedback on badge
        versionBadge.style.animation = 'pulse 0.5s';
        setTimeout(() => {
            versionBadge.style.animation = '';
        }, 500);
    });

    // Mini-map click to jump
    miniMap.addEventListener('click', (e) => {
        const rect = miniMap.getBoundingClientRect();
        const clickX = e.clientX - rect.left;
        const clickY = e.clientY - rect.top;

        const scaleX = MAP_WIDTH / 150;
        const scaleY = MAP_HEIGHT / 98;

        const mapX = clickX * scaleX;
        const mapY = clickY * scaleY;

        focusOnPoint(mapX, mapY);
    });

    // Toolbar collapse/expand
    toolbarCollapseBtn.addEventListener('click', () => {
        mapToolbar.classList.add('collapsed');
    });

    toolbarExpandBtn.addEventListener('click', () => {
        mapToolbar.classList.remove('collapsed');
    });

    // Zoom in/out buttons
    zoomInBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newScale = Math.min(MAX_SCALE, scale + ZOOM_SPEED * scale);
        const clientX = (getViewportWidth() / 2) + SIDEBAR_WIDTH;
        const clientY = getViewportHeight() / 2;

        const clientX_relative = clientX - SIDEBAR_WIDTH;
        const centerMapX = (clientX_relative - panX) / scale;
        const centerMapY = (clientY - panY) / scale;

        panX = clientX_relative - (centerMapX * newScale);
        panY = clientY - (centerMapY * newScale);
        scale = newScale;

        updateTransform();
    });

    zoomOutBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        const newScale = Math.max(MIN_SCALE, scale - ZOOM_SPEED * scale);
        const clientX = (getViewportWidth() / 2) + SIDEBAR_WIDTH;
        const clientY = getViewportHeight() / 2;

        const clientX_relative = clientX - SIDEBAR_WIDTH;
        const centerMapX = (clientX_relative - panX) / scale;
        const centerMapY = (clientY - panY) / scale;

        panX = clientX_relative - (centerMapX * newScale);
        panY = clientY - (centerMapY * newScale);
        scale = newScale;

        updateTransform();
    });

    window.addEventListener('resize', () => {
        mapContainer.classList.remove('is-transitioning');
        updateTransform();
    });

    mapContainer.addEventListener('transitionend', () => {
        mapContainer.classList.remove('is-transitioning');
    });

    // --- Terrain Overlay Functions ---
    function createTerrainOverlay() {
        // Remove existing terrain cells
        document.querySelectorAll('.terrain-cell').forEach(cell => cell.remove());

        // Create a terrain cell for each sub-grid cell
        for (let col = 0; col < GRID_COLS; col++) {
            for (let row = 0; row < GRID_ROWS; row++) {
                const colLetter = String.fromCharCode(65 + col);
                const rowNumber = row + 1;

                for (let subCol = 1; subCol <= SUBGRID_DIVISIONS; subCol++) {
                    for (let subRow = 1; subRow <= SUBGRID_DIVISIONS; subRow++) {
                        const terrainKey = `${colLetter}${rowNumber}-${subCol}-${subRow}`;
                        const terrain = terrainData[terrainKey];

                        if (terrain && terrain !== 'unknown') {
                            const cellX = GRID_START_X + (col * CELL_WIDTH) + ((subCol - 1) * (CELL_WIDTH / SUBGRID_DIVISIONS));
                            const cellY = GRID_START_Y + (row * CELL_HEIGHT) + ((subRow - 1) * (CELL_HEIGHT / SUBGRID_DIVISIONS));
                            const cellWidth = CELL_WIDTH / SUBGRID_DIVISIONS;
                            const cellHeight = CELL_HEIGHT / SUBGRID_DIVISIONS;

                            const terrainCell = document.createElement('div');
                            terrainCell.className = `terrain-cell ${terrain}`;
                            terrainCell.style.left = cellX + 'px';
                            terrainCell.style.top = cellY + 'px';
                            terrainCell.style.width = cellWidth + 'px';
                            terrainCell.style.height = cellHeight + 'px';
                            mapContainer.appendChild(terrainCell);
                        }
                    }
                }
            }
        }
    }

    // --- Toggle Event Listeners ---
    togglePorts.addEventListener('change', () => {
        const ports = document.querySelectorAll('.map-point');
        ports.forEach(port => {
            port.style.display = togglePorts.checked ? 'block' : 'none';
        });
        drawMiniMap();
    });

    toggleEntities.addEventListener('change', () => {
        const entities = document.querySelectorAll('.map-entity');
        entities.forEach(entity => {
            entity.style.display = toggleEntities.checked ? 'block' : 'none';
        });
        drawMiniMap();
    });

    toggleGridlines.addEventListener('change', () => {
        const gridLines = document.querySelectorAll('.map-grid-line');
        gridLines.forEach(line => {
            line.style.display = toggleGridlines.checked ? 'block' : 'none';
        });

        const gridLabels = document.querySelectorAll('.map-grid-label');
        gridLabels.forEach(label => {
            label.style.display = toggleGridlines.checked ? 'block' : 'none';
        });
    });

    toggleTerrain.addEventListener('change', () => {
        if (toggleTerrain.checked) {
            createTerrainOverlay();
        } else {
            document.querySelectorAll('.terrain-cell').forEach(cell => cell.remove());
        }
    });

    // Prevent click-through to map from toolbar controls
    const toggleControls = document.querySelector('.toggle-controls');
    if (toggleControls) {
        toggleControls.addEventListener('click', (e) => {
            e.stopPropagation();
        });
    }
});