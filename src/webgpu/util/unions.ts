export function standardizeExtent3D(v: Readonly<GPUExtent3D>): Required<GPUExtent3DDict> {
  if (v instanceof Array) {
    return { width: v[0] ?? 1, height: v[1] ?? 1, depth: v[2] ?? 1 };
  } else {
    return { width: v.width ?? 1, height: v.height ?? 1, depth: v.depth ?? 1 };
  }
}

export function standardizeOrigin3D(v: Readonly<GPUOrigin3D>): Required<GPUOrigin3DDict> {
  if (v instanceof Array) {
    return { x: v[0] ?? 1, y: v[1] ?? 1, z: v[2] ?? 1 };
  } else {
    return { x: v.x ?? 1, y: v.y ?? 1, z: v.z ?? 1 };
  }
}
