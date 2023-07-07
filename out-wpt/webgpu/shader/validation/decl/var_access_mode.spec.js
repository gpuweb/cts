/**
 * AUTO-GENERATED - DO NOT EDIT. Source: https://github.com/gpuweb/cts
 **/ export const description = `
7.3 var Declarations

The access mode always has a default value, and except for variables in the
storage address space, must not be specified in the WGSL source. See §13.3 Address Spaces.
`;
import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { kAccessModeInfo, kAddressSpaceInfo } from '../../types.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import { declareEntryPoint } from './util.js';

// Test address spaces that we can hold an i32 variable.
const kNonHandleAddressSpaces = keysOf(kAddressSpaceInfo).filter(as => as !== 'handle');

export const g = makeTestGroup(ShaderValidationTest);

/**
 * @returns a WGSL var declaration with given parameters for variable 'x' and
 * store type i32.
 */
function declareVarX(addressSpace, accessMode) {
  const parts = [];
  if (addressSpace && kAddressSpaceInfo[addressSpace].binding) parts.push('@group(0) @binding(0) ');
  parts.push('var');

  const template_parts = [];
  if (addressSpace) template_parts.push(addressSpace);
  if (accessMode) template_parts.push(accessMode);
  if (template_parts.length > 0) parts.push(`<${template_parts.join(',')}>`);

  parts.push(' x: i32;');
  return parts.join('');
}

/**
 * @returns a WGSL program for the test parameterization.
 */
function getShader(
  p,

  additionalBody
) {
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

/** @returns the list of address space info objects for the given address space.  */
function infoExpander(p) {
  return [kAddressSpaceInfo[p.addressSpace]];
}

/**
 * @returns a list of booleans indicating valid cases of specifying the address
 * space.
 */
function explicitSpaceExpander(p) {
  return p.info.spell === 'must' ? [true] : [true, false];
}
/** @returns a list of usable access modes under given experiment conditions.  */
function accessModeExpander(p) {
  return p.explicitMode && p.info.spellAccessMode !== 'never' ? p.info.accessModes : [];
}

/**
 * @returns false if the test does not spell the address space in the var
 * declaration but the address space requires it.
 * Use this filter when trying to test something other than access mode
 * functionality.
 */
function compatibleAS(p) {
  return !p.explicitSpace && p.info.spell === 'must';
}

/** @returns the effective access mode for the given experiment.  */
function effectiveMode(p) {
  return p.accessMode || p.info.accessModes[0]; // default is first.
}
/** @returns whether the setup allows reads */
function supportsRead(p) {
  const mode = effectiveMode(p);
  return p.info.accessModes.includes(mode) && kAccessModeInfo[mode].read;
}
/** @returns whether the setup allows writes */
function supportsWrite(p) {
  const mode = effectiveMode(p);
  return p.info.accessModes.includes(mode) && kAccessModeInfo[mode].write;
}

g.test('explicit_access_mode')
  .desc('Validate uses of an explicit access mode on a var declaration')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .expand('info', infoExpander)
        .combine('explicitSpace', [true, false])
        .filter(t => compatibleAS(t))
        .combine('explicitMode', [true])
        .combine('accessMode', keysOf(kAccessModeInfo))
        .combine('stage', ['compute']) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getShader(t.params);

    const ok =
      // The address space must be explicitly specified.
      t.params.explicitSpace &&
      // The address space must allow an access mode to be spelled, and the
      // access mode must be in the list of modes for the address space.
      t.params.info.spellAccessMode !== 'never' &&
      t.params.info.accessModes.includes(t.params.accessMode);

    t.expectCompileResult(ok, prog);
  });

g.test('implicit_access_mode')
  .desc('Validate an implicit access mode on a var declaration')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .expand('info', infoExpander)
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitMode', [false])
        .combine('stage', ['compute']) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getShader(t.params);

    // 7.3 var Declarations
    // "The access mode always has a default value,.."
    const ok = true;

    t.expectCompileResult(ok, prog);
  });

g.test('read_access')
  .desc('A variable can be read from when the access mode permits')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .expand('info', infoExpander)
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitMode', [false, true])
        .expand('accessMode', accessModeExpander)
        .combine('stage', ['compute']) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getShader(t.params, 'let copy = x;');
    const ok = supportsRead(t.params);
    t.expectCompileResult(ok, prog);
  });

g.test('write_access')
  .desc('A variable can be written to when the access mode permits')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .expand('info', infoExpander)
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitMode', [false, true])
        .expand('accessMode', accessModeExpander)
        .combine('stage', ['compute']) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getShader(t.params, 'x = 0;');
    const ok = supportsWrite(t.params);
    t.expectCompileResult(ok, prog);
  });
