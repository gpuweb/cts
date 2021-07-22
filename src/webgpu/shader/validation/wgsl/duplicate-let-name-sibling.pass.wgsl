// v-0014 - This passes because constant `a` is redeclared in a sibling scope.

[[stage(fragment)]]
fn main() {
  if (true) {
    let a = 1.;
  }
  if (true) {
    let a = 2.;
  }
  return;
}

