export const description = `
createSampler validation tests.

Test Plan: 

* lodMinClamp:
  * < 0
  * = NAN

* lodMaxClamp:
  * > MAX_SAFE_INTEGER
  * = NAN
  * =,> FLT_MAX
  * < lodMinClamp

* maxAnisotropy
  * = 0
  * = 65535 
`;
