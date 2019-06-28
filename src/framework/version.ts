// Shouldn't this be in tools/ or src/tools instead? That's because it's only used at build time.

export const version = require('child_process')
  .execSync('git describe --always --abbrev=0 --dirty')
  .toString()
  .trim();
