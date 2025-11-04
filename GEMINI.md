# Project: Interactive Caribbean Map

## Project Overview

This project is a standalone web-based interactive map of the Caribbean, likely for a game or historical visualization. It is built with vanilla HTML, CSS, and JavaScript. The application loads data for ports, ships, and other entities from local JSON files and displays them as interactive points on a pannable and zoomable map. A sidebar provides a filterable list of these points, and tooltips offer detailed information. The map also features a detailed grid and sub-grid system with terrain information.

### Key Technologies

*   **Frontend:** HTML, CSS, JavaScript (ES6)
*   **Data:** JSON
*   **Local Server:** Python `http.server`

## Building and Running

This is a static web project and does not have a build process.

To run the project locally, you need to have Python installed.

1.  **Start the web server:**
    *   On Windows, run the `webserver.cmd` file.
    *   On other operating systems, open a terminal in the project root and run the following command:
        ```bash
        python -m http.server
        ```

2.  **Open the application:**
    *   Open a web browser and navigate to `http://localhost:8000`.

## Development Conventions

*   **Code Style:** The JavaScript code is written in a procedural style with some object-oriented concepts. It is not using any major frameworks.
*   **Data Management:** All map data (ports, entities, grid, terrain) is stored in separate JSON files (`ports.json`, `entities.json`, `grid.json`, `terrain.json`). The application fetches this data at runtime.
*   **Modularity:** The code is organized into a single `script.js` file. The code is structured with clear sections for different functionalities like tooltips, data loading, grid lines, and event handling.
*   **Styling:** The application uses a custom stylesheet (`style.css`) with a dark theme. It uses the "IM Fell English" and "Merriweather" fonts from Google Fonts. Faction colors are defined in the CSS.
