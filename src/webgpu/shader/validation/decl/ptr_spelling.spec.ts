export const description = `
Validate spelling of pointer types.

Pointer types may appear.

They are parameterized by:
- address space, always
- store type
- and access mode, as specified by the table in Address Spaces.
   Concretely, only 'storage' address space allows it, and allows 'read', and 'read_write'.

A pointer type can be spelled only if it corresponds to a variable that could be
declared in the program.  So we need to test combinations against possible variable
declarations.
`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { keysOf } from '../../../../common/util/data_tables.js';
import { AddressSpace, kAddressSpaceInfo } from '../../types.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

import {
  pointerType,
  infoExpander,
  explicitSpaceExpander,
  accessModeExpander,
  getVarDeclShader,
  ShaderStage,
} from './util.js';

// Address spaces that can hold an i32 variable.
const kNonHandleAddressSpaces = keysOf(kAddressSpaceInfo).filter(
  as => as !== 'handle'
) as AddressSpace[];

export const g = makeTestGroup(ShaderValidationTest);

g.test('param_ptr_type')
  .desc('Validate formal parameter of pointer type on user-declared functions')
  .unimplemented();

g.test('let_ptr_explicit_type_matches_var')
  .desc(
    'Let-declared pointer with explicit type initialized from var with same address space and access mode'
  )
  .specURL('https://w3.org/TR#ref-ptr-types')
  .params(u =>
    u // Generate non-handle variables in all valid permutations of address space and access mode.
      .combine('addressSpace', kNonHandleAddressSpaces)
      .expand('info', infoExpander)
      .expand('explicitSpace', explicitSpaceExpander)
      .combine('explicitMode', [false, true])
      .expand('accessMode', accessModeExpander)
      // For compute shaders...
      .combine('stage', ['compute' as ShaderStage]) // Only need to check compute shaders
      // Vary the store type.
      .combine('storeType', ['i32', 'u32'])
  )
  .fn(t => {
    // Match the address space and access mode.
    const prog = getVarDeclShader(t.params, `let p: ${pointerType(t.params)} = &x;`);
    const ok = t.params.storeType === 'i32'; // The store type matches the variable.

    t.expectCompileResult(ok, prog);
  });

g.test('let_ptr_reads')
  .desc('Validate reading via ptr when permitted by access mode')
  .specURL('https://w3.org/TR#ref-ptr-types')
  .unimplemented();

g.test('let_ptr_writes')
  .desc('Validate writing via ptr when permitted by access mode')
  .specURL('https://w3.org/TR#ref-ptr-types')
  .unimplemented();
