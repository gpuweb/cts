import {
  AccessMode,
  AddressSpace,
  AddressSpaceInfo,
  kAccessModeInfo,
  kAddressSpaceInfo,
} from '../../types.js';

/** An enumerator of shader stages */
export type ShaderStage = 'vertex' | 'fragment' | 'compute';

/** The list of all shader stages */
export const kShaderStages = ['vertex', 'fragment', 'compute'] as const;

/**
 * declareEntrypoint emits the WGSL to declare an entry point with the name, stage and body.
 * The generated function will have an appropriate return type and return statement, so that @p body
 * does not have to change between stage.
 * @param arg - arg specifies the
 * optional entry point function name, the shader stage, and the body of the
 * function, excluding any automatically generated return statements.
 * @returns the WGSL string for the entry point
 */
export function declareEntryPoint(arg: {
  name?: string;
  stage: ShaderStage;
  body: string;
}): string {
  if (arg.name === undefined) {
    arg.name = 'main';
  }
  switch (arg.stage) {
    case 'vertex':
      return `@vertex
fn ${arg.name}() -> @builtin(position) vec4f {
  ${arg.body}
  return vec4f();
}`;
    case 'fragment':
      return `@fragment
fn ${arg.name}() {
  ${arg.body}
}`;
    case 'compute':
      return `@compute @workgroup_size(1)
fn ${arg.name}() {
  ${arg.body}
}`;
  }
}

/**
 * @returns a WGSL var declaration with given parameters for variable 'x' and
 * store type i32.
 */
export function declareVarX(
  addressSpace: AddressSpace | undefined,
  accessMode: AccessMode | undefined
): string {
  const parts: string[] = [];
  if (addressSpace && kAddressSpaceInfo[addressSpace].binding) parts.push('@group(0) @binding(0) ');
  parts.push('var');

  const template_parts: string[] = [];
  if (addressSpace) template_parts.push(addressSpace as string);
  if (accessMode) template_parts.push(accessMode);
  if (template_parts.length > 0) parts.push(`<${template_parts.join(',')}>`);

  parts.push(' x: i32;');
  return parts.join('');
}

/** @returns the list of address space info objects for the given address space.  */
export function infoExpander(p: { addressSpace: AddressSpace }): readonly AddressSpaceInfo[] {
  return [kAddressSpaceInfo[p.addressSpace]];
}

/** @returns a list of usable access modes under given experiment conditions.  */
export function accessModeExpander(p: {
  explicitMode: boolean; // Whether the access mode will be emitted.
  info: AddressSpaceInfo;
}): readonly AccessMode[] {
  return p.explicitMode && p.info.spellAccessMode !== 'never' ? p.info.accessModes : [];
}

/**
 * @returns a WGSL program with a single variable declaration, with the
 * given parameterization
 */
export function getVarDeclShader(
  p: {
    addressSpace: AddressSpace; // Address space for the variable.
    explicitSpace: boolean; // Should the address space be explicitly spelled?
    accessMode?: AccessMode; // What access mode to use.
    explicitMode: boolean; // Should the access mode be explicitly spelled?
    stage: ShaderStage; // What shader stage to use.
  },
  additionalBody?: string
): string {
  const as_info = kAddressSpaceInfo[p.addressSpace];
  const decl = declareVarX(
    p.explicitSpace ? p.addressSpace : undefined,
    p.explicitMode ? p.accessMode : undefined
  );

  additionalBody = additionalBody ?? '';

  switch (as_info.scope) {
    case 'module':
      return decl + '\n' + declareEntryPoint({ stage: p.stage, body: additionalBody });

    case 'function':
      return declareEntryPoint({ stage: p.stage, body: decl + '\n' + additionalBody });
  }
}

/** @returns the effective access mode for the given experiment.  */
function effectiveMode(p: { info: AddressSpaceInfo; accessMode: AccessMode }): AccessMode {
  return p.accessMode || p.info.accessModes[0]; // default is first.
}

/** @returns whether the setup allows reads */
export function supportsRead(p: { info: AddressSpaceInfo; accessMode: AccessMode }): boolean {
  const mode = effectiveMode(p);
  return p.info.accessModes.includes(mode) && kAccessModeInfo[mode].read;
}

/** @returns whether the setup allows writes */
export function supportsWrite(p: { info: AddressSpaceInfo; accessMode: AccessMode }): boolean {
  const mode = effectiveMode(p);
  return p.info.accessModes.includes(mode) && kAccessModeInfo[mode].write;
}

