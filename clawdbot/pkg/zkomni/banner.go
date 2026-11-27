package zkomni

import (
	"fmt"
	"io"
	"strings"
	"time"
)

// Banner is the static zk-shark-agent mark (one swim-cycle pose).
const Banner = `
                     ^
                    / \
              ____ /   \____
            _/  o           \___
           /                  ===>
           \____   ____      /
                \_/    \____/
                 V
   zk-shark-agent · shark of all streets
`

// Frames is a 4-pose swim cycle. Every frame has the same line count so
// a TTY can redraw in place with cursor-up.
var Frames = []string{
	`
      o             ~~~~     ~~~~
                     ^
                    / \
              ____ /   \____
            _/  o           \___
           /                  ===>
           \____   ____      /
                \_/    \____/
                 V
   zk-shark-agent · shark of all streets
`,
	`
        o         ~~~~     ~~~~
                    /
                   / \
             ____ /   ____
           _/  o          \____
          /                   ===>
          \____  ____        /
               \/    \______/
                V
   zk-shark-agent · shark of all streets
`,
	`
           o      ~~~~     ~~~~
                    ^
                     \
              ____    \____
            _/  -           \___
           /                  ===>
           \____    ___      /
                \__/   \____/
                 V
   zk-shark-agent · shark of all streets
`,
	`
              o   ~~~~     ~~~~
                     \
                    / \
              ____ /    ____
            _/  o            \__
           /                  ===>
           \___    ____      /
               \__/    \____/
                V
   zk-shark-agent · shark of all streets
`,
}

const cursorUp = "\x1b[%dA"

// WriteBanner writes the static shark mark.
func WriteBanner(w io.Writer) error {
	_, err := io.WriteString(w, Banner)
	return err
}

// Play redraws Frames in place for cycles iterations. delay is the pause
// between poses. A non-positive delay writes a single static banner.
func Play(w io.Writer, cycles int, delay time.Duration) error {
	if delay <= 0 || len(Frames) == 0 {
		return WriteBanner(w)
	}
	if cycles < 1 {
		cycles = 1
	}
	lines := strings.Count(Frames[0], "\n")
	first := true
	for c := 0; c < cycles; c++ {
		for _, frame := range Frames {
			if !first {
				if _, err := fmt.Fprintf(w, cursorUp, lines); err != nil {
					return err
				}
			}
			first = false
			if _, err := io.WriteString(w, frame); err != nil {
				return err
			}
			time.Sleep(delay)
		}
	}
	return nil
}
