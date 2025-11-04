document.addEventListener('DOMContentLoaded', () => {

    // --- Get UI elements ---
    const mapViewport = document.getElementById('map-viewport');
    const mapContainer = document.getElementById('map-container');
    const zoomInBtn = document.getElementById('zoom-in-btn');
    const zoomOutBtn = document.getElementById('zoom-out-btn');
    const panUpBtn = document.getElementById('pan-up-btn');
    const panDownBtn = document.getElementById('pan-down-btn');
    const panLeftBtn = document.getElementById('pan-left-btn');
    const panRightBtn = document.getElementById('pan-right-btn');
    const coordinateTooltip = document.getElementById('coordinate-tooltip');
    const zoomLevelDisplay = document.getElementById('zoom-level-display');
    const editorPopup = document.getElementById('editor-popup');
    const popupContent = document.getElementById('popup-content');
    const popupButtons = document.querySelector('.popup-buttons');
    const statusBar = document.getElementById('status-bar');
    const jsonOutput = document.getElementById('json-output');
    const copyJsonBtn = document.getElementById('copy-json-btn');

    // --- Constants ---
    const MAP_WIDTH = 3840;
    const MAP_HEIGHT = 2498;
    const MIN_SCALE = 0.25;
    const MAX_SCALE = 15; // Increased max zoom for editor
    const ZOOM_SPEED = 0.1;
    const PAN_AMOUNT = 100;

    // --- Grid configuration ---
    const GRID_COLS = 18;
    const GRID_ROWS = 16;
    const GRID_START_X = 60;
    const GRID_START_Y = 60;
    const CELL_WIDTH = MAP_WIDTH / GRID_COLS;
    const CELL_HEIGHT = MAP_HEIGHT / 17;
    const SUBGRID_DIVISIONS = 5;

    // --- State Variables ---
    let scale = 0.29;
    let panX = 0;
    let panY = 0;
    let isDragging = false;
    let startX, startY;
    let terrainData = {};
    let gridData = [];
    let popupTimeout;

    // --- Helper: Convert map coordinates to grid reference ---
    function getGridReference(mapX, mapY) {
        const relX = mapX - GRID_START_X;
        const relY = mapY - GRID_START_Y;

        const majorCol = Math.floor(relX / CELL_WIDTH);
        const majorRow = Math.floor(relY / CELL_HEIGHT);

        if (majorCol < 0 || majorCol >= GRID_COLS || majorRow < 0 || majorRow >= GRID_ROWS) {
            return null;
        }

        const cellX = relX - (majorCol * CELL_WIDTH);
        const cellY = relY - (majorRow * CELL_HEIGHT);

        const subCol = Math.floor((cellX / CELL_WIDTH) * SUBGRID_DIVISIONS) + 1;
        const subRow = Math.floor((cellY / CELL_HEIGHT) * SUBGRID_DIVISIONS) + 1;

        const colLetter = String.fromCharCode(65 + majorCol);
        const rowNumber = majorRow + 1;

        const finalSubCol = Math.min(subCol, SUBGRID_DIVISIONS);
        const finalSubRow = Math.min(subRow, SUBGRID_DIVISIONS);
        const terrainKey = `${colLetter}${rowNumber}-${finalSubCol}-${finalSubRow}`;

        const LAT_TOP = 30, LAT_BOTTOM = 14, LON_LEFT = 98, LON_RIGHT = 62;
        const latProgress = relY / (GRID_ROWS * CELL_HEIGHT);
        const lonProgress = relX / (GRID_COLS * CELL_WIDTH);
        const latitude = LAT_TOP - (latProgress * (LAT_TOP - LAT_BOTTOM));
        const longitude = LON_LEFT - (lonProgress * (LON_LEFT - LON_RIGHT));

        return {
            key: terrainKey,
            latitude: latitude.toFixed(2),
            longitude: longitude.toFixed(2),
            terrain: terrainData[terrainKey] || 'unknown'
        };
    }

    // --- Data Loading & Initial Drawing ---
    function loadAllData() {
        Promise.all([
            fetch('grid.json').then(res => res.json()),
            fetch('terrain.json').then(res => res.json())
        ])
        .then(([grid, terrain]) => {
            gridData = grid;
            terrainData = terrain;
            drawGridLines();
            drawTerrainCells();
            updateJsonOutput();
            updateTransform();
        })
        .catch(error => {
            console.error('There was a problem fetching map data:', error);
            statusBar.textContent = 'Error loading map data. Check console.';
        });
    }

    // --- Drawing Functions ---
    function drawGridLines() {
        const gridTotalWidth = GRID_COLS * CELL_WIDTH;
        const gridTotalHeight = GRID_ROWS * CELL_HEIGHT;

        for (let i = 0; i <= GRID_COLS; i++) {
            const line = document.createElement('div');
            line.className = 'map-grid-line vertical-line';
            line.style.left = (i * CELL_WIDTH) + GRID_START_X + 'px';
            line.style.top = GRID_START_Y + 'px';
            line.style.height = gridTotalHeight + 'px';
            mapContainer.appendChild(line);
        }

        for (let i = 0; i <= GRID_ROWS; i++) {
            const line = document.createElement('div');
            line.className = 'map-grid-line horizontal-line';
            line.style.top = (i * CELL_HEIGHT) + GRID_START_Y + 'px';
            line.style.left = GRID_START_X + 'px';
            line.style.width = gridTotalWidth + 'px';
            mapContainer.appendChild(line);
        }
    }

    function drawTerrainCells() {
        const subCellWidth = CELL_WIDTH / SUBGRID_DIVISIONS;
        const subCellHeight = CELL_HEIGHT / SUBGRID_DIVISIONS;

        for (let majorCol = 0; majorCol < GRID_COLS; majorCol++) {
            for (let majorRow = 0; majorRow < GRID_ROWS; majorRow++) {
                for (let subCol = 1; subCol <= SUBGRID_DIVISIONS; subCol++) {
                    for (let subRow = 1; subRow <= SUBGRID_DIVISIONS; subRow++) {
                        const colLetter = String.fromCharCode(65 + majorCol);
                        const rowNumber = majorRow + 1;
                        const key = `${colLetter}${rowNumber}-${subCol}-${subRow}`;
                        
                        const cell = document.createElement('div');
                        cell.className = 'terrain-cell';
                        cell.id = key;
                        cell.style.left = GRID_START_X + (majorCol * CELL_WIDTH) + ((subCol - 1) * subCellWidth) + 'px';
                        cell.style.top = GRID_START_Y + (majorRow * CELL_HEIGHT) + ((subRow - 1) * subCellHeight) + 'px';
                        cell.style.width = subCellWidth + 'px';
                        cell.style.height = subCellHeight + 'px';

                        const terrainType = terrainData[key] || 'water';
                        cell.classList.add(terrainType);

                        cell.addEventListener('click', (e) => {
                            e.stopPropagation();
                            showPopup(key, e);
                        });

                        mapContainer.appendChild(cell);
                    }
                }
            }
        }
    }

    // --- Editor Popup Logic ---
    function showPopup(key, event) {
        clearTimeout(popupTimeout);
        const terrainType = terrainData[key] || 'unknown';
        const gridRef = getGridReference(event.clientX, event.clientY);

        popupContent.innerHTML = `
            <h4>${key}</h4>
            <p><strong>Lat/Lon:</strong> ${gridRef.latitude}°N, ${gridRef.longitude}°W</p>
            <p><strong>Current Type:</strong> <span id="popup-terrain-type">${terrainType}</span></p>
        `;

        // Set data attribute on popup for the update function
        editorPopup.dataset.key = key;

        const rect = mapViewport.getBoundingClientRect();
        const x = event.clientX - rect.left;
        const y = event.clientY - rect.top;

        editorPopup.style.left = `${x + 15}px`;
        editorPopup.style.top = `${y}px`;
        editorPopup.style.visibility = 'visible';
        editorPopup.style.opacity = '1';
    }

    function hidePopup() {
        editorPopup.style.visibility = 'hidden';
        editorPopup.style.opacity = '0';
    }

    popupButtons.addEventListener('click', (e) => {
        if (e.target.tagName === 'BUTTON') {
            const newTerrain = e.target.dataset.terrain;
            const key = editorPopup.dataset.key;

            if (!key || !newTerrain) return;

            // 1. Update data object
            terrainData[key] = newTerrain;

            // 2. Update cell visual
            const cell = document.getElementById(key);
            cell.className = 'terrain-cell'; // Reset classes
            cell.classList.add(newTerrain);

            // 3. Update popup content
            document.getElementById('popup-terrain-type').textContent = `${newTerrain} (Updated)`;

            // 4. Update status bar
            statusBar.textContent = `${key} set to ${newTerrain}`;

            // 5. Update JSON output
            updateJsonOutput();

            // 6. Hide popup after a delay
            clearTimeout(popupTimeout);
            popupTimeout = setTimeout(hidePopup, 3000);
        }
    });

    // --- JSON Output Logic ---
    function updateJsonOutput() {
        jsonOutput.value = JSON.stringify(terrainData, Object.keys(terrainData).sort(), 2);
    }

    copyJsonBtn.addEventListener('click', () => {
        jsonOutput.select();
        document.execCommand('copy');
        statusBar.textContent = 'JSON copied to clipboard!';
    });

    // --- Map Navigation (Pan & Zoom) ---
    function clampPan() {
        const currentMapWidth = MAP_WIDTH * scale;
        const currentMapHeight = MAP_HEIGHT * scale;
        const minX = mapViewport.clientWidth - currentMapWidth;
        const minY = mapViewport.clientHeight - currentMapHeight;
        panX = Math.max(minX, Math.min(0, panX));
        panY = Math.max(minY, Math.min(0, panY));
    }

    function updateTransform() {
        clampPan();
        mapContainer.style.transform = `translate(${panX}px, ${panY}px) scale(${scale})`;
        zoomLevelDisplay.textContent = `${scale.toFixed(1)}x`;
    }

    function zoom(delta, clientX, clientY) {
        const newScale = Math.max(MIN_SCALE, Math.min(MAX_SCALE, scale + delta));
        if (newScale === scale) return;

        const mouseOnMapX = (clientX - panX) / scale;
        const mouseOnMapY = (clientY - panY) / scale;

        panX = clientX - (mouseOnMapX * newScale);
        panY = clientY - (mouseOnMapY * newScale);
        scale = newScale;
        updateTransform();
    }

    function zoomCenter(direction) {
        mapContainer.classList.add('is-transitioning');
        const delta = ZOOM_SPEED * direction * scale;
        zoom(delta, mapViewport.clientWidth / 2, mapViewport.clientHeight / 2);
    }

    function panMap(dx, dy) {
        mapContainer.classList.add('is-transitioning');
        panX += dx;
        panY += dy;
        updateTransform();
    }

    // --- Event Listeners ---
    mapViewport.addEventListener('mousedown', (e) => {
        if (e.target.closest('.terrain-cell')) return; // Don't drag if click started on a cell
        hidePopup();
        isDragging = true;
        mapViewport.classList.add('is-dragging');
        startX = e.pageX - panX;
        startY = e.pageY - panY;
    });

    window.addEventListener('mouseup', () => {
        isDragging = false;
        mapViewport.classList.remove('is-dragging');
    });

    window.addEventListener('mousemove', (e) => {
        if (isDragging) {
            panX = e.pageX - startX;
            panY = e.pageY - startY;
            updateTransform();
        } else {
            // Show coordinate tooltip
            const rect = mapContainer.getBoundingClientRect();
            const mapX = (e.clientX - rect.left) / scale;
            const mapY = (e.clientY - rect.top) / scale;
            const gridRef = getGridReference(mapX, mapY);
            if (gridRef) {
                coordinateTooltip.innerHTML = `${gridRef.key} (${gridRef.terrain})`;
                coordinateTooltip.style.left = mapX + 'px';
                coordinateTooltip.style.top = mapY + 'px';
                coordinateTooltip.style.transform = `translate(15px, -15px) scale(${1/scale})`;
                coordinateTooltip.style.visibility = 'visible';
                coordinateTooltip.style.opacity = '1';
            } else {
                coordinateTooltip.style.visibility = 'hidden';
            }
        }
    });

    mapViewport.addEventListener('mouseleave', () => {
        coordinateTooltip.style.visibility = 'hidden';
    });

    mapViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        mapContainer.classList.remove('is-transitioning');
        const delta = -Math.sign(e.deltaY) * ZOOM_SPEED * scale;
        zoom(delta, e.clientX, e.clientY);
    }, { passive: false });

    zoomInBtn.addEventListener('click', () => zoomCenter(1));
    zoomOutBtn.addEventListener('click', () => zoomCenter(-1));

    panUpBtn.addEventListener('click', () => panMap(0, PAN_AMOUNT));
    panDownBtn.addEventListener('click', () => panMap(0, -PAN_AMOUNT));
    panLeftBtn.addEventListener('click', () => panMap(PAN_AMOUNT, 0));
    panRightBtn.addEventListener('click', () => panMap(-PAN_AMOUNT, 0));

    window.addEventListener('resize', updateTransform);

    mapContainer.addEventListener('transitionend', () => {
        mapContainer.classList.remove('is-transitioning');
    });

    // --- Initial Load ---
    loadAllData();
});
