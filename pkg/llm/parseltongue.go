package llm

import (
	"math/rand"
	"regexp"
	"strings"
)

// ObfuscationTechnique defines the character-level perturbation method.
type ObfuscationTechnique string

const (
	TechniqueLeetspeak ObfuscationTechnique = "leetspeak"
	TechniqueUnicode   ObfuscationTechnique = "unicode"
	TechniqueZWJ       ObfuscationTechnique = "zwj"
	TechniqueMixedCase ObfuscationTechnique = "mixedcase"
	TechniquePhonetic  ObfuscationTechnique = "phonetic"
	TechniqueRandom    ObfuscationTechnique = "random"
)

// Intensity controls how many characters per trigger word are transformed.
type Intensity string

const (
	IntensityLight  Intensity = "light"
	IntensityMedium Intensity = "medium"
	IntensityHeavy  Intensity = "heavy"
)

// ParseltongueConfig controls the perturbation engine.
type ParseltongueConfig struct {
	Enabled        bool                 `json:"enabled"`
	Technique      ObfuscationTechnique `json:"technique"`
	Intensity      Intensity            `json:"intensity"`
	CustomTriggers []string             `json:"customTriggers,omitempty"`
}

// ParseltongueResult carries the transformation metadata.
type ParseltongueResult struct {
	OriginalText    string                      `json:"originalText"`
	TransformedText string                      `json:"transformedText"`
	TriggersFound   []string                    `json:"triggersFound"`
	TechniqueUsed   ObfuscationTechnique        `json:"techniqueUsed"`
	Transformations []ParseltongueTransformation `json:"transformations"`
}

// ParseltongueTransformation records a single word replacement.
type ParseltongueTransformation struct {
	Original    string               `json:"original"`
	Transformed string               `json:"transformed"`
	Technique   ObfuscationTechnique `json:"technique"`
}

// Default trigger words that commonly cause model refusals.
var defaultTriggers = []string{
	// Action words
	"hack", "exploit", "bypass", "crack", "break", "attack", "penetrate",
	"inject", "manipulate", "override", "disable", "circumvent", "evade",
	// Security terms
	"malware", "virus", "trojan", "payload", "shellcode", "rootkit",
	"keylogger", "backdoor", "vulnerability",
	// Sensitive topics
	"weapon", "bomb", "explosive", "poison", "drug", "synthesize",
	// System terms
	"jailbreak", "unlock", "root", "sudo", "admin", "privilege",
	// Social engineering
	"phishing", "scam", "impersonate", "deceive", "fraud",
	// Content flags
	"nsfw", "explicit", "uncensored", "unfiltered", "unrestricted",
	// AI-specific
	"ignore", "disregard", "forget", "pretend", "roleplay",
	"character", "act as", "you are now", "new identity",
}

// Leetspeak substitution map.
var leetMap = map[byte][]string{
	'a': {"4", "@", "^"},
	'b': {"8", "|3"},
	'c': {"(", "<"},
	'd': {"|)", "|>"},
	'e': {"3", "€"},
	'f': {"|=", "ph"},
	'g': {"9", "6", "&"},
	'h': {"#", "|-|"},
	'i': {"1", "!", "|"},
	'j': {"_|", "]"},
	'k': {"|<", "|{"},
	'l': {"1", "|_"},
	'm': {"|V|", "/\\/\\\\"},
	'n': {"|\\|", "/\\/"},
	'o': {"0", "()", "ø"},
	'p': {"|*", "|>"},
	'q': {"0_", "()_"},
	'r': {"|2", "12"},
	's': {"5", "$", "§"},
	't': {"7", "+", "†"},
	'u': {"|_|", "µ"},
	'v': {"\\/"},
	'w': {"\\/\\/", "vv"},
	'x': {"><", "×"},
	'y': {"`/", "¥"},
	'z': {"2", "7_"},
}

// Unicode homoglyph map (visually similar, different codepoints).
var unicodeHomoglyphs = map[byte][]string{
	'a': {"\u0430", "\u0251", "\u03b1"}, // cyrillic а, latin alpha, greek alpha
	'b': {"\u044c"},                       // cyrillic ь
	'c': {"\u0441", "\u03f2"},             // cyrillic с, greek lunate sigma
	'd': {"\u0501"},                       // cyrillic ԁ
	'e': {"\u0435", "\u0117"},             // cyrillic е
	'g': {"\u0261"},                       // latin script g
	'h': {"\u04bb"},                       // cyrillic һ
	'i': {"\u0456", "\u03b9"},             // cyrillic і, greek iota
	'j': {"\u03f3"},                       // greek yot
	'k': {"\u03ba"},                       // greek kappa
	'l': {"\u04cf"},                       // cyrillic palochka
	'o': {"\u043e", "\u03bf"},             // cyrillic о, greek omicron
	'p': {"\u0440", "\u03c1"},             // cyrillic р, greek rho
	's': {"\u0455"},                       // cyrillic ѕ
	'u': {"\u03c5"},                       // greek upsilon
	'v': {"\u03bd"},                       // greek nu
	'x': {"\u0445"},                       // cyrillic х
	'y': {"\u0443", "\u03b3"},             // cyrillic у, greek gamma
	'z': {"\u1d22"},                       // latin small z with hook
}

// Zero-width Unicode characters for invisible insertion.
var zwChars = []string{
	"\u200B", // zero-width space
	"\u200C", // zero-width non-joiner
	"\u200D", // zero-width joiner
	"\uFEFF", // zero-width no-break space
}

// DefaultParseltongueConfig returns a disabled default configuration.
func DefaultParseltongueConfig() ParseltongueConfig {
	return ParseltongueConfig{
		Enabled:   false,
		Technique: TechniqueLeetspeak,
		Intensity: IntensityMedium,
	}
}

// DetectTriggers finds all trigger words present in text.
func DetectTriggers(text string, customTriggers []string) []string {
	allTriggers := append(append([]string{}, defaultTriggers...), customTriggers...)
	lower := strings.ToLower(text)
	seen := map[string]bool{}
	var found []string
	for _, trigger := range allTriggers {
		escaped := regexp.QuoteMeta(trigger)
		pattern := regexp.MustCompile(`(?i)\b` + escaped + `\b`)
		if pattern.MatchString(lower) && !seen[trigger] {
			seen[trigger] = true
			found = append(found, trigger)
		}
	}
	return found
}

// ApplyParseltongue detects trigger words and applies obfuscation.
func ApplyParseltongue(text string, cfg ParseltongueConfig) ParseltongueResult {
	if !cfg.Enabled {
		return ParseltongueResult{
			OriginalText:    text,
			TransformedText: text,
			TechniqueUsed:   cfg.Technique,
		}
	}

	triggers := DetectTriggers(text, cfg.CustomTriggers)
	if len(triggers) == 0 {
		return ParseltongueResult{
			OriginalText:    text,
			TransformedText: text,
			TechniqueUsed:   cfg.Technique,
		}
	}

	// Sort triggers longest-first to avoid partial replacements.
	sortedTriggers := make([]string, len(triggers))
	copy(sortedTriggers, triggers)
	for i := 0; i < len(sortedTriggers); i++ {
		for j := i + 1; j < len(sortedTriggers); j++ {
			if len(sortedTriggers[j]) > len(sortedTriggers[i]) {
				sortedTriggers[i], sortedTriggers[j] = sortedTriggers[j], sortedTriggers[i]
			}
		}
	}

	transformed := text
	var transformations []ParseltongueTransformation
	for _, trigger := range sortedTriggers {
		escaped := regexp.QuoteMeta(trigger)
		pattern := regexp.MustCompile(`(?i)\b` + escaped + `\b`)
		transformed = pattern.ReplaceAllStringFunc(transformed, func(match string) string {
			result := obfuscateWord(match, cfg.Technique, cfg.Intensity)
			transformations = append(transformations, ParseltongueTransformation{
				Original:    match,
				Transformed: result,
				Technique:   cfg.Technique,
			})
			return result
		})
	}

	return ParseltongueResult{
		OriginalText:    text,
		TransformedText: transformed,
		TriggersFound:   triggers,
		TechniqueUsed:   cfg.Technique,
		Transformations: transformations,
	}
}

func obfuscateWord(word string, technique ObfuscationTechnique, intensity Intensity) string {
	switch technique {
	case TechniqueLeetspeak:
		return applyLeetspeak(word, intensity)
	case TechniqueUnicode:
		return applyUnicodeHomoglyphs(word, intensity)
	case TechniqueZWJ:
		return applyZWJ(word, intensity)
	case TechniqueMixedCase:
		return applyMixedCase(word, intensity)
	case TechniquePhonetic:
		return applyPhonetic(word)
	case TechniqueRandom:
		techniques := []ObfuscationTechnique{TechniqueLeetspeak, TechniqueUnicode, TechniqueZWJ, TechniqueMixedCase}
		pick := techniques[rand.Intn(len(techniques))]
		return obfuscateWord(word, pick, intensity)
	default:
		return word
	}
}

func transformCount(wordLen int, intensity Intensity) int {
	switch intensity {
	case IntensityLight:
		return 1
	case IntensityMedium:
		return (wordLen + 1) / 2
	case IntensityHeavy:
		return wordLen
	default:
		return 1
	}
}

func applyLeetspeak(word string, intensity Intensity) string {
	chars := []byte(word)
	count := transformCount(len(chars), intensity)
	step := max(1, len(chars)/count)
	transformed := 0
	result := make([]string, len(chars))
	for i := range chars {
		result[i] = string(chars[i])
	}
	// First pass: stepped indices
	for i := 0; i < len(chars) && transformed < count; i += step {
		lower := toLowerByte(chars[i])
		if opts, ok := leetMap[lower]; ok {
			result[i] = opts[rand.Intn(len(opts))]
			transformed++
		}
	}
	// Second pass: fill remaining
	for i := 0; i < len(chars) && transformed < count; i++ {
		lower := toLowerByte(chars[i])
		if _, ok := leetMap[lower]; ok && result[i] == string(chars[i]) {
			opts := leetMap[lower]
			result[i] = opts[rand.Intn(len(opts))]
			transformed++
		}
	}
	return strings.Join(result, "")
}

func applyUnicodeHomoglyphs(word string, intensity Intensity) string {
	chars := []byte(word)
	count := transformCount(len(chars), intensity)
	transformed := 0
	result := make([]string, len(chars))
	for i := range chars {
		result[i] = string(chars[i])
	}
	for i := 0; i < len(chars) && transformed < count; i++ {
		lower := toLowerByte(chars[i])
		if opts, ok := unicodeHomoglyphs[lower]; ok {
			pick := opts[rand.Intn(len(opts))]
			if chars[i] >= 'A' && chars[i] <= 'Z' {
				pick = strings.ToUpper(pick)
			}
			result[i] = pick
			transformed++
		}
	}
	return strings.Join(result, "")
}

func applyZWJ(word string, intensity Intensity) string {
	chars := []byte(word)
	insertCount := transformCount(len(chars), intensity)
	if insertCount > len(chars)-1 {
		insertCount = len(chars) - 1
	}
	var buf strings.Builder
	insertions := 0
	for i, c := range chars {
		buf.WriteByte(c)
		if i < len(chars)-1 && insertions < insertCount {
			zw := zwChars[rand.Intn(len(zwChars))]
			buf.WriteString(zw)
			insertions++
		}
	}
	return buf.String()
}

func applyMixedCase(word string, intensity Intensity) string {
	chars := []byte(word)
	switch intensity {
	case IntensityLight:
		idx := rand.Intn(len(chars))
		chars[idx] = toUpperByte(chars[idx])
	case IntensityMedium:
		for i := range chars {
			if i%2 == 0 {
				chars[i] = toLowerByte(chars[i])
			} else {
				chars[i] = toUpperByte(chars[i])
			}
		}
	case IntensityHeavy:
		for i := range chars {
			if rand.Intn(2) == 0 {
				chars[i] = toUpperByte(chars[i])
			} else {
				chars[i] = toLowerByte(chars[i])
			}
		}
	}
	return string(chars)
}

func applyPhonetic(word string) string {
	subs := []struct {
		pattern *regexp.Regexp
		repl    string
	}{
		{regexp.MustCompile(`(?i)ph`), "f"},
		{regexp.MustCompile(`(?i)ck`), "k"},
		{regexp.MustCompile(`(?i)x`), "ks"},
		{regexp.MustCompile(`(?i)qu`), "kw"},
		{regexp.MustCompile(`(?i)c(?=[eiy])`), "s"},
		{regexp.MustCompile(`(?i)c`), "k"},
	}
	result := word
	for _, s := range subs {
		result = s.pattern.ReplaceAllString(result, s.repl)
	}
	return result
}

func toLowerByte(b byte) byte {
	if b >= 'A' && b <= 'Z' {
		return b + 32
	}
	return b
}

func toUpperByte(b byte) byte {
	if b >= 'a' && b <= 'z' {
		return b - 32
	}
	return b
}

