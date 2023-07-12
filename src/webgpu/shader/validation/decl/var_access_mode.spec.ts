export const description = `
7.3 var Declarations

The access mode always has a default value, and except for variables in the
storage address space, must not be specified in the WGSL source. See §13.3 Address Spaces.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { AddressSpace, kAccessModeInfo, kAddressSpaceInfo } from '../../types.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import {
  explicitSpaceExpander,
  varDeclCompatibleAddressSpace,
  getVarDeclShader,
  accessModeExpander,
  supportsRead,
  supportsWrite,
  ShaderStage,
} from './util.js';

// Address spaces that can hold an i32 variable.
const kNonHandleAddressSpaces = keysOf(kAddressSpaceInfo).filter(
  as => as !== 'handle'
) as AddressSpace[];

export const g = makeTestGroup(ShaderValidationTest);

g.test('explicit_access_mode')
  .desc('Validate uses of an explicit access mode on a var declaration')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .combine('explicitSpace', [true, false])
        .filter(t => varDeclCompatibleAddressSpace(t))
        .combine('explicitAccess', [true])
        .combine('accessMode', keysOf(kAccessModeInfo))
        .combine('stage', ['compute' as ShaderStage]) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getVarDeclShader(t.params);
    const info = kAddressSpaceInfo[t.params.addressSpace];

    const ok =
      // The address space must be explicitly specified.
      t.params.explicitSpace &&
      // The address space must allow an access mode to be spelled, and the
      // access mode must be in the list of modes for the address space.
      info.spellAccessMode !== 'never' &&
      (info.accessModes as readonly string[]).includes(t.params.accessMode);

    t.expectCompileResult(ok, prog);
  });

g.test('implicit_access_mode')
  .desc('Validate an implicit access mode on a var declaration')
  .specURL('https://gpuweb.github.io/gpuweb/wgsl/#var-decls')
  .params(
    u =>
      u
        .combine('addressSpace', kNonHandleAddressSpaces)
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitAccess', [false])
        .combine('accessMode', [''] as const)
        .combine('stage', ['compute' as ShaderStage]) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getVarDeclShader(t.params);

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
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitAccess', [false, true])
        .expand('accessMode', accessModeExpander)
        .combine('stage', ['compute' as ShaderStage]) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getVarDeclShader(t.params, 'let copy = x;');
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
        .expand('explicitSpace', explicitSpaceExpander)
        .combine('explicitAccess', [false, true])
        .expand('accessMode', accessModeExpander)
        .combine('stage', ['compute' as ShaderStage]) // Only need to check compute shaders
  )
  .fn(t => {
    const prog = getVarDeclShader(t.params, 'x = 0;');
    const ok = supportsWrite(t.params);
    t.expectCompileResult(ok, prog);
  });
