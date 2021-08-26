export function getCode(intrinsicCall: string) {
  const code =
    'fn intrinsicCall() {\n' +
    '  ' +
    intrinsicCall +
    '\n' +
    'return;\n' +
    '}\n' +
    '[[stage(vertex)]]\n' +
    'fn vertex_main() -> [[builtin(position)]] vec4<f32> {\n' +
    '  intrinsicCall();\n' +
    '  return vec4<f32>();\n' +
    '}\n';
  return code;
}
