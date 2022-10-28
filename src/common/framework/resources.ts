/**
 * Base path for resources. The default value is correct for non-worker WPT, but standalone and
 * workers must access resources using a different base path, so this is overridden in
 * `test_worker-worker.ts` and `standalone.ts`.
 */
let baseResourcePath = './resources';

function getAbsoluteBaseResourcePath(path: string) {
  const relparts = window.location.pathname.split('/');
  relparts.pop();
  const pathparts = path.split('/');

  let i;
  for (i = 0; i < pathparts.length; ++i) {
    switch (pathparts[i]) {
      case '':
        break;
      case '.':
        break;
      case '..':
        relparts.pop();
        break;
      default:
        relparts.push(pathparts[i]);
        break;
    }
  }

  return relparts.join('/');
}

/**
 * Get a path to a resource in the `resources` directory, relative to the current execution context
 * (html file or worker .js file), for `fetch()`, `<img>`, `<video>`, etc. Pass the cross origin host
 * name if wants to load resoruce from cross origin host.
 */
export function getResourcePath(pathRelativeToResourcesDir: string, crossOriginHostName = '') {
  if (crossOriginHostName !== '') {
    return (
      crossOriginHostName +
      ':' +
      location.port +
      getAbsoluteBaseResourcePath(baseResourcePath) +
      '/' +
      pathRelativeToResourcesDir
    );
  }
  return baseResourcePath + '/' + pathRelativeToResourcesDir;
}

/**
 * Set the base resource path (path to the `resources` directory relative to the current
 * execution context).
 */
export function setBaseResourcePath(path: string) {
  baseResourcePath = path;
}
