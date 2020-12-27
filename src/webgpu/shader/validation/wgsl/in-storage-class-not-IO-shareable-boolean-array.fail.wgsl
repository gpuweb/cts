# v-0038: A module scope variable in 'out' storage class must be IO-sharable.
# An array type with boolean elements is not IO-shareable.

var<out> particle : array<bool, 4>;

[[stage(vertex)]]
fn main() -> void{
}
