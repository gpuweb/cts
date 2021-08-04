import { raceWithRejectOnTimeout } from '../../common/util/util.js';

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
      const callbackAndResolve = async () => {
        try {
          await callback();
          resolve();
        } catch (ex) {
          reject();
        }
      };

      if (video.error) {
        reject(new Error('Video failed to load: ' + video.error));
        return;
      }

      video.addEventListener(
        'error',
        e => reject(new Error('Video playback failed: ' + e.message)),
        true
      );

      if ('requestVideoFrameCallback' in video) {
        /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
        (video as any).requestVideoFrameCallback(() => {
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
      video.play();
    }),
    2000,
    'Video never became ready'
  );
}
