package ooda

import "testing"

func TestResolveTickCount(t *testing.T) {
	t.Parallel()
	cases := []struct {
		name     string
		sim      bool
		ticks    int
		ticksSet bool
		want     int
	}{
		{name: "readme sim defaults to one tick", sim: true, want: 1},
		{name: "sim ticks 0 is forever", sim: true, ticks: 0, ticksSet: true, want: 0},
		{name: "sim ticks 3", sim: true, ticks: 3, ticksSet: true, want: 3},
		{name: "live without ticks is forever", sim: false, want: 0},
		{name: "live explicit ticks", sim: false, ticks: 5, ticksSet: true, want: 5},
		{name: "negative treated as forever when set", sim: true, ticks: -2, ticksSet: true, want: 0},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			t.Parallel()
			got := ResolveTickCount(tc.sim, tc.ticks, tc.ticksSet)
			if got != tc.want {
				t.Fatalf("ResolveTickCount(%v, %d, %v) = %d, want %d",
					tc.sim, tc.ticks, tc.ticksSet, got, tc.want)
			}
		})
	}
}
