const fs = require('fs');

const WIDTH = 120;
const HEIGHT = 60;

function isPointInPoly(x, y, poly) {
    let inside = false;
    for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
        const xi = poly[i][0], yi = poly[i][1];
        const xj = poly[j][0], yj = poly[j][1];
        const intersect = ((yi > y) !== (yj > y)) && (x < (xj - xi) * (y - yi) / (yj - yi) + xi);
        if (intersect) inside = !inside;
    }
    return inside;
}

const rawData = fs.readFileSync('scratch/world_data.md', 'utf8');
const lines = rawData.split('\n');
const jsonStr = lines.slice(4).join('\n');
const data = JSON.parse(jsonStr);

const grid = Array.from({ length: HEIGHT }, () => Array(WIDTH).fill(false));

data.features.forEach(feature => {
    const geom = feature.geometry;
    if (!geom) return;

    let polySets = [];
    if (geom.type === 'Polygon') {
        polySets = [geom.coordinates];
    } else if (geom.type === 'MultiPolygon') {
        polySets = geom.coordinates;
    }

    polySets.forEach(polySet => {
        polySet.forEach(poly => {
            const lngs = poly.map(p => p[0]);
            const lats = poly.map(p => p[1]);
            const minLng = Math.min(...lngs);
            const maxLng = Math.max(...lngs);
            const minLat = Math.min(...lats);
            const maxLat = Math.max(...lats);

            const minGX = Math.floor((minLng + 180) * (WIDTH / 360));
            const maxGX = Math.ceil((maxLng + 180) * (WIDTH / 360));
            const minGY = Math.floor((90 - maxLat) * (HEIGHT / 180));
            const maxGY = Math.ceil((90 - minLat) * (HEIGHT / 180));

            for (let gy = Math.max(0, minGY - 1); gy < Math.min(HEIGHT, maxGY + 1); gy++) {
                for (let gx = Math.max(0, minGX - 1); gx < Math.min(WIDTH, maxGX + 1); gx++) {
                    const glng = (gx / WIDTH) * 360 - 180;
                    const glat = 90 - (gy / HEIGHT) * 180;
                    if (isPointInPoly(glng, glat, poly)) {
                        grid[gy][gx] = true;
                    }
                }
            }
        });
    });
});

const result = grid.map(row => row.map(cell => cell ? '1' : '0').join('')).join('|');
fs.writeFileSync('scratch/map_bits.txt', result);
console.log('Done');
