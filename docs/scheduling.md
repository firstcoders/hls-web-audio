# Scheduling Mechanics

This document describes how `hls-web-audio` schedules audio segments into the
Web Audio API without polling, how buffering recovery works, and how each
component participates in that flow.

## Design Goal

All scheduling computation happens at precomputed, event-driven moments — not on
a fixed polling interval. The scheduler calculates when it will next be needed,
arms a single timeout, and sleeps until then.

---

## Key Roles

| Class              | Role                                                                                                            |
| ------------------ | --------------------------------------------------------------------------------------------------------------- |
| `PlaybackTimeline` | Tracks the playhead anchor (`anchor`) and computes `currentTime` as a pure read                          |
| `Timeframe`        | Snapshot of timing parameters used for Web Audio scheduling math; owns the anchor calculation via `setAnchor()` |
| `PlaybackEngine`   | Monitors readiness; enforces loop and boundary transitions; triggers buffering recovery                         |
| `TrackScheduler`   | Per-track lookahead scheduler; manages the precomputed wake-up boundary                                         |
| `Stack`            | Doubly linked list of segments; fast traversal around the current playhead position                             |
| `AudioSegment`     | Segment lifecycle: load buffer → decode → connect source node → disconnect                                      |

---

## Time Anchor (`anchor`)

Because `AudioContext.currentTime` ticks continuously and cannot be reset, we
tie playhead position to the global clock via an anchor:

```
currentTime = AudioContext.currentTime - anchor
```

`anchor` is set once at play start and reset on every seek or loop wrap:

```js
// Timeframe.setAnchor(contextTime, trackTime)
this.anchor = contextTime - trackTime;
```

`PlaybackTimeline.currentTime` is a **pure read** — it never mutates state or
fires events. All boundary enforcement (loop wrapping, offset underrun) happens
inside `PlaybackEngine._engineTick()`, which is the only place the anchor is
intentionally reset.

---

## PlaybackEngine — Engine Tick

`_engineTick()` is **not** a polling loop. It runs in two situations:

1. The `AudioContext` fires a `statechange` event (e.g. transitions from
   `suspended` to `running` on `play()`).
2. A `setTimeout` armed by the previous tick fires at a precomputed moment.

Each tick:

1. Reads `currentTime`.
2. Enforces boundaries (offset underrun resets anchor to `offset`; loop end
   resets anchor to `offset` and reschedules; non-loop end fires `end`).
3. Checks whether all tracks have a ready segment at the playhead
   (`shouldAndCanPlay`).
4. Transitions buffering state if needed.
5. Computes when the next check is due:
   - **Not buffering:** `(end of the soonest currently-playing segment) - now`,
     minus 10ms to give the scheduler a head start.
   - **Buffering:** every 100ms to detect when data arrives.
   - Never less than 50ms.

Importantly, the engine tick **does not** directly schedule or load segments. It
delegates that solely to `TrackScheduler` via `track.runSchedulePass(true)`.

---

## TrackScheduler — Lookahead Scheduling

`runSchedulePass(timeframe, force?)` is the entry point. It:

1. Cancels any pending `#timeoutId`.
2. Clears `#scheduleNotBefore` if `force` is true (e.g. after a seek or region
   change).
3. Returns early (and re-arms the next pass) if `currentTime` has not yet
   reached `#scheduleNotBefore`.
4. Finds the current segment in the `Stack` via `getAt(currentTime)`.
5. Calls `getNextSegments()` to build a lookahead window up to 10 seconds
   ahead.
6. Marks candidates `$inTransit` atomically to prevent duplicate work from
   concurrent calls.
7. Awaits `scheduleAt()` for each candidate.
8. Calls `#queueNextPass()` to arm the next self-wakeup.

### Scheduling Frequency

`runSchedulePass` fires at exactly these moments:

| Trigger                             | Source                  | Meaning                      |
| ----------------------------------- | ----------------------- | ---------------------------- |
| `'start'` event                     | `Track.eStart` listener | User pressed play            |
| `'seek'` event                      | `Track.onSeek()`        | User seeked                  |
| `'offset'` / `'playDuration'` event | `Track.#reset()`        | Region changed               |
| `#queueNextPass` self-timer         | Internal                | Precomputed boundary reached |
| Buffering recovery via engine tick  | `PlaybackEngine`        | Aborted schedule was retried |

It does **not** run on a fixed interval during normal playback. The self-timer
is the only recurring call, and its interval is computed per pass.

### Lookahead Window and `#scheduleNotBefore`

After successfully connecting segment `S`, the scheduler sets:

```js
this.#scheduleNotBefore = S.end - S.duration / 2;
```

This means: "don't bother running again until we are halfway through `S`."
`#queueNextPass` converts this into a `setTimeout`:

```js
waitMs = (#scheduleNotBefore - currentTime) * 1000;
```

For a 5-second HLS segment this is roughly a 2.5-second sleep — not a tight
loop.

While the audio context is suspended (paused or buffering), `waitMs` is capped
at 1000ms so the scheduler eventually re-syncs if state changes beneath it.

### Recovery Heartbeat

If `#scheduleNotBefore` is `undefined` (i.e. no segment has been successfully
scheduled yet, or the last `scheduleAt` was aborted before setting it) **and**
the audio context is not running, `#queueNextPass` arms a 500ms recovery
timeout:

```js
if (this.#scheduleNotBefore === undefined) {
  if (this.track.controller.ac.state !== 'running') {
    this.#timeoutId = setTimeout(() => {
      this.runSchedulePass(..., true); // forced
    }, 500);
  }
  return;
}
```

Without this, an `AbortError` during `scheduleAt` (e.g. from a rapid seek
while a connection was in flight) would leave the scheduler permanently idle.
The engine's buffering poll eventually calls `runSchedulePass(true)` on every
tick, but the heartbeat provides a tighter safety net inside the scheduler
itself.

---

## `scheduleAt` — Connecting a Segment

```
load (if not cached) → decode → connect source node into audio graph
```

Timing parameters are derived from `Timeframe`:

```js
start = timeframe.calculateRealStart(segment); // anchor + segment.start
offset = timeframe.calculateOffset(segment); // currentTime - segment.start, clamped to 0
stop = timeframe.realEnd; // anchor + offset + playDuration
```

A `Symbol` connection guard (`$currentConnection`) prevents stale in-flight
connections from completing after the segment has been disconnected. If the
symbol doesn't match when decoding finishes, the operation throws `AbortError`
and is silently ignored.

---

## Seek and Region Changes

On any seek (`fixAnchor`):

1. The anchor is reset to `contextTime - seekTarget` via `Timeframe.setAnchor`.
2. A `'seek'` event is fired with the requested `t`, `pct`, and `remaining`.
3. `Track.onSeek()` calls `stack.disconnectAll(timeframe)` then
   `runSchedulePass(force=true)`.

`disconnectAll` has a proximity heuristic: for in-transit segments within 15
seconds of the new `currentTime`, it preserves the network fetch (no `cancel()`)
but still calls `disconnect()` to invalidate any stale in-flight `connect()`
call and clears `$inTransit`. This means the segment will be re-scheduled with
fresh timeframe parameters against the same already-downloaded buffer.

---

## Buffering Lifecycle

```
track.shouldAndCanPlay = false
  → engine enters buffering
  → ac.suspend()
  → 'pause-start' event fires
  → engine polls every 100ms
  → on each poll: track.runSchedulePass(true) is called
    → scheduler loads + connects the missing segment
  → shouldAndCanPlay = true for all tracks
  → ac.resume()
  → 'pause-end' event fires
  → engine resumes normal scheduling ticks
```

The buffering poll drives recovery; the scheduler's heartbeat is a fallback for
the case where the scheduler is idle and the engine's `runSchedulePass` call
itself was aborted mid-flight.
