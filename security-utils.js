/**
 * Security Utilities for PiratesIRC Interactive Map
 * Provides sanitization and validation functions to prevent XSS and other attacks
 */

/**
 * Escapes HTML special characters to prevent XSS attacks
 * @param {string} unsafe - The untrusted string to escape
 * @returns {string} - HTML-safe string
 */
function escapeHtml(unsafe) {
    if (typeof unsafe !== 'string') {
        return '';
    }
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

/**
 * Validates and sanitizes image filenames to prevent path traversal
 * @param {string} filename - The image filename from untrusted source
 * @returns {string} - Safe image path
 */
function sanitizeImagePath(filename) {
    if (!filename || typeof filename !== 'string') {
        return 'images/default.png';
    }

    // Remove path traversal attempts and path separators
    let safe = filename.replace(/\.\./g, '').replace(/[\/\\]/g, '');

    // Only allow alphanumeric, dash, underscore, and dots
    safe = safe.replace(/[^a-zA-Z0-9._-]/g, '');

    // Validate file extension
    if (!/\.(png|jpg|jpeg|gif|svg)$/i.test(safe)) {
        return 'images/default.png';
    }

    // Ensure it's in the images directory
    return `images/${safe}`;
}

/**
 * Validates and sanitizes faction/country names
 * @param {string} faction - The faction name from untrusted source
 * @returns {string} - Safe faction name
 */
function sanitizeFaction(faction) {
    if (!faction || typeof faction !== 'string') {
        return 'independent';
    }

    // List of allowed factions
    const allowedFactions = [
        'england', 'france', 'spain', 'dutch', 'netherlands',
        'pirate', 'infected', 'native', 'jesuit', 'independent'
    ];

    // Normalize and sanitize
    const normalized = faction.toLowerCase().trim().replace(/\s+/g, '-');
    const safe = normalized.replace(/[^a-z-]/g, '');

    // Return safe faction or default
    return allowedFactions.includes(safe) ? safe : 'independent';
}

/**
 * Validates port/location data
 * @param {object} port - Port object from JSON
 * @param {number} mapWidth - Maximum X coordinate
 * @param {number} mapHeight - Maximum Y coordinate
 * @returns {boolean} - True if valid
 */
function validatePort(port, mapWidth, mapHeight) {
    if (!port || typeof port !== 'object') return false;

    // Validate required fields
    if (!port.id || typeof port.id !== 'string') return false;
    if (!port.city || typeof port.city !== 'string') return false;
    if (!port.country || typeof port.country !== 'string') return false;

    // Validate string lengths to prevent DoS
    if (port.id.length > 100) return false;
    if (port.city.length > 100) return false;
    if (port.country.length > 50) return false;
    if (port.description && port.description.length > 1000) return false;

    // Validate coordinates
    if (typeof port.x !== 'number' || port.x < 0 || port.x > mapWidth) return false;
    if (typeof port.y !== 'number' || port.y < 0 || port.y > mapHeight) return false;

    return true;
}

/**
 * Validates entity data
 * @param {object} entity - Entity object from JSON
 * @param {number} mapWidth - Maximum X coordinate
 * @param {number} mapHeight - Maximum Y coordinate
 * @returns {boolean} - True if valid
 */
function validateEntity(entity, mapWidth, mapHeight) {
    if (!entity || typeof entity !== 'object') return false;

    // Validate required fields
    if (!entity.id || typeof entity.id !== 'string') return false;
    if (!entity.name || typeof entity.name !== 'string') return false;

    // Validate string lengths
    if (entity.id.length > 100) return false;
    if (entity.name.length > 100) return false;
    if (entity.description && entity.description.length > 1000) return false;
    if (entity.image && entity.image.length > 100) return false;

    // Validate coordinates
    if (typeof entity.x !== 'number' || entity.x < 0 || entity.x > mapWidth) return false;
    if (typeof entity.y !== 'number' || entity.y < 0 || entity.y > mapHeight) return false;

    return true;
}

/**
 * Validates terrain data
 * @param {object} terrain - Terrain object from JSON
 * @returns {boolean} - True if valid
 */
function validateTerrain(terrain) {
    if (!terrain || typeof terrain !== 'object') return false;

    const validTerrainTypes = ['land', 'water', 'both'];
    const validKeyPattern = /^[A-R](1[0-6]|[1-9])-[1-5]-[1-5]$/;

    for (const [key, value] of Object.entries(terrain)) {
        // Validate key format (e.g., "A1-3-2")
        if (!validKeyPattern.test(key)) return false;

        // Validate terrain type
        if (!validTerrainTypes.includes(value)) return false;
    }

    return true;
}

/**
 * Sanitizes text content with maximum length
 * @param {string} text - Text to sanitize
 * @param {number} maxLength - Maximum allowed length
 * @returns {string} - Safe text
 */
function sanitizeText(text, maxLength = 1000) {
    if (!text || typeof text !== 'string') {
        return '';
    }

    // Trim and limit length
    let safe = text.trim();
    if (safe.length > maxLength) {
        safe = safe.substring(0, maxLength);
    }

    return safe;
}

/**
 * Creates a safe DOM element with text content
 * @param {string} tagName - HTML tag name
 * @param {string} textContent - Text content (will be escaped)
 * @param {string} className - Optional class name
 * @returns {HTMLElement} - Safe DOM element
 */
function createSafeElement(tagName, textContent = '', className = '') {
    const element = document.createElement(tagName);
    element.textContent = sanitizeText(textContent);
    if (className) {
        element.className = className;
    }
    return element;
}

/**
 * Creates a safe image element
 * @param {string} src - Image source (will be sanitized)
 * @param {string} alt - Alt text (will be escaped)
 * @returns {HTMLImageElement} - Safe image element
 */
function createSafeImage(src, alt) {
    const img = document.createElement('img');
    img.src = sanitizeImagePath(src);
    img.alt = escapeHtml(alt || '');
    return img;
}
