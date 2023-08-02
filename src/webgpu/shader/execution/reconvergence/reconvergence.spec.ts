export const description = `Experimental reconvergence tests based on the Vulkan reconvergence tests at:
https://github.com/KhronosGroup/VK-GL-CTS/blob/main/external/vulkancts/modules/vulkan/reconvergence/vktReconvergenceTests.cpp`;

import { makeTestGroup } from '../../../../common/framework/test_group.js';
import { GPUTest } from '../../../gpu_test.js';
import { assert, unreachable } from '../../../../common/util/util.js';
import { PRNG } from '../../../util/prng.js';

export const g = makeTestGroup(GPUTest);

// Returns a bitmask where bits [0,size) are 1s.
function getMask(size: number): bigint {
  return (1n << BigInt(size)) - 1n;
}

// Returns a bitmask where submask is repeated every size bits for total bits.
function getReplicatedMask(submask: bigint, size: number, total: number = 128): bigint {
  const reps = total / size;
  var mask: bigint = submask;
  for (var i = 1; i < reps; i++) {
    mask |= (mask << BigInt(size));
  }
  return mask;
}

function any(value: bigint): boolean {
  return value !== 0n;
}

function all(value: bigint, stride: number): boolean {
  return value === ((1n << BigInt(stride) - 1n));
}

enum Style {
  Workgroup,
  Subgroup,
  Maximal,
};

enum OpType {
  OpBallot,

  OpStore,

  OpIfMask,
  OpElseMask,
  OpEndIf,

  OpIfLoopCount,
  OpElseLoopCount,

  OpIfLid,
  OpElseLid,

  OpBreak,
  OpContinue,

  OpForUniform,
  OpEndForUniform,

  OpReturn,

  OpMAX,
}

enum IfType {
  IfMask,
  IfUniform,
  IfLoopCount,
  IfLid,
};

class Op {
  op : OpType;
  value : number;
  caseValue : number;

  constructor(op : OpType, value: number = 0, caseValue: number = 0) {
    this.op = op;
    this.value = value;
    this.caseValue = caseValue;
  }
};

class Program {
  prng: PRNG;
  ops : Op[];
  style: Style;
  minCount: number;
  maxNesting: number;
  nesting: number;
  loopNesting: number;
  loopNestingThisFunction: number;
  numMasks: number;
  masks: number[];
  curFunc: number;
  functions: string[];
  indents: number[];

  constructor(style : Style = Style.Workgroup, seed: number = 1) {
    this.prng = new PRNG(seed);
    this.ops = [];
    this.style = style;
    this.minCount = 5; // 30;
    this.maxNesting = 5; // this.getRandomUint(70) + 30; // [30,100)
    this.nesting = 0;
    this.loopNesting = 0;
    this.loopNestingThisFunction = 0;
    this.numMasks = 10;
    this.masks = [];
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    for (var i = 1; i < this.numMasks; i++) {
      this.masks.push(this.getRandomUint(0xffffffff));
      this.masks.push(this.getRandomUint(0xffffffff));
      this.masks.push(this.getRandomUint(0xffffffff));
      this.masks.push(this.getRandomUint(0xffffffff));
    }
    this.curFunc = 0;
    this.functions = [];
    this.functions.push(``);
    this.indents = [];
    this.indents.push(2);
  }

  getRandomFloat(): number {
    return this.prng.random();
  }

  getRandomUint(max: number): number {
    return this.prng.randomU32() % max;
  }

  pickOp(count : number) {
    for (var i = 0; i < count; i++) {
      //optBallot();
      if (this.nesting < this.maxNesting) {
        const r = this.getRandomUint(12);
        switch (r) {
          case 0: {
            if (this.loopNesting > 0) {
              this.genIf(IfType.IfLoopCount);
              break;
            }
            this.genIf(IfType.IfLid);
            break;
          }
          case 1: {
            this.genIf(IfType.IfLid);
            break;
          }
          case 2: {
            this.genIf(IfType.IfMask);
            break;
          }
          case 3: {
            this.genIf(IfType.IfUniform);
            break;
          }
          case 4: {
            if (this.loopNesting <= 3) {
              const r2 = this.getRandomUint(3);
              switch (r2) {
                case 0: this.genForUniform(); break;
                case 2:
                default: {
                  break;
                }
              }
            }
            break;
          }
          case 5: {
            this.genBreak();
            break;
          }
          case 6: {
            this.genContinue();
            break;
          }
          default: {
            break;
          }
        }
      }
    }
  }

  genIf(type: IfType) {
    let maskIdx = this.getRandomUint(this.numMasks);
    if (type == IfType.IfUniform)
      maskIdx = 0;

    const lid = this.getRandomUint(128);
    if (type == IfType.IfLid) {
      this.ops.push(new Op(OpType.OpIfLid, lid));
    } else if (type == IfType.IfLoopCount) {
      this.ops.push(new Op(OpType.OpIfLoopCount, 0));
    } else {
      this.ops.push(new Op(OpType.OpIfMask, maskIdx));
    }

    this.nesting++;

    let beforeSize = this.ops.length;
    this.pickOp(2);
    let afterSize = this.ops.length;

    const randElse = this.getRandomFloat();
    if (randElse < 0.5) {
      if (type == IfType.IfLid) {
        this.ops.push(new Op(OpType.OpElseLid, lid));
      } else if (type == IfType.IfLoopCount) {
        this.ops.push(new Op(OpType.OpElseLoopCount, 0));
      } else {
        this.ops.push(new Op(OpType.OpElseMask, maskIdx));
      }

      // Sometimes make the else identical to the if.
      if (randElse < 0.1 && beforeSize != afterSize) {
        for (var i = beforeSize; i < afterSize; i++) {
          const op = this.ops[i];
          this.ops.push(new Op(op.op, op.value, op.caseValue));
        }
      } else {
        this.pickOp(2);
      }
    }
    this.ops.push(new Op(OpType.OpEndIf, 0));

    this.nesting--;
  }

  genForUniform() {
    const n = this.getRandomUint(5) + 1; // [1, 5]
    this.ops.push(new Op(OpType.OpForUniform, n));
    const header = this.ops.length - 1;
    this.nesting++;
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.pickOp(2);
    this.ops.push(new Op(OpType.OpEndForUniform, header));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  genBreak() {
		if (this.loopNestingThisFunction > 0)
		{
			// Sometimes put the break in a divergent if
			if (this.getRandomFloat() < 0.1) {
        const r = this.getRandomUint(this.numMasks-1) + 1;
        this.ops.push(new Op(OpType.OpIfMask, r));
        this.ops.push(new Op(OpType.OpBreak, 0));
        this.ops.push(new Op(OpType.OpElseMask, r));
        this.ops.push(new Op(OpType.OpBreak, 0));
        this.ops.push(new Op(OpType.OpEndIf, 0));
			} else {
				this.ops.push(new Op(OpType.OpBreak, 0));
      }
		}
  }

  genContinue() {
  }

  genCode(): string {
    for (var i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      this.genIndent()
      this.addCode(`// ops[${i}] = ${op.op}\n`);
      switch (op.op) {
        //case OpType.OpBallot: {
        //  break;
        //}
        //case OpType.OpStore: {
        //  break;
        //}
        default: {
          this.genIndent();
          this.addCode(`/* missing op ${op.op} */\n`);
          break;
        }
        case OpType.OpIfMask: {
          this.genIndent();
          if (op.value == 0) {
            const idx = this.getRandomUint(4);
            this.addCode(`if inputs[${idx}] == ${idx} {\n`);
          } else {
            const idx = op.value;
            const x = this.masks[4*idx];
            const y = this.masks[4*idx+1];
            const z = this.masks[4*idx+2];
            const w = this.masks[4*idx+3];
            this.addCode(`if testBit(vec4u(${x},${y},${z},${w}), subgroup_id) {\n`);
          }
          this.increaseIndent();
          break;
        }
        case OpType.OpIfLid: {
          this.genIndent();
          this.addCode(`if subgroup_id < inputs[${op.value}] {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.OpIfLoopCount: {
          this.genIndent();
          this.addCode(`if subgroup_id == i${this.loopNesting-1} {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.OpElseMask:
        case OpType.OpElseLid:
        case OpType.OpElseLoopCount: {
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`} else {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.OpEndIf: {
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`}\n`);
          break;
        }
        case OpType.OpForUniform: {
          this.genIndent();
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; ${iter} < inputs[${op.value}]; ${iter}++) {\n`);
          this.increaseIndent();
          this.loopNesting++;
          break;
        }
        case OpType.OpEndForUniform: {
          this.loopNesting--;
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`}\n`);
          break;
        }
        case OpType.OpBreak: {
          this.genIndent();
          this.addCode(`break;\n`);
          break;
        }
      }
    }

    let code = ``;
    for (var i = 0; i < this.functions.length; i++) {
      code += `
fn f${i}() {
${this.functions[i]}
}
`;
    }
    return code;
  }

  genIndent() {
    this.functions[this.curFunc] += ' '.repeat(this.indents[this.curFunc]);
  }
  increaseIndent() {
    this.indents[this.curFunc] += 2;
  }
  decreaseIndent() {
    this.indents[this.curFunc] -= 2;
  }
  addCode(code: string) {
    this.functions[this.curFunc] += code;
  }

  simulate(countOnly: boolean, size: number, stride: number = 128): number {
    class State {
      activeMask: bigint;
      continueMask: bigint;
      header: number;
      isLoop: boolean;
      tripCount: number;
      isCall: boolean;
      isSwitch: boolean;

      constructor() {
        this.activeMask = 0n;
        this.continueMask = 0n;
        this.header = 0;
        this.isLoop = false;
        this.tripCount = 0;
        this.isCall = false;
        this.isSwitch = false;
      }

      copy(other: State) {
        this.activeMask = other.activeMask;
        this.continueMask = other.continueMask;
        this.header = other.header;
        this.isLoop = other.isLoop;
        this.tripCount = other.tripCount;
        this.isCall = other.isCall;
        this.isSwitch = other.isSwitch;
      }
    };
    var stack = new Array();
    stack.push(new State());
    stack[0].activeMask = (1n << 128n) - 1n;
    //for (var i = 0; i < 10; i++) {
    //  stack[i] = new State();
    //}
    //stack[0].activeMask = (1n << 128n) - 1n;

    var nesting = 0;
    var loopNesting = 0;
    var locs = new Array(stride);
    locs.fill(0);

    var i = 0;
    while (i < this.ops.length) {
      const op = this.ops[i];
      console.log(`ops[${i}] = ${op.op}, nesting = ${nesting}`);
      console.log(`  mask = ${stack[nesting].activeMask.toString(16)}`);
      //for (var j = 0; j <= nesting; j++) {
      //  console.log(`  mask[${j}] = ${stack[j].activeMask.toString(16)}`);
      //}
      switch (op.op) {
        case OpType.OpIfMask: {
          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          // O is always uniform true.
          if (op.value != 0) {
            cur.activeMask &= this.getValueMask(op.value);
          }
          break;
        }
        case OpType.OpElseMask: {
          // 0 is always uniform true so the else will never be taken.
          const cur = stack[nesting];
          if (op.value == 0) {
            cur.activeMask = 0n;
          } else {
            const prev = stack[nesting-1];
            cur.activeMask = prev.activeMask & ~this.getValueMask(op.value);
          }
          break;
        }
        case OpType.OpIfLid: {
          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          // All invocations with subgroup invocation id less than op.value are active.
          cur.activeMask &= getReplicatedMask(getMask(op.value), size, stride);
          break;
        }
        case OpType.OpElseLid: {
          const prev = stack[nesting-1];
          // All invocations with a subgroup invocation id greater or equal to op.value are active.
          stack[nesting].activeMask = prev.activeMask;
          stack[nesting].activeMask &= ~getReplicatedMask(getMask(op.value), size, stride);
          break;
        }
        case OpType.OpIfLoopCount: {
          let n = nesting;
          while (!stack[n].isLoop) {
            n--;
          }

          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          cur.isLoop = 0;
          cur.isSwitch = 0;
          cur.activeMask &= getReplicatedMask(BigInt(1 << stack[n].tripCount), size, stride);
          break;
        }
        case OpType.OpElseLoopCount: {
          let n = nesting;
          while (!stack[n].isLoop) {
            n--;
          }

          stack[nesting].activeMask = stack[nesting-1].activeMask;
          stack[nesting].activeMask &= ~getReplicatedMask(BigInt(1 << stack[n].tripCount), size, stride);
					break;
        }
        case OpType.OpEndIf: {
          nesting--;
          stack.pop();
          break;
        }
        case OpType.OpForUniform: {
          nesting++;
				  loopNesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.header = i;
          cur.isLoop = true;
          cur.activeMask = stack[nesting-1].activeMask;
          break;
        }
        case OpType.OpEndForUniform: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= stack[nesting].continueMask;
          cur.continueMask = 0n;
          // Loop if there are any invocations left with iterations to perform.
          if (cur.tripCount < this.ops[cur.header].value &&
              any(cur.activeMask)) {
            i = cur.header + 1;
            continue;
          } else {
            loopNesting--;
            nesting--;
            stack.pop();
          }
          break;
        }
        case OpType.OpBreak: {
          var n = nesting;
          var mask: bigint = stack[nesting].activeMask;
          while (true) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isLoop || stack[n].isSwitch) {
              break;
            }

            n--;
          }
          break;
        }
        default: {
          unreachable(`Unhandled op ${op.op}`);
        }
      }
      i++;
    }

    assert(stack.length == 1);

    var maxLoc = 0;
    for (var j = 0; j < stride; j++) {
      maxLoc = Math.max(maxLoc, locs[j]);
    }
    return maxLoc;
  }

  // Returns an active mask for the mask at the given index.
  getValueMask(idx: number): bigint {
    const x = this.masks[4*idx];
    const y = this.masks[4*idx+1];
    const z = this.masks[4*idx+2];
    const w = this.masks[4*idx+3];
    var mask: bigint = 0n;
    mask |= BigInt(x);
    mask |= BigInt(y) << 32n;
    mask |= BigInt(z) << 64n;
    mask |= BigInt(w) << 96n;
    return mask;
  }
};

function generateProgram(program: Program): string {
  while (program.ops.length < program.minCount) {
    program.pickOp(1);
  }

  return program.genCode();
};

function generateSeeds(numCases: number): number[] {
  var prng: PRNG = new PRNG(1);
  var output: number[] = new Array(numCases);
  for (var i = 0; i < numCases; i++) {
    output[i] = prng.randomU32();
  }
  return output;
}

g.test('reconvergence')
  .desc(`Test reconvergence`)
  .params(u =>
    u
      .combine('style', [Style.Workgroup, Style.Subgroup, Style.Maximal] as const)
      .combine('seed', generateSeeds(5))
      .filter(u => {
        if (u.style == Style.Workgroup) {
          return true;
        }
        return false;
      })
      .beginSubcases()
  )
  .fn(t => {
    const invocations = 128; // t.device.limits.maxSubgroupSize;

    let wgsl = `
//enable chromium_experimental_subgroups;

const stride = ${invocations};

@group(0) @binding(0)
var<storage, read> inputs : array<u32>;
@group(0) @binding(1)
var<storage, read_write> ballots : array<vec4u>;

var<private> subgroup_id : u32;

@compute @workgroup_size(${invocations},1,1)
fn main(
  //@builtin(local_invocation_index) id : u32,
) {
  _ = inputs[0];
  _ = ballots[0];
  subgroup_id = 0; // id;

  f0();
}

fn testBit(mask : vec4u, id : u32) -> bool {
  let xbit = extractBits(mask.x, id, 1);
  let ybit = extractBits(mask.y, id - 32, 1);
  let zbit = extractBits(mask.z, id - 64, 1);
  let wbit = extractBits(mask.w, id - 96, 1);
  let lt32 = id < 32;
  let lt64 = id < 64;
  let lt96 = id < 96;
  let sela = select(wbit, xbit, lt96);
  let selb = select(zbit, ybit, lt64);
  return select(selb, sela, lt32) == 1;
}
`;

    let program : Program = new Program(t.params.style, t.params.seed);
    wgsl += generateProgram(program);
    console.log(wgsl);

    const num = program.simulate(true, 16, invocations);

    const pipeline = t.device.createComputePipeline({
      layout: 'auto',
      compute: {
        module: t.device.createShaderModule({
          code: wgsl,
        }),
        entryPoint: 'main',
      },
    });

    //// Helper to create a `size`-byte buffer with binding number `binding`.
    //function createBuffer(size: number, binding: number) {
    //  const buffer = t.device.createBuffer({
    //    size,
    //    usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC,
    //  });
    //  t.trackForCleanup(buffer);

    //  bindGroupEntries.push({
    //    binding,
    //    resource: {
    //      buffer,
    //    },
    //  });

    //  return buffer;
    //}

    //const bindGroupEntries: GPUBindGroupEntry[] = [];
    //const inputBuffer = createBuffer(16, 0);
    //const ballotBuffer = createBuffer(16, 1);

    //const bindGroup = t.device.createBindGroup({
    //  layout: pipeline.getBindGroupLayout(0),
    //  entries: bindGroupEntries,
    //});

    //const encoder = t.device.createCommandEncoder();
    //const pass = encoder.beginComputePass();
    //pass.setPipeline(pipeline);
    //pass.setBindGroup(0, bindGroup);
    //pass.dispatchWorkgroups(1,1,1);
    //pass.end();
    //t.queue.submit([encoder.finish()]);
  });
