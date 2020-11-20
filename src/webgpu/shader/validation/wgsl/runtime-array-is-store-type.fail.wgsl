# v-0031 - This fails because the runtime array must not be the store type of variable 'buf'.

[[block]]
struct Foo {
  [[offset (0)]] a : [[stride (4)]] array<f32>;
};
[[set(0), binding(1)]] var<storage> buf: Foo;

[[stage(vertex)]]
fn main() -> void {
  return;
}
