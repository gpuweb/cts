# v-0012 - This fails because of the duplicated `foo` structure.

type foo = struct {
  [[offset (0)]] a : i32;
};

type foo = struct {
  [[offset (0)]] b : f32;
};

[[stage(vertex)]]
fn main() -> void {
  return;
}

