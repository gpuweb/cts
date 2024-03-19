import { assert, unreachable } from '../../../../common/util/util.js';
import { PRNG } from '../../../util/prng.js';

export function hex(n: number): string {
  return n.toString(16);
}

/** @returns A bitmask where bits [0,size) are 1s. */
function getMask(size: number): bigint {
  return (1n << BigInt(size)) - 1n;
}

/** @returns A bitmask where |submask| is repeated every |size| bits for |total| bits. */
function getReplicatedMask(submask: bigint, size: number, total: number): bigint {
  const reps = Math.floor(total / size);
  let mask: bigint = submask & ((1n << BigInt(size)) - 1n);
  for (let i = 1; i < reps; i++) {
    mask |= mask << BigInt(size);
  }
  return mask;
}

/** @returns a mask with only the least significant 1 in |value| set for each subgroup. */
function getElectMask(value: bigint, size: number, total: number): bigint {
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
  const mask: bigint = (fullMask >> BigInt(shift)) & getMask(size);
  arr[0] = Number(BigInt.asUintN(32, mask));
  arr[1] = Number(BigInt.asUintN(32, mask >> 32n));
  arr[2] = Number(BigInt.asUintN(32, mask >> 64n));
  arr[3] = Number(BigInt.asUintN(32, mask >> 96n));
  return arr;
}

/** @returns true if bit |bit| is set to 1. */
function testBit(mask: bigint, bit: number): boolean {
  return ((mask >> BigInt(bit)) & 0x1n) === 1n;
}

/** @returns true if any bit in value is 1. */
function any(value: bigint): boolean {
  return value !== 0n;
}

/** @returns true if all bits in value from [0, size) are 1. */
function all(value: bigint, size: number): boolean {
  return value === (1n << BigInt(size)) - 1n;
}

/**
 * Reconvergence style being tested.
 */
export enum Style {
  // Workgroup uniform control flow
  Workgroup = 0,

  // Subgroup uniform control flow
  Subgroup = 1,

  // Maximal uniformity
  Maximal = 2,

  // Guarantees provided by WGSL v1.
  // Very similar to Workgroup, but less strict for loops.
  WGSLv1 = 3,
}

/**
 * Instruction type
 */
export enum OpType {
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

  // var i = 0; loop { ... continuing { i++; break if i >= inputs[value]; } }
  LoopUniform,
  EndLoopUniform,

  // var i = 0; loop { /* break */ ... continuing { ballot(); i++; } }
  LoopInf,
  EndLoopInf,

  // Function return
  Return,

  // Emulated elect for breaks from infinite loops.
  Elect,

  // Function call
  Call,
  EndCall,

  // switch (inputs[x]) {
  //   case x*2: { ... } never taken
  //   case x: { ... }   uniformly taken
  //   case x*4: { ... } never taken
  // }
  SwitchUniform,
  EndSwitch,

  // switch (subgroup_invocation_id & 3)
  SwitchVar,

  // switch (i) {
  //   case 1: { ... }
  //   case 2: { ... }
  //   default: { ... }
  // }
  SwitchLoopCount,

  CaseMask,
  CaseLoopCount,
  EndCase,

  // Fancy no-ops.
  Noise,

  MAX,
}

/** @returns The stringified version of |op|. */
function serializeOpType(op: OpType): string {
  // prettier-ignore
  switch (op) {
    case OpType.Ballot:          return 'Ballot';
    case OpType.Store:           return 'Store';
    case OpType.IfMask:          return 'IfMask';
    case OpType.ElseMask:        return 'ElseMask';
    case OpType.EndIf:           return 'EndIf';
    case OpType.IfLoopCount:     return 'IfLoopCount';
    case OpType.ElseLoopCount:   return 'ElseLoopCount';
    case OpType.IfId:            return 'IfId';
    case OpType.ElseId:          return 'ElseId';
    case OpType.Break:           return 'Break';
    case OpType.Continue:        return 'Continue';
    case OpType.ForUniform:      return 'ForUniform';
    case OpType.EndForUniform:   return 'EndForUniform';
    case OpType.ForInf:          return 'ForInf';
    case OpType.EndForInf:       return 'EndForInf';
    case OpType.ForVar:          return 'ForVar';
    case OpType.EndForVar:       return 'EndForVar';
    case OpType.LoopUniform:     return 'LoopUniform';
    case OpType.EndLoopUniform:  return 'EndLoopUniform';
    case OpType.LoopInf:         return 'LoopInf';
    case OpType.EndLoopInf:      return 'EndLoopInf';
    case OpType.Return:          return 'Return';
    case OpType.Elect:           return 'Elect';
    case OpType.Call:            return 'Call';
    case OpType.EndCall:         return 'EndCall';
    case OpType.SwitchUniform:   return 'SwitchUniform';
    case OpType.SwitchVar:       return 'SwitchVar';
    case OpType.SwitchLoopCount: return 'SwitchLoopCount';
    case OpType.EndSwitch:       return 'EndSwitch';
    case OpType.CaseMask:        return 'CaseMask';
    case OpType.CaseLoopCount:   return 'CaseLoopCount';
    case OpType.EndCase:         return 'EndCase';
    case OpType.Noise:           return 'Noise';
    default:
      unreachable('Unhandled op');
      break;
  }
  return '';
}

/**
 * Different styles of if conditions
 */
enum IfType {
  // If the mask is 0, generates a random uniform comparison
  // Otherwise, tests subgroup_invocation_id against a mask
  Mask,

  // Generates a uniform true comparison
  Uniform,

  // if subgroup_invocation_id == iN
  LoopCount,

  // if subgroup_id < inputs[N]
  Lid,
}

/**
 * Operation in a Program.
 *
 * Includes the type of operations, an operation specific value and whether or
 * not the operation is uniform.
 */
class Op {
  // Instruction type
  type: OpType;
  // Instruction specific value
  value: number;
  // Case specific value
  caseValue: number;
  // Indicates if the instruction is uniform or not
  uniform: boolean;

  constructor(type: OpType, value: number, caseValue: number = 0, uniform: boolean = true) {
    this.type = type;
    this.value = value;
    this.caseValue = caseValue;
    this.uniform = uniform;
  }
}

/**
 * Main class for testcase generation.
 *
 * Major steps involved in a test:
 * 1. Generation (either generate() or a predefined case)
 * 2. Simulation
 * 3. Result comparison
 *
 * The interface of the program is fixed and invariant of the particular
 * program being tested.
 *
 */
export class Program {
  // Number of invocations in the program
  // Max supported is 128
  public readonly invocations: number;
  // Pseduo-random number generator
  private readonly prng: PRNG;
  // Instruction list
  private ops: Op[];
  // Reconvergence style
  public readonly style: Style;
  // Minimum number of instructions in a program
  private readonly minCount: number;
  // Maximum number of instructions in a program
  // Note: this is a soft max to ensure functional programs.
  private readonly maxCount: number;
  // Maximum nesting of scopes permitted
  private readonly maxNesting: number;
  // Maximum loop nesting permitted
  private readonly maxLoopNesting: number;
  // Current nesting
  private nesting: number;
  // Current loop nesting
  private loopNesting: number;
  // Current loop nesting in the current function
  private loopNestingThisFunction: number;
  // Current call nesting
  private callNesting: number;
  // Number of pregenerated masks for testing
  private readonly numMasks: number;
  // Pregenerated masks.
  // 4 * |numMasks| entries representing ballots.
  private masks: number[];
  // Current function index
  private curFunc: number;
  // WGSL code of each function
  private functions: string[];
  // Indent level for each function
  private indents: number[];
  // Offset value for OpType.Store
  private readonly storeBase: number;
  // Reference simulation output
  public refData: Uint32Array;
  // Maps whether a particular loop nest is infinite or not
  private isLoopInf: Map<number, boolean>;
  // Maps whether a particular infinite loop has had a break inserted
  private doneInfLoopBreak: Map<number, boolean>;
  // Maximum number of locations per invocation
  // Each location stores a vec4u
  public readonly maxLocations: number;
  // Maximum nesting in the actual program
  private maxProgramNesting;
  // Indicates if the program satisfies uniform control flow for |style|
  // This depends on simulating a particular subgroup size
  public ucf: boolean;
  // Indicates that only uniform branches should be generated.
  private onlyUniform: boolean;

  /**
   * constructor
   *
   * @param style Enum indicating the type of reconvergence being tested
   * @param seed  Value used to seed the PRNG
   */
  constructor(
    style: Style = Style.Workgroup,
    seed: number = 1,
    invocations: number,
    onlyUniform: boolean = false
  ) {
    this.invocations = invocations;
    assert(invocations <= 128);
    this.prng = new PRNG(seed);
    this.ops = [];
    this.style = style;
    this.minCount = 30;
    this.maxCount = 20000; // what is a reasonable limit?
    // https://crbug.com/tint/2011
    // Tint is double counting depth
    this.maxNesting = this.getRandomUint(20) + 20;
    // Loops significantly affect runtime and memory performance
    this.maxLoopNesting = 3; //4;
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
    this.maxProgramNesting = 10; // default stack allocation
    this.maxLocations = 130000; // keep the buffer under 256MiB
    this.ucf = false;
    this.onlyUniform = onlyUniform;
  }

  /** @returns A random float between 0 and 1 */
  private getRandomFloat(): number {
    return this.prng.random();
  }

  /** @returns A random 32-bit integer between 0 and max. */
  private getRandomUint(max: number): number {
    return this.prng.randomU32() % max;
  }

  /**
   * Pick |count| random instructions
   *
   * @param count The number of instructions
   *
   * If |this.onlyUniform| is true then only uniform instructions will be
   * selected.
   *
   */
  private pickOp(count: number) {
    if (this.onlyUniform) {
      this.pickUniformOp(count);
    } else {
      this.pickAnyOp(count);
    }
  }

  /**
   * Pick |count| random instructions generators
   *
   * @param count the number of instructions
   *
   * These instructions could be uniform or non-uniform.
   */
  private pickAnyOp(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.ops.length >= this.maxCount) {
        return;
      }

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
            if (this.loopNesting < this.maxLoopNesting) {
              const r2 = this.getRandomUint(3);
              switch (r2) {
                case 0:
                  this.genForUniform();
                  break;
                case 1:
                  this.genForInf();
                  break;
                case 2:
                  this.genForVar();
                  break;
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
            if (
              this.getRandomFloat() < 0.2 &&
              this.callNesting === 0 &&
              this.nesting < this.maxNesting - 1
            ) {
              this.genCall();
            } else {
              this.genReturn();
            }
            break;
          }
          case 8: {
            if (this.loopNesting < this.maxLoopNesting) {
              const r2 = this.getRandomUint(2);
              switch (r2) {
                case 0:
                  this.genLoopUniform();
                  break;
                case 1:
                  this.genLoopInf();
                  break;
                default: {
                  break;
                }
              }
            }
            break;
          }
          case 9: {
            const r2 = this.getRandomUint(4);
            switch (r2) {
              case 0: {
                this.genSwitchUniform();
                break;
              }
              case 1: {
                if (this.loopNesting > 0) {
                  this.genSwitchLoopCount();
                  break;
                }
                // fallthrough
              }
              case 2: {
                if (this.style !== Style.Maximal) {
                  this.genSwitchMulticase();
                  break;
                }
                // fallthrough
              }
              case 3:
              default: {
                this.genSwitchVar();
                break;
              }
            }
            break;
          }
          case 10: {
            this.genElect(false);
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

  /**
   * Pick |count| random uniform instructions generators
   *
   * @param count the number of instructions
   *
   */
  private pickUniformOp(count: number) {
    for (let i = 0; i < count; i++) {
      if (this.ops.length >= this.maxCount) {
        return;
      }

      this.genBallot();
      if (this.nesting < this.maxNesting) {
        const r = this.getRandomUint(10);
        switch (r) {
          case 0:
          case 1: {
            this.genIf(IfType.Lid);
            break;
          }
          case 2:
          case 3: {
            this.genIf(IfType.Uniform);
            break;
          }
          case 4: {
            // Avoid very deep loop nests to limit memory and runtime.
            if (this.loopNesting < this.maxLoopNesting) {
              this.genForUniform();
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
            if (
              this.getRandomFloat() < 0.2 &&
              this.callNesting === 0 &&
              this.nesting < this.maxNesting - 1
            ) {
              this.genCall();
            } else {
              this.genReturn();
            }
            break;
          }
          case 8: {
            if (this.loopNesting < this.maxLoopNesting) {
              this.genLoopUniform();
            }
            break;
          }
          case 9: {
            // crbug.com/tint/2039
            // Tint generates invalid code for switch inside loops.
            if (this.loopNestingThisFunction > 0) {
              break;
            }
            const r2 = this.getRandomUint(2);
            switch (r2) {
              case 1: {
                if (this.loopNesting > 0) {
                  this.genSwitchLoopCount();
                  break;
                }
                // fallthrough
              }
              default: {
                this.genSwitchUniform();
                break;
              }
            }
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

  /**
   * Ballot generation
   *
   * Can insert ballots, stores, noise into the program.
   * For non-maximal styles, if a ballot is generated, a store always precedes
   * it.
   */
  private genBallot() {
    // Optionally insert ballots, stores, and noise.
    // Ballots and stores are used to determine correctness.
    if (this.getRandomFloat() < 0.2) {
      const cur_length = this.ops.length;
      if (
        cur_length < 2 ||
        !(
          this.ops[cur_length - 1].type === OpType.Ballot ||
          (this.ops[cur_length - 1].type === OpType.Store &&
            this.ops[cur_length - 2].type === OpType.Ballot)
        )
      ) {
        // Perform a store with each ballot so the results can be correlated.
        if (this.style !== Style.Maximal)
          this.ops.push(new Op(OpType.Store, cur_length + this.storeBase));
        this.ops.push(new Op(OpType.Ballot, 0));
      }
    }

    if (this.getRandomFloat() < 0.1) {
      const cur_length = this.ops.length;
      if (
        cur_length < 2 ||
        !(
          this.ops[cur_length - 1].type === OpType.Store ||
          (this.ops[cur_length - 1].type === OpType.Ballot &&
            this.ops[cur_length - 2].type === OpType.Store)
        )
      ) {
        // Subgroup and workgroup styles do a store with every ballot.
        // Don't bloat the code by adding more.
        if (this.style === Style.Maximal)
          this.ops.push(new Op(OpType.Store, cur_length + this.storeBase));
      }
    }

    const r = this.getRandomUint(10000);
    if (r < 3 && !this.onlyUniform) {
      this.ops.push(new Op(OpType.Noise, 0));
    } else if (r < 10) {
      this.ops.push(new Op(OpType.Noise, 1));
    }
  }

  /**
   * Generate an if based on |type|
   *
   * @param type The type of the if condition, see IfType
   *
   * Generates if/else structures.
   */
  private genIf(type: IfType) {
    let maskIdx = this.getRandomUint(this.numMasks);
    if (type === IfType.Uniform) maskIdx = 0;

    const lid = this.onlyUniform ? this.invocations : this.getRandomUint(this.invocations);
    if (type === IfType.Lid) {
      this.ops.push(new Op(OpType.IfId, lid));
    } else if (type === IfType.LoopCount) {
      this.ops.push(new Op(OpType.IfLoopCount, 0));
    } else {
      this.ops.push(new Op(OpType.IfMask, maskIdx));
    }

    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);

    const beforeSize = this.ops.length;
    this.pickOp(2);
    const afterSize = this.ops.length;

    const randElse = this.getRandomFloat();
    if (randElse < 0.5) {
      if (type === IfType.Lid) {
        this.ops.push(new Op(OpType.ElseId, lid));
      } else if (type === IfType.LoopCount) {
        this.ops.push(new Op(OpType.ElseLoopCount, 0));
      } else {
        this.ops.push(new Op(OpType.ElseMask, maskIdx));
      }

      // Sometimes make the else identical to the if, but don't just completely
      // blow up the instruction count.
      if (
        randElse < 0.1 &&
        beforeSize !== afterSize &&
        beforeSize + 2 * (afterSize - beforeSize) < this.maxCount
      ) {
        for (let i = beforeSize; i < afterSize; i++) {
          const op = this.ops[i];
          this.ops.push(new Op(op.type, op.value, op.caseValue, op.uniform));
          // Make stores unique.
          if (op.type === OpType.Store) {
            this.ops[this.ops.length - 1].value = this.storeBase + this.ops.length - 1;
          }
        }
      } else {
        this.pickOp(2);
      }
    }
    this.ops.push(new Op(OpType.EndIf, 0));

    this.nesting--;
  }

  /**
   * Generate a uniform for loop
   *
   * The number of iterations is randomly selected [1, 5].
   */
  private genForUniform() {
    const n = this.getRandomUint(5) + 1; // [1, 5]
    this.ops.push(new Op(OpType.ForUniform, n));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.pickOp(2);
    this.ops.push(new Op(OpType.EndForUniform, n));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  /**
   * Generate an infinite for loop
   *
   * The loop will always include an elect based break to prevent a truly
   * infinite loop. The maximum number of iterations is the number of
   * invocations in the program, but it is scaled by the loop nesting. Inside
   * one loop the number of iterations is halved and inside two loops the
   * number of iterations in quartered. This scaling is used to reduce runtime
   * and memory.
   *
   * The for_update also performs a ballot.
   *
   */
  private genForInf() {
    this.ops.push(new Op(OpType.ForInf, 0));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.isLoopInf.set(this.loopNesting, true);
    this.doneInfLoopBreak.set(this.loopNesting, false);

    this.pickOp(2);

    // As loop become more deeply nested, execute fewer iterations.
    const reduction = this.loopNesting === 1 ? 1 : this.loopNesting === 2 ? 2 : 4;
    this.genElect(true, reduction);
    this.doneInfLoopBreak.set(this.loopNesting, true);

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndForInf, 0));
    this.isLoopInf.set(this.loopNesting, false);
    this.doneInfLoopBreak.set(this.loopNesting, false);
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  /**
   * Generate a for loop with variable iterations per invocation
   *
   * The loop condition is based on subgroup_invocation_id + 1. So each
   * invocation executes a different number of iterations, though the this is
   * scaled by the amount of loop nesting the same as |generateForInf|.
   *
   */
  private genForVar() {
    // op.value is the iteration reduction factor.
    const reduction = this.loopNesting === 0 ? 1 : this.loopNesting === 1 ? 2 : 4;
    this.ops.push(new Op(OpType.ForVar, reduction));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    this.loopNesting++;
    this.loopNestingThisFunction++;

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndForVar, reduction));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  /**
   * Generate a loop construct with uniform iterations
   *
   * Same as |genForUniform|, but coded as a loop construct.
   */
  private genLoopUniform() {
    const n = this.getRandomUint(5) + 1;
    this.ops.push(new Op(OpType.LoopUniform, n));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    this.loopNesting++;
    this.loopNestingThisFunction++;

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndLoopUniform, n));
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  /**
   * Generate an infinite loop construct
   *
   * This is the same as |genForInf| but uses a loop construct.
   */
  private genLoopInf() {
    const header = this.ops.length;
    this.ops.push(new Op(OpType.LoopInf, 0));

    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    this.loopNesting++;
    this.loopNestingThisFunction++;
    this.isLoopInf.set(this.loopNesting, true);
    this.doneInfLoopBreak.set(this.loopNesting, false);

    this.pickOp(2);

    const reduction = this.loopNesting === 1 ? 1 : this.loopNesting === 2 ? 2 : 4;
    this.genElect(true, reduction);
    this.doneInfLoopBreak.set(this.loopNesting, true);

    this.pickOp(2);

    this.ops.push(new Op(OpType.EndLoopInf, header));

    this.isLoopInf.set(this.loopNesting, false);
    this.doneInfLoopBreak.set(this.loopNesting, false);
    this.loopNestingThisFunction--;
    this.loopNesting--;
    this.nesting--;
  }

  /**
   * Generates an if based on subgroupElect()
   *
   * @param forceBreak If true, forces the then statement to contain a break
   * @param reduction This generates extra breaks
   *
   */
  private genElect(forceBreak: boolean, reduction: number = 1) {
    this.ops.push(new Op(OpType.Elect, 0));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);

    if (forceBreak) {
      this.genBallot();
      this.genBallot();
      if (this.getRandomFloat() < 0.1) {
        this.pickOp(1);
      }

      // Sometimes use a return if we're in a call.
      if (this.callNesting > 0 && this.getRandomFloat() < 0.3) {
        this.ops.push(new Op(OpType.Return, this.callNesting));
      } else {
        this.genBreak();
      }
    } else {
      this.pickOp(2);
    }

    this.ops.push(new Op(OpType.EndIf, 0));
    this.nesting--;
    // Reduction injects extra breaks to reduce the number of iterations.
    for (let i = 1; i < reduction; i++) {
      this.ops.push(new Op(OpType.Elect, 0));
      this.ops.push(new Op(OpType.Break, 0));
      this.ops.push(new Op(OpType.EndIf, 0));
    }
  }

  /**
   * Generate a break if in a loop.
   *
   * Only generates a break within a loop, but may break out of a switch and
   * not just a loop. Sometimes the break uses a non-uniform if/else to break
   * (unless only uniform branches are specified).
   *
   */
  private genBreak() {
    if (this.loopNestingThisFunction > 0) {
      // Sometimes put the break in a divergent if
      if (this.getRandomFloat() < 0.1 && !this.onlyUniform) {
        const r = this.getRandomUint(this.numMasks - 1) + 1;
        this.ops.push(new Op(OpType.IfMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.ElseMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.EndIf, 0));
        this.maxProgramNesting = Math.max(this.nesting + 1, this.maxProgramNesting);
      } else {
        this.ops.push(new Op(OpType.Break, 0));
      }
    }
  }

  /**
   * Generate a continue if in a loop
   *
   * Sometimes uses a non-uniform if/else to continue (unless only uniform
   * branches are specified).
   */
  private genContinue() {
    if (this.loopNestingThisFunction > 0 && !this.isLoopInf.get(this.loopNesting)) {
      // Sometimes put the continue in a divergent if
      if (this.getRandomFloat() < 0.1 && !this.onlyUniform) {
        const r = this.getRandomUint(this.numMasks - 1) + 1;
        this.ops.push(new Op(OpType.IfMask, r));
        this.ops.push(new Op(OpType.Continue, 0));
        this.ops.push(new Op(OpType.ElseMask, r));
        this.ops.push(new Op(OpType.Break, 0));
        this.ops.push(new Op(OpType.EndIf, 0));
        this.maxProgramNesting = Math.max(this.nesting + 1, this.maxProgramNesting);
      } else {
        this.ops.push(new Op(OpType.Continue, 0));
      }
    }
  }

  /**
   * Generates a function call.
   *
   */
  private genCall() {
    this.ops.push(new Op(OpType.Call, 0));
    this.callNesting++;
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);
    const curLoopNesting = this.loopNestingThisFunction;
    this.loopNestingThisFunction = 0;

    this.pickOp(2);

    this.loopNestingThisFunction = curLoopNesting;
    this.nesting--;
    this.callNesting--;
    this.ops.push(new Op(OpType.EndCall, 0));
  }

  /**
   * Generates a return
   *
   * Rarely, this will return from the main function
   */
  private genReturn() {
    const r = this.getRandomFloat();
    if (
      this.nesting > 0 &&
      (r < 0.05 ||
        (this.callNesting > 0 && this.loopNestingThisFunction > 0 && r < 0.2) ||
        (this.callNesting > 0 && this.loopNestingThisFunction > 1 && r < 0.5))
    ) {
      this.genBallot();
      if (this.getRandomFloat() < 0.1 && !this.onlyUniform) {
        this.ops.push(new Op(OpType.IfMask, 0));
        this.ops.push(new Op(OpType.Return, this.callNesting));
        this.ops.push(new Op(OpType.ElseMask, 0));
        this.ops.push(new Op(OpType.Return, this.callNesting));
        this.ops.push(new Op(OpType.EndIf, 0));
        this.maxProgramNesting = Math.max(this.nesting + 1, this.maxProgramNesting);
      } else {
        this.ops.push(new Op(OpType.Return, this.callNesting));
      }
    }
  }

  /**
   * Generate a uniform switch.
   *
   * Some dead case constructs are also generated.
   */
  private genSwitchUniform() {
    const r = this.getRandomUint(5);
    this.ops.push(new Op(OpType.SwitchUniform, r));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);

    // Never taken
    this.ops.push(new Op(OpType.CaseMask, 0, 1 << (r + 1)));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    // Always taken
    this.ops.push(new Op(OpType.CaseMask, 0xf, 1 << r));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    // Never taken
    this.ops.push(new Op(OpType.CaseMask, 0, 1 << (r + 2)));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.nesting--;
  }

  /**
   * Generates a non-uniform switch based on subgroup_invocation_id
   *
   */
  private genSwitchVar() {
    this.ops.push(new Op(OpType.SwitchVar, 0));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);

    this.ops.push(new Op(OpType.CaseMask, 0x1, 1 << 0));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseMask, 0x2, 1 << 1));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseMask, 0x4, 1 << 2));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseMask, 0x8, 1 << 3));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.nesting--;
  }

  /**
   * Generates switch based on an active loop induction variable.
   *
   */
  private genSwitchLoopCount() {
    const r = this.getRandomUint(this.loopNesting);
    this.ops.push(new Op(OpType.SwitchLoopCount, r));
    this.nesting++;
    this.maxProgramNesting = Math.max(this.nesting, this.maxProgramNesting);

    this.ops.push(new Op(OpType.CaseLoopCount, 1 << 1, 1));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseLoopCount, 1 << 2, 2));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseLoopCount, 0xfffffff9, 0xffffffff));
    this.pickOp(1);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.nesting--;
  }

  /**
   * switch (subgroup_invocation_id & 3)
   *   default
   *   case 0x3: ...
   *   case 0xc: ...
   *
   * This is not generated for maximal style cases because it is not clear what
   * convergence should be expected. There are multiple valid lowerings of a
   * switch that would lead to different convergence scenarios. To test this
   * properly would likely require a range of values which is difficult for
   * this infrastructure to produce.
   *
   */
  private genSwitchMulticase() {
    this.ops.push(new Op(OpType.SwitchVar, 0));
    this.nesting++;

    this.ops.push(new Op(OpType.CaseMask, 0x3, (1 << 0) | (1 << 1)));
    this.pickOp(2);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseMask, 0xc, (1 << 2) | (1 << 3)));
    this.pickOp(2);
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.nesting--;
  }

  /** @returns The WGSL code for the program */
  public genCode(): string {
    for (let i = 0; i < this.ops.length; i++) {
      const op = this.ops[i];
      this.addCode(`// ops[${i}] = ${serializeOpType(op.type)}`);
      switch (op.type) {
        case OpType.Ballot: {
          this.addCode(`ballots[stride * output_loc + local_id] = subgroupBallot();`);
          this.addCode(`output_loc++;`);
          break;
        }
        case OpType.Store: {
          //this.addCode(`locations[local_id]++;`);
          this.addCode(`ballots[stride * output_loc + local_id] = vec4u(${op.value});`);
          this.addCode(`output_loc++;`);
          break;
        }
        default: {
          this.addCode(`/* missing op ${op.type} */`);
          break;
        }
        case OpType.IfMask: {
          if (op.value === 0) {
            const idx = this.getRandomUint(4);
            this.addCode(`if inputs[${idx}] == ${idx} {`);
          } else {
            const idx = op.value;
            const x = this.masks[4 * idx];
            const y = this.masks[4 * idx + 1];
            const z = this.masks[4 * idx + 2];
            const w = this.masks[4 * idx + 3];
            this.addCode(
              `if testBit(vec4u(0x${hex(x)},0x${hex(y)},0x${hex(z)},0x${hex(w)}), subgroup_id) {`
            );
          }
          this.increaseIndent();
          break;
        }
        case OpType.IfId: {
          this.addCode(`if subgroup_id < inputs[${op.value}] {`);
          this.increaseIndent();
          break;
        }
        case OpType.IfLoopCount: {
          this.addCode(`if subgroup_id == i${this.loopNesting - 1} {`);
          this.increaseIndent();
          break;
        }
        case OpType.ElseMask:
        case OpType.ElseId:
        case OpType.ElseLoopCount: {
          this.decreaseIndent();
          this.addCode(`} else {`);
          this.increaseIndent();
          break;
        }
        case OpType.EndIf: {
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.ForUniform: {
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; ${iter} < inputs[${op.value}]; ${iter}++) {`);
          this.increaseIndent();
          this.loopNesting++;
          break;
        }
        case OpType.ForInf: {
          const iter = `i${this.loopNesting}`;
          this.addCode(`for (var ${iter} = 0u; true; ${iter} = infLoopIncrement(${iter})) {`);
          this.loopNesting++;
          this.increaseIndent();
          // Safety mechanism for hardware runs.
          // Intention extra newline.
          this.addCode(`// Safety valve`);
          this.addCode(`if ${iter} >= sgsize { break; }\n`);
          break;
        }
        case OpType.ForVar: {
          const iter = `i${this.loopNesting}`;
          this.addCode(
            `for (var ${iter} = 0u; ${iter} < (subgroup_id / ${op.value}) + 1; ${iter}++) {`
          );
          this.loopNesting++;
          this.increaseIndent();
          break;
        }
        case OpType.EndForUniform:
        case OpType.EndForInf:
        case OpType.EndForVar: {
          this.loopNesting--;
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.LoopUniform: {
          const iter = `i${this.loopNesting}`;
          this.addCode(`${iter} = 0u;`);
          this.addCode(`loop {`);
          this.loopNesting++;
          this.increaseIndent();
          break;
        }
        case OpType.EndLoopUniform: {
          this.loopNesting--;
          const iter = `i${this.loopNesting}`;
          this.addCode(`continuing {`);
          this.increaseIndent();
          this.addCode(`${iter}++;`);
          this.addCode(`break if ${iter} >= inputs[${op.value}];`);
          this.decreaseIndent();
          this.addCode(`}`);
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.LoopInf: {
          const iter = `i${this.loopNesting}`;
          this.addCode(`${iter} = 0u;`);
          this.addCode(`loop {`);
          this.loopNesting++;
          this.increaseIndent();
          break;
        }
        case OpType.EndLoopInf: {
          this.loopNesting--;
          const iter = `i${this.loopNesting}`;
          this.addCode(`continuing {`);
          this.increaseIndent();
          this.addCode(`${iter}++;`);
          this.addCode(`ballots[stride * output_loc + local_id] = subgroupBallot();`);
          this.addCode(`output_loc++;`);
          // Safety mechanism for hardware runs.
          // Intentional extra newlines.
          this.addCode(``);
          this.addCode(`// Safety mechanism`);
          this.addCode(`break if ${iter} >= sgsize;`);
          this.decreaseIndent();
          this.addCode(`}`);
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.Break: {
          this.addCode(`break;`);
          break;
        }
        case OpType.Continue: {
          this.addCode(`continue;`);
          break;
        }
        case OpType.Return: {
          this.addCode(`return;`);
          break;
        }
        case OpType.Elect: {
          this.addCode(`if subgroupElect() {`);
          this.increaseIndent();
          break;
        }
        case OpType.Call: {
          let call = `f${this.functions.length}(`;
          for (let i = 0; i < this.loopNesting; i++) {
            call += `i${i},`;
          }
          call += `);`;
          this.addCode(call);

          this.curFunc = this.functions.length;
          this.functions.push(``);
          this.indents.push(0);
          let decl = `fn f${this.curFunc}(`;
          for (let i = 0; i < this.loopNesting; i++) {
            decl += `i${i} : u32,`;
          }
          decl += `) {`;
          this.addCode(decl);
          this.increaseIndent();
          for (let i = this.loopNesting; i < this.maxLoopNesting; i++) {
            this.addCode(`var i${i} = 0u;`);
          }
          break;
        }
        case OpType.EndCall: {
          this.decreaseIndent();
          this.addCode(`}`);
          // Call nesting is limited to 1 so we always return to f0.
          this.curFunc = 0;
          break;
        }
        case OpType.SwitchUniform: {
          this.addCode(`switch inputs[${op.value}] {`);
          this.increaseIndent();
          this.addCode(`default { }`);
          break;
        }
        case OpType.SwitchVar: {
          this.addCode(`switch subgroup_id & 0x3 {`);
          this.increaseIndent();
          this.addCode(`default { }`);
          break;
        }
        case OpType.SwitchLoopCount: {
          const iter = `i${op.value}`;
          this.addCode(`switch ${iter} {`);
          this.increaseIndent();
          break;
        }
        case OpType.EndSwitch: {
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.CaseMask: {
          let values = ``;
          for (let b = 0; b < 32; b++) {
            if ((1 << b) & op.caseValue) {
              values += `${b},`;
            }
          }
          this.addCode(`case ${values} {`);
          this.increaseIndent();
          break;
        }
        case OpType.CaseLoopCount: {
          if (op.caseValue === 0xffffffff) {
            this.addCode(`default {`);
          } else {
            this.addCode(`case ${op.caseValue} {`);
          }
          this.increaseIndent();
          break;
        }
        case OpType.EndCase: {
          this.decreaseIndent();
          this.addCode(`}`);
          break;
        }
        case OpType.Noise: {
          if (op.value === 0) {
            this.addCode(`while (!subgroupElect()) { }`);
          } else {
            // The if is uniform false.
            this.addCode(`if inputs[0] == 1234 {`);
            this.increaseIndent();
            this.addCode(`var b = subgroupBallot();`);
            this.addCode(`while b.x != 0 {`);
            this.increaseIndent();
            this.addCode(`b = subgroupBallot();`);
            this.decreaseIndent();
            this.addCode(`}`);
            this.decreaseIndent();
            this.addCode(`}`);
          }
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
//@group(0) @binding(2)
//var<storage, read_write> locations : array<u32>;
@group(0) @binding(3)
var<storage, read_write> size : array<u32>;
@group(0) @binding(4)
var<storage, read_write> ids : array<u32>;

var<private> subgroup_id : u32;
var<private> local_id : u32;
var<private> output_loc : u32 = 0;
var<private> sgsize : u32 = 0;

@compute @workgroup_size(stride,1,1)
fn main(
  @builtin(local_invocation_index) lid : u32,
  @builtin(subgroup_invocation_id) sid : u32,
  @builtin(subgroup_size) sg_size : u32,
) {
  _ = inputs[0];
  _ = ballots[0];
  //_ = locations[0];
  subgroup_id = sid;
  local_id = lid;
  ids[lid] = sid;
  sgsize = sg_size;

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
  let lower32 = (id & 63) < 32;
  let lower64 = id < 64;
  let xybit = select(ybit, xbit, lower32);
  let zwbit = select(wbit, zbit, lower32);
  return select(zwbit, xybit, lower64) == 1;
}

fn f0() {
  var i0 = 0u;
  var i1 = 0u;
  var i2 = 0u;
  var i3 = 0u;`;

    for (let i = 0; i < this.functions.length; i++) {
      code += `
${this.functions[i]}`;
      if (i === 0) {
        code += `\n}\n`;
      }
    }
    return code;
  }

  /** Adds indentation to the code for the current function. */
  private genIndent() {
    this.functions[this.curFunc] += ' '.repeat(this.indents[this.curFunc]);
  }

  /** Increase the amount of indenting for the current function. */
  private increaseIndent() {
    this.indents[this.curFunc] += 2;
  }

  /** Decrease the amount of indenting for the current function. */
  private decreaseIndent() {
    this.indents[this.curFunc] -= 2;
  }

  /** Adds the line 'code' to the current function. */
  private addCode(code: string) {
    this.genIndent();
    this.functions[this.curFunc] += code + `\n`;
  }

  /**
   * Debugging function that dump statistics about the program
   *
   * Reports number of instructions, stores, and loops.
   *
   * @param detailed If true, dumps more detailed stats
   */
  //public dumpStats(detailed: boolean = true) {
  //  let stats = `Total instructions: ${this.ops.length}\n`;
  //  let nesting = 0;
  //  let stores = 0;
  //  let totalStores = 0;
  //  let totalLoops = 0;
  //  const loopsAtNesting = new Array(this.maxLoopNesting);
  //  loopsAtNesting.fill(0);
  //  const storesAtNesting = new Array(this.maxLoopNesting + 1);
  //  storesAtNesting.fill(0);
  //  for (const op of this.ops) {
  //    switch (op.type) {
  //      case OpType.Store:
  //      case OpType.Ballot: {
  //        stores++;
  //        storesAtNesting[nesting]++;
  //        break;
  //      }
  //      case OpType.ForUniform:
  //      case OpType.LoopUniform:
  //      case OpType.ForVar:
  //      case OpType.ForInf:
  //      case OpType.LoopInf: {
  //        totalLoops++;
  //        loopsAtNesting[nesting]++;
  //        if (detailed) {
  //          stats += ' '.repeat(nesting) + `${stores} stores\n`;
  //        }
  //        totalStores += stores;
  //        stores = 0;

  //        if (detailed) {
  //          let iters = `subgroup size`;
  //          if (op.type === OpType.ForUniform || op.type === OpType.LoopUniform) {
  //            iters = `${op.value}`;
  //          }
  //          stats += ' '.repeat(nesting) + serializeOpType(op.type) + `: ${iters} iterations\n`;
  //        }
  //        nesting++;
  //        break;
  //      }
  //      case OpType.EndForUniform:
  //      case OpType.EndForInf:
  //      case OpType.EndForVar:
  //      case OpType.EndLoopUniform:
  //      case OpType.EndLoopInf: {
  //        if (detailed) {
  //          stats += ' '.repeat(nesting) + `${stores} stores\n`;
  //        }
  //        totalStores += stores;
  //        stores = 0;

  //        nesting--;
  //        if (detailed) {
  //          stats += ' '.repeat(nesting) + serializeOpType(op.type) + '\n';
  //        }
  //        break;
  //      }
  //      default:
  //        break;
  //    }
  //  }
  //  totalStores += stores;
  //  stats += `\n`;
  //  stats += `${totalLoops} loops\n`;
  //  for (let i = 0; i < loopsAtNesting.length; i++) {
  //    stats += ` ${loopsAtNesting[i]} at nesting ${i}\n`;
  //  }
  //  stats += `${totalStores} stores\n`;
  //  for (let i = 0; i < storesAtNesting.length; i++) {
  //    stats += ` ${storesAtNesting[i]} at nesting ${i}\n`;
  //  }
  //  console.log(stats);
  //}

  /**
   * Sizes the simulation buffer.
   *
   * The total size is (# of invocations) * |locs| * 4 (uint4 is written).
   * |locs| is capped at this.maxLocations.
   */
  public sizeRefData(locs: number) {
    const num = Math.min(this.maxLocations, locs);
    this.refData = new Uint32Array(num * 4 * this.invocations);
    this.refData.fill(0);
  }

  /**
   * Returns true if |mask| is uniform for the given style
   *
   * @param mask The active mask
   * @param size The subgroup size
   * @returns true if |mask| is uniform for the given style
   *
   */
  private isUniform(mask: bigint, size: number): boolean {
    if (this.style === Style.Workgroup || this.style === Style.WGSLv1) {
      if (any(mask) && !all(mask, this.invocations)) {
        return false;
      } else {
        return true;
      }
    } else if (this.style === Style.Subgroup) {
      let uniform: boolean = true;
      for (let id = 0; id < this.invocations; id += size) {
        const subgroupMask = (mask >> BigInt(id)) & getMask(size);
        if (subgroupMask !== 0n && !all(subgroupMask, size)) {
          uniform = false;
          break;
        }
      }
      return uniform;
    }

    return true;
  }

  /**
   * Simulate the program for the given subgroup size
   *
   * @param countOnly    If true, the reference output is not generated just max locations
   * @param subgroupSize The subgroup size to simulate
   *
   * BigInt is not the fastest value to manipulate. Care should be taken to optimize it's use.
   * Would it be better to roll my own 128 bitvector?
   *
   */
  public simulate(countOnly: boolean, subgroupSize: number, debug: boolean = false): number {
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
      // This state is considered nonuniform despite the active mask.
      isNonUniform: boolean;

      constructor() {
        this.activeMask = 0n;
        this.continueMask = 0n;
        this.header = 0;
        this.isLoop = false;
        this.tripCount = 0;
        this.isCall = false;
        this.isSwitch = false;
        this.isNonUniform = false;
      }

      // Reset the stack entry based on the parent state.
      reset(prev: State, header: number) {
        this.activeMask = prev.activeMask;
        this.continueMask = 0n;
        this.header = header;
        this.isLoop = false;
        this.tripCount = 0;
        this.isCall = false;
        this.isSwitch = false;
        this.isNonUniform = prev.isNonUniform;
      }
    }
    for (const op of this.ops) {
      op.uniform = true;
    }

    // Allocate the stack based on the maximum nesting in the program.
    // Note: this has proven to be considerably more performant than pushing
    // and popping from the array.
    const stack: State[] = new Array(this.maxProgramNesting + 1);
    for (let i = 0; i < stack.length; i++) {
      stack[i] = new State();
    }
    stack[0].activeMask = (1n << BigInt(this.invocations)) - 1n;

    let nesting = 0;
    let loopNesting = 0;
    const locs = new Array(this.invocations);
    locs.fill(0);

    let i = 0;
    while (i < this.ops.length) {
      const op = this.ops[i];
      if (nesting >= stack.length) {
        unreachable(
          `Max stack nesting surpassed (${stack.length} vs ${
            this.nesting
          }) at ops[${i}] = ${serializeOpType(op.type)}`
        );
      }
      //if (debug) {
      //  console.log(
      //    `ops[${i}] = ${serializeOpType(
      //      op.type
      //    )}, nesting = ${nesting}, loopNesting = ${loopNesting}, value = ${
      //      op.value
      //    }, nonuniform = ${stack[nesting].isNonUniform}`
      //  );
      //  console.log(`  mask = ${stack[nesting].activeMask.toString(16)}`);
      //}

      // Early outs if no invocations are active.
      // Don't skip ops that change nesting.
      switch (op.type) {
        case OpType.Ballot:
        case OpType.Store:
        case OpType.Return:
        case OpType.Continue:
        case OpType.Break: {
          // No reason to simulate if the current stack entry is inactive.
          if (!any(stack[nesting].activeMask)) {
            i++;
            continue;
          }
          break;
        }
        case OpType.ElseMask:
        case OpType.ElseId:
        case OpType.ElseLoopCount:
        case OpType.CaseMask:
        case OpType.CaseLoopCount: {
          // No reason to simulate if the previous stack entry is inactive.
          if (!any(stack[nesting - 1].activeMask)) {
            stack[nesting].activeMask = 0n;
            i++;
            continue;
          }
          break;
        }
        default:
          break;
      }
      switch (op.type) {
        case OpType.Ballot: {
          const curMask = stack[nesting].activeMask;
          const uniform = this.isUniform(curMask, subgroupSize);
          if (this.style !== Style.Maximal) {
            op.uniform = uniform;
          }
          if (uniform) {
            this.ucf = true;
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
                if (op.uniform && !stack[nesting].isNonUniform) {
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
          const cur = stack[nesting];
          if (!any(cur.activeMask)) {
            break;
          }

          for (let id = 0; id < this.invocations; id++) {
            if (testBit(cur.activeMask, id)) {
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
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          // O is always uniform true.
          if (op.value !== 0 && any(cur.activeMask)) {
            let subMask = this.getValueMask(op.value);
            subMask &= getMask(subgroupSize);
            cur.activeMask &= getReplicatedMask(subMask, subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.ElseMask: {
          // 0 is always uniform true so the else will never be taken.
          const cur = stack[nesting];
          const prev = stack[nesting - 1];
          if (op.value === 0) {
            cur.activeMask = 0n;
          } else if (any(prev.activeMask)) {
            let subMask = this.getValueMask(op.value);
            subMask &= getMask(subgroupSize);
            cur.activeMask = prev.activeMask;
            cur.activeMask &= ~getReplicatedMask(subMask, subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.IfId: {
          nesting++;
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          if (any(cur.activeMask)) {
            // All invocations with subgroup invocation id less than op.value are active.
            const mask = getReplicatedMask(getMask(op.value), subgroupSize, this.invocations);
            cur.activeMask &= mask;
          }
          break;
        }
        case OpType.ElseId: {
          const prev = stack[nesting - 1];
          // All invocations with a subgroup invocation id greater or equal to op.value are active.
          stack[nesting].activeMask = prev.activeMask;
          if (any(prev.activeMask)) {
            const mask = getReplicatedMask(getMask(op.value), subgroupSize, this.invocations);
            stack[nesting].activeMask &= ~mask;
          }
          break;
        }
        case OpType.IfLoopCount: {
          // Branch based on the subgroup invocation id == loop iteration.
          let n = nesting;
          while (!stack[n].isLoop) {
            n--;
          }
          if (n < 0) {
            unreachable(`Failed to find loop for IfLoopCount`);
          }

          nesting++;
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          if (any(cur.activeMask)) {
            const submask = BigInt(1 << stack[n].tripCount);
            const mask = getReplicatedMask(submask, subgroupSize, this.invocations);
            cur.activeMask &= mask;
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
          if (n < 0) {
            unreachable(`Failed to find loop for ElseLoopCount`);
          }

          stack[nesting].activeMask = stack[nesting - 1].activeMask;
          if (any(stack[nesting].activeMask)) {
            const submask = BigInt(1 << stack[n].tripCount);
            const mask = getReplicatedMask(submask, subgroupSize, this.invocations);
            stack[nesting].activeMask &= ~mask;
          }
          break;
        }
        case OpType.EndIf: {
          // End the current if.
          nesting--;
          break;
        }
        case OpType.ForUniform:
        case OpType.ForInf:
        case OpType.ForVar:
        case OpType.LoopUniform:
        case OpType.LoopInf: {
          nesting++;
          loopNesting++;
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          cur.isLoop = true;
          break;
        }
        case OpType.EndForUniform: {
          // Determine which invocations have another iteration of the loop to execute.
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          if (cur.tripCount < this.ops[cur.header].value && any(cur.activeMask)) {
            i = cur.header + 1;
            if (this.style === Style.WGSLv1 && !all(cur.activeMask, subgroupSize)) {
              cur.isNonUniform = true;
            }
            continue;
          } else {
            loopNesting--;
            nesting--;
          }
          break;
        }
        case OpType.EndForInf: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          if (any(cur.activeMask)) {
            let maskArray = new Uint32Array();
            const uniform = this.isUniform(cur.activeMask, subgroupSize) && !cur.isNonUniform;
            for (let id = 0; id < this.invocations; id++) {
              if (id % subgroupSize === 0) {
                maskArray = getSubgroupMask(cur.activeMask, subgroupSize, id);
              }
              if (testBit(cur.activeMask, id)) {
                if (!countOnly) {
                  const idx = this.baseIndex(id, locs[id]);
                  if (uniform) {
                    this.refData[idx + 0] = maskArray[0];
                    this.refData[idx + 1] = maskArray[1];
                    this.refData[idx + 2] = maskArray[2];
                    this.refData[idx + 3] = maskArray[3];
                  } else {
                    this.refData.fill(0x12345678, idx, idx + 4);
                  }
                }
                locs[id]++;
              }
            }
            if (this.style === Style.WGSLv1 && !uniform) {
              cur.isNonUniform = true;
            }
            i = cur.header + 1;
            continue;
          } else {
            loopNesting--;
            nesting--;
          }
          break;
        }
        case OpType.EndForVar: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          let done = !any(cur.activeMask) || cur.tripCount === Math.floor(subgroupSize / op.value);
          if (!done) {
            // i < (subgroup_invocation_id / reduction) + 1
            // So remove all ids < tripCount * reduction
            const submask = getMask(subgroupSize) & ~getMask(cur.tripCount * op.value);
            const mask = getReplicatedMask(submask, subgroupSize, this.invocations);
            cur.activeMask &= mask;
            done = !any(cur.activeMask);
          }

          if (done) {
            loopNesting--;
            nesting--;
          } else {
            if (this.style === Style.WGSLv1 && !all(cur.activeMask, subgroupSize)) {
              cur.isNonUniform = true;
            }
            i = cur.header + 1;
            continue;
          }
          break;
        }
        case OpType.EndLoopUniform: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          cur.continueMask = 0n;
          if (cur.tripCount < this.ops[cur.header].value && any(cur.activeMask)) {
            if (this.style === Style.WGSLv1 && !all(cur.activeMask, subgroupSize)) {
              cur.isNonUniform = true;
            }
            i = cur.header + 1;
            continue;
          } else {
            loopNesting--;
            nesting--;
          }
          break;
        }
        case OpType.EndLoopInf: {
          const cur = stack[nesting];
          cur.tripCount++;
          cur.activeMask |= cur.continueMask;
          if (any(cur.activeMask)) {
            let maskArray = new Uint32Array();
            const uniform = this.isUniform(cur.activeMask, subgroupSize) && !cur.isNonUniform;
            for (let id = 0; id < this.invocations; id++) {
              if (id % subgroupSize === 0) {
                maskArray = getSubgroupMask(cur.activeMask, subgroupSize, id);
              }
              if (testBit(cur.activeMask, id)) {
                if (!countOnly) {
                  const idx = this.baseIndex(id, locs[id]);
                  if (uniform) {
                    this.refData[idx + 0] = maskArray[0];
                    this.refData[idx + 1] = maskArray[1];
                    this.refData[idx + 2] = maskArray[2];
                    this.refData[idx + 3] = maskArray[3];
                  } else {
                    this.refData.fill(0x12345678, idx, idx + 4);
                  }
                }
                locs[id]++;
              }
            }
            if (this.style === Style.WGSLv1 && !uniform) {
              cur.isNonUniform = true;
            }
            i = cur.header + 1;
            continue;
          } else {
            loopNesting--;
            nesting--;
          }
          break;
        }
        case OpType.Break: {
          // Remove this active mask from all stack entries for the current loop/switch.
          const mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

          let n = nesting;
          for (; n >= 0; n--) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isLoop || stack[n].isSwitch) {
              break;
            }
          }
          if (n < 0) {
            unreachable(`Failed to find loop/switch for break`);
          }
          break;
        }
        case OpType.Continue: {
          // Remove this active mask from stack entries in this loop.
          // Add this mask to the loop's continue mask for the next iteration.
          const mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

          const uniform = this.style !== Style.WGSLv1 || this.isUniform(mask, subgroupSize);

          let n = nesting;
          for (; n >= 0; n--) {
            stack[n].activeMask &= ~mask;
            if (!uniform) {
              // Not all invocations continue on the same path.
              stack[n].isNonUniform = true;
            }
            if (stack[n].isLoop) {
              stack[n].continueMask |= mask;
              break;
            }
          }
          if (n < 0) {
            unreachable(`Failed to find loop for continue`);
          }

          break;
        }
        case OpType.Return: {
          // Remove this active mask from all stack entries for this function.
          const mask: bigint = stack[nesting].activeMask;
          if (!any(mask)) {
            break;
          }

          let n = nesting;
          for (; n >= 0; n--) {
            stack[n].activeMask &= ~mask;
            if (stack[n].isCall) {
              break;
            }
          }
          // op.value for Return is the call nesting.
          // If the value is > 0 we should have encountered the call on the stack.
          if (op.value !== 0 && n < 0) {
            unreachable(`Failed to find call for return`);
          }

          break;
        }
        case OpType.Elect: {
          nesting++;
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          if (any(cur.activeMask)) {
            cur.activeMask = getElectMask(cur.activeMask, subgroupSize, this.invocations);
          }
          break;
        }
        case OpType.Call: {
          nesting++;
          const cur = stack[nesting];
          // Header is unused for calls.
          cur.reset(stack[nesting - 1], 0);
          cur.isCall = true;
          break;
        }
        case OpType.EndCall: {
          nesting--;
          break;
        }
        case OpType.SwitchUniform:
        case OpType.SwitchVar:
        case OpType.SwitchLoopCount: {
          nesting++;
          const cur = stack[nesting];
          cur.reset(stack[nesting - 1], i);
          cur.isSwitch = true;
          break;
        }
        case OpType.EndSwitch: {
          nesting--;
          break;
        }
        case OpType.CaseMask: {
          const mask = getReplicatedMask(BigInt(op.value), 4, this.invocations);
          stack[nesting].activeMask = stack[nesting - 1].activeMask & mask;
          break;
        }
        case OpType.CaseLoopCount: {
          let n = nesting;
          let l = loopNesting;

          const findLoop = this.ops[stack[nesting].header].value;
          while (n >= 0 && l >= 0) {
            if (stack[n].isLoop) {
              l--;
              if (l === findLoop) {
                break;
              }
            }
            n--;
          }
          if (n < 0 || l < 0) {
            unreachable(`Failed to find loop for CaseLoopCount`);
          }

          if (((1 << stack[n].tripCount) & op.value) !== 0) {
            stack[nesting].activeMask = stack[nesting - 1].activeMask;
          } else {
            stack[nesting].activeMask = 0n;
          }
          break;
        }
        case OpType.Noise:
        case OpType.EndCase: {
          // No work
          break;
        }
        default: {
          unreachable(`Unhandled op ${serializeOpType(op.type)}`);
        }
      }
      i++;
    }

    assert(nesting === 0);

    let maxLoc = 0;
    for (let id = 0; id < this.invocations; id++) {
      maxLoc = Math.max(maxLoc, locs[id]);
    }
    maxLoc = Math.min(this.maxLocations, maxLoc);
    return maxLoc;
  }

  /**
   * @returns a mask formed from |masks[idx]|
   *
   * @param idx The index in |this.masks| to use.
   *
   */
  private getValueMask(idx: number): bigint {
    const x = this.masks[4 * idx];
    const y = this.masks[4 * idx + 1];
    const z = this.masks[4 * idx + 2];
    const w = this.masks[4 * idx + 3];
    let mask: bigint = 0n;
    mask |= BigInt(x);
    mask |= BigInt(y) << 32n;
    mask |= BigInt(z) << 64n;
    mask |= BigInt(w) << 96n;
    return mask;
  }

  /** @returns a randomized program */
  public generate() {
    //let i = 0;
    do {
      //if (i !== 0) {
      //  console.log(`Warning regenerating UCF testcase`);
      //}
      this.ops = [];
      while (this.ops.length < this.minCount) {
        this.pickOp(1);
      }
      //break;

      // If this is an uniform control flow case, make sure a uniform ballot is
      // generated. A subgroup size of 64 is used for testing purposes here.
      if (this.style !== Style.Maximal) {
        this.simulate(true, 64);
      }
      //i++;
    } while (this.style !== Style.Maximal && !this.ucf);
  }

  /** @returns true if the program has uniform control flow for some ballot */
  private isUCF(): boolean {
    return this.ucf;
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
    return (
      res[resIdx + 0] === ref[refIdx + 0] &&
      res[resIdx + 1] === ref[refIdx + 1] &&
      res[resIdx + 2] === ref[refIdx + 2] &&
      res[resIdx + 3] === ref[refIdx + 3]
    );
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
  public checkResults(
    ballots: Uint32Array /*locations: Uint32Array,*/,
    subgroupSize: number,
    numLocs: number
  ): Error | undefined {
    const totalLocs = Math.min(numLocs, this.maxLocations);
    if (this.style !== Style.Maximal) {
      if (!this.isUCF()) {
        return Error(`Expected some uniform condition for this test`);
      }
      // Subgroup and Workgroup tests always have an associated store
      // preceeding them in the buffer.
      const maskArray = getSubgroupMask(getMask(subgroupSize), subgroupSize);
      for (let id = 0; id < this.invocations; id++) {
        let refLoc = 1;
        let resLoc = 0;
        while (refLoc < totalLocs) {
          while (
            refLoc < totalLocs &&
            !this.matchResult(this.refData, this.baseIndex(id, refLoc), maskArray, 0)
          ) {
            refLoc++;
          }
          if (refLoc < numLocs) {
            // Fully converged simulation

            // Search for the corresponding data in the result.
            const storeRefLoc = refLoc - 1;
            while (
              resLoc + 1 < totalLocs &&
              !(
                this.matchResult(
                  ballots,
                  this.baseIndex(id, resLoc),
                  this.refData,
                  this.baseIndex(id, storeRefLoc)
                ) &&
                this.matchResult(
                  ballots,
                  this.baseIndex(id, resLoc + 1),
                  this.refData,
                  this.baseIndex(id, refLoc)
                )
              )
            ) {
              resLoc++;
            }

            if (resLoc + 1 >= totalLocs) {
              const sIdx = this.baseIndex(id, storeRefLoc);
              const bIdx = this.baseIndex(id, refLoc);
              const ref = this.refData;
              let msg = `Failure for invocation ${id}: could not find match for:\n`;
              msg += `- store[${storeRefLoc}] = ${this.refData[sIdx]}\n`;
              msg += `- ballot[${refLoc}] = (0x${hex(ref[bIdx + 3])},0x${hex(
                ref[bIdx + 2]
              )},0x${hex(ref[bIdx + 1])},0x${hex(ref[bIdx])})`;
              return Error(msg);
            }
            // Match both locations so don't revisit them.
            resLoc++;
            refLoc++;
          }
        }
      }
    } else {
      // Expect exact matches.
      for (let i = 0; i < this.refData.length; i += 4) {
        const idx_uvec4 = Math.floor(i / 4);
        const id = Math.floor(idx_uvec4 % this.invocations);
        const loc = Math.floor(idx_uvec4 / this.invocations);
        if (!this.matchResult(ballots, i, this.refData, i)) {
          let msg = `Failure for invocation ${id} at location ${loc}:\n`;
          msg += `- expected: (0x${hex(this.refData[i + 3])},0x${hex(this.refData[i + 2])},0x${hex(
            this.refData[i + 1]
          )},0x${hex(this.refData[i])})\n`;
          msg += `- got:      (0x${hex(ballots[i + 3])},0x${hex(ballots[i + 2])},0x${hex(
            ballots[i + 1]
          )},0x${hex(ballots[i])})`;
          return Error(msg);
        }
      }
      for (let i = this.refData.length; i < ballots.length; i++) {
        if (ballots[i] !== 0) {
          let msg = `Unexpected write at end of buffer (index = ${i}):\n`;
          msg += `- got:      (${ballots[i]})`;
          return Error(msg);
        }
      }
    }

    return undefined;
  }

  /**
   * Equivalent to:
   *
   * ballot(); // fully uniform
   * if (inputs[1] == 1)
   *   ballot(); // fullly uniform
   *   for (var i = 0; i < 3; i++)
   *     ballot(); // Simulation expects fully uniform, WGSL does not.
   *     if (testBit(vec4u(0xaaaaaaaa,0xaaaaaaa,0xaaaaaaaa,0xaaaaaaaa), subgroup_id))
   *       ballot(); // non-uniform
   *       continue;
   *     ballot(); // non-uniform
   *   ballot(); // fully uniform
   * ballot(); // fully uniform
   *
   * @param beginLoop The loop type
   * @param endLoop   The end loop type
   *
   * |beginLoop| and |endLoop| must be paired. Currently supported pairs:
   *  * ForUniform and EndForUniform
   *  * LoopUniform and EndLoopUniform
   */
  public predefinedProgram1(
    beginLoop: OpType = OpType.ForUniform,
    endLoop: OpType = OpType.EndForUniform
  ) {
    // Set the mask for index 1
    this.masks[4 * 1 + 0] = 0xaaaaaaaa;
    this.masks[4 * 1 + 1] = 0xaaaaaaaa;
    this.masks[4 * 1 + 2] = 0xaaaaaaaa;
    this.masks[4 * 1 + 3] = 0xaaaaaaaa;

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(beginLoop, 3));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Continue, 0));

    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(endLoop, 3));

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
   * if (subgroup_id < 16)
   *   ballot(); // 0xffff
   *   if (testbit(vec4u(0x00ff00ff,00ff00ff,00ff00ff,00ff00ff), subgroup_id))
   *     ballot(); // 0xff
   *     if (inputs[1] == 1)
   *       ballot(); // 0xff
   *     ballot(); // 0xff
   * else
   *   ballot(); // 0xF..0000
   *   return;
   * ballot; // 0xffff
   *
   * In this program, subgroups larger than 16 invocations diverge at the first if.
   * Subgroups larger than 8 diverge at the second if.
   * No divergence at the third if.
   * The else of the first if returns, so the final ballot is only uniform for subgroups <= 16.
   */
  public predefinedProgram2() {
    // Set the mask for index 1
    this.masks[4 * 1 + 0] = 0x00ff00ff;
    this.masks[4 * 1 + 1] = 0x00ff00ff;
    this.masks[4 * 1 + 2] = 0x00ff00ff;
    this.masks[4 * 1 + 3] = 0x00ff00ff;

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
    this.ops.push(new Op(OpType.Return, 0));

    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * if subgroup_id < inputs[107]
   *   if subgroup_id < inputs[112]
   *     ballot();
   *     if testBit(vec4u(0xd2f269c6,0xffe83b3f,0xa279f695,0x58899224), subgroup_id)
   *       ballot();
   *     else
   *       ballot()
   *     ballot();
   *   else
   *     ballot();
   *
   * The first two if statements are uniform for subgroup sizes 64 or less.
   * The third if statement is non-uniform for all subgroup sizes.
   * It is tempting for compilers to collapse the third if/else into a single
   * basic block which can lead to unexpected convergence of the ballots.
   */
  public predefinedProgram3() {
    // Set the mask for index 1
    this.masks[4 * 1 + 0] = 0xd2f269c6;
    this.masks[4 * 1 + 1] = 0xffe83b3f;
    this.masks[4 * 1 + 2] = 0xa279f695;
    this.masks[4 * 1 + 3] = 0x58899224;

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
    this.ops.push(new Op(OpType.ElseId, 112));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.EndIf, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i = 0; ; i++, ballot())
   *   ballot();
   *   if (subgroupElect())
   *     ballot();
   *     break;
   * ballot();
   *
   * @param beginType The loop type
   * @param endType   The end loop type
   *
   * |beginType| and |endType| must be paired. Currently supported pairs:
   *  * ForInf and EndForInf
   *  * LoopInf and EndLoopInf
   */
  public predefinedProgramInf(
    beginType: OpType = OpType.ForInf,
    endType: OpType = OpType.EndForInf
  ) {
    this.ops.push(new Op(beginType, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Elect, 0));

    this.ops.push(new Op(OpType.Break, 0));

    this.ops.push(new Op(OpType.EndIf, 0));
    this.ops.push(new Op(endType, 0));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i = 0; i < subgroup_invocation_id + 1; i++)
   *   ballot();
   * ballot();
   * for (var i = 0; i < subgroup_invocation_id + 1; i++)
   *   ballot();
   * ballot();
   */
  public predefinedProgramForVar() {
    this.ops.push(new Op(OpType.ForVar, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForVar, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.ForVar, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForVar, 1));

    this.ops.push(new Op(OpType.Store, this.ops.length + this.storeBase));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * fn f0()
   *   for (var i = 0; i < inputs[3]; i++)
   *     f1(i);
   *     ballot();
   *   ballot();
   *   if (inputs[3] == 3)
   *    f2();
   *    ballot();
   *   ballot()
   * fn f1(i : u32)
   *   ballot();
   *   if (subgroup_invocation_id == i)
   *     ballot();
   *     return;
   * fn f2()
   *   ballot();
   *   if (testBit(vec4u(0xaaaaaaaa,0xaaaaaaaa,0xaaaaaaaa,0xaaaaaaaa), local_invocation_index))
   *     ballot();
   *     return;
   */
  public predefinedProgramCall() {
    this.masks[4 + 0] = 0xaaaaaaaa;
    this.masks[4 + 1] = 0xaaaaaaaa;
    this.masks[4 + 2] = 0xaaaaaaaa;
    this.masks[4 + 3] = 0xaaaaaaaa;

    this.ops.push(new Op(OpType.ForUniform, 3));

    this.ops.push(new Op(OpType.Call, 0));
    // f1
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfLoopCount, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Return, 1));
    this.ops.push(new Op(OpType.EndIf, 0));
    // end f1
    this.ops.push(new Op(OpType.EndCall, 0));

    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndForUniform, 3));

    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 0));

    this.ops.push(new Op(OpType.Call, 0));
    // f2
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.IfMask, 1));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Return, 1));
    this.ops.push(new Op(OpType.EndIf, 0));
    // end f2
    this.ops.push(new Op(OpType.EndCall, 0));

    this.ops.push(new Op(OpType.EndIf, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * ballot()
   * switch (inputs[5])
   *   default
   *   case 6 ballot();
   *   case 5 ballot();
   *   case 7 ballot();
   * ballot();
   *
   */
  public predefinedProgramSwitchUniform() {
    const value = 5;
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.SwitchUniform, value));
    this.ops.push(new Op(OpType.CaseMask, 0, 1 << (value + 1)));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.CaseMask, 0xf, 1 << value));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.CaseMask, 0, 1 << (value + 2)));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * ballot();
   * switch subgroup_invocation_id & 3
   *   default
   *   case 0: ballot();
   *   case 1: ballot();
   *   case 2: ballot();
   *   case 3: ballot();
   * ballot();
   */
  public predefinedProgramSwitchVar() {
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.SwitchVar, 0));
    this.ops.push(new Op(OpType.CaseMask, 0x1, 1 << 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.CaseMask, 0x2, 1 << 1));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.CaseMask, 0x4, 1 << 2));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.CaseMask, 0x8, 1 << 3));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));
    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i0 = 0u; i0 < inputs[3]; i0++)
   *   for (var i1 = 0u; i1 < inputs[3]; i1++)
   *     for (var i2 = 0u; i2 < subgroup_invocation_id + 1; i2++)
   *       ballot();
   *       switch i_loop
   *         case 1 ballot();
   *         case 2 ballot();
   *         default ballot();
   *       ballot();
   */
  public predefinedProgramSwitchLoopCount(loop: number) {
    this.ops.push(new Op(OpType.ForUniform, 1));
    this.ops.push(new Op(OpType.ForUniform, 2));
    this.ops.push(new Op(OpType.ForVar, 4));

    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.SwitchLoopCount, loop));

    this.ops.push(new Op(OpType.CaseLoopCount, 1 << 1, 1));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseLoopCount, 1 << 2, 2));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseLoopCount, 0xfffffff9, 0xffffffff));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.EndForVar, 4));
    this.ops.push(new Op(OpType.EndForUniform, 3));
    this.ops.push(new Op(OpType.EndForUniform, 3));
  }

  /**
   * Equivalent to:
   *
   * switch subgroup_invocation_id & 0x3
   *   default
   *   case 0,1 ballot();
   *   case 2,3 ballot();
   */
  public predefinedProgramSwitchMulticase() {
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.SwitchVar, 0));

    this.ops.push(new Op(OpType.CaseMask, 0x3, (1 << 0) | (1 << 1)));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.CaseMask, 0xc, (1 << 2) | (1 << 3)));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndCase, 0));

    this.ops.push(new Op(OpType.EndSwitch, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * ballot();
   * for (var i = 0; i < inputs[3]; i++)
   *   ballot();
   *   if (subgroupElect())
   *     continue;
   * ballot();
   *
   * This case can distinguish between Workgroup and WGSLv1 reconvergence.
   * The ballot in the loop is not required to be converged for WGSLv1.
   */
  public predefinedProgramWGSLv1() {
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.ForUniform, 3));

    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Elect, 0));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Continue, 0));
    this.ops.push(new Op(OpType.EndIf, 0));

    this.ops.push(new Op(OpType.EndForUniform, 2));
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
  }

  /**
   * Equivalent to:
   *
   * for (var i0 = 0u; i0 < inputs[3]; i0++)
   *   ballot();
   *   if subgroup_invocation_id < inputs[128]
   *     ballot();
   *     if subgroup_invocation_id < inputs[128]
   *       ballot();
   *       if subgroup_invocation_id < inputs[128]
   *         for (var i1 = 0u; i1 < inputs[3]; i1++)
   *           if subgroup_invocation_id < inputs[128]
   *             ballot();
   *             break;
   *           if inputs[3] == 3
   *             ballot();
   *         ballot();
   *
   */
  public predefinedProgramAllUniform() {
    this.ops.push(new Op(OpType.ForUniform, 3)); // for 0
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.IfId, 128)); // if 0
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.IfId, 128)); // if 1
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.IfId, 128)); // if 2
    this.ops.push(new Op(OpType.ForUniform, 3)); // for 1
    this.ops.push(new Op(OpType.IfId, 128)); // if 3
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.Break, 0));
    this.ops.push(new Op(OpType.EndIf, 0)); // end if 3

    this.ops.push(new Op(OpType.IfMask, 0)); // if 4
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));
    this.ops.push(new Op(OpType.EndIf, 0)); // end if 4

    this.ops.push(new Op(OpType.EndForUniform, 0)); // end for 1

    this.ops.push(new Op(OpType.ElseId, 128)); // else if 2
    this.ops.push(new Op(OpType.EndIf, 0)); // end if 2
    this.ops.push(new Op(OpType.Store, this.storeBase + this.ops.length));
    this.ops.push(new Op(OpType.Ballot, 0));

    this.ops.push(new Op(OpType.EndIf, 0)); // end if 1

    this.ops.push(new Op(OpType.EndIf, 0)); // end if 0

    this.ops.push(new Op(OpType.EndForUniform, 0)); // end for 0
  }
}

export function generateSeeds(numCases: number): number[] {
  const prng: PRNG = new PRNG(1);
  const output: number[] = new Array(numCases);
  for (let i = 0; i < numCases; i++) {
    output[i] = prng.randomU32();
  }
  return output;
}
