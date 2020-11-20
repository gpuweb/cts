# v-0015 - This fails because of the runtime array is not last member of a [[block]] struct.

type RTArr = [[stride (16)]] array<vec4<f32>>;

[[stage(vertex)]]
fn main() -> void {
  var rt : RTArr;
}
