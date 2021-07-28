export const description = `
TODO:
- Test pipeline outputs with different color targets, depth/stencil targets.
  - different scalar types in shader (f32, u32, i32) to targets with different format (f32 to unorm/float, u32 to uint)
  - different componentCounts of the output doesn't matter (e.g. f32, vec2<f32>, vec3<f32>, vec4<f32>)
    Extra components are discarded and missing components are filled to 0,0,1.
`;
