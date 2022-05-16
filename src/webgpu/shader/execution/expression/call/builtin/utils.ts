/**
 * Generates the boundary entries for the given number of dimensions
 *
 * @param numDimensions: The number of dimensions to generate for
 * @returns an array of generated coord boundarys
 */
export function generateCoordBoundaries(numDimensions: number) {
  let ret = ['in-bounds'];

  if (numDimensions < 1 || numDimensions > 3) {
    throw new Error(`invalid numDimensions: ${numDimensions}`);
  }

  let name = 'xyz';
  for (let i = 0; i < numDimensions; ++i) {
    for (let j of ['min', 'max']) {
      for (let k of ['wrap', 'boundary']) {
        ret.push(`${name[i]}-${j}-${k}`);
      }
    }
  }

  return ret;
}
