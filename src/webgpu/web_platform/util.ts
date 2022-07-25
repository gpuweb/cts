import { Fixture } from '../../common/framework/fixture.js';
import { assert, ErrorWithExtra, raceWithRejectOnTimeout } from '../../common/util/util.js';

/**
 * Starts playing a video and waits for it to be consumable.
 * Promise resolves after the callback has been called.
 *
 * @param video An HTML5 Video element.
 * @param callback Function to call when video is ready.
 *
 * Copied from https://github.com/KhronosGroup/WebGL/blob/main/sdk/tests/js/webgl-test-utils.js
 */
export function startPlayingAndWaitForVideo(
  video: HTMLVideoElement,
  callback: () => unknown
): Promise<void> {
  return raceWithRejectOnTimeout(
    new Promise((resolve, reject) => {
      const callbackAndResolve = () =>
        void (async () => {
          try {
            await callback();
            resolve();
          } catch (ex) {
            reject();
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

      if ('requestVideoFrameCallback' in video) {
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

export async function getVideoFrameFromVideoElement(
  test: Fixture,
  video: HTMLVideoElement
): Promise<VideoFrame> {
  if (!('captureStream' in (video as HTMLMediaElement))) {
    test.skip('HTMLVideoElement.captureStream is not supported');
  }

  const track: MediaStreamVideoTrack = video.captureStream().getVideoTracks()[0];
  const reader = new MediaStreamTrackProcessor({ track }).readable.getReader();
  const videoFrame = (await reader.read()).value;
  assert(videoFrame !== undefined, 'unable to get a VideoFrame from track 0');
  return videoFrame;
}
