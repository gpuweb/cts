import { assert } from '../../../../common/util/util.js';

export function useAsImageSource2dDrawImage(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const context2d = dst.getContext('2d') as CanvasRenderingContext2D;
  context2d.drawImage(src, 0, 0);
}

export function useAsImageSourceToDataURL(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const context2d = dst.getContext('2d') as CanvasRenderingContext2D;
  const imgFromDataUrl = new Image();
  imgFromDataUrl.src = src.toDataURL();
  imgFromDataUrl.onload = () => {
    context2d.drawImage(imgFromDataUrl, 0, 0);
  };
}

export function useAsImageSourceToBlob(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const context2d = dst.getContext('2d') as CanvasRenderingContext2D;
  const imgFromBlob = new Image(src.width, src.height);
  src.toBlob(blob => {
    assert(blob !== null);
    const url = URL.createObjectURL(blob);
    imgFromBlob.src = url;
  });
  imgFromBlob.onload = () => {
    context2d.drawImage(imgFromBlob, 0, 0);
  };
}

export function useAsImageSourceCreateImageBitmap(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const context2d = dst.getContext('2d') as CanvasRenderingContext2D;
  createImageBitmap(src).then(image => {
    context2d.drawImage(image, 0, 0);
  }, null);
}

const kVertexShaderSourceWebGL = `
attribute vec4 a_Position;
varying vec2 v_Texcoord;
void main()
{
  v_Texcoord = (a_Position.xy + vec2(1.0, 1.0)) * 0.5;
  v_Texcoord.y = 1.0 - v_Texcoord.y;
  gl_Position = a_Position;
}
`;

const kFragmentShaderSourceWebGL = `
precision mediump float;
varying vec2 v_Texcoord;
uniform sampler2D u_Texture2D;
void main() {
  gl_FragColor = texture2D(u_Texture2D, v_Texcoord);
}
`;

const kVertices = new Float32Array([1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1]);

function WebGLDrawTexQuad(gl: WebGLRenderingContext) {
  const vertexShader = gl.createShader(gl.VERTEX_SHADER);
  if (vertexShader) {
    gl.shaderSource(vertexShader, kVertexShaderSourceWebGL);
    gl.compileShader(vertexShader);
  } else {
    return;
  }

  const fragmentShader = gl.createShader(gl.FRAGMENT_SHADER);
  if (fragmentShader) {
    gl.shaderSource(fragmentShader, kFragmentShaderSourceWebGL);
    gl.compileShader(fragmentShader);
  } else {
    return;
  }

  const program = gl.createProgram();
  if (!program) {
    return;
  }
  gl.attachShader(program, vertexShader);
  gl.attachShader(program, fragmentShader);
  gl.bindAttribLocation(program, 0, 'a_Position');
  gl.linkProgram(program);
  gl.useProgram(program);

  const vertexBuffer = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vertexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER, kVertices, gl.STATIC_DRAW);
  gl.enableVertexAttribArray(0);
  gl.vertexAttribPointer(0, 2, gl.FLOAT, false, 0, 0);

  // Needed to sample a non-power-of-2 texture
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.NEAREST);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
  gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);

  // Assume texture 0 slot has a texture binded
  gl.uniform1i(gl.getUniformLocation(program, 'u_Texture2D'), 0);

  gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
  gl.drawArrays(gl.TRIANGLES, 0, 6);
  gl.flush();
}

export function useAsImageSourceWebGLTexImage2D(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const gl = dst.getContext('webgl') as WebGLRenderingContext;

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, src);

  WebGLDrawTexQuad(gl);
}

export function useAsImageSourceWebGLTexSubImage2D(src: HTMLCanvasElement, dst: HTMLCanvasElement) {
  const gl = dst.getContext('webgl') as WebGLRenderingContext;

  const texture = gl.createTexture();
  gl.activeTexture(gl.TEXTURE0);
  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(
    gl.TEXTURE_2D,
    0,
    gl.RGBA,
    src.width,
    src.height,
    0,
    gl.RGBA,
    gl.UNSIGNED_BYTE,
    null
  );
  gl.texSubImage2D(gl.TEXTURE_2D, 0, 0, 0, gl.RGBA, gl.UNSIGNED_BYTE, src);

  WebGLDrawTexQuad(gl);
}
