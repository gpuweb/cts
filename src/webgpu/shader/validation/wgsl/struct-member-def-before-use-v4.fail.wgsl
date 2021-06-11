// v-0007 - Fails because struct `foo` does not have a member `c`however `f.c`
// is used.

struct foo {
  b : f32;
  a : array<f32>;
};

[[stage(vertex)]]
fn main() {
  var f : foo;
  f.c = 2;
  return;
}
