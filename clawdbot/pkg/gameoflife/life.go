// Package gameoflife implements Conway's Game of Life — the cellular automaton
// that is Turing-complete (a universal computer, per Conway 1982). It is adapted
// from the Pied Piper GameOfLife module (docs/PiedPiper-master/GameOfLife) into
// a clean, deterministic, toroidal Go engine that the ClawdBot console renders
// as its "universal computer" animation alongside the Weissman compression score.
package gameoflife

// Grid is a wrap-around (toroidal) Life board. Cells are 0 (dead) or 1 (alive).
type Grid struct {
	Rows  int       `json:"rows"`
	Cols  int       `json:"cols"`
	Gen   int       `json:"gen"`
	Cells [][]uint8 `json:"cells"`
}

// New allocates a rows×cols dead grid.
func New(rows, cols int) *Grid {
	if rows < 1 {
		rows = 1
	}
	if cols < 1 {
		cols = 1
	}
	cells := make([][]uint8, rows)
	for i := range cells {
		cells[i] = make([]uint8, cols)
	}
	return &Grid{Rows: rows, Cols: cols, Cells: cells}
}

// Set turns a cell on or off, wrapping coordinates toroidally so callers can
// place patterns without bounds-checking.
func (g *Grid) Set(r, c int, alive bool) {
	r = wrap(r, g.Rows)
	c = wrap(c, g.Cols)
	if alive {
		g.Cells[r][c] = 1
	} else {
		g.Cells[r][c] = 0
	}
}

// Alive reports whether a cell is live, wrapping coordinates.
func (g *Grid) Alive(r, c int) bool {
	return g.Cells[wrap(r, g.Rows)][wrap(c, g.Cols)] == 1
}

// Population counts live cells.
func (g *Grid) Population() int {
	n := 0
	for _, row := range g.Cells {
		for _, v := range row {
			if v == 1 {
				n += int(v)
			}
		}
	}
	return n
}

// Step advances the board one generation under Conway's B3/S23 rule on a
// toroidal topology, mutating the grid in place.
func (g *Grid) Step() {
	next := make([][]uint8, g.Rows)
	for i := 0; i < g.Rows; i++ {
		next[i] = make([]uint8, g.Cols)
		for j := 0; j < g.Cols; j++ {
			n := g.liveNeighbors(i, j)
			if g.Cells[i][j] == 1 {
				// Survival: a live cell with 2 or 3 neighbors lives on.
				if n == 2 || n == 3 {
					next[i][j] = 1
				}
			} else if n == 3 {
				// Birth: a dead cell with exactly 3 neighbors becomes alive.
				next[i][j] = 1
			}
		}
	}
	g.Cells = next
	g.Gen++
}

// liveNeighbors counts the 8 Moore-neighborhood live cells with toroidal wrap.
func (g *Grid) liveNeighbors(r, c int) int {
	n := 0
	for dr := -1; dr <= 1; dr++ {
		for dc := -1; dc <= 1; dc++ {
			if dr == 0 && dc == 0 {
				continue
			}
			if g.Cells[wrap(r+dr, g.Rows)][wrap(c+dc, g.Cols)] == 1 {
				n++
			}
		}
	}
	return n
}

// SeedGlider places a glider with its top-left near (r,c). The glider is the
// canonical Life spaceship — it translates diagonally forever, the moving "bit"
// that makes Life a universal computer.
func (g *Grid) SeedGlider(r, c int) {
	pattern := [][2]int{{0, 1}, {1, 2}, {2, 0}, {2, 1}, {2, 2}}
	for _, p := range pattern {
		g.Set(r+p[0], c+p[1], true)
	}
}

// SeedGosperGun places a Gosper glider gun — the pattern that first proved Life
// supports unbounded growth, emitting a glider every 30 generations.
func (g *Grid) SeedGosperGun(r, c int) {
	cells := [][2]int{
		{0, 24},
		{1, 22}, {1, 24},
		{2, 12}, {2, 13}, {2, 20}, {2, 21}, {2, 34}, {2, 35},
		{3, 11}, {3, 15}, {3, 20}, {3, 21}, {3, 34}, {3, 35},
		{4, 0}, {4, 1}, {4, 10}, {4, 16}, {4, 20}, {4, 21},
		{5, 0}, {5, 1}, {5, 10}, {5, 14}, {5, 16}, {5, 17}, {5, 22}, {5, 24},
		{6, 10}, {6, 16}, {6, 24},
		{7, 11}, {7, 15},
		{8, 12}, {8, 13},
	}
	for _, p := range cells {
		g.Set(r+p[0], c+p[1], true)
	}
}

func wrap(x, n int) int {
	x %= n
	if x < 0 {
		x += n
	}
	return x
}
