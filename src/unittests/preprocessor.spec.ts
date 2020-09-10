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
  t.test(pp``, '');
  t.test(pp`\n`, '');
  t.test(pp`\n\n`, '');
});

g.test('plain').fn(t => {
  t.test(pp`\na`, 'a');
  t.test(pp`\n\na`, 'a');
  t.test(pp`\na\n`, 'a');
  t.test(pp`\na\n\n`, 'a');
});

g.test('substitutions,1').fn(t => {
  const act = pp`
a ${3} b`;
  const exp = 'a 3 b';
  t.test(act, exp);
});

g.test('substitutions,2').fn(t => {
  const act = pp`
a ${'x'}`;
  const exp = 'a x';
  t.test(act, exp);
});

g.test('substitutions,3').fn(t => {
  const act = pp`
a ${'x'} b`;
  const exp = 'a x b';
  t.test(act, exp);
});

g.test('substitutions,4').fn(t => {
  const act = pp`
a
%if ${false}
${'x'}
%endif
b`;
  const exp = 'a\nb';
  t.test(act, exp);
});

g.test('if,true').fn(t => {
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

g.test('if,false').fn(t => {
  const act = pp`
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
%%if ${true}#comment
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
%if ${false}#comment
b
%else
h
%%if ${false} # c o m m e n t \n\
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
  pp`\n%if ${true}\n%endif\n`;
  pp`\n%if ${true}\n%else\n%endif\n`;
  pp`\n%if ${true}\n%%if ${true}\n%%endif\n%endif\n`;
  pp`\n%if ${true}\n%%if ${true}\n%%else\n%%else\n%%endif\n%endif\n`;
});

g.test('errors,fail').fn(t => {
  const e = (fn: () => void) => t.shouldThrow('Error', fn);
  e(() => pp`a`);
  e(() => pp`a\n`);
  e(() => pp`\n%if`);
  e(() => pp`\n%if `);
  e(() => pp`\n%if ${true}\n%endif`);
  e(() => pp`\n%if true\n%endif\n`);
  e(() => pp`\n%if \n%endif\n`);
  e(() => pp`\n%if \n${true}%endif\n`);
  e(() => pp`\n%if \n${1}%endif\n`);
  e(() => pp`\n%if true\n${true}\n%endif`);
  e(() => pp`\n%if true\n%endif\n${true}`);
  e(() => pp`\n%if \n${true}\n%endif`);
  e(() => pp`\n%if \n%endif\n${true}`);
  e(() => pp`\n%if${true}`);
  e(() => pp`\n%if ${true}`);
  e(() => pp`\n%if ${true}\n%else\n`);
  e(() => pp`\n%if ${true}\n%elif ${true}\n`);
  e(() => pp`\n%if ${true}\n%elif ${true}\n%else\n`);
  e(() => pp`\n%if ${true}\n%if ${true}\n%endif\n%endif\n`);
  e(() => pp`\n%endif\n`);
  e(() => pp`\n%endif\n%endif\n`);
  e(() => pp`\n%else\n%endif\n`);
  e(() => pp`\n%%if ${true}\n%%endif\n`);
  e(() => pp`\n%if ${true} ${3}\n%endif\n`);
  e(() => pp`\n%if ${true} # ${3}\n%endif\n`);
  e(() => pp`\n%if ${true}\n%endif ${3}\n`);
});
