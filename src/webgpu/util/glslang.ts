let glslang: any = undefined;
export default async function () {
  if (glslang !== undefined) return glslang;
  const glslangModule = await import(
    '../../../node_modules/@webgpu/glslang/dist/web-devel/glslang.js'
  );
  glslang = await glslangModule.default();
  return glslang;
}
