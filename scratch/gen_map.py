import json

# Grid settings
WIDTH = 120
HEIGHT = 60

def lat_lng_to_grid(lat, lng):
    x = int((lng + 180) * (WIDTH / 360))
    y = int((90 - lat) * (HEIGHT / 180))
    return x, y

def is_point_in_poly(x, y, poly):
    n = len(poly)
    inside = False
    p1x, p1y = poly[0]
    for i in range(n + 1):
        p2x, p2y = poly[i % n]
        if y > min(p1y, p2y):
            if y <= max(p1y, p2y):
                if x <= max(p1x, p2x):
                    if p1y != p2y:
                        xints = (y - p1y) * (p2x - p1x) / (p2y - p1y) + p1x
                    if p1x == p2x or x <= xints:
                        inside = not inside
        p1x, p1y = p2x, p2y
    return inside

with open('world.geojson', 'r') as f:
    data = json.load(f)

grid = [[False for _ in range(WIDTH)] for _ in range(HEIGHT)]

for feature in data['features']:
    geom = feature['geometry']
    coords = geom['coordinates']
    if geom['type'] == 'Polygon':
        coords = [coords]
    
    for poly_set in coords:
        for poly in poly_set:
            # Simple bounding box check for speed
            min_lng = min(p[0] for p in poly)
            max_lng = max(p[0] for p in poly)
            min_lat = min(p[1] for p in poly)
            max_lat = max(p[1] for p in poly)
            
            min_x, min_y = lat_lng_to_grid(max_lat, min_lng)
            max_x, max_y = lat_lng_to_grid(min_lat, max_lng)
            
            for gy in range(max(0, min_y-1), min(HEIGHT, max_y+2)):
                for gx in range(max(0, min_x-1), min(WIDTH, max_x+2)):
                    # Grid center lat/lng
                    glng = (gx / WIDTH) * 360 - 180
                    glat = 90 - (gy / HEIGHT) * 180
                    if is_point_in_poly(glng, glat, poly):
                        grid[gy][gx] = True

# Convert to bitstring or compact representation
rows = []
for y in range(HEIGHT):
    row_val = 0
    for x in range(WIDTH):
        if grid[y][x]:
            rows.append(f"{x},{y}")

print("|".join(rows))
