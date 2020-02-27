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

# Self recursion is dis-allowed and `c` calls itself.


fn d() -> i32 {
  return 2;
}

fn c() -> i32 {
  return c() + d();
}

fn b() -> i32 {
  return c();
}

fn a() -> i32 {
  return b();
}

fn main() -> void {
  var v : i32 = a();
  return;
}
entry_point vertex = main;

