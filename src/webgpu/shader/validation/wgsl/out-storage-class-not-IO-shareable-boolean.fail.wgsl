# v-0038: A module scope variable in 'out' storage class must be IO-sharable.
# Boolean type is not IO-shareable.

var<out> particle : bool;

[[stage(vertex)]]
fn main() -> void{
}
