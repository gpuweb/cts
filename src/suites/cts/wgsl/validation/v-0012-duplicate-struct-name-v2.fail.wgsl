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

# This fails because |struct Foo|, |fn Foo| and |var Foo| have the same name |Foo|.


type Foo = struct {
  b : f32;
};

fn Foo() ->void {
  return;
}

fn main() -> void {
  var Foo : f32;
  var f : Foo;
  return;
}
entry_point fragment = main;
