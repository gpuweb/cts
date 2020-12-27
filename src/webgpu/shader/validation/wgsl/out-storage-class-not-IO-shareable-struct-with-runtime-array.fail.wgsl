# v-0038: A module scope variable in 'out' storage class must be IO-sharable.
# A struct type with a runtime array element is not IO-shareable.

type RTArr = [[stride (16)]] array<vec4<f32>>;
[[block]] 
struct S {
  [[offset(0)]] b : f32;
  [[offset(4)]] data : RTArr;
};

var<out> arr : S;

[[stage(vertex)]]
fn main() -> void {
}
