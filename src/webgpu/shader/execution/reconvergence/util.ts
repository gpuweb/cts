import { assert, unreachable } from '../../../../common/util/util.js';
import { PRNG } from '../../../util/prng.js';

/** @returns A bitmask where bits [0,size) are 1s. */
function getMask(size: number): bigint {
  return (1n << BigInt(size)) - 1n;
}

/** @returns A bitmask where submask is repeated every size bits for total bits. */
function getReplicatedMask(submask: bigint, size: number, total: number = 128): bigint {
  const reps = total / size;
  var mask: bigint = submask;
  for (var i = 1; i < reps; i++) {
    mask |= (mask << BigInt(size));
  }
  return mask;
}

/** @returns true if any bit in value is 1. */
function any(value: bigint): boolean {
  return value !== 0n;
}

/** @returns true if all bits in value from [0, size) are 1. */
function all(value: bigint, size: number): boolean {
  return value === ((1n << BigInt(size) - 1n));
}


export enum Style {
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
  type : OpType;
  value : number;
  caseValue : number;

  constructor(type : OpType, value: number = 0, caseValue: number = 0) {
    this.type = type;
    this.value = value;
    this.caseValue = caseValue;
  }
};

export class Program {
  private invocations: number;
  private readonly prng: PRNG;
  private ops : Op[];
  private readonly style: Style;
  private readonly minCount: number;
  private readonly maxNesting: number;
  private nesting: number;
  private loopNesting: number;
  private loopNestingThisFunction: number;
  private numMasks: number;
  private readonly masks: number[];
  private curFunc: number;
  private functions: string[];
  private indents: number[];
  private storeBase: number;

  /**
   * constructor
   *
   * @param style Enum indicating the type of reconvergence being tested
   * @param seed  Value used to seed the PRNG
   */
  constructor(style : Style = Style.Workgroup, seed: number = 1, invocations: number = 128) {
    this.invocations = invocations;
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
    this.storeBase = 0x10000;
  }

  /** @returns A random float between 0 and 1 */
  private getRandomFloat(): number {
    return this.prng.random();
  }

  /** @returns A random 32-bit integer between 0 and max. */
  private getRandomUint(max: number): number {
    return this.prng.randomU32() % max;
  }

  private pickOp(count : number) {
    for (var i = 0; i < count; i++) {
      //this.genBallot();
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

  private genBallot() {
		// Optionally insert ballots, stores, and noise.
    // Ballots and stores are used to determine correctness.
		if (this.getRandomFloat() < 0.2) {
      const cur_length = this.ops.length;
			if (cur_length < 2 ||
			   !(this.ops[cur_length - 1].type == OpType.OpBallot ||
				 (this.ops[cur_length-1].type == OpType.OpStore && this.ops[cur_length - 2].type == OpType.OpBallot))) {
        // Perform a store with each ballot so the results can be correlated.
				if (this.style != Style.Maximal)
					this.ops.push(new Op(OpType.OpStore, cur_length + this.storeBase));
				this.ops.push(new Op(OpType.OpBallot, 0));
			}
		}

		if (this.getRandomFloat() < 0.1) {
      const cur_length = this.ops.length;
			if (cur_length < 2 ||
			   !(this.ops[cur_length - 1].type == OpType.OpStore ||
				 (this.ops[cur_length - 1].type == OpType.OpBallot && this.ops[cur_length - 2].type == OpType.OpStore))) {
				// Subgroup and workgroup styles do a store with every ballot.
        // Don't bloat the code by adding more.
				if (this.style == Style.Maximal)
					this.ops.push(new Op(OpType.OpStore, cur_length + this.storeBase));
			}
		}

		//deUint32 r = this.getRandomUint(10000);
		//if (r < 3) {
		//	ops.push_back({OP_NOISE, 0});
    //} else if (r < 10) {
		//	ops.push_back({OP_NOISE, 1});
    //}
  }

  private genIf(type: IfType) {
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
          this.ops.push(new Op(op.type, op.value, op.caseValue));
        }
      } else {
        this.pickOp(2);
      }
    }
    this.ops.push(new Op(OpType.OpEndIf, 0));

    this.nesting--;
  }

  private genForUniform() {
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

  private genBreak() {
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

  private genContinue() {
    // TODO: need to avoid infinite loops
		if (this.loopNestingThisFunction > 0)
		{
			// Sometimes put the continue in a divergent if
			if (this.getRandomFloat() < 0.1) {
        const r = this.getRandomUint(this.numMasks-1) + 1;
        this.ops.push(new Op(OpType.OpIfMask, r));
        this.ops.push(new Op(OpType.OpContinue, 0));
        this.ops.push(new Op(OpType.OpElseMask, r));
        this.ops.push(new Op(OpType.OpBreak, 0));
        this.ops.push(new Op(OpType.OpEndIf, 0));
			} else {
				this.ops.push(new Op(OpType.OpContinue, 0));
      }
		}
  }

  private genCode(): string {
    for (var i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      this.genIndent()
      this.addCode(`// ops[${i}] = ${op.type}\n`);
      switch (op.type) {
        case OpType.OpBallot: {
          this.genIndent();
          this.addCode(`ballots[stride * output_loc + local_id] = subgroupBallot();\n`);
          this.genIndent();
          this.addCode(`output_loc++;\n`);
          break;
        }
        case OpType.OpStore: {
          this.genIndent();
          this.addCode(`locations[local_id]++;\n`);
          this.genIndent();
          this.addCode(`ballots[stride * output_loc + local_id] = vec4u(${op.value},0,0,0);\n`);
          this.genIndent();
          this.addCode(`output_loc++;\n`);
          break;
        }
        default: {
          this.genIndent();
          this.addCode(`/* missing op ${op.type} */\n`);
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
        case OpType.OpBreak: {
          this.genIndent();
          this.addCode(`continue;\n`);
          break;
        }
      }
    }

    let code: string = `
//enable chromium_experimental_subgroups;

const stride = ${this.invocations};

@group(0) @binding(0)
var<storage, read> inputs : array<u32>;
@group(0) @binding(1)
var<storage, read_write> ballots : array<vec4u>;
@group(0) @binding(2)
var<storage, read_write> locations : array<u32>;

var<private> subgroup_id : u32;
var<private> local_id : u32;
var<private> output_loc : u32 = 0;

@compute @workgroup_size(${this.invocations},1,1)
fn main(
  @builtin(local_invocation_index) lid : u32,
  //@builtin(subgroup_invocation_id) sid : u32,
) {
  _ = inputs[0];
  _ = ballots[0];
  subgroup_id = 0; // sid;
  local_id = lid;

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

    for (var i = 0; i < this.functions.length; i++) {
      code += `
fn f${i}() {
${this.functions[i]}
}
`;
    }
    return code;
  }

  private genIndent() {
    this.functions[this.curFunc] += ' '.repeat(this.indents[this.curFunc]);
  }
  private increaseIndent() {
    this.indents[this.curFunc] += 2;
  }
  private decreaseIndent() {
    this.indents[this.curFunc] -= 2;
  }
  private addCode(code: string) {
    this.functions[this.curFunc] += code;
  }

  public simulate(countOnly: boolean, size: number): number {
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

    var nesting = 0;
    var loopNesting = 0;
    var locs = new Array(this.invocations);
    locs.fill(0);

    var i = 0;
    while (i < this.ops.length) {
      const op = this.ops[i];
      console.log(`ops[${i}] = ${op.type}, nesting = ${nesting}`);
      console.log(`  mask = ${stack[nesting].activeMask.toString(16)}`);
      //for (var j = 0; j <= nesting; j++) {
      //  console.log(`  mask[${j}] = ${stack[j].activeMask.toString(16)}`);
      //}
      switch (op.type) {
        case OpType.OpBallot: {
          break;
        }
        case OpType.OpStore: {
          break;
        }
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
          cur.activeMask &= getReplicatedMask(getMask(op.value), size, this.invocations);
          break;
        }
        case OpType.OpElseLid: {
          const prev = stack[nesting-1];
          // All invocations with a subgroup invocation id greater or equal to op.value are active.
          stack[nesting].activeMask = prev.activeMask;
          stack[nesting].activeMask &= ~getReplicatedMask(getMask(op.value), size, this.invocations);
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
          cur.activeMask &= getReplicatedMask(BigInt(1 << stack[n].tripCount), size, this.invocations);
          break;
        }
        case OpType.OpElseLoopCount: {
          let n = nesting;
          while (!stack[n].isLoop) {
            n--;
          }

          stack[nesting].activeMask = stack[nesting-1].activeMask;
          stack[nesting].activeMask &= ~getReplicatedMask(BigInt(1 << stack[n].tripCount), size, this.invocations);
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
        case OpType.OpContinue: {
          var n = nesting;
          var mask: bigint = stack[nesting].activeMask;
          while (true) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isLoop) {
              stack[n].continueMask |= mask;
              break;
            }
            n--;
          }
          break;
        }
        default: {
          unreachable(`Unhandled op ${op.type}`);
        }
      }
      i++;
    }

    assert(stack.length == 1);

    var maxLoc = 0;
    for (var j = 0; j < this.invocations; j++) {
      maxLoc = Math.max(maxLoc, locs[j]);
    }
    return maxLoc;
  }

  // Returns an active mask for the mask at the given index.
  private getValueMask(idx: number): bigint {
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

  /** @returns a randomized program */
  public generate(): string {
    while (this.ops.length < this.minCount) {
      this.pickOp(1);
    }

    return this.genCode();
  }
};

export function generateSeeds(numCases: number): number[] {
  var prng: PRNG = new PRNG(1);
  var output: number[] = new Array(numCases);
  for (var i = 0; i < numCases; i++) {
    output[i] = prng.randomU32();
  }
  return output;
}
