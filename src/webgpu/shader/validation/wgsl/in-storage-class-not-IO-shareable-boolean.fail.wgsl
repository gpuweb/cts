# v-0038: A module scope variable in 'in' storage class must be IO-sharable.
# Boolean type is not IO-shareable.

var<in> particle : bool;

[[stage(vertex)]]
fn main() -> void{
}
