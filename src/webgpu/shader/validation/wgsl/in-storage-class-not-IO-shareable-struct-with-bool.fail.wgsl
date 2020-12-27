# v-0038: A module scope variable in 'out' storage class must be IO-sharable.
# A struct type with a boolean element is not IO-shareable.

[[block]] 
struct S {
  [[offset(0)]] b : bool;
};

var<out> arr : S;

[[stage(vertex)]]
fn main() -> void {
}
