export const description = `
Test for "pp" preprocessor.
`;

import { pp } from '../common/framework/preprocessor.js';
import { makeTestGroup } from '../common/framework/test_group.js';

import { UnitTest } from './unit_test.js';

class F extends UnitTest {
  test(act: string, exp: string): void {
    this.expect(act === exp, 'got: ' + act.replace('\n', '⏎'));
  }
}

export const g = makeTestGroup(F);

g.test('empty').fn(t => {
  const act = pp``;
  const exp = '';
  t.test(act, exp);
});

g.test('basic,true').fn(t => {
  const act = pp`
a
%if ${true} #comment
c
%endif
d
`;
  const exp = 'a\nc\nd';
  t.test(act, exp);
});

g.test('basic,false').fn(t => {
  const act = pp`#start-of-file comment
a
%if ${false} #end-of-directive comment
c
%endif
d
`;
  const exp = 'a\nd';
  t.test(act, exp);
});

g.test('else,1').fn(t => {
  const act = pp`
a
%if ${true} # comment
b
%else
c
%endif
d
`;
  const exp = 'a\nb\nd';
  t.test(act, exp);
});

g.test('else,2').fn(t => {
  const act = pp`
a
%if ${false} #comment
b
%else
c
%endif
d
`;
  const exp = 'a\nc\nd';
  t.test(act, exp);
});

g.test('else,3').fn(t => {
  const act = pp`
a
%if ${false} #comment
b
%else
c
%else
e
%endif
d
`;
  const exp = 'a\nc\nd';
  t.test(act, exp);
});

g.test('elif,1').fn(t => {
  const act = pp`
a
%if ${false} #comment
b
%elif ${true} #comment
e
%else #comment
c
%endif #comment
d
`;
  const exp = 'a\ne\nd';
  t.test(act, exp);
});

g.test('elif,2').fn(t => {
  const act = pp`
a
%if ${true} #comment
b
%elif ${true} #comment
e
%else #comment
c
%endif #comment
d
`;
  const exp = 'a\nb\nd';
  t.test(act, exp);
});

g.test('nested,1').fn(t => {
  const act = pp`
a
%if ${false} #comment
b
%%if ${true} #comment
e
%%endif
c
%endif #comment
d
`;
  const exp = 'a\nd';
  t.test(act, exp);
});

g.test('nested,2').fn(t => {
  const act = pp`
a
%if ${false} #comment
b
%else
h
%%if ${false} #comment
e
%%elif ${true}
f
%%else
g
%%endif
c
%endif #comment
d
`;
  const exp = 'a\nh\nf\nc\nd';
  t.test(act, exp);
});

g.test('errors,pass').fn(() => {
  pp`\n%if ${true}\n%endif`;
  pp`\n%if ${true}\n%endif\n`;
  pp`\n%if ${true}\n%else\n%endif\n`;
  pp`\n%if ${true}\n%%if ${true}\n%%endif\n%endif`;
  pp`\n%if ${true}\n%%if ${true}\n%%else\n%%else\n%%endif\n%endif`;
});

g.test('errors,fail').fn(t => {
  const e = (fn: () => void) => t.shouldThrow('Error', fn);
  e(() => pp`\n%if`);
  e(() => pp`\n%if `);
  e(() => pp`\n%if true\n%endif`);
  e(() => pp`\n%if true\n${true}\n%endif`);
  e(() => pp`\n%if true\n%endif\n${true}`);
  e(() => pp`\n%if \n${true}\n%endif`);
  e(() => pp`\n%if \n%endif\n${true}`);
  e(() => pp`\n%if${true}`);
  e(() => pp`\n%if ${true}`);
  e(() => pp`\n%if ${true}\n%else`);
  e(() => pp`\n%if ${true}\n%elif ${true}`);
  e(() => pp`\n%if ${true}\n%elif ${true}\n%else`);
  e(() => pp`\n%if ${true}\n%if ${true}\n%endif\n%endif`);
  e(() => pp`\n%endif\n`);
  e(() => pp`\n%endif\n%endif\n`);
  e(() => pp`\n%else\n%endif\n`);
  e(() => pp`\n%%if ${true}\n%%endif`);
});
