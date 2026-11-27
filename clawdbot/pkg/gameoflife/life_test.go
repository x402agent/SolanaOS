package gameoflife

import "testing"

// A 2x2 block is a still life: it must be unchanged after a step.
func TestBlockIsStable(t *testing.T) {
	g := New(6, 6)
	g.Set(2, 2, true)
	g.Set(2, 3, true)
	g.Set(3, 2, true)
	g.Set(3, 3, true)
	before := g.Population()
	g.Step()
	if g.Population() != before {
		t.Fatalf("block population changed: %d -> %d", before, g.Population())
	}
	for _, c := range [][2]int{{2, 2}, {2, 3}, {3, 2}, {3, 3}} {
		if !g.Alive(c[0], c[1]) {
			t.Fatalf("block cell (%d,%d) died", c[0], c[1])
		}
	}
}

// A horizontal blinker becomes vertical after one step and back after two.
func TestBlinkerOscillates(t *testing.T) {
	g := New(7, 7)
	g.Set(3, 2, true)
	g.Set(3, 3, true)
	g.Set(3, 4, true)

	g.Step()
	// Now vertical through the center column.
	for _, c := range [][2]int{{2, 3}, {3, 3}, {4, 3}} {
		if !g.Alive(c[0], c[1]) {
			t.Fatalf("after 1 step expected vertical blinker, (%d,%d) dead", c[0], c[1])
		}
	}
	if g.Alive(3, 2) || g.Alive(3, 4) {
		t.Fatal("horizontal arms should have died")
	}

	g.Step()
	// Back to horizontal.
	for _, c := range [][2]int{{3, 2}, {3, 3}, {3, 4}} {
		if !g.Alive(c[0], c[1]) {
			t.Fatalf("after 2 steps expected horizontal blinker, (%d,%d) dead", c[0], c[1])
		}
	}
}

// A glider returns to its original shape shifted by (+1,+1) after 4 generations.
func TestGliderTranslates(t *testing.T) {
	g := New(20, 20)
	g.SeedGlider(5, 5)
	start := livecoords(g)

	for i := 0; i < 4; i++ {
		g.Step()
	}
	got := livecoords(g)
	if len(got) != len(start) {
		t.Fatalf("glider population changed: %d -> %d", len(start), len(got))
	}
	// Every start cell shifted by (1,1) must be present now.
	for c := range start {
		shifted := [2]int{c[0] + 1, c[1] + 1}
		if !got[shifted] {
			t.Fatalf("glider did not translate: expected live cell at (%d,%d)", shifted[0], shifted[1])
		}
	}
	if g.Gen != 4 {
		t.Fatalf("Gen = %d, want 4", g.Gen)
	}
}

// The Gosper gun must exhibit unbounded growth: population strictly exceeds the
// seed after enough generations to emit gliders.
func TestGosperGunGrows(t *testing.T) {
	g := New(60, 60)
	g.SeedGosperGun(1, 1)
	seed := g.Population()
	for i := 0; i < 90; i++ {
		g.Step()
	}
	if g.Population() <= seed {
		t.Fatalf("Gosper gun did not grow: seed %d, later %d", seed, g.Population())
	}
}

func TestToroidalWrap(t *testing.T) {
	g := New(5, 5)
	// Set with out-of-range coords; must wrap rather than panic.
	g.Set(-1, -1, true)
	if !g.Alive(4, 4) {
		t.Fatal("negative coordinates did not wrap toroidally")
	}
	g.Set(5, 5, true)
	if !g.Alive(0, 0) {
		t.Fatal("overflow coordinates did not wrap toroidally")
	}
}

func livecoords(g *Grid) map[[2]int]bool {
	m := map[[2]int]bool{}
	for i := 0; i < g.Rows; i++ {
		for j := 0; j < g.Cols; j++ {
			if g.Cells[i][j] == 1 {
				m[[2]int{i, j}] = true
			}
		}
	}
	return m
}
