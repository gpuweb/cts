import { GPUTest } from "../../../gpu_test";
import { checkElementsPassPredicate } from '../../../util/check_contents.js';

export type MemoryModelParams = {
  workgroupSize: number;
  /** The number of workgroups to assign to running the test. */
  testingWorkgroups: number;
  /** 
   * Run no more than this many workgroups. Must be >= the number of testing workgroups. Non-testing workgroups are used
   * to stress other memory locations.
   */
  maxWorkgroups: number;
  /** The percentage of iterations to shuffle the workgroup ids. */
  shufflePct: number;
  /** The percentage of iterations to run the bounded spin-loop barrier. */
  barrierPct: number;
  /** The percentage of iterations to run memory stress using non-testing workgroups. */
  memStressPct: number;
  /** The number of iterations to run the memory stress pattern. */
  memStressIterations: number;
  /** The percentage of iterations the first instruction in the stress pattern should be a store. */
  memStressStoreFirstPct: number;
  /** The percentage of iterations the second instruction in the stress pattern should be a store. */
  memStressStoreSecondPct: number;
  /** The percentage of iterations for testing threads to run stress before running the test. */
  preStressPct: number;
  /** Same as for memStressIterations. */
  preStressIterations: number;
  /** The percentage of iterations the first instruction in the pre-stress pattern should be a store. */
  preStressStoreFirstPct: number;
  /** The percentage of iterations the second instruction in the pre-stress pattern should be a store. */
  preStressStoreSecondPct: number;
  /** The size of the scratch memory region, used for stressing threads. */
  scratchMemorySize: number;
  /** The size of each block of memory stressing threads access. */
  stressLineSize: number;
  /** The number of blocks of memory to assign stressing threads to. */
  stressTargetLines: number;
  /** How non-testing threads are assigned to stressing locations. 100 means all iterations use a round robin approach, 0 means all use a chunking approach. */
  stressStrategyBalancePct: number;
  /** Used to permute thread ids within a workgroup, so more random pairings are created between threads coordinating on a test. */
  permuteFirst: number;
  /** Used to create distance between memory locations used in a test. Set this to 1 for memory that should be aliased. */
  permuteSecond: number;
  /** The distance (in number of 4 byte intervals) between any two memory locations used for testing. */
  memStride: number;
  /** For tests that access one memory location, but use dynamic addresses to avoid compiler optimization, aliased memory should be set to true. */
  aliasedMemory: boolean;
  /** The number of memory locations accessed by this test. */
  numMemLocations: number;
  /** The number of read outputs per test that need to be analyzed in the result aggregation shader. */
  numReadOutputs: number;
  /** The number of possible behaviors that a test can have. */
  numBehaviors: number;
}

/** Represents a device buffer and a utility buffer for resetting memory and copying parameters. */
type BufferWithSource = {
  deviceBuf: GPUBuffer;
  srcBuf: GPUBuffer;
  size: number;
}

/** Specifies the buffers used during a memory model test. */
type MemoryModelBuffers = {
  /** This is the memory region that testing threads read from and write to. */
  testLocations: BufferWithSource;
  /** This buffer collects the results of reads for analysis in the result aggregation shader. */
  readResults: BufferWithSource;
  /** This buffer is the aggregated results of every testing thread, and is used to check for test success/failure. */
  testResults: BufferWithSource;
  /** This buffer stores the shuffled workgroup ids for use during testing. */
  shuffledWorkgroups: BufferWithSource;
  /** This is the bounded spin-loop barrier, used to temporally align testing threads. */
  barrier: BufferWithSource;
  /** Memory region for stressing threads to read to and write from. */
  scratchpad: BufferWithSource;
  /** The memory locations in the scratch region that stressing threads access. */
  scratchMemoryLocations: BufferWithSource;
  /** Parameters that are used by the shader to calculate memory locations and perform stress. */
  stressParams: BufferWithSource;
}

/** The number of stress params to add to the stress params buffer. */
const numStressParams = 12;

/** Buffer sizes are specified in number of memory locations, multiplying by 4 gives the number of bytes. */
const byteMultiplier = 4;

/** Uniform buffer elements must align to a 16 byte boundary (see https://www.w3.org/TR/WGSL/#storage-class-layout-constraints). */
const uniformBufferAlignment = 4;
const uniformByteMultiplier = 16;


/** Implements setup code necessary to run a memory model shader.  */
export class MemoryModelTester {
  protected test: GPUTest;
  protected params: MemoryModelParams;
  protected buffers: MemoryModelBuffers;
  protected testPipeline: GPUComputePipeline;
  protected testBindGroup: GPUBindGroup;
  protected resultPipeline: GPUComputePipeline;
  protected resultBindGroup: GPUBindGroup;

  /** Sets up a memory model test by initializing buffers and pipeline layouts. */
  constructor(t: GPUTest, params: MemoryModelParams, testShader: string, resultShader: string) {
    this.test = t;
    this.params = params;

    // set up buffers
    const testingThreads = this.params.workgroupSize * this.params.testingWorkgroups;
    const testLocationsSize = testingThreads * this.params.numMemLocations * this.params.memStride * byteMultiplier;
    const testLocationsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: testLocationsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.makeBufferWithContents(new Uint32Array(testLocationsSize).fill(0), GPUBufferUsage.COPY_SRC),
      size: testLocationsSize
    };

    const readResultsSize = testingThreads * this.params.numReadOutputs * byteMultiplier;
    const readResultsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: readResultsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.makeBufferWithContents(new Uint32Array(readResultsSize).fill(0), GPUBufferUsage.COPY_SRC),
      size: readResultsSize
    };

    const testResultsSize = this.params.numBehaviors * byteMultiplier;
    const testResultsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: testResultsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC}),
      srcBuf: this.test.makeBufferWithContents(new Uint32Array(testResultsSize).fill(0), GPUBufferUsage.COPY_SRC),
      size: testResultsSize
    };

    const shuffledWorkgroupsSize = this.params.testingWorkgroups * byteMultiplier;
    const shuffledWorkgroupsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: shuffledWorkgroupsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.device.createBuffer({
        size: shuffledWorkgroupsSize,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE}),
      size: shuffledWorkgroupsSize
    };

    const barrierSize = byteMultiplier;
    const barrierBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: barrierSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.makeBufferWithContents(new Uint32Array(barrierSize).fill(0), GPUBufferUsage.COPY_SRC),
      size: barrierSize
    };

    const scratchpadSize = this.params.scratchMemorySize * byteMultiplier;
    const scratchpadBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: scratchpadSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.makeBufferWithContents(new Uint32Array(scratchpadSize).fill(0), GPUBufferUsage.COPY_SRC),
      size: scratchpadSize
    };

    const scratchMemoryLocationsSize = this.params.maxWorkgroups * byteMultiplier;
    const scratchMemoryLocationsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: scratchMemoryLocationsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.STORAGE}),
      srcBuf: this.test.device.createBuffer({
        size: scratchMemoryLocationsSize,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE}),
      size: scratchMemoryLocationsSize
    };

    const stressParamsSize = numStressParams * uniformByteMultiplier;
    const stressParamsBuffer: BufferWithSource = {
      deviceBuf: this.test.device.createBuffer({
        size: stressParamsSize,
        usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.UNIFORM}),
      srcBuf: this.test.device.createBuffer({
        size: stressParamsSize,
        usage: GPUBufferUsage.COPY_SRC | GPUBufferUsage.MAP_WRITE}),
      size: stressParamsSize
    };

    this.buffers = {
      testLocations: testLocationsBuffer,
      readResults: readResultsBuffer,
      testResults: testResultsBuffer,
      shuffledWorkgroups: shuffledWorkgroupsBuffer,
      barrier: barrierBuffer,
      scratchpad: scratchpadBuffer,
      scratchMemoryLocations: scratchMemoryLocationsBuffer,
      stressParams: stressParamsBuffer
    };

    // set up pipeline layouts
    const testLayout = this.test.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 4, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 5, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 6, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.testPipeline = this.test.device.createComputePipeline({
      layout: this.test.device.createPipelineLayout({
        bindGroupLayouts: [testLayout]
      }),
      compute: {
        module: this.test.device.createShaderModule({
          code: testShader
        }),
        entryPoint: 'main'
      }
    });
    this.testBindGroup = this.test.device.createBindGroup({
      entries: [
        { binding: 0, resource: { buffer: this.buffers.testLocations.deviceBuf } },
        { binding: 1, resource: { buffer: this.buffers.readResults.deviceBuf } },
        { binding: 2, resource: { buffer: this.buffers.shuffledWorkgroups.deviceBuf } },
        { binding: 3, resource: { buffer: this.buffers.barrier.deviceBuf } },
        { binding: 4, resource: { buffer: this.buffers.scratchpad.deviceBuf } },
        { binding: 5, resource: { buffer: this.buffers.scratchMemoryLocations.deviceBuf } },
        { binding: 6, resource: { buffer: this.buffers.stressParams.deviceBuf } }
      ],
      layout: testLayout
    });

    const resultLayout = this.test.device.createBindGroupLayout({
      entries: [
        { binding: 0, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 1, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 2, visibility: GPUShaderStage.COMPUTE, buffer: { type: "storage" } },
        { binding: 3, visibility: GPUShaderStage.COMPUTE, buffer: { type: "uniform" } }
      ]
    });
    this.resultPipeline = this.test.device.createComputePipeline({
      layout: this.test.device.createPipelineLayout({
        bindGroupLayouts: [resultLayout]
      }),
      compute: {
        module: this.test.device.createShaderModule({
          code: resultShader
        }),
        entryPoint: 'main'
      }
    });
    this.resultBindGroup = this.test.device.createBindGroup({
      entries: [
        { binding: 0, resource: { buffer: this.buffers.testLocations.deviceBuf } },
        { binding: 1, resource: { buffer: this.buffers.readResults.deviceBuf } },
        { binding: 2, resource: { buffer: this.buffers.testResults.deviceBuf } },
        { binding: 3, resource: { buffer: this.buffers.stressParams.deviceBuf } }
      ],
      layout: resultLayout
    });
  }

  /** 
   * Run the test for the specified number of iterations. Checks the testResults buffer on the weakIndex; if
   * this value is not 0 then the test has failed.
   */
  async run(iterations: number, weakIndex: number): Promise<void> {
    for (let i = 0; i < iterations; i++) {
      const numWorkgroups = this.getRandomInRange(this.params.testingWorkgroups, this.params.maxWorkgroups);
      await this.setShuffledWorkgroups(numWorkgroups);
      await this.setScratchLocations(numWorkgroups);
      await this.setStressParams();
      const encoder = this.test.device.createCommandEncoder();
      this.copyBufferToBuffer(encoder, this.buffers.testLocations);
      this.copyBufferToBuffer(encoder, this.buffers.readResults);
      this.copyBufferToBuffer(encoder, this.buffers.testResults);
      this.copyBufferToBuffer(encoder, this.buffers.barrier);
      this.copyBufferToBuffer(encoder, this.buffers.shuffledWorkgroups);
      this.copyBufferToBuffer(encoder, this.buffers.scratchpad);
      this.copyBufferToBuffer(encoder, this.buffers.scratchMemoryLocations);
      this.copyBufferToBuffer(encoder, this.buffers.stressParams);

      const testPass = encoder.beginComputePass();
      testPass.setPipeline(this.testPipeline);
      testPass.setBindGroup(0, this.testBindGroup);
      testPass.dispatch(numWorkgroups);
      testPass.endPass();

      const resultPass = encoder.beginComputePass();
      resultPass.setPipeline(this.resultPipeline);
      resultPass.setBindGroup(0, this.resultBindGroup);
      resultPass.dispatch(this.params.testingWorkgroups);
      resultPass.endPass();

      this.test.device.queue.submit([encoder.finish()]);
      this.test.expectGPUBufferValuesPassCheck(this.buffers.testResults.deviceBuf, this.checkWeakIndex(weakIndex), {
        type: Uint32Array,
        typedLength: this.params.numBehaviors
      });
    }
  }

  /** Returns a function that checks whether the test passes, given a weak index and the test results buffer. */
  protected checkWeakIndex(weakIndex: number): (a: Uint32Array) => Error | undefined {
    const checkResult = this.checkResult(weakIndex);
    const resultPrinter = this.resultPrinter(weakIndex);
    return function(a: Uint32Array): Error | undefined {
      return checkElementsPassPredicate(a, checkResult, {
        predicatePrinter: [{leftHeader: 'expected ==', getValueForCell: resultPrinter}]
      })
    }
  }

  /** Returns a function that checks whether the specified weak index's value is not equal to 0. */
  protected checkResult(weakIndex: number): (i: number, v: number) => boolean {
    return function(i: number, v: number): boolean {
      if (i == weakIndex && v > 0) {
        return false;
      }
      return true;
    }
  }

  /** Returns a printer function that visualizes the results of checking the test results. */
  protected resultPrinter(weakIndex: number): (i: number) => string | number {
    return function(i: number): string | number {
      if (i == weakIndex) {
        return 0;
      } else {
        return "any value";
      }
    }
  }

  /** Utility method that simplifies copying source buffers to device buffers. */
  protected copyBufferToBuffer(encoder: GPUCommandEncoder, buffer: BufferWithSource): void {
    encoder.copyBufferToBuffer(buffer.srcBuf, 0, buffer.deviceBuf, 0, buffer.size);
  }

  /** Returns a random integer between 0 and the max. */
  protected getRandomInt(max: number): number {
    return Math.floor(Math.random() * max);
  }

  /** Returns a random number in between the min and max values. */
  protected getRandomInRange(min: number, max: number): number {
    if (min == max) {
      return min;
    } else {
      const offset = this.getRandomInt(max - min);
      return min + offset;
    }
  }

  /** 
   * Shuffles the order of workgroup ids, so that threads operating on the same memory location are not always in 
   * consecutive workgroups.
   */
  protected async setShuffledWorkgroups(numWorkgroups: number): Promise<void> {
    await this.buffers.shuffledWorkgroups.srcBuf.mapAsync(GPUMapMode.WRITE);
    const shuffledWorkgroupsBuffer = this.buffers.shuffledWorkgroups.srcBuf.getMappedRange();
    const shuffledWorkgroupsArray = new Uint32Array(shuffledWorkgroupsBuffer);
    for (let i = 0; i < numWorkgroups; i++) {
      shuffledWorkgroupsArray[i] = i;
    }
    if (this.getRandomInt(100) < this.params.shufflePct) {
      for (let i = numWorkgroups - 1; i > 0; i--) {
        const x = this.getRandomInt(i + 1);
        const temp = shuffledWorkgroupsArray[i];
        shuffledWorkgroupsArray[i] = shuffledWorkgroupsArray[x];
        shuffledWorkgroupsArray[x] = temp;
      }
    }
    this.buffers.shuffledWorkgroups.srcBuf.unmap();
  }

  /** Sets the memory locations that stressing workgroups will access. Uses either a chunking or round robin assignment strategy. */
  protected async setScratchLocations(numWorkgroups: number): Promise<void> {
    await this.buffers.scratchMemoryLocations.srcBuf.mapAsync(GPUMapMode.WRITE);
    const scratchLocationsArrayBuffer = this.buffers.scratchMemoryLocations.srcBuf.getMappedRange();
    const scratchLocationsArray = new Uint32Array(scratchLocationsArrayBuffer);
    const scratchUsedRegions = new Set();
    const scratchNumRegions = this.params.scratchMemorySize / this.params.stressLineSize;
    for (let i = 0; i < this.params.stressTargetLines; i++) {
      let region = this.getRandomInt(scratchNumRegions);
      while (scratchUsedRegions.has(region)) {
        region = this.getRandomInt(scratchNumRegions);
      }
      const locInRegion = this.getRandomInt(this.params.stressLineSize);
      if (this.getRandomInt(100) < this.params.stressStrategyBalancePct) {
        for (let j = i; j < numWorkgroups; j += this.params.stressTargetLines) {
          scratchLocationsArray[j] = region * this.params.stressLineSize + locInRegion;
        }
      } else {
        const workgroupsPerLocation = numWorkgroups / this.params.stressTargetLines;
        for (let j = 0; j < workgroupsPerLocation; j++) {
          scratchLocationsArray[i * workgroupsPerLocation + j] = region * this.params.stressLineSize + locInRegion;
        }
        if (i == this.params.stressTargetLines - 1 && numWorkgroups % this.params.stressTargetLines != 0) {
          for (let j = 0; j < numWorkgroups % this.params.stressTargetLines; j++) {
            scratchLocationsArray[numWorkgroups - j - 1] = region * this.params.stressLineSize + locInRegion;
          }
        }
      }
      scratchUsedRegions.add(region);
    }
    this.buffers.scratchMemoryLocations.srcBuf.unmap();
  }

  /** Sets the parameters that are used by the shader to calculate memory locations and perform stress. */
  protected async setStressParams(): Promise<void> {
    await this.buffers.stressParams.srcBuf.mapAsync(GPUMapMode.WRITE);
    const stressParamsArrayBuffer = this.buffers.stressParams.srcBuf.getMappedRange();
    const stressParamsArray = new Uint32Array(stressParamsArrayBuffer);
    if (this.getRandomInt(100) < this.params.barrierPct) {
      stressParamsArray[0] = 1;
    } else {
      stressParamsArray[0] = 0;
    }
    if (this.getRandomInt(100) < this.params.memStressPct) {
      stressParamsArray[1 * uniformBufferAlignment] = 1;
    } else {
      stressParamsArray[1 * uniformBufferAlignment] = 0;
    }
    stressParamsArray[2 * uniformBufferAlignment] = this.params.memStressIterations;
    const memStressStoreFirst = this.getRandomInt(100) < this.params.memStressStoreFirstPct;
    const memStressStoreSecond = this.getRandomInt(100) < this.params.memStressStoreSecondPct; 
    let memStressPattern;
    if (memStressStoreFirst && memStressStoreSecond) {
      memStressPattern = 0;
    } else if (memStressStoreFirst && !memStressStoreSecond) {
      memStressPattern = 1;
    } else if (!memStressStoreFirst && memStressStoreSecond) {
      memStressPattern = 2;
    } else {
      memStressPattern = 3;
    }
    stressParamsArray[3*uniformBufferAlignment] = memStressPattern;
    if (this.getRandomInt(100) < this.params.preStressPct) {
      stressParamsArray[4 * uniformBufferAlignment] = 1;
    } else {
      stressParamsArray[4 * uniformBufferAlignment] = 0;
    }
    stressParamsArray[5 * uniformBufferAlignment] = this.params.preStressIterations;
    const preStressStoreFirst = this.getRandomInt(100) < this.params.preStressStoreFirstPct;
    const preStressStoreSecond = this.getRandomInt(100) < this.params.preStressStoreSecondPct; 
    let preStressPattern;
    if (preStressStoreFirst && preStressStoreSecond) {
      preStressPattern = 0;
    } else if (preStressStoreFirst && !preStressStoreSecond) {
      preStressPattern = 1;
    } else if (!preStressStoreFirst && preStressStoreSecond) {
      preStressPattern = 2;
    } else {
      preStressPattern = 3;
    }
    stressParamsArray[6*uniformBufferAlignment] = preStressPattern;
    stressParamsArray[7 * uniformBufferAlignment] = this.params.permuteFirst;
    stressParamsArray[8 * uniformBufferAlignment] = this.params.permuteSecond;
    stressParamsArray[9 * uniformBufferAlignment] = this.params.testingWorkgroups;
    stressParamsArray[10 * uniformBufferAlignment] = this.params.memStride;
    if (this.params.aliasedMemory) {
      stressParamsArray[11 * uniformBufferAlignment] = 0;
    } else {
      stressParamsArray[11 * uniformBufferAlignment] = this.params.memStride;
    }
    this.buffers.stressParams.srcBuf.unmap();
  }
}