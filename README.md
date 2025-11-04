# Caribbean Interactive Map

An interactive web-based map visualization of the Caribbean region, featuring zoomable/pannable navigation, ports, ships, and a detailed terrain classification system.

## Features

### Interactive Map Viewer
- **Pan & Zoom Navigation**: Mouse drag to pan, scroll to zoom (0.25x - 5x)
- **Smart Grid System**: 18×16 major grid with 5×5 sub-grids per cell (1,440 total sub-cells)
- **Dynamic Entities**: Ships and ports with faction-specific icons and colors
- **Real-time Tooltips**: Hover over locations for detailed information
- **Coordinate Display**: Click anywhere to see grid reference, lat/lon, and terrain type
- **Faction Management**: Support for 8 factions (England, France, Spain, Pirate, Native, Jesuit, Infected, Independent)
- **Auto-refresh**: Data reloads every 60 seconds

### Terrain Editor
- **Visual Classification**: Click any sub-grid cell to classify as Land, Water, or Both (coastal)
- **Live Preview**: See terrain changes in real-time
- **JSON Export**: Copy updated terrain data to clipboard

### Terrain Analysis Tool
- **Automated Classification**: Python script analyzes map image to auto-classify terrain
- **Batch Processing**: Processes all 1,440 sub-cells automatically

## Getting Started

### Prerequisites
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Python 3.x (for local server and terrain analysis tool)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/yourusername/caribbean-map.git
cd caribbean-map
```

2. Start the development server:

**Linux/Mac:**
```bash
python -m http.server
```

**Windows:**
```bash
webserver.cmd
```

3. Open your browser and navigate to:
```
http://localhost:8000
```

## Usage

### Map Viewer (`index.html`)

**Navigation:**
- **Pan**: Click and drag the map
- **Zoom**: Use mouse wheel or +/- buttons
- **Keyboard**: `+` to zoom in, `-` to zoom out
- **Reset**: Click "Reset View" to return to default position

**Exploring:**
- **Sidebar Tabs**: Browse all ports and entities
- **Quick Navigation**: Click any port/entity in the sidebar to focus on it
- **Tooltips**: Hover over markers for detailed information
- **Grid Coordinates**: Click the map to see grid reference and terrain type

### Terrain Editor (`map-editor.html`)

1. Open `http://localhost:8000/map-editor.html`
2. Click any sub-grid cell to open the classification popup
3. Select terrain type: **Land**, **Water**, or **Both** (coastal)
4. Review the updated JSON in the output panel
5. Click **Copy JSON** to copy to clipboard
6. Manually paste into `terrain.json` file

**Note**: The editor does not auto-save - you must manually update the file.

### Terrain Analysis Tool

Automatically classify terrain from the map image:

1. Install dependencies:
```bash
pip install pillow numpy
```

2. Run the analysis:
```bash
python tool/scan-map.py
```

3. Outputs `terrain.ini` and `terrain.json` files

## Data Format

### Ports (`ports.json`)
```json
{
  "id": "unique-id",
  "city": "Port Royal",
  "country": "England",
  "x": 1234,
  "y": 567,
  "description": "Major English port"
}
```

### Entities (`entities.json`)
```json
{
  "id": "ship-1",
  "name": "HMS Victory",
  "description": "English Man-o-War",
  "image": "ship-england.png",
  "x": 1234,
  "y": 567
}
```

### Terrain (`terrain.json`)
```json
{
  "A1-1-1": "water",
  "A1-1-2": "both",
  "A1-1-3": "land"
}
```

**Coordinate Format**: `A1-3-2`
- `A` = Column (A-R)
- `1` = Row (1-16)
- `3` = Sub-column (1-5)
- `2` = Sub-row (1-5)

## Grid Coordinate System

### Map Coverage
- **Latitude**: 30°N (top) to 14°N (bottom)
- **Longitude**: 98°W (left) to 62°W (right)

### Grid Structure
- **Major Grid**: 18 columns (A-R) × 16 rows (1-16)
- **Sub-Grid**: Each major cell divided into 5×5 sub-cells
- **Total Sub-Cells**: 1,440 (18 × 16 × 5 × 5)

### Dimensions
- **Map Size**: 3840×2498 pixels (logical coordinates)
- **Grid Offset**: (60, 60) pixels
- **Major Cell Width**: 213.33px
- **Major Cell Height**: 146.94px
- **Sub-Cell Width**: 42.67px
- **Sub-Cell Height**: 29.39px

## Factions

| Faction | Icon | Color |
|---------|------|-------|
| England | Anchor | Blue |
| France | Anchor | Light Blue |
| Spain | Anchor | Yellow |
| Pirate | Pirate Flag | Red |
| Infected | Biohazard | Purple |
| Native | Wigwam | Brown |
| Jesuit | Church | White |
| Independent | Flag | Gray |

## Project Structure

```
caribbean-map/
├── index.html              # Main map viewer
├── map-editor.html         # Terrain editor
├── script.js               # Main viewer logic
├── editor.js               # Editor logic
├── style.css               # Shared styles
├── ports.json              # Port locations and data
├── entities.json           # Ships and entities
├── terrain.json            # Terrain classifications
├── grid.json               # Grid configuration
├── images/
│   ├── map.jpg            # Caribbean map image
│   └── *.png              # Entity icons
└── tool/
    └── scan-map.py        # Terrain analysis script
```

## Technologies Used

- **Frontend**: Vanilla JavaScript (ES6+), HTML5, CSS3
- **Server**: Python HTTP server (development)
- **Analysis**: Python 3, PIL/Pillow, NumPy

## Configuration

Key constants defined in both `script.js` and `editor.js`:

```javascript
const MAP_WIDTH = 3840;
const MAP_HEIGHT = 2498;
const GRID_COLS = 18;
const GRID_ROWS = 16;
const GRID_START_X = 60;
const GRID_START_Y = 60;
const SUBGRID_DIVISIONS = 5;
const SUBGRID_ZOOM_THRESHOLD = 0.9;  // Sub-grid visibility threshold
```

## Development Notes

- Sub-grid lines only appear when zoom level ≥ 0.9x
- Cell height calculation uses 17 instead of 16: `CELL_HEIGHT = MAP_HEIGHT / 17`
- Auto-refresh interval: 60 seconds
- Cache-busting is enabled on both HTML files

## Contributing

1. Fork the repository
2. Create a feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the LICENSE file for details.

## Acknowledgments

- Map imagery of the Caribbean region
- Icon assets for ships and factions
