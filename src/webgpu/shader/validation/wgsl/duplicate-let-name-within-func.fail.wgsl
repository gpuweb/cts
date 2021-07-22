// v-0014 - This fails because constant `a` is redeclared.

[[stage(fragment)]]
fn main() {
  let a = 1u;
  if (true) {
    let a = 2u;
  }
  return;
}

