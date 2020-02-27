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

# Fails because struct `foo` does not have a member `b`however `f.b` is used.

type goo = struct {
  b : f32;
}

type foo = struct {
  a : f32;
}

fn main() -> void {
  var f : foo;
  f.a = 2.0;
  f.b = 5.0;
  return;
}
entry_point vertex = main;
