# Copyright 2020 Google LLC
#
# Licensed under the Apache License, Version 2.0 (the "License");
# you may not use this file except in compliance with the License.
# You may obtain a copy of the License at
#
#     http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing, software
# distributed under the License is distributed on an "AS IS" BASIS,
# WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
# See the License for the specific language governing permissions and
# limitations under the License.

# Fails because 'struct boo does not have a member t'.

type boo = struct {
  z : f32;
}

type goo = struct {
  y : boo;
}

type foo = struct {
  x : goo;
}

fn main() -> void {
  var f : foo;
  f.g = 1;
  f.x.y.t = 2.0;
  return;
}
entry_point vertex = main;
