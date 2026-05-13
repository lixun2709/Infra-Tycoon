import json

WIDTH = 120
HEIGHT = 60

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

# Load the file manually since it has markdown headers
with open('world_data.md', 'r') as f:
    lines = f.readlines()
    json_str = "".join(lines[4:]) # Skip markdown header
    data = json.loads(json_str)

grid = [[False for _ in range(WIDTH)] for _ in range(HEIGHT)]

for feature in data['features']:
    geom = feature['geometry']
    if not geom: continue
    
    # Handle Polygon and MultiPolygon
    poly_sets = []
    if geom['type'] == 'Polygon':
        poly_sets = [geom['coordinates']]
    elif geom['type'] == 'MultiPolygon':
        poly_sets = geom['coordinates']
    
    for poly_set in poly_sets:
        for poly in poly_set:
            # Basic bounding box
            min_lng = min(p[0] for p in poly)
            max_lng = max(p[0] for p in poly)
            min_lat = min(p[1] for p in poly)
            max_lat = max(p[1] for p in poly)
            
            min_gx = int((min_lng + 180) * (WIDTH / 360))
            max_gx = int((max_lng + 180) * (WIDTH / 360))
            min_gy = int((90 - max_lat) * (HEIGHT / 180))
            max_gy = int((90 - min_lat) * (HEIGHT / 180))
            
            for gy in range(max(0, min_gy-1), min(HEIGHT, max_gy+2)):
                for gx in range(max(0, min_gx-1), min(WIDTH, max_gx+2)):
                    glng = (gx / WIDTH) * 360 - 180
                    glat = 90 - (gy / HEIGHT) * 180
                    if is_point_in_poly(glng, glat, poly):
                        grid[gy][gx] = True

# Output compact representation
result = []
for y in range(HEIGHT):
    row = ""
    for x in range(WIDTH):
        row += "1" if grid[y][x] else "0"
    result.append(row)

print("|".join(result))
