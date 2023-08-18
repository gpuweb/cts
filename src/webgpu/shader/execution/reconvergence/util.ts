import { assert, unreachable } from '../../../../common/util/util.js';
import { PRNG } from '../../../util/prng.js';

export function hex(n: number): string {
  return n.toString(16);
}

/** @returns A bitmask where bits [0,size) are 1s. */
function getMask(size: number): bigint {
  return (1n << BigInt(size)) - 1n;
}

/** @returns A bitmask where submask is repeated every size bits for total bits. */
function getReplicatedMask(submask: bigint, size: number, total: number = 128): bigint {
  const reps = Math.floor(total / size);
  let mask: bigint = submask;
  for (let i = 1; i < reps; i++) {
    mask |= (mask << BigInt(size));
  }
  return mask;
}

/** @returns a mask with only the least significant 1 in |value| set for each subgroup. */
function getElectMask(value: bigint, size: number, total: number = 128): bigint {
  let mask = value;
  let count = 0;
  while (!(mask & 1n)) {
    mask >>= 1n;
    count++;
  }
  mask = value & (1n << BigInt(count));
  return getReplicatedMask(mask, size, total);
}

/**
 * Produce the subgroup mask for local invocation |id| within |fullMask|
 *
 * @param fullMask The active mask for the full workgroup
 * @param size     The subgroup size
 * @param id       The local invocation index
 *
 * @returns A Uint32Array with 4 elements containing the subgroup mask.
 */
function getSubgroupMask(fullMask: bigint, size: number, id: number = 0): Uint32Array {
  const arr: Uint32Array = new Uint32Array(4);
  const subgroup_id: number = Math.floor(id / size);
  const shift: number = subgroup_id * size;
  let mask: bigint = (fullMask >> BigInt(shift)) & getMask(size);
  arr[0] = Number(BigInt.asUintN(32, mask));
  arr[1] = Number(BigInt.asUintN(32, mask >> 32n));
  arr[2] = Number(BigInt.asUintN(32, mask >> 64n));
  arr[3] = Number(BigInt.asUintN(32, mask >> 96n));
  return arr;
}

/** @returns true if bit |bit| is set to 1. */
function testBit(mask: bigint, bit: number): boolean {
  return ((mask >> BigInt(bit)) & 0x1n) == 1n;
}

/** @returns true if any bit in value is 1. */
function any(value: bigint): boolean {
  return value !== 0n;
}

/** @returns true if all bits in value from [0, size) are 1. */
function all(value: bigint, size: number): boolean {
  return value === ((1n << BigInt(size)) - 1n);
}

export enum Style {
  // Workgroup uniform control flow
  Workgroup,

  // Subgroup uniform control flow
  Subgroup,

  // Maximal uniformity
  Maximal,
};

enum OpType {
  // Store a ballot.
  // During simulation, uniform is set to false if the
  // ballot is not fully uniform for the given style.
  Ballot,

  // Store a literal.
  Store,

  // if (testBit(mask, subgroup_id))
  // Special case if value == 0: if (inputs[idx] == idx)
  IfMask,
  ElseMask,
  EndIf,

  // Conditional based on loop iteration
  // if (subgroup_id == iN)
  IfLoopCount,
  ElseLoopCount,

  // if (subgroup_id < inputs[value])
  IfId,
  ElseId,

  // Break/continue
  Break,
  Continue,

  // for (var i = 0u; i < inputs[value]; i++)
  ForUniform,
  EndForUniform,

  // Equivalent to:
  // for (var i = 0u; ; i++, ballot)
  // Always includes an "elect"-based break in the loop.
  ForInf,
  EndForInf,

  // Equivalent to:
  // for (var i = 0u; i < subgroup_invocation_id + 1; i++)
  ForVar,
  EndForVar,

  // Function return
  Return,

  // Emulated elect for breaks from infinite loops.
  Elect,

  MAX,
}

function serializeOpType(op: OpType): string {
  // prettier-ignore
  switch (op) {
    case OpType.Ballot:        return 'Ballot';
    case OpType.Store:         return 'Store';
    case OpType.IfMask:        return 'IfMask';
    case OpType.ElseMask:      return 'ElseMask';
    case OpType.EndIf:         return 'EndIf';
    case OpType.IfLoopCount:   return 'IfLoopCount';
    case OpType.ElseLoopCount: return 'ElseLoopCount';
    case OpType.IfId:          return 'IfId';
    case OpType.ElseId:        return 'ElseId';
    case OpType.Break:         return 'Break';
    case OpType.Continue:      return 'Continue';
    case OpType.ForUniform:    return 'ForUniform';
    case OpType.EndForUniform: return 'EndForUniform';
    case OpType.ForInf:        return 'ForInf';
    case OpType.EndForInf:     return 'EndForInf';
    case OpType.ForVar:        return 'ForVar';
    case OpType.EndForVar:     return 'EndForVar';
    case OpType.Return:        return 'Return';
    case OpType.Elect:         return 'Elect';
    default:
      unreachable('Unhandled op');
      break;
  }
  return '';
}

enum IfType {
  Mask,
  Uniform,
  LoopCount,
  Lid,
};

/**
 * Operation in a Program.
 *
 * Includes the type of operations, an operation specific value and whether or
 * not the operation is uniform.
 */
class Op {
  type : OpType;
  value : number;
  uniform : boolean;

  constructor(type : OpType, value: number = 0, uniform: boolean = true) {
    this.type = type;
    this.value = value;
    this.uniform = uniform;
  }
};

export class Program {
  public invocations: number;
  private readonly prng: PRNG;
  private ops : Op[];
  public readonly style: Style;
  private readonly minCount: number;
  private readonly maxNesting: number;
  private nesting: number;
  private loopNesting: number;
  private loopNestingThisFunction: number;
  private callNesting: number;
  private numMasks: number;
  private masks: number[];
  private curFunc: number;
  private functions: string[];
  private indents: number[];
  private readonly storeBase: number;
  public refData: Uint32Array;
  private isLoopInf: Map<number, boolean>;
  private doneInfLoopBreak: Map<number, boolean>;

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
    this.minCount = 30;
    this.maxNesting = this.getRandomUint(40) + 20; //this.getRandomUint(70) + 30; // [30,100)
    this.nesting = 0;
    this.loopNesting = 0;
    this.loopNestingThisFunction = 0;
    this.callNesting = 0;
    this.numMasks = 10;
    this.masks = [];
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    this.masks.push(0xffffffff);
    for (let i = 1; i < this.numMasks; i++) {
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
    this.refData = new Uint32Array();
    this.isLoopInf = new Map();
    this.doneInfLoopBreak = new Map();
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
    for (let i = 0; i < count; i++) {
      this.genBallot();
      if (this.nesting < this.maxNesting) {
        const r = this.getRandomUint(12);
        switch (r) {
          case 0: {
            if (this.loopNesting > 0) {
              this.genIf(IfType.LoopCount);
              break;
            }
            this.genIf(IfType.Lid);
            break;
          }
          case 1: {
            this.genIf(IfType.Lid);
            break;
          }
          case 2: {
            this.genIf(IfType.Mask);
            break;
          }
          case 3: {
            this.genIf(IfType.Uniform);
            break;
          }
          case 4: {
            // Avoid very deep loop nests to limit memory and runtime.
            if (this.loopNesting <= 2) {
              const r2 = this.getRandomUint(3);
              switch (r2) {
                case 0: this.genForUniform(); break;
                case 1: this.genForInf(); break;
                case 2: this.genForVar(); break;
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
          case 7: {
            // Calls and returns.
            // TODO: calls
            this.genReturn();
            break;
          }
          default: {
            break;
          }
        }
      }
      this.genBallot();
    }
  }

  private genBallot() {
    // Optionally insert ballots, stores, and noise.
    // Ballots and stores are used to determine correctness.
    if (this.getRandomFloat() < 0.2) {
      const cur_length = this.ops.length;
      if (cur_length < 2 ||
         !(this.ops[cur_length - 1].type == OpType.Ballot ||
         (this.ops[cur_length-1].type == OpType.Store && this.ops[cur_length - 2].type == OpType.Ballot))) {
        // Perform a store with each ballot so the results can be correlated.
        //if (this.style != Style.Maximal)
          this.ops.push(new Op(OpType.Store, cur_length + this.storeBase));
        this.ops.push(new Op(OpType.Ballot, 0));
      }
    }

    if (this.getRandomFloat() < 0.1) {
      const cur_length = this.ops.length;
      if (cur_length < 2 ||
         !(this.ops[cur_length - 1].type == OpType.Store ||
         (this.ops[cur_length - 1].type == OpType.Ballot && this.ops[cur_length - 2].type == OpType.Store))) {
        // Subgroup and workgroup styles do a store with every ballot.
        // Don't bloat the code by adding more.
        if (this.style == Style.Maximal)
          this.ops.push(new Op(OpType.Store, cur_length + this.storeBase));
      }
    }

    //deUint32 r = this.getRandomUint(10000);
    //if (r < 3) {
    //  ops.push_back({OP_NOISE, 0});
    //} else if (r < 10) {
    //  ops.push_back({OP_NOISE, 1});
    //}
  }

  private genIf(type: IfType) {
    let maskIdx = this.getRandomUint(this.numMasks);
    if (type == IfType.Uniform)
      maskIdx = 0;

    const lid = this.getRandomUint(128);
    if (type == IfType.Lid) {
      this.ops.push(new Op(OpType.IfId, lid));
    } else if (type == IfType.LoopCount) {
      this.ops.push(new Op(OpType.IfLoopCount, 0));
    } else {
      this.ops.push(new Op(OpType.IfMask, maskIdx));
    }

    this.nesting++;

    let beforeSize = this.ops.length;
    this.pickOp(2);
    let afterSize = this.ops.length;

    const randElse = this.getRandomFloat();
    if (randElse < 0.5) {
      if (type == IfType.Lid) {
        this.ops.push(new Op(OpType.ElseId, lid));
      } else if (type == IfType.LoopCount) {
        this.ops.push(new Op(OpType.ElseLoopCount, 0));
      } else {
        this.ops.push(new Op(OpType.ElseMask, maskIdx));
      }

      // Sometimes make the else identical to the if.
      if (randElse < 0.1 && beforeSize != afterSize) {
        for (let i = beforeSize; i < afterSize; i++) {
          const op = this.ops[i];
          this.ops.push(new Op(op.type, op.value, op.uniform));
        }
      } else {
        this.pickOp(2);
      }
    }
    this.ops.push(new Op(OpType.EndIf, 0));

    this.nesting--;
  }

  private genForUniform() {
    const n = this.getRandomUint(5) + 1; // [1, 5]
    const header = this.ops.length;
    this.ops.push(new Op(OpType.ForUniform, n));
    this.nesting++;
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.pickOp(2);
    this.ops.push(new Op(OpType.EndForUniform, header));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  private genForInf() {
    const header = this.ops.length;
    this.ops.push(new Op(OpType.ForInf, 0));
    this.nesting++;
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.isLoopInf.set(this.loopNesting, true);
    this.doneInfLoopBreak.set(this.loopNesting, false);

    this.pickOp(2);

    this.genElect(true);
    this.doneInfLoopBreak.set(this.loopNesting, true);

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndForInf, header));
    this.isLoopInf.set(this.loopNesting, false);
    this.doneInfLoopBreak.set(this.loopNesting, false);
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  private genForVar() {
    const header = this.ops.length;
    this.ops.push(new Op(OpType.ForVar, 0));
    this.nesting++;
    this.loopNesting++;
    this.loopNestingThisFunction++;

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndForVar, header));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  private genElect(forceBreak: boolean) {
    this.ops.push(new Op(OpType.Elect, 0));
    this.nesting++;

    if (forceBreak) {
      this.genBallot();
      this.genBallot();
      if (this.getRandomFloat() < 0.1) {
        this.pickOp(1);
      }

      // Sometimes use a return if we're in a call.
      if (this.callNesting > 0 && this.getRandomFloat() < 0.3) {
        this.ops.push(new Op(OpType.Return, 0));
      } else {
        this.genBreak();
      }
    } else {
      this.pickOp(2);
    }

    this.ops.push(new Op(OpType.EndIf, 0));
    this.nesting--;
  }

  private genBreak() {
    if (this.loopNestingThisFunction > 0) {
      // Sometimes put the break in a divergent if
      if (this.getRandomFloat() < 0.1) {
        const r = this.getRandomUint(this.numMasks-1) + 1;
        this.ops.push(new Op(OpType.IfMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.ElseMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.EndIf, 0));
      } else {
        this.ops.push(new Op(OpType.Break, 0));
      }
    }
  }

  private genContinue() {
    if (this.loopNestingThisFunction > 0 && !this.isLoopInf.get(this.loopNesting)) {
      // Sometimes put the continue in a divergent if
      if (this.getRandomFloat() < 0.1) {
        const r = this.getRandomUint(this.numMasks-1) + 1;
        this.ops.push(new Op(OpType.IfMask, r));
        this.ops.push(new Op(OpType.Continue, 0));
        this.ops.push(new Op(OpType.ElseMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.EndIf, 0));
      } else {
        this.ops.push(new Op(OpType.Continue, 0));
      }
    }
  }

  private genReturn() {
    const r = this.getRandomFloat();
    if (this.nesting > 0 &&
        (r < 0.05 ||
         (this.callNesting > 0 && this.loopNestingThisFunction > 0 && r < 0.2) ||
         (this.callNesting > 0 && this.loopNestingThisFunction > 1 && r < 0.5))) {
      this.genBallot();
      if (this.getRandomFloat() < 0.1) {
        this.ops.push(new Op(OpType.IfMask, 0));
        this.ops.push(new Op(OpType.Return, 0));
        this.ops.push(new Op(OpType.ElseMask, 0));
        this.ops.push(new Op(OpType.Return, 0));
        this.ops.push(new Op(OpType.EndIf, 0));
      } else {
        this.ops.push(new Op(OpType.Return, 0));
      }
    }
  }

  /** @returns The WGSL code for the program */
  public genCode(): string {
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      this.genIndent()
      this.addCode(`// ops[${i}] = ${serializeOpType(op.type)}\n`);
      switch (op.type) {
        case OpType.Ballot: {
          this.genIndent();
          this.addCode(`ballots[stride * output_loc + local_id] = subgroupBallot();\n`);
          this.genIndent();
          this.addCode(`output_loc++;\n`);
          break;
        }
        case OpType.Store: {
          this.genIndent();
          this.addCode(`locations[local_id]++;\n`);
          this.genIndent();
          this.addCode(`ballots[stride * output_loc + local_id] = vec4u(${op.value});\n`);
          this.genIndent();
          this.addCode(`output_loc++;\n`);
          break;
        }
        default: {
          this.genIndent();
          this.addCode(`/* missing op ${op.type} */\n`);
          break;
        }
        case OpType.IfMask: {
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
            this.addCode(`if testBit(vec4u(0x${hex(x)},0x${hex(y)},0x${hex(z)},0x${hex(w)}), subgroup_id) {\n`);
          }
          this.increaseIndent();
          break;
        }
        case OpType.IfId: {
          this.genIndent();
          this.addCode(`if subgroup_id < inputs[${op.value}] {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.IfLoopCount: {
          this.genIndent();
          this.addCode(`if subgroup_id == i${this.loopNesting-1} {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.ElseMask:
        case OpType.ElseId:
        case OpType.ElseLoopCount: {
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`} else {\n`);
          this.increaseIndent();
          break;
        }
        case OpType.EndIf: {
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`}\n`);
          break;
        }
        case OpType.ForUniform: {
          this.genIndent();
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; ${iter} < inputs[${op.value}]; ${iter}++) {\n`);
          this.increaseIndent();
          this.loopNesting++;
          break;
        }
        case OpType.ForInf: {
          this.genIndent();
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; true; ${iter} = infLoopIncrement(${iter})) {\n`);
          this.loopNesting++;
          this.increaseIndent();
          // Safety mechanism for hardware runs.
          this.genIndent();
          this.addCode(`// Safety valve\n`);
          this.genIndent();
          this.addCode(`if ${iter} >= 128u { break; }\n\n`);
          break;
        }
        case OpType.ForVar: {
          this.genIndent();
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; ${iter} < subgroup_id + 1; ${iter}++) {\n`);
          this.loopNesting++;
          this.increaseIndent();
          break;
        }
        case OpType.EndForUniform:
        case OpType.EndForInf:
        case OpType.EndForVar: {
          this.loopNesting--;
          this.decreaseIndent();
          this.genIndent();
          this.addCode(`}\n`);
          break;
        }
        case OpType.Break: {
          this.genIndent();
          this.addCode(`break;\n`);
          break;
        }
        case OpType.Continue: {
          this.genIndent();
          this.addCode(`continue;\n`);
          break;
        }
        case OpType.Return: {
          this.genIndent();
          this.addCode(`return;\n`);
          break;
        }
        case OpType.Elect: {
          this.genIndent();
          this.addCode(`if subgroupElect() {\n`);
          this.increaseIndent();
          break;
        }
      }
    }

    let code: string = `
enable chromium_experimental_subgroups;

const stride = ${this.invocations};

@group(0) @binding(0)
var<storage, read> inputs : array<u32>;
@group(0) @binding(1)
var<storage, read_write> ballots : array<vec4u>;
@group(0) @binding(2)
var<storage, read_write> locations : array<u32>;
@group(0) @binding(3)
var<storage, read_write> size : array<u32>;
@group(0) @binding(4)
var<storage, read_write> ids : array<u32>;

var<private> subgroup_id : u32;
var<private> local_id : u32;
var<private> output_loc : u32 = 0;

@compute @workgroup_size(stride,1,1)
fn main(
  @builtin(local_invocation_index) lid : u32,
  @builtin(subgroup_invocation_id) sid : u32,
  @builtin(subgroup_size) sg_size : u32,
) {
  _ = inputs[0];
  _ = ballots[0];
  _ = locations[0];
  subgroup_id = sid;
  local_id = lid;
  ids[lid] = sid;

  // Store the subgroup size from the built-in value and ballot to check for
  // consistency.
  let b = subgroupBallot();
  if lid == 0 {
    size[0] = sg_size;
    let count = countOneBits(b);
    size[1] = count.x + count.y + count.z + count.w;
  }

  f0();
}

fn infLoopIncrement(iter : u32) -> u32 {
  ballots[stride * output_loc + local_id] = subgroupBallot();
  output_loc++;
  return iter + 1;
}

fn subgroupElect() -> bool {
  let b = subgroupBallot();
  let lsb = firstTrailingBit(b);
  let x_m1 = lsb.x != 0xffffffffu;
  let y_m1 = lsb.y != 0xffffffffu;
  let z_m1 = lsb.z != 0xffffffffu;
  let w_or_z = select(lsb.w + 96, lsb.z + 64, z_m1);
  let wz_or_y = select(w_or_z, lsb.y + 32, y_m1);
  let val = select(wz_or_y, lsb.x, x_m1);
  return val == subgroup_id;
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

    for (let i = 0; i < this.functions.length; i++) {
      code += `
fn f${i}() {
${this.functions[i]}
}
`;
    }
    return code;
  }

  /**
   * Adds indentation to the code for the current function.
   */
  private genIndent() {
    this.functions[this.curFunc] += ' '.repeat(this.indents[this.curFunc]);
  }

  /**
   * Increase the amount of indenting for the current function.
   */
  private increaseIndent() {
    this.indents[this.curFunc] += 2;
  }

  /**
   * Decrease the amount of indenting for the current function.
   */
  private decreaseIndent() {
    this.indents[this.curFunc] -= 2;
  }

  /**
   * Adds 'code' to the current function
   */
  private addCode(code: string) {
    this.functions[this.curFunc] += code;
  }

  /**
   * Sizes the simulation buffer.
   *
   * The total size is (# of invocations) * |locs| * 4 (uint4 is written).
   */
  public sizeRefData(locs: number) {
    this.refData = new Uint32Array(locs * 4 * this.invocations);
    this.refData.fill(0);
  }

  // TODO: Reconvergence guarantees are not as strong as this simulation.
  /**
   * Simulate the program for the given subgroup size
   *
   * @param countOnly    If true, the reference output is not generated just max locations
   * @param subgroupSize The subgroup size to simulate
   *
   * BigInt is not the fastest value to manipulate. Care should be taken to optimize it's use.
   */
  public simulate(countOnly: boolean, subgroupSize: number): number {
    class State {
      // Active invocations
      activeMask: bigint;
      // Invocations that rejoin at the head of a loop
      continueMask: bigint;
      // Header index
      header: number;
      // This state is a loop
      isLoop: boolean;
      // Current trip count
      tripCount: number;
      // This state is a call
      isCall: boolean;
      // This state is a switch
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
    for (let idx = 0; idx < this.ops.length; idx++) {
      this.ops[idx].uniform = true;
    }

    let stack = new Array();
    stack.push(new State());
    stack[0].activeMask = (1n << 128n) - 1n;

    let nesting = 0;
    let loopNesting = 0;
    let locs = new Array(this.invocations);
    locs.fill(0);

    if (!countOnly) {
      console.log(`Simulating subgroup size = ${subgroupSize}`);
    }
    let i = 0;
    while (i < this.ops.length) {
      const op = this.ops[i];
      if (!countOnly) {
        console.log(`ops[${i}] = ${serializeOpType(op.type)}, nesting = ${nesting}`);
        console.log(`  mask = ${stack[nesting].activeMask.toString(16)}`);
        //for (let j = 0; j <= nesting; j++) {
        //  console.log(`  mask[${j}] = ${stack[j].activeMask.toString(16)}`);
        //}
      }
      switch (op.type) {
        case OpType.Ballot: {
          const curMask = stack[nesting].activeMask;
          // Flag if this ballot is not workgroup uniform.
          if (this.style == Style.Workgroup && any(curMask) && !all(curMask, this.invocations)) {
            op.uniform = false;
          }

          // Flag if this ballot is not subgroup uniform.
          if (this.style == Style.Subgroup) {
            for (let id = 0; id < this.invocations; id += subgroupSize) {
              const subgroupMask = (curMask >> BigInt(id)) & getMask(subgroupSize);
              if (subgroupMask != 0n && !all(subgroupMask, subgroupSize)) {
                op.uniform = false;
              }
            }
          }

          if (!any(curMask)) {
            break;
          }

          let mask = new Uint32Array();
          for (let id = 0; id < this.invocations; id++) {
            if (id % subgroupSize === 0) {
              mask = getSubgroupMask(curMask, subgroupSize, id);
            }
            if (testBit(curMask, id)) {
              if (!countOnly) {
                const idx = this.baseIndex(id, locs[id]);
                if (op.uniform) {
                  this.refData[idx + 0] = mask[0];
                  this.refData[idx + 1] = mask[1];
                  this.refData[idx + 2] = mask[2];
                  this.refData[idx + 3] = mask[3];
                } else {
                  // Emit a magic value to indicate that we shouldn't validate this ballot
                  this.refData.fill(0x12345678, idx, idx + 4);
                }
              }
              locs[id]++;
            }
          }
          break;
        }
        case OpType.Store: {
          if (!any(stack[nesting].activeMask)) {
            break;
          }

          for (let id = 0; id < this.invocations; id++) {
            if (testBit(stack[nesting].activeMask, id)) {
              if (!countOnly) {
                const idx = this.baseIndex(id, locs[id]);
                this.refData.fill(op.value, idx, idx + 4);
              }
              locs[id]++;
            }
          }
          break;
        }
        case OpType.IfMask: {
          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          cur.isLoop = 0;
          cur.isSwitch = 0;
          // O is always uniform true.
          if (op.value != 0 && any(cur.activeMask)) {
            let subMask = this.getValueMask(op.value);
            subMask &= getMask(subgroupSize);
            cur.activeMask &= getReplicatedMask(subMask, subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.ElseMask: {
          // 0 is always uniform true so the else will never be taken.
          const cur = stack[nesting];
          if (op.value == 0) {
            cur.activeMask = 0n;
          } else if (any(cur.activeMask)) {
            const prev = stack[nesting-1];
            let subMask = this.getValueMask(op.value);
            subMask &= getMask(subgroupSize);
            cur.activeMask = prev.activeMask;
            cur.activeMask &= ~getReplicatedMask(subMask, subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.IfId: {
          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          cur.isLoop = 0;
          cur.isSwitch = 0;
          if (any(cur.activeMask)) {
            // All invocations with subgroup invocation id less than op.value are active.
            cur.activeMask &= getReplicatedMask(getMask(op.value), subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.ElseId: {
          const prev = stack[nesting-1];
          // All invocations with a subgroup invocation id greater or equal to op.value are active.
          stack[nesting].activeMask = prev.activeMask;
          if (any(prev.activeMask)) {
            stack[nesting].activeMask &= ~getReplicatedMask(getMask(op.value), subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.IfLoopCount: {
          // Branch based on the subgroup invocation id == loop iteration.
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
          if (any(cur.activeMask)) {
            cur.activeMask &= getReplicatedMask(BigInt(1 << stack[n].tripCount), subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.ElseLoopCount: {
          // Execute the else of the loop count conditional. It includes all
          // invocations whose subgroup invocation id does not match the
          // current iteration count.
          let n = nesting;
          while (!stack[n].isLoop) {
            n--;
          }

          stack[nesting].activeMask = stack[nesting-1].activeMask;
          if (any(stack[nesting].activeMask)) {
            stack[nesting].activeMask &= ~getReplicatedMask(BigInt(1 << stack[n].tripCount), subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.EndIf: {
          // End the current if.
          nesting--;
          stack.pop();
          break;
        }
        case OpType.ForUniform: {
          // New uniform for loop.
          nesting++;
          loopNesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.header = i;
          cur.isLoop = true;
          cur.activeMask = stack[nesting-1].activeMask;
          break;
        }
        case OpType.EndForUniform: {
          // Determine which invocations have another iteration of the loop to execute.
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
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
        case OpType.ForInf: {
          nesting++;
          loopNesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.header = i;
          cur.isLoop = true;
          cur.activeMask = stack[nesting-1].activeMask;
          break;
        }
        case OpType.EndForInf: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          if (any(cur.activeMask)) {
            let maskArray = new Uint32Array();
            for (let id = 0; id < this.invocations; id++) {
              if (id % subgroupSize === 0) {
                maskArray = getSubgroupMask(cur.activeMask, subgroupSize, id);
              }
              if (testBit(cur.activeMask, id)) {
                if (!countOnly) {
                  const idx = this.baseIndex(id, locs[id]);
                  this.refData[idx + 0] = maskArray[0];
                  this.refData[idx + 1] = maskArray[1];
                  this.refData[idx + 2] = maskArray[2];
                  this.refData[idx + 3] = maskArray[3];
                }
                locs[id]++;
              }
            }
            i = cur.header + 1;
            continue;
          } else {
            loopNesting--;
            nesting--;
            stack.pop();
          }
          break;
        }
        case OpType.ForVar: {
          nesting++;
          loopNesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.header = i;
          cur.isLoop = true;
          cur.activeMask = stack[nesting-1].activeMask;
          break;
        }
        case OpType.EndForVar: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          let done = !any(cur.activeMask) || cur.tripCount === subgroupSize;
          if (!done) {
            let submask = getMask(subgroupSize) & ~getMask(cur.tripCount);
            let mask = getReplicatedMask(submask, subgroupSize, this.invocations);
            cur.activeMask &= mask;
            done = !any(cur.activeMask);
          }

          if (done) {
            loopNesting--;
            nesting--;
            stack.pop();
          } else {
            i = cur.header + 1;
          }
          break;
        }
        case OpType.Break: {
          // Remove this active mask from all stack entries for the current loop/switch.
          let n = nesting;
          let mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

          while (true) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isLoop || stack[n].isSwitch) {
              break;
            }

            n--;
          }
          break;
        }
        case OpType.Continue: {
          // Remove this active mask from stack entries in this loop.
          // Add this mask to the loop's continue mask for the next iteration.
          let n = nesting;
          let mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

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
        case OpType.Return: {
          // Remove this active mask from all stack entries for this function.
          let mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

          for (let n = nesting; n >= 0; n--) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isCall) {
              break;
            }
          }
          break;
        }
        case OpType.Elect: {
          nesting++;
          stack.push(new State());
          const cur = stack[nesting];
          cur.copy(stack[nesting-1]);
          cur.header = i;
          cur.isLoop = 0;
          cur.isSwitch = 0;
          if (any(cur.activeMask)) {
            cur.activeMask = getElectMask(cur.activeMask, subgroupSize, this.invocations);
          }
          break;
        }
        default: {
          unreachable(`Unhandled op ${serializeOpType(op.type)}`);
        }
      }
      i++;
    }

    assert(stack.length == 1);

    let maxLoc = 0;
    for (let id = 0; id < this.invocations; id++) {
      maxLoc = Math.max(maxLoc, locs[id]);
    }
    if (!countOnly) {
      console.log(`Max location = ${maxLoc}\n`);
    }
    return maxLoc;
  }

  /**
   * @returns a mask formed from |masks[idx]|
   */
  private getValueMask(idx: number): bigint {
    const x = this.masks[4*idx];
    const y = this.masks[4*idx+1];
    const z = this.masks[4*idx+2];
    const w = this.masks[4*idx+3];
    let mask: bigint = 0n;
    mask |= BigInt(x);
    mask |= BigInt(y) << 32n;
    mask |= BigInt(z) << 64n;
    mask |= BigInt(w) << 96n;
    return mask;
  }

  /** @returns a randomized program */
  public generate() {
    do {
      this.ops = [];
      while (this.ops.length < this.minCount) {
        this.pickOp(1);
      }
      //break;

      // If this is an uniform control flow case, make sure a uniform ballot is
      // generated. A subgroup size of 64 is used for testing purposes here.
      if (this.style != Style.Maximal) {
        this.simulate(true, 64);
      }
    } while (this.style != Style.Maximal && !this.isUCF());
  }

  /** @returns true if the program has uniform control flow for some ballot */
  private isUCF(): boolean {
    let ucf: boolean = false;
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      if (op.type === OpType.Ballot && op.uniform) {
        ucf = true;
      }
    }
    return ucf;
  }

  /**
   * Calculates the base index for values in the result arrays.
   *
   * @param id  The invocation id
   * @param loc The location
   *
   * @returns The base index in a Uint32Array
   */
  private baseIndex(id: number, loc: number): number {
    return 4 * (this.invocations * loc + id);
  }

  /**
   * Determines if an instance of results match.
   *
   * @param res    The result data
   * @param resIdx The base result index
   * @param ref    The reference data
   * @param refIdx The base reference index
   * 
   * @returns true if 4 successive values match in both arrays
   */
  private matchResult(res: Uint32Array, resIdx: number, ref: Uint32Array, refIdx: number): boolean {
    return res[resIdx + 0] === ref[refIdx + 0] &&
           res[resIdx + 1] === ref[refIdx + 1] &&
           res[resIdx + 2] === ref[refIdx + 2] &&
           res[resIdx + 3] === ref[refIdx + 3];
  }

  /**
   * Validates the results of the program.
   *
   * @param ballots      The output data array
   * @param locations    The location data array
   * @param subgroupSize Subgroup size that was executed on device
   * @param numLocs      The maximum locations used in simulation
   * @returns an error if the results do meet expectatations
   */
  public checkResults(ballots: Uint32Array, locations: Uint32Array,
                      subgroupSize: number, numLocs: number): Error | undefined {
    //console.log(`Verifying numLocs = ${numLocs}`);
    if (this.style == Style.Workgroup || this.style === Style.Subgroup) {
      if (!this.isUCF()) {
        return Error(`Expected some uniform condition for this test`);
      }
      // Subgroup and Workgroup tests always have an associated store
      // preceeding them in the buffer.
      const maskArray = getSubgroupMask(getMask(subgroupSize), subgroupSize);
      const zeroArray = new Uint32Array([0,0,0,0]);
      for (let id = 0; id < this.invocations; id++) {
        let refLoc = 1;
        let resLoc = 0;
        while (refLoc < numLocs) {
          while (refLoc < numLocs &&
                 !this.matchResult(this.refData, this.baseIndex(id, refLoc), maskArray, 0)) {
            refLoc++;
          }
          if (refLoc < numLocs) {
            // Fully converged simulation

            // Search for the corresponding store in the result data.
            let storeRefLoc = refLoc - 1;
            while (resLoc < numLocs &&
                   !this.matchResult(ballots, this.baseIndex(id, resLoc),
                                     this.refData, this.baseIndex(id, storeRefLoc))) {
              resLoc++;
            }

            if (resLoc >= numLocs) {
              const refIdx = this.baseIndex(id, storeRefLoc);
              return Error(`Failure for invocation ${id}: could not find associated store for reference location ${storeRefLoc}: ${this.refData[refIdx]},${this.refData[refIdx+1]},${this.refData[refIdx+2]},${this.refData[refIdx+3]}`);
            } else {
              // Found a matching store, now check the ballot.
              const resIdx = this.baseIndex(id, resLoc + 1);
              const refIdx = this.baseIndex(id, refLoc);
              if (!this.matchResult(ballots, resIdx, this.refData, refIdx)) {
                return Error(`Failure for invocation ${id} at location ${resLoc}
- expected: (0x${hex(this.refData[refIdx+3])},0x${hex(this.refData[refIdx+2])},0x${hex(this.refData[refIdx+1])},0x${hex(this.refData[refIdx])})
- got:      (0x${hex(ballots[resIdx+3])},0x${hex(ballots[resIdx+2])},0x${hex(ballots[resIdx+1])},0x${hex(ballots[resIdx])})`);
              }
              resLoc++;
            }
            refLoc++;
          }
        }
        // Check there were no extra writes.
        const idx = this.baseIndex(id, numLocs);
        if (!this.matchResult(ballots, idx, zeroArray, 0)) {
          return Error(`Unexpected write at end of buffer (location = ${numLocs}) for invocation ${id}
- got:      (${ballots[idx]}, ${ballots[idx + 1]}, ${ballots[idx + 2]}, ${ballots[idx + 3]})`);
        }
      }
    } else if (this.style == Style.Maximal) {
      // Expect exact matches.
      for (let i = 0; i < this.refData.length; i += 4) {
        const idx_uvec4 = Math.floor(i / 4);
        const id = Math.floor(idx_uvec4 % this.invocations);
        const loc = Math.floor(idx_uvec4 / this.invocations);
        if (!this.matchResult(ballots, i, this.refData, i)) {
          return Error(`Failure for invocation ${id} at location ${loc}:
- expected: (0x${hex(this.refData[i+3])},0x${hex(this.refData[i+2])},0x${hex(this.refData[i+1])},0x${hex(this.refData[i])})
- got:      (0x${hex(ballots[i+3])},0x${hex(ballots[i+2])},0x${hex(ballots[i+1])},0x${hex(ballots[i])})`);
        }
      }
      for (let i = this.refData.length; i < ballots.length; i++) {
        if (ballots[i] !== 0) {
          return Error(`Unexpected write at end of buffer (index = ${i}):
- got:      (${ballots[i]})`);
        }
      }
    }

    return undefined;
  }

  /**
   * Equivalent to:
   *
   * ballot(); // fully uniform
   * if (inputs[1] == 1) {
   *   ballot(); // fullly uniform
   *   for (var i = 0; i < 3; i++) {
   *     ballot(); // Simulation expects fully uniform, WGSL does not.
   *     if (testBit(vec4u(0xaaaaaaaa,0xaaaaaaa,0xaaaaaaaa,0xaaaaaaaa), subgroup_id)) {
   *       ballot(); // non-uniform
   *       continue;
   *     }
   *     ballot(); // non-uniform
   *   }
   *   ballot(); // fully uniform
   * }
   * ballot(); // fully uniform
   */
  public predefinedProgram1() {
    // Set the mask for index 1
    this.masks[4*1 + 0] = 0xaaaaaaaa
    this.masks[4*1 + 1] = 0xaaaaaaaa
    this.masks[4*1 + 2] = 0xaaaaaaaa
    this.masks[4*1 + 3] = 0xaaaaaaaa

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.ForUniform, 3));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Continue, 0));

    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForUniform, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * ballot(); // uniform
   * if (subgroup_id < 16) {
   *   ballot(); // 0xffff
   *   if (testbit(vec4u(0x00ff00ff,00ff00ff,00ff00ff,00ff00ff), subgroup_id)) {
   *     ballot(); // 0xff
   *     if (inputs[1] == 1) {
   *       ballot(); // 0xff
   *     }
   *     ballot(); // 0xff
   * } else {
   *   ballot(); // 0xF..0000
   *   return;
   * }
   * ballot; // 0xffff
   *
   * In this program, subgroups larger than 16 invocations diverge at the first if.
   * Subgroups larger than 8 diverge at the second if.
   * No divergence at the third if.
   * The else of the first if returns, so the final ballot is only uniform for subgroups <= 16.
   */
  public predefinedProgram2() {
    // Set the mask for index 1
    this.masks[4*1 + 0] = 0x00ff00ff
    this.masks[4*1 + 1] = 0x00ff00ff
    this.masks[4*1 + 2] = 0x00ff00ff
    this.masks[4*1 + 3] = 0x00ff00ff

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfId, 16));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.ElseId, 16));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Return, 16));

    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * if subgroup_id < inputs[107] {
   *   if subgroup_id < inputs[112] {
   *     ballot();
   *     if testBit(vec4u(0xd2f269c6,0xffe83b3f,0xa279f695,0x58899224), subgroup_id) {
   *       ballot();
   *     } else {
   *       ballot()
   *     }
   *     ballot();
   *   } else {
   *     ballot();
   *   }
   * }
   *
   * The first two if statements are uniform for subgroup sizes 64 or less.
   * The third if statement is non-uniform for all subgroup sizes.
   * It is tempting for compilers to collapse the third if/else into a single
   * basic block which can lead to unexpected convergence of the ballots.
   */
  public predefinedProgram3() {
    // Set the mask for index 1
    this.masks[4*1 + 0] = 0xd2f269c6;
    this.masks[4*1 + 1] = 0xffe83b3f;
    this.masks[4*1 + 2] = 0xa279f695;
    this.masks[4*1 + 3] = 0x58899224;

    this.ops.push(new Op(OpType.IfId, 107));

    this.ops.push(new Op(OpType.IfId, 112));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.ElseMask, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.ElseId, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.EndIf, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i = 0; ; i++, ballot()) {
   *   ballot();
   *   if (subgroupElect()) {
   *     ballot();
   *     break;
   *   }
   * }
   * ballot();
   */
  public predefinedProgramForInf() {
    this.ops.push(new Op(OpType.ForInf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Elect, 0));

    this.ops.push(new Op(OpType.Break, 0));

    this.ops.push(new Op(OpType.EndIf, 0));
    this.ops.push(new Op(OpType.EndForInf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i = 0; i < subgroup_invocation_id + 1; i++) {
   *   ballot();
   * }
   * ballot();
   * for (var i = 0; i < subgroup_invocation_id + 1; i++) {
   *   ballot();
   * }
   * ballot();
   */
  public predefinedProgramForVar() {
    this.ops.push(new Op(OpType.ForVar, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForVar, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.ForVar, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForVar, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }
};

export function generateSeeds(numCases: number): number[] {
  let prng: PRNG = new PRNG(1);
  let output: number[] = new Array(numCases);
  for (let i = 0; i < numCases; i++) {
    output[i] = prng.randomU32();
  }
  return output;
}
