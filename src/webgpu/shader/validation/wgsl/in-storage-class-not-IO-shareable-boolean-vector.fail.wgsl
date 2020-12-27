# v-0038: A module scope variable in 'out' storage class must be IO-sharable.
# A vector type with boolean components is not IO-shareable.

var<out> particle : vec2<bool>;

[[stage(vertex)]]
fn main() -> void{
}
