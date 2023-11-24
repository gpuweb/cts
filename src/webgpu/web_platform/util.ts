import { Fixture, SkipTestCase } from '../../common/framework/fixture.js';
import { getResourcePath } from '../../common/framework/resources.js';
import { keysOf } from '../../common/util/data_tables.js';
import { timeout } from '../../common/util/timeout.js';
import { ErrorWithExtra, raceWithRejectOnTimeout } from '../../common/util/util.js';
import { GPUTest } from '../gpu_test.js';

declare global {
  interface HTMLMediaElement {
    // Add captureStream() support for HTMLMediaElement from
    // https://w3c.github.io/mediacapture-fromelement/#dom-htmlmediaelement-capturestream
    captureStream(): MediaStream;
  }
}

// MAINTENANCE_TODO: Uses raw floats as expectation in external_texture related cases has some diffs.
// Remove this conversion utils and uses raw float data as expectation in external_textrue
// related cases when resolve this.
export function convertToUnorm8(expectation: {
  R: number;
  G: number;
  B: number;
  A: number;
}): Uint8Array {
  const rgba8Unorm = new Uint8ClampedArray(4);
  rgba8Unorm[0] = Math.round(expectation.R * 255.0);
  rgba8Unorm[1] = Math.round(expectation.G * 255.0);
  rgba8Unorm[2] = Math.round(expectation.B * 255.0);
  rgba8Unorm[3] = Math.round(expectation.A * 255.0);

  return new Uint8Array(rgba8Unorm.buffer);
}

// MAINTENANCE_TODO: Add document to describe how to get these magic numbers.
// Expectation values about converting video contents to sRGB color space.
// Source video color space affects expected values.
// The process to calculate these expected pixel values can be found:
// https://github.com/gpuweb/cts/pull/2242#issuecomment-1430382811
// and https://github.com/gpuweb/cts/pull/2242#issuecomment-1463273434
const kBt601PixelValue = {
  displayP3: {
    red: { R: 0.894192705847254, G: 0.243671200178642, B: 0.132706713001254, A: 1.0 },
    green: { R: 0.498521961972036, G: 0.971040256815059, B: 0.286694021461098, A: 1.0 },
    blue: { R: 0.108297853706575, G: 0.134448468828998, B: 0.962798268696141, A: 1.0 },
    yellow: { R: 0.994991952943137, G: 0.992827230430229, B: 0.318417391806334, A: 1.0 },
  },
  srgb: {
    red: { R: 0.972945567233341, G: 0.141794376683341, B: -0.0209589916711088, A: 1.0 },
    green: { R: 0.248234279433399, G: 0.984810378661784, B: -0.0564701319494314, A: 1.0 },
    blue: { R: 0.10159735826538, G: 0.135451122863674, B: 1.00262982899724, A: 1.0 },
    yellow: { R: 0.995470750775951, G: 0.992742114518355, B: -0.0701036235167653, A: 1.0 },
  },
};

const kBt709PixelValue = {
  displayP3: {
    red: { R: 0.917522190548533, G: 0.200307878409863, B: 0.13860420691359, A: 1.0 },
    green: { R: 0.458329787229903, G: 0.985255869269063, B: 0.298345835592774, A: 1.0 },
    blue: { R: -0.0000827756941124, G: -0.0000284371289164, B: 0.959637561951994, A: 1.0 },
    yellow: { R: 1.00000470900876, G: 0.999994346502453, B: 0.330959103516173, A: 1.0 },
  },
  srgb: {
    red: { R: 1.0, G: 0.0, B: 0.0, A: 1.0 },
    green: { R: 0.0, G: 1.0, B: 0.0, A: 1.0 },
    blue: { R: 0.0, G: 0.0, B: 1.0, A: 1.0 },
    yellow: { R: 1.0, G: 1.0, B: 0.0, A: 1.0 },
  },
};

function videoTable<Table extends { readonly [K: string]: {} }>({
  table,
}: {
  table: Table;
}): {
  readonly [F in keyof Table]: {
    readonly [K in keyof Table[F]]: Table[F][K];
  };
} {
  return Object.fromEntries(
    Object.entries(table).map(([k, row]) => [k, { ...row }])
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ) as any;
}

export const kVideoInfo = videoTable({
  table: {
    'four-colors-vp8-bt601.webm': {
      mimeType: 'video/webm; codecs=vp8',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
      },
    },
    'four-colors-theora-bt601.ogv': {
      mimeType: 'video/ogg; codecs=theora',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
      },
    },
    'four-colors-h264-bt601.mp4': {
      mimeType: 'video/mp4; codecs=avc1.4d400c',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
      },
    },
    'four-colors-vp9-bt601.webm': {
      mimeType: 'video/webm; codecs=vp9',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
      },
    },
    'four-colors-vp9-bt709.webm': {
      mimeType: 'video/webm; codecs=vp9',
      presentColors: {
        'display-p3': {
          red: kBt709PixelValue.displayP3.red,
          green: kBt709PixelValue.displayP3.green,
          blue: kBt709PixelValue.displayP3.blue,
          yellow: kBt709PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
        srgb: {
          red: kBt709PixelValue.srgb.red,
          green: kBt709PixelValue.srgb.green,
          blue: kBt709PixelValue.srgb.blue,
          yellow: kBt709PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get topRightColor() { return this.red; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.blue; },
          /*prettier-ignore*/ get bottomRightColor() { return this.green; },
        },
      },
    },
    'four-colors-h264-bt601-rotate-90.mp4': {
      mimeType: 'video/mp4; codecs=avc1.4d400c',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.red; },
          /*prettier-ignore*/ get topRightColor() { return this.green; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get bottomRightColor() { return this.blue; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.red; },
          /*prettier-ignore*/ get topRightColor() { return this.green; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.yellow; },
          /*prettier-ignore*/ get bottomRightColor() { return this.blue; },
        },
      },
    },
    'four-colors-h264-bt601-rotate-180.mp4': {
      mimeType: 'video/mp4; codecs=avc1.4d400c',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.green; },
          /*prettier-ignore*/ get topRightColor() { return this.blue; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.red; },
          /*prettier-ignore*/ get bottomRightColor() { return this.yellow; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.green; },
          /*prettier-ignore*/ get topRightColor() { return this.blue; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.red; },
          /*prettier-ignore*/ get bottomRightColor() { return this.yellow; },
        },
      },
    },
    'four-colors-h264-bt601-rotate-270.mp4': {
      mimeType: 'video/mp4; codecs=avc1.4d400c',
      presentColors: {
        'display-p3': {
          red: kBt601PixelValue.displayP3.red,
          green: kBt601PixelValue.displayP3.green,
          blue: kBt601PixelValue.displayP3.blue,
          yellow: kBt601PixelValue.displayP3.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.blue; },
          /*prettier-ignore*/ get topRightColor() { return this.yellow; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.green; },
          /*prettier-ignore*/ get bottomRightColor() { return this.red; },
        },
        srgb: {
          red: kBt601PixelValue.srgb.red,
          green: kBt601PixelValue.srgb.green,
          blue: kBt601PixelValue.srgb.blue,
          yellow: kBt601PixelValue.srgb.yellow,
          /*prettier-ignore*/ get topLeftColor() { return this.blue; },
          /*prettier-ignore*/ get topRightColor() { return this.yellow; },
          /*prettier-ignore*/ get bottomLeftColor() { return this.green; },
          /*prettier-ignore*/ get bottomRightColor() { return this.red; },
        },
      },
    },
  },
});

type VideoName = keyof typeof kVideoInfo;
export const kVideoNames: readonly VideoName[] = keysOf(kVideoInfo);

export const kPredefinedColorSpace = ['display-p3', 'srgb'] as const;
/**
 * Starts playing a video and waits for it to be consumable.
 * Returns a promise which resolves after `callback` (which may be async) completes.
 *
 * @param video An HTML5 Video element.
 * @param callback Function to call when video is ready.
 *
 * Adapted from https://github.com/KhronosGroup/WebGL/blob/main/sdk/tests/js/webgl-test-utils.js
 */
export function startPlayingAndWaitForVideo(
  video: HTMLVideoElement,
  callback: () => unknown | Promise<unknown>
): Promise<void> {
  return raceWithRejectOnTimeout(
    new Promise((resolve, reject) => {
      const callbackAndResolve = () =>
        void (async () => {
          try {
            await callback();
            resolve();
          } catch (ex) {
            reject(ex);
          }
        })();
      if (video.error) {
        reject(
          new ErrorWithExtra('Video.error: ' + video.error.message, () => ({ error: video.error }))
        );
        return;
      }

      video.addEventListener(
        'error',
        event => reject(new ErrorWithExtra('Video received "error" event', () => ({ event }))),
        true
      );

      if (video.requestVideoFrameCallback) {
        video.requestVideoFrameCallback(() => {
          callbackAndResolve();
        });
      } else {
        // If requestVideoFrameCallback isn't available, check each frame if the video has advanced.
        const timeWatcher = () => {
          if (video.currentTime > 0) {
            callbackAndResolve();
          } else {
            requestAnimationFrame(timeWatcher);
          }
        };
        timeWatcher();
      }

      video.loop = true;
      video.muted = true;
      video.preload = 'auto';
      video.play().catch(reject);
    }),
    2000,
    'Video never became ready'
  );
}

/**
 * Fire a `callback` when the script animation reaches a new frame.
 * Returns a promise which resolves after `callback` (which may be async) completes.
 */
export function waitForNextTask(callback: () => unknown | Promise<unknown>): Promise<void> {
  const { promise, callbackAndResolve } = callbackHelper(callback, 'wait for next task timed out');
  timeout(() => {
    callbackAndResolve();
  }, 0);

  return promise;
}

/**
 * Fire a `callback` when the video reaches a new frame.
 * Returns a promise which resolves after `callback` (which may be async) completes.
 *
 * MAINTENANCE_TODO: Find a way to implement this for browsers without requestVideoFrameCallback as
 * well, similar to the timeWatcher path in startPlayingAndWaitForVideo. If that path is proven to
 * work well, we can consider getting rid of the requestVideoFrameCallback path.
 */
export function waitForNextFrame(
  video: HTMLVideoElement,
  callback: () => unknown | Promise<unknown>
): Promise<void> {
  const { promise, callbackAndResolve } = callbackHelper(callback, 'waitForNextFrame timed out');

  if ('requestVideoFrameCallback' in video) {
    video.requestVideoFrameCallback(() => {
      callbackAndResolve();
    });
  } else {
    throw new SkipTestCase('waitForNextFrame currently requires requestVideoFrameCallback');
  }

  return promise;
}

export async function getVideoFrameFromVideoElement(
  test: Fixture,
  video: HTMLVideoElement
): Promise<VideoFrame> {
  if (video.captureStream === undefined) {
    test.skip('HTMLVideoElement.captureStream is not supported');
  }

  return raceWithRejectOnTimeout(
    new Promise<VideoFrame>(resolve => {
      const videoTrack: MediaStreamVideoTrack = video.captureStream().getVideoTracks()[0];
      const trackProcessor: MediaStreamTrackProcessor<VideoFrame> = new MediaStreamTrackProcessor({
        track: videoTrack,
      });
      const transformer: TransformStream = new TransformStream({
        transform(videoFrame, _controller) {
          videoTrack.stop();
          resolve(videoFrame);
        },
        flush(controller) {
          controller.terminate();
        },
      });
      const trackGenerator: MediaStreamTrackGenerator<VideoFrame> = new MediaStreamTrackGenerator({
        kind: 'video',
      });
      trackProcessor.readable
        .pipeThrough(transformer)
        .pipeTo(trackGenerator.writable)
        .catch(() => {});
    }),
    2000,
    'Video never became ready'
  );
}

/**
 * Create HTMLVideoElement based on VideoName. Check whether video is playable in current
 * browser environment.
 * Returns a HTMLVideoElement.
 *
 * @param t: GPUTest that requires getting HTMLVideoElement
 * @param videoName: Required video name
 *
 */
export function getVideoElement(t: GPUTest, videoName: VideoName): HTMLVideoElement {
  if (typeof HTMLVideoElement === 'undefined') {
    t.skip('HTMLVideoElement not available');
  }

  const videoElement = document.createElement('video');
  const videoInfo = kVideoInfo[videoName];

  if (videoElement.canPlayType(videoInfo.mimeType) === '') {
    t.skip('Video codec is not supported');
  }

  const videoUrl = getResourcePath(videoName);
  videoElement.src = videoUrl;

  return videoElement;
}

/**
 * Helper for doing something inside of a (possibly async) callback (directly, not in a following
 * microtask), and returning a promise when the callback is done.
 * MAINTENANCE_TODO: Use this in startPlayingAndWaitForVideo (and make sure it works).
 */
function callbackHelper(
  callback: () => unknown | Promise<unknown>,
  timeoutMessage: string
): { promise: Promise<void>; callbackAndResolve: () => void } {
  let callbackAndResolve: () => void;

  const promiseWithoutTimeout = new Promise<void>((resolve, reject) => {
    callbackAndResolve = () =>
      void (async () => {
        try {
          await callback(); // catches both exceptions and rejections
          resolve();
        } catch (ex) {
          reject(ex);
        }
      })();
  });
  const promise = raceWithRejectOnTimeout(promiseWithoutTimeout, 2000, timeoutMessage);
  return { promise, callbackAndResolve: callbackAndResolve! };
}
