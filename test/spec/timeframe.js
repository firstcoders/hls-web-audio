// import { expect } from '@bundled-es-modules/chai';
// import sinon from 'sinon';
// import Controller from '../../src/controller';
// import HLS from '../../src/hls';

// describe('#calculateRealStart', () => {
//   let controller;

//   beforeEach(() => {
//     controller = new Controller();
//   });

//   describe('when #adjustedStart = undefined (default)', () => {
//     it('returns undefined', () => {
//       expect(controller.calculateRealStart({ start: 60 })).to.be.undefined;
//     });
//   });

//   describe('when #adjustedStart = 0', () => {
//     beforeEach(() => {
//       controller.adjustedStart = 0;
//     });

//     it('returns the default start time #start = 60', () => {
//       expect(controller.calculateRealStart({ start: 60 })).equal(60);
//     });
//   });

//   describe('when #adjustedStart = -30', () => {
//     beforeEach(() => {
//       controller.adjustedStart = -30;
//     });

//     it('returns an adjusted start time', () => {
//       expect(controller.calculateRealStart({ start: 60 })).equal(30);
//     });
//   });

//   describe('when #loop = true', () => {
//     beforeEach(() => {
//       controller.loop = true;
//       controller.duration = 10;
//     });
//     describe('when playback is at the end', () => {
//       beforeEach(() => {
//         controller.adjustedStart = 0;
//         controller.ac = { currentTime: 9 };
//       });

//       it('returns the correct start time for first element in the next loop', () => {
//         expect(controller.calculateRealStart({ start: 0, isInNextLoop: true })).equal(10);
//       });
//     });
//   });
// });

// describe('#calculateOffset', () => {
//   let controller;

//   beforeEach(() => {
//     controller = new Controller();
//   });

//   describe('when #currentTime = undefined (default)', () => {
//     it('returns undefined', () => {
//       expect(controller.calculateOffset({ start: 60 })).to.be.undefined;
//     });
//   });

//   describe('when #currentTime = 30', () => {
//     beforeEach(() => {
//       controller.observe({ duration: 60, end: 60 });
//       controller.currentTime = 30;
//     });

//     it('returns #offset=0 for a #start=60 in the future', () => {
//       expect(Math.round(controller.calculateOffset({ start: 60 }))).equal(0);
//     });

//     it('returns #offset = 10 for #start = 20 in the past', () => {
//       expect(Math.round(controller.calculateOffset({ start: 20 }))).equal(10);
//     });
//   });
// });
