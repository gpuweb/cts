export const version = (await import('child_process'))
  .execSync('git describe --always --abbrev=0 --dirty')
  .toString()
  .trim();
