import { keysOf } from '../../common/util/data_tables.js';
import { assertTypeTrue, TypeEqual } from '../../common/util/types.js';

/** WGSL plain scalar type names. */
export type ScalarType = 'i32' | 'u32' | 'f32' | 'bool';

/** Info for each plain scalar type. */
export const kScalarTypeInfo = /* prettier-ignore */ {
  'i32':    { layout: { alignment:  4, size:  4 }, supportsAtomics:  true },
  'u32':    { layout: { alignment:  4, size:  4 }, supportsAtomics:  true },
  'f32':    { layout: { alignment:  4, size:  4 }, supportsAtomics: false },
  'bool':   { layout:                   undefined, supportsAtomics: false },
} as const;
/** List of all plain scalar types. */
export const kScalarTypes = keysOf(kScalarTypeInfo);

/** Info for each vecN<> container type. */
export const kVectorContainerTypeInfo = /* prettier-ignore */ {
  'vec2':   { layout: { alignment:  8, size:  8 }, arrayLength: 2 },
  'vec3':   { layout: { alignment: 16, size: 12 }, arrayLength: 3 },
  'vec4':   { layout: { alignment: 16, size: 16 }, arrayLength: 4 },
} as const;
/** List of all vecN<> container types. */
export const kVectorContainerTypes = keysOf(kVectorContainerTypeInfo);

/** Info for each matNxN<> container type. */
export const kMatrixContainerTypeInfo = /* prettier-ignore */ {
  'mat2x2': { layout: { alignment:  8, size: 16 }, arrayLength: 2, innerLength: 2 },
  'mat3x2': { layout: { alignment:  8, size: 24 }, arrayLength: 3, innerLength: 2 },
  'mat4x2': { layout: { alignment:  8, size: 32 }, arrayLength: 4, innerLength: 2 },
  'mat2x3': { layout: { alignment: 16, size: 32 }, arrayLength: 2, innerLength: 3 },
  'mat3x3': { layout: { alignment: 16, size: 48 }, arrayLength: 3, innerLength: 3 },
  'mat4x3': { layout: { alignment: 16, size: 64 }, arrayLength: 4, innerLength: 3 },
  'mat2x4': { layout: { alignment: 16, size: 32 }, arrayLength: 2, innerLength: 4 },
  'mat3x4': { layout: { alignment: 16, size: 48 }, arrayLength: 3, innerLength: 4 },
  'mat4x4': { layout: { alignment: 16, size: 64 }, arrayLength: 4, innerLength: 4 },
} as const;
/** List of all matNxN<> container types. */
export const kMatrixContainerTypes = keysOf(kMatrixContainerTypeInfo);

export type AccessQualifier = 'read' | 'write';
export const kAccessQualifiers = ['read', 'write'] as const;
assertTypeTrue<TypeEqual<AccessQualifier, typeof kAccessQualifiers[number]>>();

export type StorageMode = 'read' | 'write' | 'read_write';
export const kStorageModes = ['read', 'write', 'read_write'] as const;
assertTypeTrue<TypeEqual<StorageMode, typeof kStorageModes[number]>>();

export const kStorageClassInfo = /* prettier-ignore */ {
  'storage':    { validAccess: kAccessQualifiers, validStorageMode: kStorageModes },
  'uniform':    { validAccess: ['read'],          validStorageMode: [undefined] },
  'private':    { validAccess: kAccessQualifiers, validStorageMode: [undefined] },
  'function':   { validAccess: kAccessQualifiers, validStorageMode: [undefined] },
  'workgroup':  { validAccess: kAccessQualifiers, validStorageMode: [undefined] },
} as const;
export const kStorageClasses = keysOf(kStorageClassInfo);
export type StorageClass = keyof typeof kStorageClassInfo;

/** Generates scalarTypes (i32/u32/f32/bool) that support the specified usage. */
export function* supportedScalarTypes(p: { atomic: boolean; storageClass: StorageClass }) {
  for (const scalarType of kScalarTypes) {
    const info = kScalarTypeInfo[scalarType];

    // Test atomics only on supported scalar types.
    if (p.atomic && !info.supportsAtomics) continue;

    // Storage and uniform require host-sharable types.
    const isHostShared = p.storageClass === 'storage' || p.storageClass === 'uniform';
    if (isHostShared && info.layout === undefined) continue;

    yield scalarType;
  }
}

/** Atomic access requires atomic type and storage/workgroup memory. */
export function supportsAtomics(p: { storageClass: StorageClass; storageMode?: StorageMode }) {
  return (
    (p.storageClass === 'storage' && p.storageMode === 'read_write') ||
    p.storageClass === 'workgroup'
  );
}
