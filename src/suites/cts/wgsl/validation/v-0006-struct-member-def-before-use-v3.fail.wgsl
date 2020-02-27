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

# This fails because |fn Foo()| returns |struct goo|, which does not have a member |s.z|.

type goo = struct {
  s : vec2<i32>;
}

fn Foo() -> type goo {
  var a : type goo;
  a.s.x = 2;
  a.s.y = 3;
  return a;
}

fn main() -> void {
  var r : i32 = Foo().s.z;
  return;
}
entry_point fragment = main;
