import { getDefaultRequestAdapterOptions } from '../../../common/util/navigator_gpu.js';

export type TestResult = {
  error: String | undefined;
};

export async function launchDedicatedWorker() {
  const selfPath = import.meta.url;
  const selfPathDir = selfPath.substring(0, selfPath.lastIndexOf('/'));
  const workerPath = selfPathDir + '/worker.js';
  const worker = new Worker(workerPath, { type: 'module' });

  const promise = new Promise<TestResult>(resolve => {
    worker.addEventListener('message', ev => resolve(ev.data as TestResult), { once: true });
  });
  worker.postMessage({ defaultRequestAdapterOptions: getDefaultRequestAdapterOptions() });
  return await promise;
}

export async function launchSharedWorker() {
  const selfPath = import.meta.url;
  const selfPathDir = selfPath.substring(0, selfPath.lastIndexOf('/'));
  const workerPath = selfPathDir + '/worker.js';
  const worker = new SharedWorker(workerPath, { type: 'module' });

  const port = worker.port;
  const promise = new Promise<TestResult>(resolve => {
    port.addEventListener('message', ev => resolve(ev.data as TestResult), { once: true });
  });
  port.start();
  port.postMessage({
    defaultRequestAdapterOptions: getDefaultRequestAdapterOptions(),
  });
  return await promise;
}

export async function launchServiceWorker() {
  const selfPath = import.meta.url;
  const selfPathDir = selfPath.substring(0, selfPath.lastIndexOf('/'));
  const serviceWorkerPath = selfPathDir + '/worker.js';
  const registration = await navigator.serviceWorker.register(serviceWorkerPath, {
    type: 'module',
  });
  await registration.update();

  const promise = new Promise<TestResult>(resolve => {
    navigator.serviceWorker.addEventListener(
      'message',
      ev => {
        resolve(ev.data as TestResult);
        void registration.unregister();
      },
      { once: true }
    );
  });
  registration.active?.postMessage({
    defaultRequestAdapterOptions: getDefaultRequestAdapterOptions(),
  });
  return await promise;
}
