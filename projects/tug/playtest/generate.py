# The generator the ten yards came from (Python 3, no packages):
#   python3 generate.py <first seed> <last seed> <width> <height> <derelicts> [wall density]
# prints the six yards with the most pushes needed.
# Generate Sokoban rooms: random walls, goals, then a breadth-first search
# backwards (pulls) from the solved position. The farthest state from it is a
# start whose best solution takes that many pushes.
import random, sys
from collections import deque
D = [(0,-1),(1,0),(0,1),(-1,0)]
def regions(floor, boxes, start):
    seen = {start}; q = [start]
    while q:
        x, y = q.pop()
        for dx, dy in D:
            n = (x+dx, y+dy)
            if n in floor and n not in boxes and n not in seen: seen.add(n); q.append(n)
    return seen
def gen(w, h, k, seed):
    rnd = random.Random(seed)
    floor = {(x, y) for x in range(1, w+1) for y in range(1, h+1)}
    for _ in range(int(w*h*float(sys.argv[6] if len(sys.argv) > 6 else 0.22))):
        c = (rnd.randint(1, w), rnd.randint(1, h)); floor.discard(c)
    # keep the largest connected piece
    best = set()
    left = set(floor)
    while left:
        r = regions(floor, set(), next(iter(left))); left -= r
        if len(r) > len(best): best = r
    floor = best
    if len(floor) < k + 8: return None
    goals = frozenset(rnd.sample(sorted(floor), k))
    # reverse BFS: state = (boxes, canonical player cell)
    def canon(boxes, p):
        return min(regions(floor, boxes, p))
    starts = []
    for c in floor - goals:
        r = regions(floor, goals, c)
        if min(r) == c: starts.append((goals, c))
    dist = {}; q = deque()
    for s in starts: dist[s] = 0; q.append(s)
    far = None
    while q:
        boxes, p = q.popleft(); d = dist[(boxes, p)]
        if len(dist) > 400000: return None
        far = (boxes, p, d) if not far or d > far[2] else far
        for cell in regions(floor, boxes, p):
            for dx, dy in D:
                b = (cell[0]+dx, cell[1]+dy); back = (cell[0]-dx, cell[1]-dy)
                # pull: player at cell, box at b, player steps to back, box to cell
                if b in boxes and back in floor and back not in boxes:
                    nb = (boxes - {b}) | {cell}
                    s = (frozenset(nb), canon(frozenset(nb), back))
                    if s not in dist: dist[s] = d + 1; q.append(s)
    boxes, p, d = far
    if any(b in goals for b in boxes): pass
    rows = []
    for y in range(0, h+2):
        row = ""
        for x in range(0, w+2):
            c = (x, y)
            if c not in floor: row += "#"
            elif c in boxes and c in goals: row += "*"
            elif c in boxes: row += "$"
            elif c in goals: row += "."
            elif c == p: row += "@"
            else: row += " "
        rows.append(row)
    return d, sum(b in goals for b in boxes), rows
out = []
for seed in range(int(sys.argv[1]), int(sys.argv[2])):
    for (w, h, k) in [(int(sys.argv[3]), int(sys.argv[4]), int(sys.argv[5]))]:
        r = gen(w, h, k, seed)
        if r: out.append((r[0], r[1], seed, r[2]))
out.sort(reverse=True)
for d, ong, seed, rows in out[:6]:
    print(d, "pushes", ong, "on goal", "seed", seed); print("\n".join(rows))
