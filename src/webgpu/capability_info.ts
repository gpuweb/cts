// MAINTENANCE_TODO: The generated Typedoc for this file is hard to navigate because it's
// alphabetized. Consider using namespaces or renames to fix this?

/* eslint-disable no-sparse-arrays */

import { keysOf, makeTable, numericKeysOf, valueof } from '../common/util/data_tables.js';
import { assertTypeTrue, TypeEqual } from '../common/util/types.js';
import { assert, unreachable } from '../common/util/util.js';

import { GPUConst, kMaxUnsignedLongValue, kMaxUnsignedLongLongValue } from './constants.js';
import { ImageCopyType } from './util/texture/layout.js';

// Base device limits can be found in constants.ts.

// Queries

/** Maximum number of queries in GPUQuerySet, by spec. */
export const kMaxQueryCount = 4096;
/** Per-GPUQueryType info. */
export type QueryTypeInfo = {
  /** Optional feature required to use this GPUQueryType. */
  readonly feature: GPUFeatureName | undefined;
  // Add fields as needed
};
export const kQueryTypeInfo: {
  readonly [k in GPUQueryType]: QueryTypeInfo;
} = /* prettier-ignore */ {
  // Occlusion query does not require any features.
  'occlusion':           { feature:  undefined },
  'timestamp':           { feature: 'timestamp-query' },
};
/** List of all GPUQueryType values. */
export const kQueryTypes = keysOf(kQueryTypeInfo);

// Buffers

/** Required alignment of a GPUBuffer size, by spec. */
export const kBufferSizeAlignment = 4;

/** Per-GPUBufferUsage copy info. */
export const kBufferUsageCopyInfo: {
  readonly [name: string]: GPUBufferUsageFlags;
} = /* prettier-ignore */ {
  'COPY_NONE':    0,
  'COPY_SRC':     GPUConst.BufferUsage.COPY_SRC,
  'COPY_DST':     GPUConst.BufferUsage.COPY_DST,
  'COPY_SRC_DST': GPUConst.BufferUsage.COPY_SRC | GPUConst.BufferUsage.COPY_DST,
};
/** List of all GPUBufferUsage copy values. */
export const kBufferUsageCopy = keysOf(kBufferUsageCopyInfo);

/** Per-GPUBufferUsage keys and info. */
type BufferUsageKey = keyof typeof GPUConst.BufferUsage;
export const kBufferUsageKeys = keysOf(GPUConst.BufferUsage);
export const kBufferUsageInfo: {
  readonly [k in BufferUsageKey]: GPUBufferUsageFlags;
} = {
  ...GPUConst.BufferUsage,
};

/** List of all GPUBufferUsage values. */
export const kBufferUsages = Object.values(GPUConst.BufferUsage);
export const kAllBufferUsageBits = kBufferUsages.reduce(
  (previousSet, currentUsage) => previousSet | currentUsage,
  0
);

// Errors

/** Per-GPUErrorFilter info. */
export const kErrorScopeFilterInfo: {
  readonly [k in GPUErrorFilter]: {
    generatable: boolean;
  };
} = /* prettier-ignore */ {
  'internal':      { generatable: false },
  'out-of-memory': { generatable: true },
  'validation':    { generatable: true },
};
/** List of all GPUErrorFilter values. */
export const kErrorScopeFilters = keysOf(kErrorScopeFilterInfo);
export const kGeneratableErrorScopeFilters = kErrorScopeFilters.filter(
  e => kErrorScopeFilterInfo[e].generatable
);

// Textures

// Definitions for use locally. To access the table entries, use `kTextureFormatInfo`.

/**
 * Defaults applied to all tables automatically. Used only inside `tableWithDefaults`.
 * This ensures keys are never missing, always explicitly `undefined`.
 *
 * All top-level keys must be defined here, or they won't be exposed.
 */
const kUniversalDefaults = {
  blockWidth: undefined,
  blockHeight: undefined,
  color: undefined,
  depth: undefined,
  stencil: undefined,
  colorRender: undefined,
  multisample: undefined,
  feature: undefined,
  baseFormat: undefined,

  sampleType: undefined,
  copySrc: undefined,
  copyDst: undefined,
  bytesPerBlock: undefined,
  renderable: false,
  renderTargetPixelByteCost: undefined,
  renderTargetComponentAlignment: undefined,

  // IMPORTANT:
  // Add new top-level keys both here and in TextureFormatInfo_TypeCheck.
} as const;
/**
 * Takes `table` and applies `defaults` to every row, i.e. for each row,
 * `{ ... kUniversalDefaults, ...defaults, ...row }`.
 * This only operates at the first level; it doesn't support defaults in nested objects.
 */
function tableWithDefaults<Defaults extends {}, Table extends { readonly [K: string]: {} }>({
  defaults,
  table,
}: {
  defaults: Defaults;
  table: Table;
}): {
  readonly [F in keyof Table]: {
    readonly [K in keyof typeof kUniversalDefaults]: K extends keyof Table[F]
      ? Table[F][K]
      : K extends keyof Defaults
      ? Defaults[K]
      : typeof kUniversalDefaults[K];
  };
} {
  return Object.fromEntries(
    Object.entries(table).map(([k, row]) => [k, { ...kUniversalDefaults, ...defaults, ...row }])
    /* eslint-disable-next-line @typescript-eslint/no-explicit-any */
  ) as any;
}

/** "plain color formats", plus rgb9e5ufloat. */
const kRegularTextureFormatInfo = tableWithDefaults({
  defaults: { blockWidth: 1, blockHeight: 1 },
  table: {
    // plain, 8 bits per component

    r8unorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      colorRender: { blend: true, resolve: true, byteCost: 1, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r8snorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r8uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      colorRender: { blend: false, resolve: false, byteCost: 1, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r8sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      colorRender: { blend: false, resolve: false, byteCost: 1, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rg8unorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: true, resolve: true, byteCost: 2, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg8snorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg8uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: false, resolve: false, byteCost: 2, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg8sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: false, resolve: false, byteCost: 2, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rgba8unorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      baseFormat: 'rgba8unorm',
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'rgba8unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      baseFormat: 'rgba8unorm',
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba8snorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba8uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba8sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    bgra8unorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      baseFormat: 'bgra8unorm',
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bgra8unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 1 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      baseFormat: 'bgra8unorm',
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    // plain, 16 bits per component

    r16uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: false, resolve: false, byteCost: 2, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r16sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: false, resolve: false, byteCost: 2, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r16float: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      colorRender: { blend: true, resolve: true, byteCost: 2, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rg16uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg16sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg16float: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 4, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rgba16uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: false, resolve: false, byteCost: 8, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba16sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: false, resolve: false, byteCost: 8, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba16float: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 2 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    // plain, 32 bits per component

    r32uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r32sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    r32float: {
      color: { type: 'unfilterable-float', copySrc: true, copyDst: true, storage: true, bytes: 4 },
      colorRender: { blend: false, resolve: false, byteCost: 4, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rg32uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: false, resolve: false, byteCost: 8, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg32sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: false, resolve: false, byteCost: 8, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg32float: {
      color: { type: 'unfilterable-float', copySrc: true, copyDst: true, storage: true, bytes: 8 },
      colorRender: { blend: false, resolve: false, byteCost: 8, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    rgba32uint: {
      color: { type: 'uint', copySrc: true, copyDst: true, storage: true, bytes: 16 },
      colorRender: { blend: false, resolve: false, byteCost: 16, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba32sint: {
      color: { type: 'sint', copySrc: true, copyDst: true, storage: true, bytes: 16 },
      colorRender: { blend: false, resolve: false, byteCost: 16, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rgba32float: {
      color: { type: 'unfilterable-float', copySrc: true, copyDst: true, storage: true, bytes: 16 },
      colorRender: { blend: false, resolve: false, byteCost: 16, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    // plain, mixed component width, 32 bits per texel

    rgb10a2unorm: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      colorRender: { blend: true, resolve: true, byteCost: 8, alignment: 4 },
      renderable: true,
      /*prettier-ignore*/ get renderTargetComponentAlignment() { return this.colorRender.alignment; },
      /*prettier-ignore*/ get renderTargetPixelByteCost() { return this.colorRender.byteCost; },
      multisample: true,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    rg11b10ufloat: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
      renderTargetPixelByteCost: 8,
      renderTargetComponentAlignment: 4,
    },

    // packed

    rgb9e5ufloat: {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 4 },
      multisample: false,
      /*prettier-ignore*/ get sampleType() { return this.color.type; },
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
  },
} as const);

// MAINTENANCE_TODO: Distinguishing "sized" and "unsized" depth stencil formats doesn't make sense
// because one aspect can be sized and one can be unsized. This should be cleaned up, but is kept
// this way during a migration phase.
const kSizedDepthStencilFormatInfo = tableWithDefaults({
  defaults: { blockWidth: 1, blockHeight: 1, multisample: true },
  table: {
    stencil8: {
      stencil: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      sampleType: 'uint',
      copySrc: true,
      copyDst: true,
      bytesPerBlock: 1,
      renderable: true,
    },
    depth16unorm: {
      depth: { type: 'depth', copySrc: true, copyDst: true, storage: false, bytes: 2 },
      sampleType: 'depth',
      copySrc: true,
      copyDst: true,
      bytesPerBlock: 2,
      renderable: true,
    },
    depth32float: {
      depth: { type: 'depth', copySrc: true, copyDst: false, storage: false, bytes: 4 },
      sampleType: 'depth',
      copySrc: true,
      copyDst: false,
      bytesPerBlock: 4,
      renderable: true,
    },
  },
} as const);
const kUnsizedDepthStencilFormatInfo = tableWithDefaults({
  defaults: { blockWidth: 1, blockHeight: 1, multisample: true },
  table: {
    depth24plus: {
      depth: { type: 'depth', copySrc: false, copyDst: false, storage: false, bytes: undefined },
      copySrc: false,
      copyDst: false,
      bytesPerBlock: undefined,
      sampleType: 'depth',
      renderable: true,
    },
    'depth24plus-stencil8': {
      depth: { type: 'depth', copySrc: false, copyDst: false, storage: false, bytes: undefined },
      stencil: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      copySrc: false,
      copyDst: false,
      bytesPerBlock: undefined,
      sampleType: 'depth',
      renderable: true,
    },
    'depth32float-stencil8': {
      depth: { type: 'depth', copySrc: true, copyDst: false, storage: false, bytes: 4 },
      stencil: { type: 'uint', copySrc: true, copyDst: true, storage: false, bytes: 1 },
      feature: 'depth32float-stencil8',
      copySrc: false,
      copyDst: false,
      sampleType: 'depth',
      renderable: true,
    },
  },
} as const);

const kBCTextureFormatInfo = tableWithDefaults({
  defaults: {
    blockWidth: 4,
    blockHeight: 4,
    multisample: false,
    feature: 'texture-compression-bc',
  },
  table: {
    'bc1-rgba-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'bc1-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc1-rgba-unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'bc1-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc2-rgba-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc2-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc2-rgba-unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc2-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc3-rgba-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc3-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc3-rgba-unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc3-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc4-r-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc4-r-snorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc5-rg-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc5-rg-snorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc6h-rgb-ufloat': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc6h-rgb-float': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'bc7-rgba-unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc7-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'bc7-rgba-unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'bc7-rgba-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
  },
} as const);

const kETC2TextureFormatInfo = tableWithDefaults({
  defaults: {
    blockWidth: 4,
    blockHeight: 4,
    multisample: false,
    feature: 'texture-compression-etc2',
  },
  table: {
    'etc2-rgb8unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'etc2-rgb8unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'etc2-rgb8unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'etc2-rgb8unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'etc2-rgb8a1unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'etc2-rgb8a1unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'etc2-rgb8a1unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      baseFormat: 'etc2-rgb8a1unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'etc2-rgba8unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'etc2-rgba8unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'etc2-rgba8unorm-srgb': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'etc2-rgba8unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'eac-r11unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'eac-r11snorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 8 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'eac-rg11unorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'eac-rg11snorm': {
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
  },
} as const);

const kASTCTextureFormatInfo = tableWithDefaults({
  defaults: {
    multisample: false,
    feature: 'texture-compression-astc',
  },
  table: {
    'astc-4x4-unorm': {
      blockWidth: 4,
      blockHeight: 4,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-4x4-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-4x4-unorm-srgb': {
      blockWidth: 4,
      blockHeight: 4,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-4x4-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-5x4-unorm': {
      blockWidth: 5,
      blockHeight: 4,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-5x4-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-5x4-unorm-srgb': {
      blockWidth: 5,
      blockHeight: 4,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-5x4-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-5x5-unorm': {
      blockWidth: 5,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-5x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-5x5-unorm-srgb': {
      blockWidth: 5,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-5x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-6x5-unorm': {
      blockWidth: 6,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-6x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-6x5-unorm-srgb': {
      blockWidth: 6,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-6x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-6x6-unorm': {
      blockWidth: 6,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-6x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-6x6-unorm-srgb': {
      blockWidth: 6,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-6x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-8x5-unorm': {
      blockWidth: 8,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-8x5-unorm-srgb': {
      blockWidth: 8,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-8x6-unorm': {
      blockWidth: 8,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-8x6-unorm-srgb': {
      blockWidth: 8,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-8x8-unorm': {
      blockWidth: 8,
      blockHeight: 8,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x8-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-8x8-unorm-srgb': {
      blockWidth: 8,
      blockHeight: 8,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-8x8-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-10x5-unorm': {
      blockWidth: 10,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-10x5-unorm-srgb': {
      blockWidth: 10,
      blockHeight: 5,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x5-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-10x6-unorm': {
      blockWidth: 10,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-10x6-unorm-srgb': {
      blockWidth: 10,
      blockHeight: 6,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x6-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-10x8-unorm': {
      blockWidth: 10,
      blockHeight: 8,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x8-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-10x8-unorm-srgb': {
      blockWidth: 10,
      blockHeight: 8,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x8-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-10x10-unorm': {
      blockWidth: 10,
      blockHeight: 10,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x10-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-10x10-unorm-srgb': {
      blockWidth: 10,
      blockHeight: 10,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-10x10-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-12x10-unorm': {
      blockWidth: 12,
      blockHeight: 10,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-12x10-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-12x10-unorm-srgb': {
      blockWidth: 12,
      blockHeight: 10,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-12x10-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },

    'astc-12x12-unorm': {
      blockWidth: 12,
      blockHeight: 12,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-12x12-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
    'astc-12x12-unorm-srgb': {
      blockWidth: 12,
      blockHeight: 12,
      color: { type: 'float', copySrc: true, copyDst: true, storage: false, bytes: 16 },
      baseFormat: 'astc-12x12-unorm',
      sampleType: 'float',
      copySrc: true,
      copyDst: true,
      /*prettier-ignore*/ get bytesPerBlock() { return this.color.bytes; },
    },
  },
} as const);

// Definitions for use locally. To access the table entries, use `kTextureFormatInfo`.

// MAINTENANCE_TODO: Consider generating the exports below programmatically by filtering the big list, instead
// of using these local constants? Requires some type magic though.
/* prettier-ignore */ const   kCompressedTextureFormatInfo = { ...kBCTextureFormatInfo, ...kETC2TextureFormatInfo, ...kASTCTextureFormatInfo } as const;
/* prettier-ignore */ const        kColorTextureFormatInfo = { ...kRegularTextureFormatInfo, ...kCompressedTextureFormatInfo } as const;
/* prettier-ignore */ const    kEncodableTextureFormatInfo = { ...kRegularTextureFormatInfo, ...kSizedDepthStencilFormatInfo } as const;
/* prettier-ignore */ const        kSizedTextureFormatInfo = { ...kRegularTextureFormatInfo, ...kSizedDepthStencilFormatInfo, ...kCompressedTextureFormatInfo } as const;
/* prettier-ignore */ const        kDepthStencilFormatInfo = { ...kSizedDepthStencilFormatInfo, ...kUnsizedDepthStencilFormatInfo } as const;
/* prettier-ignore */ const kUncompressedTextureFormatInfo = { ...kRegularTextureFormatInfo, ...kSizedDepthStencilFormatInfo, ...kUnsizedDepthStencilFormatInfo } as const;
/* prettier-ignore */ const          kAllTextureFormatInfo = { ...kUncompressedTextureFormatInfo, ...kCompressedTextureFormatInfo } as const;

/** A "regular" texture format (uncompressed, sized, single-plane color formats). */
/* prettier-ignore */ export type      RegularTextureFormat = keyof typeof kRegularTextureFormatInfo;
/** A sized depth/stencil texture format. */
/* prettier-ignore */ export type   SizedDepthStencilFormat = keyof typeof kSizedDepthStencilFormatInfo;
/** An unsized depth/stencil texture format. */
/* prettier-ignore */ export type UnsizedDepthStencilFormat = keyof typeof kUnsizedDepthStencilFormatInfo;
/** A compressed (block) texture format. */
/* prettier-ignore */ export type   CompressedTextureFormat = keyof typeof kCompressedTextureFormatInfo;

/** A color texture format (regular | compressed). */
/* prettier-ignore */ export type        ColorTextureFormat = keyof typeof kColorTextureFormatInfo;
/** An encodable texture format (regular | sized depth/stencil). */
/* prettier-ignore */ export type    EncodableTextureFormat = keyof typeof kEncodableTextureFormatInfo;
/** A sized texture format (regular | sized depth/stencil | compressed). */
/* prettier-ignore */ export type        SizedTextureFormat = keyof typeof kSizedTextureFormatInfo;
/** A depth/stencil format (sized | unsized). */
/* prettier-ignore */ export type        DepthStencilFormat = keyof typeof kDepthStencilFormatInfo;
/** An uncompressed (block size 1x1) format (regular | depth/stencil). */
/* prettier-ignore */ export type UncompressedTextureFormat = keyof typeof kUncompressedTextureFormatInfo;

/* prettier-ignore */ export const      kRegularTextureFormats: readonly      RegularTextureFormat[] = keysOf(     kRegularTextureFormatInfo);
/* prettier-ignore */ export const   kSizedDepthStencilFormats: readonly   SizedDepthStencilFormat[] = keysOf(  kSizedDepthStencilFormatInfo);
/* prettier-ignore */ export const kUnsizedDepthStencilFormats: readonly UnsizedDepthStencilFormat[] = keysOf(kUnsizedDepthStencilFormatInfo);
/* prettier-ignore */ export const   kCompressedTextureFormats: readonly   CompressedTextureFormat[] = keysOf(  kCompressedTextureFormatInfo);

/* prettier-ignore */ export const        kColorTextureFormats: readonly        ColorTextureFormat[] = keysOf(       kColorTextureFormatInfo);
/* prettier-ignore */ export const    kEncodableTextureFormats: readonly    EncodableTextureFormat[] = keysOf(   kEncodableTextureFormatInfo);
/* prettier-ignore */ export const        kSizedTextureFormats: readonly        SizedTextureFormat[] = keysOf(       kSizedTextureFormatInfo);
/* prettier-ignore */ export const        kDepthStencilFormats: readonly        DepthStencilFormat[] = keysOf(       kDepthStencilFormatInfo);
/* prettier-ignore */ export const kUncompressedTextureFormats: readonly UncompressedTextureFormat[] = keysOf(kUncompressedTextureFormatInfo);
/* prettier-ignore */ export const          kAllTextureFormats: readonly          GPUTextureFormat[] = keysOf(         kAllTextureFormatInfo);

// CompressedTextureFormat are unrenderable so filter from RegularTextureFormats for color targets is enough
export const kRenderableColorTextureFormats = kRegularTextureFormats.filter(
  v => kColorTextureFormatInfo[v].colorRender
);
assert(
  kRenderableColorTextureFormats.every(
    f =>
      kAllTextureFormatInfo[f].renderTargetComponentAlignment !== undefined &&
      kAllTextureFormatInfo[f].renderTargetPixelByteCost !== undefined
  )
);

// The formats of GPUTextureFormat for canvas context.
export const kCanvasTextureFormats = ['bgra8unorm', 'rgba8unorm', 'rgba16float'] as const;

// The alpha mode for canvas context.
export const kCanvasAlphaModesInfo: {
  readonly [k in GPUCanvasAlphaMode]: {};
} = /* prettier-ignore */ {
  'opaque': {},
  'premultiplied': {},
};
export const kCanvasAlphaModes = keysOf(kCanvasAlphaModesInfo);

// The color spaces for canvas context
export const kCanvasColorSpacesInfo: {
  readonly [k in PredefinedColorSpace]: {};
} = /* prettier-ignore */ {
  'srgb': {},
  'display-p3': {},
};
export const kCanvasColorSpaces = keysOf(kCanvasColorSpacesInfo);

/** Per-GPUTextureFormat-per-aspect info. */
interface TextureFormatAspectInfo {
  /** Whether the aspect can be used as `COPY_SRC`. */
  copySrc: boolean;
  /** Whether the aspect can be used as `COPY_DST`. */
  copyDst: boolean;
  /** Whether the aspect can be used as `STORAGE`. */
  storage: boolean;
  /** The "texel block copy footprint" of one texel block; `undefined` if the aspect is unsized. */
  bytes: number | undefined;
}
/** Per GPUTextureFormat-per-aspect info for color aspects. */
interface TextureFormatColorAspectInfo extends TextureFormatAspectInfo {
  bytes: number;
  /** "Best" sample type of the format. "float" also implies "unfilterable-float". */
  type: 'float' | 'uint' | 'sint' | 'unfilterable-float';
}
/** Per GPUTextureFormat-per-aspect info for depth aspects. */
interface TextureFormatDepthAspectInfo extends TextureFormatAspectInfo {
  /** "depth" also implies "unfilterable-float". */
  type: 'depth';
}
/** Per GPUTextureFormat-per-aspect info for stencil aspects. */
interface TextureFormatStencilAspectInfo extends TextureFormatAspectInfo {
  bytes: 1;
  type: 'uint';
}

/**
 * Per-GPUTextureFormat info.
 * This is not actually the type of values in kTextureFormatInfo; that type is fully const
 * so that it can be narrowed very precisely at usage sites by the compiler.
 * This type exists only a type check on the inferred type of kTextureFormatInfo.
 * Documentation is also written here, but not actually visible to the IDE.
 */
type TextureFormatInfo_TypeCheck = {
  /** Texel block width. */
  blockWidth: number;
  /** Texel block height. */
  blockHeight: number;
  /** Whether the format can be used in a multisample texture. */
  multisample: boolean;
  /** The base format for srgb formats. Specified on both srgb and equivalent non-srgb formats. */
  baseFormat: GPUTextureFormat | undefined;
  /** Optional feature required to use this format, or `undefined` if none. */
  feature: GPUFeatureName | undefined;

  /** @deprecated */
  sampleType: GPUTextureSampleType;
  /** @deprecated */
  copySrc: boolean;
  /** @deprecated */
  copyDst: boolean;
  /** @deprecated */
  bytesPerBlock: number | undefined;
  /** @deprecated */
  renderable: boolean;
  /** @deprecated */
  renderTargetPixelByteCost: number | undefined;
  /** @deprecated */
  renderTargetComponentAlignment: number | undefined;

  // IMPORTANT:
  // Add new top-level keys both here and in kUniversalDefaults.
} & (
  | {
      /** Color aspect info. */
      color: TextureFormatColorAspectInfo;
      /** Defined if the format is a color format that can be used as `RENDER_ATTACHMENT`. */
      colorRender:
        | undefined
        | {
            /** Whether the format is blendable. */
            blend: boolean;
            /** Whether the format can be a multisample resolve target. */
            resolve: boolean;
            /** The "render target pixel byte cost" of the format. */
            byteCost: number;
            /** The "render target component alignment" of the format. */
            alignment: number;
          };
    }
  | (
      | {
          /** Depth aspect info. */
          depth: TextureFormatDepthAspectInfo;
          /** Stencil aspect info. */
          stencil: undefined | TextureFormatStencilAspectInfo;
          multisample: true;
        }
      | {
          /** Stencil aspect info. */
          stencil: TextureFormatStencilAspectInfo;
          multisample: true;
        }
    )
);

/** Per-GPUTextureFormat info. */
export const kTextureFormatInfo = {
  ...kRegularTextureFormatInfo,
  ...kSizedDepthStencilFormatInfo,
  ...kUnsizedDepthStencilFormatInfo,
  ...kBCTextureFormatInfo,
  ...kETC2TextureFormatInfo,
  ...kASTCTextureFormatInfo,
} as const;
export type TextureFormatInfo<
  Format extends GPUTextureFormat = GPUTextureFormat
> = typeof kTextureFormatInfo[Format];

/** Dummy variable to verify the type of kTextureFormatInfo2. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const kTextureFormatInfo_TypeCheck: {
  readonly [F in GPUTextureFormat]: TextureFormatInfo_TypeCheck;
} = kTextureFormatInfo;
/** List of all GPUTextureFormat values. */
export const kTextureFormats: readonly GPUTextureFormat[] = keysOf(kAllTextureFormatInfo);

/** Valid GPUTextureFormats for `copyExternalImageToTexture`, by spec. */
export const kValidTextureFormatsForCopyE2T = [
  'r8unorm',
  'r16float',
  'r32float',
  'rg8unorm',
  'rg16float',
  'rg32float',
  'rgba8unorm',
  'rgba8unorm-srgb',
  'bgra8unorm',
  'bgra8unorm-srgb',
  'rgb10a2unorm',
  'rgba16float',
  'rgba32float',
] as const;

/** Per-GPUTextureDimension info. */
export const kTextureDimensionInfo: {
  readonly [k in GPUTextureDimension]: {};
} = /* prettier-ignore */ {
  '1d': {},
  '2d': {},
  '3d': {},
};
/** List of all GPUTextureDimension values. */
export const kTextureDimensions = keysOf(kTextureDimensionInfo);

/** Per-GPUTextureAspect info. */
export const kTextureAspectInfo: {
  readonly [k in GPUTextureAspect]: {};
} = /* prettier-ignore */ {
  'all': {},
  'depth-only': {},
  'stencil-only': {},
};
/** List of all GPUTextureAspect values. */
export const kTextureAspects = keysOf(kTextureAspectInfo);

/** Per-GPUCompareFunction info. */
export const kCompareFunctionInfo: {
  readonly [k in GPUCompareFunction]: {};
} = /* prettier-ignore */ {
  'never': {},
  'less': {},
  'equal': {},
  'less-equal': {},
  'greater': {},
  'not-equal': {},
  'greater-equal': {},
  'always': {},
};
/** List of all GPUCompareFunction values. */
export const kCompareFunctions = keysOf(kCompareFunctionInfo);

/** Per-GPUStencilOperation info. */
export const kStencilOperationInfo: {
  readonly [k in GPUStencilOperation]: {};
} = /* prettier-ignore */ {
  'keep': {},
  'zero': {},
  'replace': {},
  'invert': {},
  'increment-clamp': {},
  'decrement-clamp': {},
  'increment-wrap': {},
  'decrement-wrap': {},
};
/** List of all GPUStencilOperation values. */
export const kStencilOperations = keysOf(kStencilOperationInfo);

const kDepthStencilFormatCapabilityInBufferTextureCopy = {
  // kUnsizedDepthStencilFormats
  depth24plus: {
    CopyB2T: [],
    CopyT2B: [],
    texelAspectSize: { 'depth-only': -1, 'stencil-only': -1 },
  },
  'depth24plus-stencil8': {
    CopyB2T: ['stencil-only'],
    CopyT2B: ['stencil-only'],
    texelAspectSize: { 'depth-only': -1, 'stencil-only': 1 },
  },

  // kSizedDepthStencilFormats
  depth16unorm: {
    CopyB2T: ['all', 'depth-only'],
    CopyT2B: ['all', 'depth-only'],
    texelAspectSize: { 'depth-only': 2, 'stencil-only': -1 },
  },
  depth32float: {
    CopyB2T: [],
    CopyT2B: ['all', 'depth-only'],
    texelAspectSize: { 'depth-only': 4, 'stencil-only': -1 },
  },
  'depth32float-stencil8': {
    CopyB2T: ['stencil-only'],
    CopyT2B: ['depth-only', 'stencil-only'],
    texelAspectSize: { 'depth-only': 4, 'stencil-only': 1 },
  },
  stencil8: {
    CopyB2T: ['all', 'stencil-only'],
    CopyT2B: ['all', 'stencil-only'],
    texelAspectSize: { 'depth-only': -1, 'stencil-only': 1 },
  },
} as const;

/** `kDepthStencilFormatResolvedAspect[format][aspect]` returns the aspect-specific format for a
 *  depth-stencil format, or `undefined` if the format doesn't have the aspect.
 */
export const kDepthStencilFormatResolvedAspect: {
  readonly [k in DepthStencilFormat]: {
    readonly [a in GPUTextureAspect]: DepthStencilFormat | undefined;
  };
} = {
  // kUnsizedDepthStencilFormats
  depth24plus: {
    all: 'depth24plus',
    'depth-only': 'depth24plus',
    'stencil-only': undefined,
  },
  'depth24plus-stencil8': {
    all: 'depth24plus-stencil8',
    'depth-only': 'depth24plus',
    'stencil-only': 'stencil8',
  },

  // kSizedDepthStencilFormats
  depth16unorm: {
    all: 'depth16unorm',
    'depth-only': 'depth16unorm',
    'stencil-only': undefined,
  },
  depth32float: {
    all: 'depth32float',
    'depth-only': 'depth32float',
    'stencil-only': undefined,
  },
  'depth32float-stencil8': {
    all: 'depth32float-stencil8',
    'depth-only': 'depth32float',
    'stencil-only': 'stencil8',
  },
  stencil8: {
    all: 'stencil8',
    'depth-only': undefined,
    'stencil-only': 'stencil8',
  },
} as const;

/**
 * @returns the GPUTextureFormat corresponding to the @param aspect of @param format.
 * This allows choosing the correct format for depth-stencil aspects when creating pipelines that
 * will have to match the resolved format of views, or to get per-aspect information like the
 * `blockByteSize`.
 *
 * Many helpers use an `undefined` `aspect` to means `'all'` so this is also the default for this
 * function.
 */
export function resolvePerAspectFormat(
  format: GPUTextureFormat,
  aspect?: GPUTextureAspect
): GPUTextureFormat {
  if (aspect === 'all' || aspect === undefined) {
    return format;
  }
  assert(!!kTextureFormatInfo[format].depth || !!kTextureFormatInfo[format].stencil);
  const resolved = kDepthStencilFormatResolvedAspect[format as DepthStencilFormat][aspect ?? 'all'];
  assert(resolved !== undefined);
  return resolved;
}

/**
 * Gets all copyable aspects for copies between texture and buffer for specified depth/stencil format and copy type, by spec.
 */
export function depthStencilFormatCopyableAspects(
  type: ImageCopyType,
  format: DepthStencilFormat
): readonly GPUTextureAspect[] {
  const appliedType = type === 'WriteTexture' ? 'CopyB2T' : type;
  return kDepthStencilFormatCapabilityInBufferTextureCopy[format][appliedType];
}

/**
 * Computes whether a copy between a depth/stencil texture aspect and a buffer is supported, by spec.
 */
export function depthStencilBufferTextureCopySupported(
  type: ImageCopyType,
  format: DepthStencilFormat,
  aspect: GPUTextureAspect
): boolean {
  const supportedAspects: readonly GPUTextureAspect[] = depthStencilFormatCopyableAspects(
    type,
    format
  );
  return supportedAspects.includes(aspect);
}

/**
 * Returns the byte size of the depth or stencil aspect of the specified depth/stencil format,
 * or -1 if none.
 */
export function depthStencilFormatAspectSize(
  format: DepthStencilFormat,
  aspect: 'depth-only' | 'stencil-only'
) {
  const texelAspectSize =
    kDepthStencilFormatCapabilityInBufferTextureCopy[format].texelAspectSize[aspect];
  assert(texelAspectSize > 0);
  return texelAspectSize;
}

/**
 * Returns true iff a texture can be created with the provided GPUTextureDimension
 * (defaulting to 2d) and GPUTextureFormat, by spec.
 */
export function textureDimensionAndFormatCompatible(
  dimension: undefined | GPUTextureDimension,
  format: GPUTextureFormat
): boolean {
  const info = kAllTextureFormatInfo[format];
  return !(
    (dimension === '1d' || dimension === '3d') &&
    (info.blockWidth > 1 || info.depth || info.stencil)
  );
}

/** Per-GPUTextureUsage type info. */
export const kTextureUsageTypeInfo: {
  readonly [name: string]: number;
} = /* prettier-ignore */ {
  'texture': Number(GPUConst.TextureUsage.TEXTURE_BINDING),
  'storage': Number(GPUConst.TextureUsage.STORAGE_BINDING),
  'render':  Number(GPUConst.TextureUsage.RENDER_ATTACHMENT),
};
/** List of all GPUTextureUsage type values. */
export const kTextureUsageType = keysOf(kTextureUsageTypeInfo);

/** Per-GPUTextureUsage copy info. */
export const kTextureUsageCopyInfo: {
  readonly [name: string]: number;
} = /* prettier-ignore */ {
  'none':     0,
  'src':      Number(GPUConst.TextureUsage.COPY_SRC),
  'dst':      Number(GPUConst.TextureUsage.COPY_DST),
  'src-dest': Number(GPUConst.TextureUsage.COPY_SRC) | Number(GPUConst.TextureUsage.COPY_DST),
};
/** List of all GPUTextureUsage copy values. */
export const kTextureUsageCopy = keysOf(kTextureUsageCopyInfo);

/** Per-GPUTextureUsage info. */
export const kTextureUsageInfo: {
  readonly [k in valueof<typeof GPUConst.TextureUsage>]: {};
} = {
  [GPUConst.TextureUsage.COPY_SRC]: {},
  [GPUConst.TextureUsage.COPY_DST]: {},
  [GPUConst.TextureUsage.TEXTURE_BINDING]: {},
  [GPUConst.TextureUsage.STORAGE_BINDING]: {},
  [GPUConst.TextureUsage.RENDER_ATTACHMENT]: {},
};
/** List of all GPUTextureUsage values. */
export const kTextureUsages = numericKeysOf<GPUTextureUsageFlags>(kTextureUsageInfo);

// Texture View

/** Per-GPUTextureViewDimension info. */
export type TextureViewDimensionInfo = {
  /** Whether a storage texture view can have this view dimension. */
  readonly storage: boolean;
  // Add fields as needed
};
/** Per-GPUTextureViewDimension info. */
export const kTextureViewDimensionInfo: {
  readonly [k in GPUTextureViewDimension]: TextureViewDimensionInfo;
} = /* prettier-ignore */ {
  '1d':         { storage: true  },
  '2d':         { storage: true  },
  '2d-array':   { storage: true  },
  'cube':       { storage: false },
  'cube-array': { storage: false },
  '3d':         { storage: true  },
};
/** List of all GPUTextureDimension values. */
export const kTextureViewDimensions = keysOf(kTextureViewDimensionInfo);

// Vertex formats

/** Per-GPUVertexFormat info. */
// Exists just for documentation. Otherwise could be inferred by `makeTable`.
export type VertexFormatInfo = {
  /** Number of bytes in each component. */
  readonly bytesPerComponent: 1 | 2 | 4;
  /** The data encoding (float, normalized, or integer) for each component. */
  readonly type: 'float' | 'unorm' | 'snorm' | 'uint' | 'sint';
  /** Number of components. */
  readonly componentCount: 1 | 2 | 3 | 4;
  /** The completely matching WGSL type for vertex format */
  readonly wgslType:
    | 'f32'
    | 'vec2<f32>'
    | 'vec3<f32>'
    | 'vec4<f32>'
    | 'u32'
    | 'vec2<u32>'
    | 'vec3<u32>'
    | 'vec4<u32>'
    | 'i32'
    | 'vec2<i32>'
    | 'vec3<i32>'
    | 'vec4<i32>';
  // Add fields as needed
};
/** Per-GPUVertexFormat info. */
export const kVertexFormatInfo: {
  readonly [k in GPUVertexFormat]: VertexFormatInfo;
} = /* prettier-ignore */ makeTable(
               ['bytesPerComponent',  'type', 'componentCount',  'wgslType'] as const,
               [                   ,        ,                 ,            ] as const, {
  // 8 bit components
  'uint8x2':   [                  1,  'uint',                2, 'vec2<u32>'],
  'uint8x4':   [                  1,  'uint',                4, 'vec4<u32>'],
  'sint8x2':   [                  1,  'sint',                2, 'vec2<i32>'],
  'sint8x4':   [                  1,  'sint',                4, 'vec4<i32>'],
  'unorm8x2':  [                  1, 'unorm',                2, 'vec2<f32>'],
  'unorm8x4':  [                  1, 'unorm',                4, 'vec4<f32>'],
  'snorm8x2':  [                  1, 'snorm',                2, 'vec2<f32>'],
  'snorm8x4':  [                  1, 'snorm',                4, 'vec4<f32>'],
  // 16 bit components
  'uint16x2':  [                  2,  'uint',                2, 'vec2<u32>'],
  'uint16x4':  [                  2,  'uint',                4, 'vec4<u32>'],
  'sint16x2':  [                  2,  'sint',                2, 'vec2<i32>'],
  'sint16x4':  [                  2,  'sint',                4, 'vec4<i32>'],
  'unorm16x2': [                  2, 'unorm',                2, 'vec2<f32>'],
  'unorm16x4': [                  2, 'unorm',                4, 'vec4<f32>'],
  'snorm16x2': [                  2, 'snorm',                2, 'vec2<f32>'],
  'snorm16x4': [                  2, 'snorm',                4, 'vec4<f32>'],
  'float16x2': [                  2, 'float',                2, 'vec2<f32>'],
  'float16x4': [                  2, 'float',                4, 'vec4<f32>'],
  // 32 bit components
  'float32':   [                  4, 'float',                1,       'f32'],
  'float32x2': [                  4, 'float',                2, 'vec2<f32>'],
  'float32x3': [                  4, 'float',                3, 'vec3<f32>'],
  'float32x4': [                  4, 'float',                4, 'vec4<f32>'],
  'uint32':    [                  4,  'uint',                1,       'u32'],
  'uint32x2':  [                  4,  'uint',                2, 'vec2<u32>'],
  'uint32x3':  [                  4,  'uint',                3, 'vec3<u32>'],
  'uint32x4':  [                  4,  'uint',                4, 'vec4<u32>'],
  'sint32':    [                  4,  'sint',                1,       'i32'],
  'sint32x2':  [                  4,  'sint',                2, 'vec2<i32>'],
  'sint32x3':  [                  4,  'sint',                3, 'vec3<i32>'],
  'sint32x4':  [                  4,  'sint',                4, 'vec4<i32>']
} as const);
/** List of all GPUVertexFormat values. */
export const kVertexFormats = keysOf(kVertexFormatInfo);

// Typedefs for bindings

/**
 * Classes of `PerShaderStage` binding limits. Two bindings with the same class
 * count toward the same `PerShaderStage` limit(s) in the spec (if any).
 */
export type PerStageBindingLimitClass =
  | 'uniformBuf'
  | 'storageBuf'
  | 'sampler'
  | 'sampledTex'
  | 'storageTex';
/**
 * Classes of `PerPipelineLayout` binding limits. Two bindings with the same class
 * count toward the same `PerPipelineLayout` limit(s) in the spec (if any).
 */
export type PerPipelineBindingLimitClass = PerStageBindingLimitClass;

export type ValidBindableResource =
  | 'uniformBuf'
  | 'storageBuf'
  | 'filtSamp'
  | 'nonFiltSamp'
  | 'compareSamp'
  | 'sampledTex'
  | 'sampledTexMS'
  | 'storageTex';
type ErrorBindableResource = 'errorBuf' | 'errorSamp' | 'errorTex';

/**
 * Types of resource binding which have distinct binding rules, by spec
 * (e.g. filtering vs non-filtering sampler, multisample vs non-multisample texture).
 */
export type BindableResource = ValidBindableResource | ErrorBindableResource;
export const kBindableResources = [
  'uniformBuf',
  'storageBuf',
  'filtSamp',
  'nonFiltSamp',
  'compareSamp',
  'sampledTex',
  'sampledTexMS',
  'storageTex',
  'errorBuf',
  'errorSamp',
  'errorTex',
] as const;
assertTypeTrue<TypeEqual<BindableResource, typeof kBindableResources[number]>>();

// Bindings

/** Dynamic buffer offsets require offset to be divisible by 256, by spec. */
export const kMinDynamicBufferOffsetAlignment = 256;

/** Default `PerShaderStage` binding limits, by spec. */
export const kPerStageBindingLimits: {
  readonly [k in PerStageBindingLimitClass]: {
    /** Which `PerShaderStage` binding limit class. */
    readonly class: k;
    /** Maximum number of allowed bindings in that class. */
    readonly max: number;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'uniformBuf': { class: 'uniformBuf', max: 12, },
  'storageBuf': { class: 'storageBuf', max:  8, },
  'sampler':    { class: 'sampler',    max: 16, },
  'sampledTex': { class: 'sampledTex', max: 16, },
  'storageTex': { class: 'storageTex', max:  4, },
};

/**
 * Default `PerPipelineLayout` binding limits, by spec.
 */
export const kPerPipelineBindingLimits: {
  readonly [k in PerPipelineBindingLimitClass]: {
    /** Which `PerPipelineLayout` binding limit class. */
    readonly class: k;
    /** Maximum number of allowed bindings with `hasDynamicOffset: true` in that class. */
    readonly maxDynamic: number;
    // Add fields as needed
  };
} = /* prettier-ignore */ {
  'uniformBuf': { class: 'uniformBuf', maxDynamic: 8, },
  'storageBuf': { class: 'storageBuf', maxDynamic: 4, },
  'sampler':    { class: 'sampler',    maxDynamic: 0, },
  'sampledTex': { class: 'sampledTex', maxDynamic: 0, },
  'storageTex': { class: 'storageTex', maxDynamic: 0, },
};

interface BindingKindInfo {
  readonly resource: ValidBindableResource;
  readonly perStageLimitClass: typeof kPerStageBindingLimits[PerStageBindingLimitClass];
  readonly perPipelineLimitClass: typeof kPerPipelineBindingLimits[PerPipelineBindingLimitClass];
  // Add fields as needed
}

const kBindingKind: {
  readonly [k in ValidBindableResource]: BindingKindInfo;
} = /* prettier-ignore */ {
  uniformBuf:   { resource: 'uniformBuf',   perStageLimitClass: kPerStageBindingLimits.uniformBuf, perPipelineLimitClass: kPerPipelineBindingLimits.uniformBuf, },
  storageBuf:   { resource: 'storageBuf',   perStageLimitClass: kPerStageBindingLimits.storageBuf, perPipelineLimitClass: kPerPipelineBindingLimits.storageBuf, },
  filtSamp:     { resource: 'filtSamp',     perStageLimitClass: kPerStageBindingLimits.sampler,    perPipelineLimitClass: kPerPipelineBindingLimits.sampler,    },
  nonFiltSamp:  { resource: 'nonFiltSamp',  perStageLimitClass: kPerStageBindingLimits.sampler,    perPipelineLimitClass: kPerPipelineBindingLimits.sampler,    },
  compareSamp:  { resource: 'compareSamp',  perStageLimitClass: kPerStageBindingLimits.sampler,    perPipelineLimitClass: kPerPipelineBindingLimits.sampler,    },
  sampledTex:   { resource: 'sampledTex',   perStageLimitClass: kPerStageBindingLimits.sampledTex, perPipelineLimitClass: kPerPipelineBindingLimits.sampledTex, },
  sampledTexMS: { resource: 'sampledTexMS', perStageLimitClass: kPerStageBindingLimits.sampledTex, perPipelineLimitClass: kPerPipelineBindingLimits.sampledTex, },
  storageTex:   { resource: 'storageTex',   perStageLimitClass: kPerStageBindingLimits.storageTex, perPipelineLimitClass: kPerPipelineBindingLimits.storageTex, },
};

// Binding type info

const kValidStagesAll = {
  validStages:
    GPUConst.ShaderStage.VERTEX | GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
} as const;
const kValidStagesStorageWrite = {
  validStages: GPUConst.ShaderStage.FRAGMENT | GPUConst.ShaderStage.COMPUTE,
} as const;

/** Binding type info (including class limits) for the specified GPUBufferBindingLayout. */
export function bufferBindingTypeInfo(d: GPUBufferBindingLayout) {
  /* prettier-ignore */
  switch (d.type ?? 'uniform') {
    case 'uniform':           return { usage: GPUConst.BufferUsage.UNIFORM, ...kBindingKind.uniformBuf,  ...kValidStagesAll,          };
    case 'storage':           return { usage: GPUConst.BufferUsage.STORAGE, ...kBindingKind.storageBuf,  ...kValidStagesStorageWrite, };
    case 'read-only-storage': return { usage: GPUConst.BufferUsage.STORAGE, ...kBindingKind.storageBuf,  ...kValidStagesAll,          };
  }
}
/** List of all GPUBufferBindingType values. */
export const kBufferBindingTypes = ['uniform', 'storage', 'read-only-storage'] as const;
assertTypeTrue<TypeEqual<GPUBufferBindingType, typeof kBufferBindingTypes[number]>>();

/** Binding type info (including class limits) for the specified GPUSamplerBindingLayout. */
export function samplerBindingTypeInfo(d: GPUSamplerBindingLayout) {
  /* prettier-ignore */
  switch (d.type ?? 'filtering') {
    case 'filtering':     return { ...kBindingKind.filtSamp,    ...kValidStagesAll, };
    case 'non-filtering': return { ...kBindingKind.nonFiltSamp, ...kValidStagesAll, };
    case 'comparison':    return { ...kBindingKind.compareSamp, ...kValidStagesAll, };
  }
}
/** List of all GPUSamplerBindingType values. */
export const kSamplerBindingTypes = ['filtering', 'non-filtering', 'comparison'] as const;
assertTypeTrue<TypeEqual<GPUSamplerBindingType, typeof kSamplerBindingTypes[number]>>();

/** Binding type info (including class limits) for the specified GPUTextureBindingLayout. */
export function sampledTextureBindingTypeInfo(d: GPUTextureBindingLayout) {
  /* prettier-ignore */
  if (d.multisampled) {
    return { usage: GPUConst.TextureUsage.TEXTURE_BINDING, ...kBindingKind.sampledTexMS, ...kValidStagesAll, };
  } else {
    return { usage: GPUConst.TextureUsage.TEXTURE_BINDING, ...kBindingKind.sampledTex,   ...kValidStagesAll, };
  }
}
/** List of all GPUTextureSampleType values. */
export const kTextureSampleTypes = [
  'float',
  'unfilterable-float',
  'depth',
  'sint',
  'uint',
] as const;
assertTypeTrue<TypeEqual<GPUTextureSampleType, typeof kTextureSampleTypes[number]>>();

/** Binding type info (including class limits) for the specified GPUStorageTextureBindingLayout. */
export function storageTextureBindingTypeInfo(d: GPUStorageTextureBindingLayout) {
  return {
    usage: GPUConst.TextureUsage.STORAGE_BINDING,
    ...kBindingKind.storageTex,
    ...kValidStagesStorageWrite,
  };
}
/** List of all GPUStorageTextureAccess values. */
export const kStorageTextureAccessValues = ['write-only'] as const;
assertTypeTrue<TypeEqual<GPUStorageTextureAccess, typeof kStorageTextureAccessValues[number]>>();

/** GPUBindGroupLayoutEntry, but only the "union" fields, not the common fields. */
export type BGLEntry = Omit<GPUBindGroupLayoutEntry, 'binding' | 'visibility'>;
/** Binding type info (including class limits) for the specified BGLEntry. */
export function texBindingTypeInfo(e: BGLEntry) {
  if (e.texture !== undefined) return sampledTextureBindingTypeInfo(e.texture);
  if (e.storageTexture !== undefined) return storageTextureBindingTypeInfo(e.storageTexture);
  unreachable();
}
/** BindingTypeInfo (including class limits) for the specified BGLEntry. */
export function bindingTypeInfo(e: BGLEntry) {
  if (e.buffer !== undefined) return bufferBindingTypeInfo(e.buffer);
  if (e.texture !== undefined) return sampledTextureBindingTypeInfo(e.texture);
  if (e.sampler !== undefined) return samplerBindingTypeInfo(e.sampler);
  if (e.storageTexture !== undefined) return storageTextureBindingTypeInfo(e.storageTexture);
  unreachable('GPUBindGroupLayoutEntry has no BindingLayout');
}

/**
 * Generate a list of possible buffer-typed BGLEntry values.
 *
 * Note: Generates different `type` options, but not `hasDynamicOffset` options.
 */
export function bufferBindingEntries(includeUndefined: boolean): readonly BGLEntry[] {
  return [
    ...(includeUndefined ? [{ buffer: { type: undefined } }] : []),
    { buffer: { type: 'uniform' } },
    { buffer: { type: 'storage' } },
    { buffer: { type: 'read-only-storage' } },
  ] as const;
}
/** Generate a list of possible sampler-typed BGLEntry values. */
export function samplerBindingEntries(includeUndefined: boolean): readonly BGLEntry[] {
  return [
    ...(includeUndefined ? [{ sampler: { type: undefined } }] : []),
    { sampler: { type: 'comparison' } },
    { sampler: { type: 'filtering' } },
    { sampler: { type: 'non-filtering' } },
  ] as const;
}
/**
 * Generate a list of possible texture-typed BGLEntry values.
 *
 * Note: Generates different `multisampled` options, but not `sampleType` or `viewDimension` options.
 */
export function textureBindingEntries(includeUndefined: boolean): readonly BGLEntry[] {
  return [
    ...(includeUndefined ? [{ texture: { multisampled: undefined } }] : []),
    { texture: { multisampled: false } },
    { texture: { multisampled: true, sampleType: 'unfilterable-float' } },
  ] as const;
}
/**
 * Generate a list of possible storageTexture-typed BGLEntry values.
 *
 * Note: Generates different `access` options, but not `format` or `viewDimension` options.
 */
export function storageTextureBindingEntries(format: GPUTextureFormat): readonly BGLEntry[] {
  return [{ storageTexture: { access: 'write-only', format } }] as const;
}
/** Generate a list of possible texture-or-storageTexture-typed BGLEntry values. */
export function sampledAndStorageBindingEntries(
  includeUndefined: boolean,
  storageTextureFormat: GPUTextureFormat = 'rgba8unorm'
): readonly BGLEntry[] {
  return [
    ...textureBindingEntries(includeUndefined),
    ...storageTextureBindingEntries(storageTextureFormat),
  ] as const;
}
/**
 * Generate a list of possible BGLEntry values of every type, but not variants with different:
 * - buffer.hasDynamicOffset
 * - texture.sampleType
 * - texture.viewDimension
 * - storageTexture.viewDimension
 */
export function allBindingEntries(
  includeUndefined: boolean,
  storageTextureFormat: GPUTextureFormat = 'rgba8unorm'
): readonly BGLEntry[] {
  return [
    ...bufferBindingEntries(includeUndefined),
    ...samplerBindingEntries(includeUndefined),
    ...sampledAndStorageBindingEntries(includeUndefined, storageTextureFormat),
  ] as const;
}

// Shader stages

/** List of all GPUShaderStage values. */
export type ShaderStageKey = keyof typeof GPUConst.ShaderStage;
export const kShaderStageKeys = Object.keys(GPUConst.ShaderStage) as ShaderStageKey[];
export const kShaderStages: readonly GPUShaderStageFlags[] = [
  GPUConst.ShaderStage.VERTEX,
  GPUConst.ShaderStage.FRAGMENT,
  GPUConst.ShaderStage.COMPUTE,
];
/** List of all possible combinations of GPUShaderStage values. */
export const kShaderStageCombinations: readonly GPUShaderStageFlags[] = [0, 1, 2, 3, 4, 5, 6, 7];
export const kShaderStageCombinationsWithStage: readonly GPUShaderStageFlags[] = [
  1,
  2,
  3,
  4,
  5,
  6,
  7,
];

/**
 * List of all possible texture sampleCount values.
 *
 * MAINTENANCE_TODO: Switch existing tests to use kTextureSampleCounts
 */
export const kTextureSampleCounts = [1, 4] as const;

// Blend factors and Blend components

/** List of all GPUBlendFactor values. */
export const kBlendFactors: readonly GPUBlendFactor[] = [
  'zero',
  'one',
  'src',
  'one-minus-src',
  'src-alpha',
  'one-minus-src-alpha',
  'dst',
  'one-minus-dst',
  'dst-alpha',
  'one-minus-dst-alpha',
  'src-alpha-saturated',
  'constant',
  'one-minus-constant',
];

/** List of all GPUBlendOperation values. */
export const kBlendOperations: readonly GPUBlendOperation[] = [
  'add', //
  'subtract',
  'reverse-subtract',
  'min',
  'max',
];

// Primitive topologies
export const kPrimitiveTopology: readonly GPUPrimitiveTopology[] = [
  'point-list',
  'line-list',
  'line-strip',
  'triangle-list',
  'triangle-strip',
];
assertTypeTrue<TypeEqual<GPUPrimitiveTopology, typeof kPrimitiveTopology[number]>>();

export const kIndexFormat: readonly GPUIndexFormat[] = ['uint16', 'uint32'];
assertTypeTrue<TypeEqual<GPUIndexFormat, typeof kIndexFormat[number]>>();

/** Info for each entry of GPUSupportedLimits */
export const kLimitInfo = /* prettier-ignore */ makeTable(
                                               [    'class', 'default',            'maximumValue'] as const,
                                               [  'maximum',          ,     kMaxUnsignedLongValue] as const, {
  'maxTextureDimension1D':                     [           ,      8192,                          ],
  'maxTextureDimension2D':                     [           ,      8192,                          ],
  'maxTextureDimension3D':                     [           ,      2048,                          ],
  'maxTextureArrayLayers':                     [           ,       256,                          ],

  'maxBindGroups':                             [           ,         4,                          ],
  'maxBindingsPerBindGroup':                   [           ,      1000,                          ],
  'maxDynamicUniformBuffersPerPipelineLayout': [           ,         8,                          ],
  'maxDynamicStorageBuffersPerPipelineLayout': [           ,         4,                          ],
  'maxSampledTexturesPerShaderStage':          [           ,        16,                          ],
  'maxSamplersPerShaderStage':                 [           ,        16,                          ],
  'maxStorageBuffersPerShaderStage':           [           ,         8,                          ],
  'maxStorageTexturesPerShaderStage':          [           ,         4,                          ],
  'maxUniformBuffersPerShaderStage':           [           ,        12,                          ],

  'maxUniformBufferBindingSize':               [           ,     65536, kMaxUnsignedLongLongValue],
  'maxStorageBufferBindingSize':               [           , 134217728, kMaxUnsignedLongLongValue],
  'minUniformBufferOffsetAlignment':           ['alignment',       256,                          ],
  'minStorageBufferOffsetAlignment':           ['alignment',       256,                          ],

  'maxVertexBuffers':                          [           ,         8,                          ],
  'maxBufferSize':                             [           , 268435456, kMaxUnsignedLongLongValue],
  'maxVertexAttributes':                       [           ,        16,                          ],
  'maxVertexBufferArrayStride':                [           ,      2048,                          ],
  'maxInterStageShaderComponents':             [           ,        60,                          ],
  'maxInterStageShaderVariables':              [           ,        16,                          ],

  'maxColorAttachments':                       [           ,         8,                          ],
  'maxColorAttachmentBytesPerSample':          [           ,        32,                          ],

  'maxComputeWorkgroupStorageSize':            [           ,     16384,                          ],
  'maxComputeInvocationsPerWorkgroup':         [           ,       256,                          ],
  'maxComputeWorkgroupSizeX':                  [           ,       256,                          ],
  'maxComputeWorkgroupSizeY':                  [           ,       256,                          ],
  'maxComputeWorkgroupSizeZ':                  [           ,        64,                          ],
  'maxComputeWorkgroupsPerDimension':          [           ,     65535,                          ],
} as const);

/** List of all entries of GPUSupportedLimits. */
export const kLimits = keysOf(kLimitInfo);

// Pipeline limits

/** Maximum number of color attachments to a render pass, by spec. */
export const kMaxColorAttachments = kLimitInfo.maxColorAttachments.default;
/** `maxVertexBuffers` per GPURenderPipeline, by spec. */
export const kMaxVertexBuffers = kLimitInfo.maxVertexBuffers.default;
/** `maxVertexAttributes` per GPURenderPipeline, by spec. */
export const kMaxVertexAttributes = kLimitInfo.maxVertexAttributes.default;
/** `maxVertexBufferArrayStride` in a vertex buffer in a GPURenderPipeline, by spec. */
export const kMaxVertexBufferArrayStride = kLimitInfo.maxVertexBufferArrayStride.default;

/** The size of indirect draw parameters in the indirectBuffer of drawIndirect */
export const kDrawIndirectParametersSize = 4;
/** The size of indirect drawIndexed parameters in the indirectBuffer of drawIndexedIndirect */
export const kDrawIndexedIndirectParametersSize = 5;

/** Per-GPUFeatureName info. */
export const kFeatureNameInfo: {
  readonly [k in GPUFeatureName]: {};
} = /* prettier-ignore */ {
  'bgra8unorm-storage': {},
  'depth-clip-control': {},
  'depth32float-stencil8': {},
  'texture-compression-bc': {},
  'texture-compression-etc2': {},
  'texture-compression-astc': {},
  'timestamp-query': {},
  'indirect-first-instance': {},
  'shader-f16': {},
  'rg11b10ufloat-renderable': {},
  'float32-filterable': {},
};
/** List of all GPUFeatureName values. */
export const kFeatureNames = keysOf(kFeatureNameInfo);

/**
 * Check if two formats are view format compatible.
 *
 * This function may need to be generalized to use `baseFormat` from `kTextureFormatInfo`.
 */
export function viewCompatible(a: GPUTextureFormat, b: GPUTextureFormat): boolean {
  return a === b || a + '-srgb' === b || b + '-srgb' === a;
}

export function getFeaturesForFormats<T>(
  formats: readonly (T & (GPUTextureFormat | undefined))[]
): readonly (GPUFeatureName | undefined)[] {
  return Array.from(new Set(formats.map(f => (f ? kTextureFormatInfo[f].feature : undefined))));
}

export function filterFormatsByFeature<T>(
  feature: GPUFeatureName | undefined,
  formats: readonly (T & (GPUTextureFormat | undefined))[]
): readonly (T & (GPUTextureFormat | undefined))[] {
  return formats.filter(f => f === undefined || kTextureFormatInfo[f].feature === feature);
}

export const kFeaturesForFormats = getFeaturesForFormats(kTextureFormats);
