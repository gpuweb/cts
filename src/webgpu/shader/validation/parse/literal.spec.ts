export const description = `Validation tests for literals`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { ShaderValidationTest } from '../shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

g.test('bools')
  .desc(`Test that valid bools are accepted.`)
  .params(u => u.combine('val', ['true', 'false']).beginSubcases())
  .fn(t => {
    const code = `var test = ${t.params.val};`;
    t.expectCompileResult(true, t.wrapInEntryPoint(code));
  });

{
  const kValidIntegers = new Set([
    '0x123', // hex number
    '123', // signed number, no suffix
    '94i', // signed number
    '1u', // unsigned number
    '0', // zero
    '0x3f', // hex with 'f' as last character
    '2147483647', // max signed int
    '2147483647i', // max signed int
    '2147483647u', // max signed int
    '-2147483648', // min signed int
    '-2147483648i', // min signed int
    '4294967295', // will be deduced to unsigned
    '4294967295u', // max unsigned int
  ]);
  const kInvalidIntegers = new Set([
    '0123', // Integer does not start with zero
    '2147483648i', // max signed int + 1
    '-2147483649i', // min signed int - 1
    '4294967295i', // max unsigned int with i suffix
    '4294967296u', // max unsigned int + 1
    '-1u', // negative unsigned
  ]);
  g.test('integer')
    .desc(`Test that valid integers are accepted, and invalid integers are rejected.`)
    .params(u =>
      u.combine('val', new Set([...kValidIntegers, ...kInvalidIntegers])).beginSubcases()
    )
    .fn(t => {
      const code = `var test = ${t.params.val};`;
      t.expectCompileResult(kValidIntegers.has(t.params.val), t.wrapInEntryPoint(code));
    });
}

{
  const kValidFloats = new Set([
    '0f', // Zero float
    '0.0f', // Zero float
    '0.0', // Zero float without suffix
    '.0', // Zero float without leading value
    '12.223f', // float value
    '12.', // No decimal points
    '00012.', // Leading zeros allowed
    '.12', // No leading digits
    '12.f', // .f
    '.12f', // No leading number with a f
    '1.2e2', // Exponent without sign (lowercase e)
    '1.2E2', // Exponent without sign (uppercase e)
    '1.2e+2', // positive exponent
    '2.4e+4f', // Positive exponent with f suffix
    '2.4e-2', // Negative exponent
    '2.4e-2f', // Negative exponent with f suffix
    '2.e+4f', // Exponent without decimals
    '.1e-2', // Exponent without leading number
    '1e-4f', // Exponennt without decimal point
    '0x.3', // Hex float, lowercase X
    '0X.3', // Hex float, uppercase X'
    '0xa.fp+2', // Hex float, lowercase p
    '0xa.fP+2', // Hex float, uppercase p
    '0xE.fp+2', // Uppercase E (as hex, but matches non hex exponent char)
    '0x1P+4f', // Hex float no decimal
    '0X1.fp-4', // Hex float negative exponent
  ]);
  const kInvalidFloats = new Set([
    '.f', // Must have a number
    '.e-2', // Exponent without leading values
    '1.e&2f', // Exponent invalid sign
    '1.ef', // Exponent without value
    '1.e+f', // Exponent sign no value
    '0x.p2', // Hex float no value
    '0x1p', // Hex float missing exponent
    '0x1p^', // Hex float invalid exponent
  ]);

  g.test('float')
    .desc(`Test that valid floats are accepted, and invalid floats are rejected`)
    .params(u => u.combine('val', new Set([...kValidFloats, ...kInvalidFloats])).beginSubcases())
    .fn(t => {
      const code = `var test = ${t.params.val};`;
      t.expectCompileResult(kValidFloats.has(t.params.val), t.wrapInEntryPoint(code));
    });
}

{
  const kValidHalfFloats = new Set([
    '0h', // Zero half
    '1h', // Half no decimal
    '.1h', // Half no leading value
    '1.1e2h', // Exponent half no sign
    '1.1E+2h', // Exponent half, plus (uppercase E)
    '2.4e-2h', // Exponent half, negative
    '0X3h', // Hexfloat half no exponent
    '0xep2h', // Hexfloat half lower case p
    '0xEp-2h', // Hexfloat uppcase hex value
    '0x3p+2h', // Hex float half positive exponent
    '0x3.2p+2h', // Hex float with decimal half
  ]);
  const kInvalidHalfFloats = new Set([
    '1.1eh', // Missing exponent value
    '1.1e%2h', // Invalid exponent sign
    '1.1e+h', // Missing exponent with sign
  ]);
  g.test('half_float')
    .desc(
      `
Test that valid half floats are accepted, and invalid half floats are rejected

TODO: Need to inject the 'enable fp16' into the shader to enable the parsing.
`
    )
    .params(u =>
      u.combine('val', new Set([...kValidHalfFloats, ...kInvalidHalfFloats])).beginSubcases()
    )
    .unimplemented();
}
