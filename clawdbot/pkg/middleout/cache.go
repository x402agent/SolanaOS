// Package middleout implements ClawdBot's "middle-out" runtime: a realtime
// compressing content cache with content-addressed routing, plus a goal-driven
// Ralph loop that runs a step function until a goal predicate holds.
//
// The name is the Pied Piper joke, but the mechanics are real: cached payloads
// are zstd-compressed on write (compress), keyed by content hash so identical
// payloads collapse to one entry (dedupe/route), and evicted by least-recently-
// used order under a byte budget (bounded realtime cache).
package middleout

import (
	"container/list"
	"crypto/sha256"
	"encoding/hex"
	"sync"
	"time"

	"github.com/klauspost/compress/zstd"
)

// sharedEncoder/decoder are safe for concurrent use per the zstd docs and avoid
// per-operation allocation on the hot path.
var (
	sharedEncoder *zstd.Encoder
	sharedDecoder *zstd.Decoder
	encoderOnce   sync.Once
	decoderOnce   sync.Once
)

func encoder() *zstd.Encoder {
	encoderOnce.Do(func() {
		sharedEncoder, _ = zstd.NewWriter(nil, zstd.WithEncoderLevel(zstd.SpeedBetterCompression))
	})
	return sharedEncoder
}

func decoder() *zstd.Decoder {
	decoderOnce.Do(func() {
		sharedDecoder, _ = zstd.NewReader(nil)
	})
	return sharedDecoder
}

// Compress zstd-compresses b.
func Compress(b []byte) []byte {
	return encoder().EncodeAll(b, make([]byte, 0, len(b)/2+16))
}

// Decompress reverses Compress.
func Decompress(b []byte) ([]byte, error) {
	return decoder().DecodeAll(b, nil)
}

// ContentKey is the content address of a payload (sha256, hex).
func ContentKey(b []byte) string {
	sum := sha256.Sum256(b)
	return hex.EncodeToString(sum[:])
}

type entry struct {
	key        string
	compressed []byte
	rawSize    int
	createdAt  time.Time
	hits       int
}

// Stats is a snapshot of cache activity for the console.
type Stats struct {
	Entries          int     `json:"entries"`
	Hits             int64   `json:"hits"`
	Misses           int64   `json:"misses"`
	HitRate          float64 `json:"hitRate"`
	RawBytes         int64   `json:"rawBytes"`        // uncompressed bytes currently held
	CompressedBytes  int64   `json:"compressedBytes"` // on-the-wire bytes currently held
	CompressionRatio float64 `json:"compressionRatio"`
	Evictions        int64   `json:"evictions"`
	MaxBytes         int64   `json:"maxBytes"`
	Dedupes          int64   `json:"dedupes"`
}

// Cache is a thread-safe, LRU, compress-on-write content cache bounded by the
// total compressed bytes it holds.
type Cache struct {
	mu       sync.Mutex
	maxBytes int64
	curBytes int64 // sum of compressed sizes
	rawBytes int64 // sum of raw sizes (for ratio reporting)
	ll       *list.List
	items    map[string]*list.Element

	hits, misses, evictions, dedupes int64
}

// NewCache creates a cache holding at most maxBytes of compressed data.
func NewCache(maxBytes int64) *Cache {
	if maxBytes <= 0 {
		maxBytes = 8 << 20 // 8 MiB default
	}
	return &Cache{
		maxBytes: maxBytes,
		ll:       list.New(),
		items:    make(map[string]*list.Element),
	}
}

// PutContent compresses and stores value under its own content hash, returning
// the content key. Identical content is stored once (a dedupe), and the entry is
// moved to most-recently-used.
func (c *Cache) PutContent(value []byte) string {
	key := ContentKey(value)
	c.Put(key, value)
	return key
}

// Put compresses and stores value under key, evicting LRU entries until the
// compressed footprint fits the budget.
func (c *Cache) Put(key string, value []byte) {
	comp := Compress(value)
	c.mu.Lock()
	defer c.mu.Unlock()

	if el, ok := c.items[key]; ok {
		// Same key already present: refresh payload and recency, count a dedupe.
		e := el.Value.(*entry)
		c.curBytes += int64(len(comp)) - int64(len(e.compressed))
		c.rawBytes += int64(len(value)) - int64(e.rawSize)
		e.compressed = comp
		e.rawSize = len(value)
		c.dedupes++
		c.ll.MoveToFront(el)
		c.evictToFit()
		return
	}

	e := &entry{key: key, compressed: comp, rawSize: len(value), createdAt: time.Now()}
	el := c.ll.PushFront(e)
	c.items[key] = el
	c.curBytes += int64(len(comp))
	c.rawBytes += int64(len(value))
	c.evictToFit()
}

// Get returns the decompressed value for key and records a hit or miss.
func (c *Cache) Get(key string) ([]byte, bool) {
	c.mu.Lock()
	el, ok := c.items[key]
	if !ok {
		c.misses++
		c.mu.Unlock()
		return nil, false
	}
	e := el.Value.(*entry)
	e.hits++
	c.hits++
	c.ll.MoveToFront(el)
	comp := e.compressed
	c.mu.Unlock()

	out, err := Decompress(comp)
	if err != nil {
		return nil, false
	}
	return out, true
}

// evictToFit drops least-recently-used entries until within budget. Caller holds
// the lock.
func (c *Cache) evictToFit() {
	for c.curBytes > c.maxBytes {
		el := c.ll.Back()
		if el == nil {
			return
		}
		e := el.Value.(*entry)
		c.ll.Remove(el)
		delete(c.items, e.key)
		c.curBytes -= int64(len(e.compressed))
		c.rawBytes -= int64(e.rawSize)
		c.evictions++
	}
}

// Stats returns a snapshot of cache activity.
func (c *Cache) Stats() Stats {
	c.mu.Lock()
	defer c.mu.Unlock()
	total := c.hits + c.misses
	var hitRate, ratio float64
	if total > 0 {
		hitRate = float64(c.hits) / float64(total)
	}
	if c.curBytes > 0 {
		ratio = float64(c.rawBytes) / float64(c.curBytes)
	}
	return Stats{
		Entries:          c.ll.Len(),
		Hits:             c.hits,
		Misses:           c.misses,
		HitRate:          hitRate,
		RawBytes:         c.rawBytes,
		CompressedBytes:  c.curBytes,
		CompressionRatio: ratio,
		Evictions:        c.evictions,
		MaxBytes:         c.maxBytes,
		Dedupes:          c.dedupes,
	}
}

// Has reports whether key is currently cached without affecting hit/miss stats.
func (c *Cache) Has(key string) bool {
	c.mu.Lock()
	defer c.mu.Unlock()
	_, ok := c.items[key]
	return ok
}
