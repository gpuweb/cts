/* eslint-disable-next-line n/no-restricted-require */
// Providing the version via an environment variable is supported so that these
// tests can be run without the actual git checkout available.
let possible_version = process.env.WEBGPU_CTS_GIT_VERSION;
if (!possible_version) {
  possible_version = require('child_process')
    .execSync('git describe --always --abbrev=0 --dirty')
    .toString()
    .trim();
}
export const version = possible_version;
