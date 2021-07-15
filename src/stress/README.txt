WebGPU stress tests.

These tests are part of a separate "suite" from the conformance tests because they are likely to
cause browser hangs and crashes.

Add informal notes here on possible stress tests.

- getMappedRange on an oom-buffer-mappedAtCreation.
    Should throw RangeError above some threshold, but below that may just crash the page.
- Allocating tons of {{unmappable, mapAtCreation, mapAtCreation then unmapped, mappable} buffer, texture}
    memory in ~64MB chunks until OOM.
    - Fill with arbitrary data
    - If mappable: then, once max is reached, try to mapAsync all of them.
- Test buffer mapping conditions around real-VRAM-OOM (as opposed to shmem OOM):
  - while(!oom) { allocate 512MB (non-mappable) }
  - Try to allocate 64MB to fill a little extra space (ignore OOM if it happens).
  - Try to allocate 512MB with `mappedAtCreation:true`, expect this to OOM (theoretically this should be VRAM OOM and not shmem OOM).
  - Test getMappedRange of a small range, it should still succeed in returning a (dummy) range.
- Allocating and {dropping, destroying} ~64MB {{unmappable, mapAtCreation, mappable} buffers, textures} for a while.
    - Fill with arbitrary data
- Creating a huge number of ShaderModules/RenderPipelines/ComputePipelines.
- Creating a huge number of tiny resources.
- Creating huge numbers of other objects.
- Issuing {draw, dispatch} calls with huge counts.
- Issuing {draw, dispatch} calls with very slow or infinite-looping shaders.
- {Render,compute} passes with ~millions of bind groups,
- Huge amounts of bind group churn (creating many bind groups and switching between them).

TODO: Look at dEQP (OpenGL ES and Vulkan) and WebGL for inspiration here.
