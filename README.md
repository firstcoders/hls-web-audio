# hls-web-audio

`@firstcoders/hls-web-audio` plays multiple streamed audio tracks in sync using
the Web Audio API. It is designed for stem-like playback where each track can
be independently loaded, buffered, scheduled, and mixed.

The package supports HLS manifests (`.m3u8`) and browser-supported audio
formats.

## Install

```bash
npm i @firstcoders/hls-web-audio
```

## Public API

```js
import { Controller, HLS } from '@firstcoders/hls-web-audio';
```

Also exported as subpaths:

- `@firstcoders/hls-web-audio/core/AudioController.js`
- `@firstcoders/hls-web-audio/track/HLS.js`

## Quick Start

```js
import { Controller, HLS } from '@firstcoders/hls-web-audio';

const controller = new Controller({ loop: false });

const drums = new HLS({ controller });
const bass = new HLS({ controller });
const vocal = new HLS({ controller });

await Promise.all([
  drums.load('https://example.com/drums.m3u8').promise,
  bass.load('https://example.com/bass.m3u8').promise,
  vocal.load('https://example.com/vocal.m3u8').promise,
]);

await controller.play();

// seek by absolute time or percentage
controller.currentTime = 30;
controller.pct = 0.5;
```

## Architecture

The runtime is split into clear layers:

- `src/core/`: global playback orchestration
- `src/track/`: per-track scheduling and segment ordering
- `src/io/`: manifest loading, segment loading, decoding, and connection
- `src/lib/`: helper utilities

### Core Layer (`src/core`)

- `AudioController`: top-level facade and event hub
- `PlaybackEngine`: handles play/pause state and buffering transitions
- `PlaybackTimeline`: computes `currentTime`, seek offsets, and percentages
- `Timeframe`: immutable-ish snapshot used for scheduling calculations
- `TrackGroup`: maintains track collection and aggregate readiness
- `Observer`: event emitter primitive used by the controller

### Track Layer (`src/track`)

- `Track`: base track behavior and controller wiring
- `HLS`: HLS-specific track that builds segments from manifests
- `TrackScheduler`: lookahead scheduler for loading/connecting segments
- `Stack`: doubly linked list that stores segments in timeline order

### I/O Layer (`src/io`)

- `ManifestLoader`: fetches/parses manifests
- `AudioSegment`: segment model and lifecycle
- `SegmentLoader`: network fetch for segment bytes
- `SegmentBuffer`: decode/cache management
- `SegmentPlayer`: source-node connection/disconnection behavior

## Playback Flow

1. `HLS.load()` fetches and parses the manifest.
2. Segment objects are created and pushed into `Stack` (linked list).
3. `TrackScheduler.runSchedulePass()` picks upcoming segments in a lookahead
   window.
4. Each segment is loaded (if needed), decoded, and connected at precisely
   calculated start/offset times via `Timeframe`.
5. `PlaybackEngine` monitors readiness (`shouldAndCanPlay`) and suspends/resumes
   audio context during buffering.
6. The UI reads `controller.currentTime` / `controller.pct` and renders progress.

## Linked-List Segment Stack

`Stack` uses a doubly linked list (`head`, `tail`, `prev`, `next`) instead of an
array.

Why this matters:

- Efficient local traversal around current playback position using
  `#lastAccessed` cache.
- Stable neighbor access for lookbehind/lookahead operations.
- Low-overhead start-time recomputation from a changed node onward via
  `recalculateStartTimes(fromSegment)`.
- Natural support for scheduler operations that move forward/backward through
  nearby segments repeatedly.

## Scheduling and Buffering Model

`TrackScheduler` runs a lookahead pass and sets a wake-up boundary
(`scheduleNotBefore`) so it does not spin continuously.

Key behavior:

- Marks candidates as `$inTransit` up front to avoid duplicate work from
  overlapping passes.
- Uses timeline-aware `start` and `offset` calculations before connecting.
- Evicts old caches near the edges of the active window.
- Supports looping windows without physically rewiring the linked list.

`PlaybackEngine` is responsible for playback state, not rendering ticks:

- If any track is not ready at the playhead, buffering starts (`pause-start`).
- When all tracks are ready again, buffering ends (`pause-end`).
- End-of-play-window detection triggers `end`.

## Events

Common controller events:

- `start`
- `pause`
- `pause-start`
- `pause-end`
- `seek`
- `end`
- `duration`
- `offset`
- `playDuration`
- `error`
- `init`

Example:

```js
controller.on('start', () => {});
controller.on('pause-start', () => {});
controller.on('pause-end', () => {});
controller.on('seek', ({ t, pct, remaining }) => {});
controller.on('error', (err) => console.error(err));
```

## UI Time Updates

This package no longer owns a high-frequency UI `timeupdate` loop. The intended
model is:

- audio readiness, scheduling, and buffering are handled in
  `@firstcoders/hls-web-audio`
- visual clock/progress rendering is handled by the consumer UI layer

Typical UI pattern:

```js
function renderTick() {
  const t = controller.currentTime;
  const pct = controller.pct;
  // update UI
  requestAnimationFrame(renderTick);
}
requestAnimationFrame(renderTick);
```

## Contributing

> This repo is a subtree split of our monorepo which will be made public in due
> course. We cannot process pull requests to this repo. Please contact us for
> support.
