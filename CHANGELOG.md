# Change Log

All notable changes to this project will be documented in this file.
See [Conventional Commits](https://conventionalcommits.org) for commit guidelines.

# [2.0.0-beta.4](https://github.com/sound-ws/hls-web-audio/compare/@soundws/hls-web-audio@2.0.0-beta.3...@soundws/hls-web-audio@2.0.0-beta.4) (2023-04-25)

**Note:** Version bump only for package @soundws/hls-web-audio





# [2.0.0-beta.3](https://github.com/sound-ws/hls-web-audio/compare/@soundws/hls-web-audio@2.0.0-beta.2...@soundws/hls-web-audio@2.0.0-beta.3) (2023-04-25)

**Note:** Version bump only for package @soundws/hls-web-audio





# [2.0.0-beta.2](https://github.com/sound-ws/hls-web-audio/compare/@soundws/hls-web-audio@2.0.0-beta.1...@soundws/hls-web-audio@2.0.0-beta.2) (2023-04-25)


### Bug Fixes

* **hls-web-audio:** do not seek to 0 when playing first time.. merely mark 0 point ([f3c474b](https://github.com/sound-ws/hls-web-audio/commit/f3c474b6ba3a648f2358a7d403153ebd3fa38219))
* **hls-web-audio:** fix for seek out of range. Dont throw error. ([957aa63](https://github.com/sound-ws/hls-web-audio/commit/957aa63bbec249583cd7d2cae79b1f1919bc5e90))


### Features

* **hls-web-audio:** stop ac before seeking so that disconnecting nodes does not cause cracks and pops, resume after ([5c6b0e2](https://github.com/sound-ws/hls-web-audio/commit/5c6b0e280175e032e46f7ae13e7dd3b68cdf4f46))





# 2.0.0-beta.1 (2023-04-19)

**Note:** Version bump only for package @soundws/hls-web-audio





# 2.0.0-beta.0 (2023-04-19)


### Bug Fixes

* fix for hls segment staying stuck in a preparing state ([5df1f12](https://github.com/sound-ws/monorepo/commit/5df1f12c3c0f14dc8fad9a8edb50d5821230f158))
* **hls-service:** catch error and emit as controller event ([5cc7b0f](https://github.com/sound-ws/monorepo/commit/5cc7b0f2edc152af2e27ca19ac43de8b198341ab))
* **hls:** better handling of abort error which was causing the player to get stuck ([7474b8f](https://github.com/sound-ws/monorepo/commit/7474b8f7cce288bc6717ac64aee0a1cc9f955302))
* **hls:** catch AbortError in m3u8 load ([3886356](https://github.com/sound-ws/monorepo/commit/3886356bd1ce04eb172cb5795fc579e6cbf806ed))
* **hls:** deal better with call to controller.play when paused ([741a935](https://github.com/sound-ws/monorepo/commit/741a935dcaf34e75857d22b65020b70738b1ebb0))
* **hls:** disable continuous retry of loading of stem ([b59574e](https://github.com/sound-ws/monorepo/commit/b59574ef289eb5c96ca1aecfd845bdbefa3e701e))
* **hls:** emit loading event when seeking ([7644766](https://github.com/sound-ws/monorepo/commit/7644766ec325a39f96c56cfbc8281d491206481d))
* **hls:** ensure methods are not called after object is destroyed ([73df570](https://github.com/sound-ws/monorepo/commit/73df570d3bba8bbfde9c3ebee1cb5bab3ff87d4f))
* **hls:** fix for ac#onstateChange ([420ad67](https://github.com/sound-ws/monorepo/commit/420ad6767f403183b231af5e3f9ee5db2b82ff8d))
* **hls:** fix for buffer-start being called from 2 places causing load screen to hang ([e89cdfc](https://github.com/sound-ws/monorepo/commit/e89cdfc5d5a498d72e0997957fd6610f731ec6ac))
* **hls:** fix for hls.canPlay returning false when no current segment exists ([a46686b](https://github.com/sound-ws/monorepo/commit/a46686b5f65444514aace17c7a01f7a1e9df8faa))
* **hls:** fix for pause-start/end event not fireing if the player wasnt playing ([851f83d](https://github.com/sound-ws/monorepo/commit/851f83d7190408f73cf9364a771d0f60a45e7e62))
* **hls:** fix for when decodeaudiodata fails ([cb1eaa3](https://github.com/sound-ws/monorepo/commit/cb1eaa362880dfa71c15fdd95c5b27d08995820a))
* **hls:** fix play during buffer starts playback early ([2395818](https://github.com/sound-ws/monorepo/commit/23958184a2b6b86592eb1e3d02b9fe1f2459c12d))
* **hls:** fix returning on tick when end ([317c2db](https://github.com/sound-ws/monorepo/commit/317c2db6e6535ccfc2b3b79b3b67c957cc222a2a))
* **hls:** improvements for gapless playback ([9bd03f7](https://github.com/sound-ws/monorepo/commit/9bd03f7f3cd4980482618b661c56d8b370cad44f))
* **hls:** include accept header in m3u8 request ([f2e53a8](https://github.com/sound-ws/monorepo/commit/f2e53a8666839e902c4d1b449579308cdef7cc78))
* **hls:** move fire pause-end event after resetting state. Added playOnceReady method to controller ([d818496](https://github.com/sound-ws/monorepo/commit/d8184962a5565cdf9cce873dbe104a1f0e39201a))
* **hls:** prevent attempted disconnect if sourcenode doesnt exist ([8cc6a9e](https://github.com/sound-ws/monorepo/commit/8cc6a9e155d267292b1946a2d95c163d4595f7cc))
* **hls:** reject with error when fetch failed is true on segment ([b81135a](https://github.com/sound-ws/monorepo/commit/b81135a02ed516ced9f9cdd058eaa5c7eca8a284))
* **hls:** revert to not calling bufferingStart when already buffering ([be5d979](https://github.com/sound-ws/monorepo/commit/be5d979ddb9515d1b3dda08039a0b9039294a230))
* **hls:** run schedulePass immediately when seeking ([a5debb0](https://github.com/sound-ws/monorepo/commit/a5debb0f50b2094e5e5776429681be06436d9225))
* **hls:** seeking back and forth caused loading freeze ([b4a7e62](https://github.com/sound-ws/monorepo/commit/b4a7e6297a399ec05bb93164c20a511976bf8dac))
* **hls:** tied tick to ac statechange ([a4cd504](https://github.com/sound-ws/monorepo/commit/a4cd504a79f646d21db0405fb147ae760eb88091))
* **hls:** time could progress when the audiocontext was paused ([5b1d2cf](https://github.com/sound-ws/monorepo/commit/5b1d2cfdcde2bc8bf115bed684c7c5cf12eeeee3))


### chore

* upgraded all dependencies ([232e7f0](https://github.com/sound-ws/monorepo/commit/232e7f0f2e6434981ca3235a252775aa36efe41c))


### Code Refactoring

* **hls:** simplified API ([9d56c84](https://github.com/sound-ws/monorepo/commit/9d56c84bb40b16929e0a14a8748d2489842f7582))


### Features

* added retry config to hls ([2fd428a](https://github.com/sound-ws/monorepo/commit/2fd428a6d2897853726cd0a1743fbd85b4661444))
* **hls:** added apple mpegurl to accept header to getM3u8 api request ([4ba009e](https://github.com/sound-ws/monorepo/commit/4ba009e673224f4f5fdd237cbe9d5bedbf1d975c))
* **hls:** added fadein and fadeout ([0afb9dd](https://github.com/sound-ws/monorepo/commit/0afb9ddf3fadab1d3e4e707011c4ddb8ded86524))
* **hls:** added injecting of fetchOptions to allow setting of headers etc ([ee5104b](https://github.com/sound-ws/monorepo/commit/ee5104bae4acfe65deb9f1f4c65f7f05888fdedd))
* tweak with hls and driver ([afe2970](https://github.com/sound-ws/monorepo/commit/afe29704cc52685ca1de8530d6f16660ff5c9246))


### BREAKING CHANGES

* **hls:** removed hlsClient
* due to dependencies





## [1.1.2-beta.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.1...@sound-ws/hls@1.1.2-beta.0) (2022-11-15)

**Note:** Version bump only for package @sound-ws/hls





## [1.1.1](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.1-beta.1...@sound-ws/hls@1.1.1) (2022-08-30)

**Note:** Version bump only for package @sound-ws/hls





## [1.1.1-beta.1](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.1-beta.0...@sound-ws/hls@1.1.1-beta.1) (2022-08-29)


### Bug Fixes

* **hls:** fix for buffer-start being called from 2 places causing load screen to hang ([e89cdfc](https://github.com/sound-ws/monorepo/commit/e89cdfc5d5a498d72e0997957fd6610f731ec6ac))





## [1.1.1-beta.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.0...@sound-ws/hls@1.1.1-beta.0) (2022-08-22)


### Bug Fixes

* **hls:** improvements for gapless playback ([9bd03f7](https://github.com/sound-ws/monorepo/commit/9bd03f7f3cd4980482618b661c56d8b370cad44f))





# [1.1.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.0-beta.1...@sound-ws/hls@1.1.0) (2022-08-09)

**Note:** Version bump only for package @sound-ws/hls





# [1.1.0-beta.1](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.1.0-beta.0...@sound-ws/hls@1.1.0-beta.1) (2022-07-18)


### Bug Fixes

* **hls:** seeking back and forth caused loading freeze ([b4a7e62](https://github.com/sound-ws/monorepo/commit/b4a7e6297a399ec05bb93164c20a511976bf8dac))





# [1.1.0-beta.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.1-beta.1...@sound-ws/hls@1.1.0-beta.0) (2022-07-05)


### Features

* **hls:** added apple mpegurl to accept header to getM3u8 api request ([4ba009e](https://github.com/sound-ws/monorepo/commit/4ba009e673224f4f5fdd237cbe9d5bedbf1d975c))





## [1.0.1-beta.1](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.1-beta.0...@sound-ws/hls@1.0.1-beta.1) (2022-06-29)


### Bug Fixes

* **hls:** move fire pause-end event after resetting state. Added playOnceReady method to controller ([d818496](https://github.com/sound-ws/monorepo/commit/d8184962a5565cdf9cce873dbe104a1f0e39201a))





## [1.0.1-beta.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0...@sound-ws/hls@1.0.1-beta.0) (2022-06-28)

**Note:** Version bump only for package @sound-ws/hls





# [1.0.0](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.8...@sound-ws/hls@1.0.0) (2022-05-25)

**Note:** Version bump only for package @sound-ws/hls





# [1.0.0-beta.8](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.7...@sound-ws/hls@1.0.0-beta.8) (2022-05-24)


### Bug Fixes

* **hls:** include accept header in m3u8 request ([f2e53a8](https://github.com/sound-ws/monorepo/commit/f2e53a8666839e902c4d1b449579308cdef7cc78))
* **hls:** reject with error when fetch failed is true on segment ([b81135a](https://github.com/sound-ws/monorepo/commit/b81135a02ed516ced9f9cdd058eaa5c7eca8a284))





# [1.0.0-beta.7](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.6...@sound-ws/hls@1.0.0-beta.7) (2022-05-24)


### Bug Fixes

* **hls-service:** catch error and emit as controller event ([5cc7b0f](https://github.com/sound-ws/monorepo/commit/5cc7b0f2edc152af2e27ca19ac43de8b198341ab))





# [1.0.0-beta.6](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.5...@sound-ws/hls@1.0.0-beta.6) (2022-05-23)


### Bug Fixes

* **hls:** better handling of abort error which was causing the player to get stuck ([7474b8f](https://github.com/sound-ws/monorepo/commit/7474b8f7cce288bc6717ac64aee0a1cc9f955302))
* **hls:** revert to not calling bufferingStart when already buffering ([be5d979](https://github.com/sound-ws/monorepo/commit/be5d979ddb9515d1b3dda08039a0b9039294a230))





# [1.0.0-beta.5](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.4...@sound-ws/hls@1.0.0-beta.5) (2022-05-19)


### Bug Fixes

* **hls:** disable continuous retry of loading of stem ([b59574e](https://github.com/sound-ws/monorepo/commit/b59574ef289eb5c96ca1aecfd845bdbefa3e701e))
* **hls:** fix play during buffer starts playback early ([2395818](https://github.com/sound-ws/monorepo/commit/23958184a2b6b86592eb1e3d02b9fe1f2459c12d))





# [1.0.0-beta.4](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.3...@sound-ws/hls@1.0.0-beta.4) (2022-05-18)


### Bug Fixes

* **hls:** fix for hls.canPlay returning false when no current segment exists ([a46686b](https://github.com/sound-ws/monorepo/commit/a46686b5f65444514aace17c7a01f7a1e9df8faa))


### Features

* **hls:** added injecting of fetchOptions to allow setting of headers etc ([ee5104b](https://github.com/sound-ws/monorepo/commit/ee5104bae4acfe65deb9f1f4c65f7f05888fdedd))





# [1.0.0-beta.3](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.2...@sound-ws/hls@1.0.0-beta.3) (2022-03-22)


### Bug Fixes

* **hls:** ensure methods are not called after object is destroyed ([73df570](https://github.com/sound-ws/monorepo/commit/73df570d3bba8bbfde9c3ebee1cb5bab3ff87d4f))





# [1.0.0-beta.2](https://github.com/sound-ws/monorepo/compare/@sound-ws/hls@1.0.0-beta.1...@sound-ws/hls@1.0.0-beta.2) (2022-03-18)

**Note:** Version bump only for package @sound-ws/hls
