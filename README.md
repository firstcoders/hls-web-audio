# hls-web-audio

A package allowing for steaming multiple audio tracks with precision.

It uses the [HLS protocol](https://en.wikipedia.org/wiki/HTTP_Live_Streaming), however it will play any audio format that is supported by the relevant browser

and the [Web Audio API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API).

## Contributing

> This repo is a subtree split of our monorepo which will be made public in due course. We cannot process any pull-requests to this repo. Please contact us for help.

## Usage

```JS
import { Controller, HLS } from '@soundws/hls-web-audio';

// Create a controller to control playback
const controller = new Controller();

// register the HLS tracks with the controller
const drums = new HLS({ controller });
const piano = new HLS({ controller });
const vocal = new HLS({ controller });

// Load all the tracks
Promise.all([
  drums.load('http://my-server.com/drums.m3u8').promise,
  piano.load('http://my-server.com/piano.m3u8').promise,
  vocal.load('http://my-server.com/vocal.m3u8').promise
]).then(() => {
  controller.play()
}).catch((err) => {
  console.error(err)
})

// seek
controller.currentTime = 30 // seconds
controller.pct = 50 // percent

// events
controller.on('start', () => { /*..*/ }) // when playback starts
controller.on('pause', () => { /*..*/ }) // when playback pauses
controller.on('pause-start', () => { /*..*/ }) // when pausing (due to buffering) starts
controller.on('pause-end', () => { /*..*/ }) // when pausing (due to buffering) ends
controller.on('timeupdate', ({ t, pct }) => { /*..*/ }) // progress events, emitted ongoing
controller.on('seek', ({ t, pct }) => { /*..*/ }) // seek event, when currentTime is changed via setting either controller.currentTime or controller.pct
```
