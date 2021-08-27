export const description = 'Section 3 Test Plan';

import { makeTestGroup } from '../../../common/framework/test_group.js';

import { ShaderValidationTest } from './shader_validation_test.js';

export const g = makeTestGroup(ShaderValidationTest);

`textual_structure`;
g.test('literals,section_3_3_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#literals
Description: Note: literals are parsed greedily.
This means that for statements like a -5 this will not parse as a minus 5 but instead as a -5 which may be unexpected.
A space must be inserted after the - if the first expression is desired.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('identifiers,section_3_5_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#identifiers
Description: An identifier must not have the same spelling as a keyword or as a reserved keyword.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: An attribute must not be specified more than once per object or type.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a member of a structure type.
Must be a power of 2.
See memory layout alignment and size.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_2')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a resource variable.
Specifies the binding number of the resource in a bind group.
See section 9.3.2 Resource interface.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_3')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a structure type.
Indicates this structure type represents the contents of a buffer resource occupying a single binding slot in the shader’s resource interface.
The block attribute must be applied to a structure type used as the store type of a uniform buffer or storage buffer variable.
A structure type with the block attribute must not be: the element type of an array type the member type in another structure
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_4')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to an entry point function parameter, entry point return type, or member of a structure.
Declares a builtin variable.
See section 15 Built-in variables.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_5')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a resource variable.
Specifies the binding group of the resource.
See section 9.3.2 Resource interface.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_6')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: The first parameter must be an interpolation type.
The second parameter, if present, must specify the interpolation sampling.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_7')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to an entry point function parameter, entry point return type, or member of a structure type.
Must only be applied to declarations of scalars or vectors of floating-point type.
Must not be used with the compute shader stage.
Specifies how the user-defined IO must be interpolated.
The attribute is only significant on user-defined vertex outputs and fragment inputs.
See section 9.3.1.3 Interpolation.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_8')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to the position built-in variable.
When applied to the position built-in output variable of a vertex shader, the computation of the result is invariant across different programs and different invocations of the same entry point.
That is, if the data and control flow match for two position outputs in different entry points, then the result values are guaranteed to be the same.
There is no affect on a position built-in input variable.
Note: this attribute maps to the Invariant decoration in SPIR-V, the precise qualifier in HLSL, and the invariant qualifier in GLSL.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_9')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to an entry point function parameter, entry point return type, or member of a structure type.
Must only be applied to declarations of numeric scalar or numeric vector type.
Must not be used with the compute shader stage.
Specifies a part of the user-defined IO of an entry point.
See section 9.3.1.4 Input-output Locations.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_10')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to module scope constant declaration of scalar type.
Specifies a pipeline-overridable constant.
In the WebGPU API, pipeline overridable constants are specified by the identifier of the constant the attribute is applied to.
If the optional parameter is specified, the pipeline overridable constant is referred to by the numeric id specified instead.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_11')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a member of a structure type.
The number of bytes reserved in the struct for this member.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_12')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to a function declaration.
Declares an entry point by specifying its pipeline stage.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_13')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must only be applied to an array type.
The number of bytes from the start of one element of the array to the start of the next element.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_14')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Each parameter is either a literal or module-scope constant.
All parameters must be of the same type, either i32 or u32.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('attributes,section_3_6_rule_15')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#attributes
Description: Must be applied to a compute shader entry point function.
Must not be applied to any other object.
Specifies the x, y, and z dimensions of the workgroup grid for the compute shader.
The first parameter specifies the x dimension.
The second parameter, if provided, specifies the y dimension, otherwise is assumed to be 1.
The third parameter, if provided, specifies the z dimension, otherwise is assumed to be 1.
Each dimension must be at least 1 and at most an upper bound specified by the WebGPU API.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('declaration_and_scope,section_3_8_rule_0')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#declaration-and-scope
Description: A declaration must not introduce a name when that identifier is already in scope with the same end scope as another instance of that name.
When an identifier is used in scope of one or more declarations for that name, the identifier will denote the object of the declaration appearing closest to that use.
We say the identifier use resolves to that declaration.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();

g.test('declaration_and_scope,section_3_8_rule_1')
  .desc(
    `
https://gpuweb.github.io/gpuweb/wgsl/#declaration-and-scope
Description: When an identifier is used, it must be in scope for some declaration, or as part of a directive.
`
  )
  .params(u => u.combine('palceHolder1', ['palceHolder2', 'placeHolder3']))
  .unimplemented();
