import sSweepVert from "../shader/sweep-vert.glsl";
import sMainFrag from "../shader/main-frag.glsl";
import sOutputDrawFrag from "../shader/output-draw-frag.glsl";
import sDefaultGist from "../shader/default-gist.glsl";
import * as twgl from "twgl.js";
import { truncate } from "../common/utils.js";
import * as SD from "../common/server-defs.js";
import {ACTION} from "../common/server-defs.js";

const logComms = true;
init();

let hiDef = false;
let webGLCanvas, gl, w, h;
let sweepArrays, sweepBufferInfo;
let progiMain, progiOutputDraw;
let txOutput0, txOutput1;
let clip0;
let socket;
let sGist;
let animating = false;
let animStartTime = -1;
let lastFrameTime = -1;

function init() {

  // 3D WebGL canvas, and twgl
  webGLCanvas = document.getElementById("webgl-canvas");
  gl = webGLCanvas.getContext("webgl2");
  twgl.addExtensionsToContext(gl);

  // This is for sweeping output range for pure fragment shaders
  sweepArrays = {
    position: {numComponents: 2, data: [-1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1]},
  };
  sweepBufferInfo = twgl.createBufferInfoFromArrays(gl, sweepArrays);

  resizeWorld();
  window.addEventListener("resize", () => {
    resizeWorld();
  });

  initSocket();
  initGui();

  setTimeout(() => safeReportSize(), 500);

  // TODO: Remove once clips are part of sketches
  clip0 = {
    frames: [],
    dims: [0, 0],
    tx: null,
  };
  void getClipFrames("wind", clip0);
}

function initSocket() {
  socket = new WebSocket(SD.kSocketUrl + SD.kSocketPathProj);
  socket.addEventListener("open", () => {
    if (logComms) console.log("[PROJ] Socket open");
    requestActiveSketch();
  });
  socket.addEventListener("message", (event) => {
    const msgStr = event.data;
    if (logComms) console.log(`[PROJ] Message: ${truncate(msgStr, 64)}`);
    const msg = JSON.parse(msgStr);
    handleSocketMessage(msg);
  });
  socket.addEventListener("close", () => {
    if (logComms) console.log("[PROJ] Socket closed");
    socket = null;
  });
}

function requestActiveSketch() {
  const msg = { action: SD.ACTION.GetActiveSketch };
  socket.send(JSON.stringify(msg));
}

function handleSocketMessage(msg) {
  if (msg.action == SD.ACTION.Sketch) {
    if (!msg.sketch.hasOwnProperty("gist"))
      return;
    updateGist(msg.sketch.gist);
    // TODO: Fetch clip frame once they are defined in sketch
  }
  else if (msg.action == SD.ACTION.SketchGist) {
    updateGist(msg.gist);
  }
  else if (msg.action == SD.ACTION.Command) {
    if (msg.command == SD.COMMAND.SetAnimate) {
      const newAnimating = msg.data;
      if (newAnimating == animating) return;
      animating = newAnimating;
      animStartTime = lastFrameTime = -1;
      if (animating) requestAnimationFrame(frame);
    }
    else if (msg.command == SD.COMMAND.SetHiDef) {
      const newHiDef = msg.data;
      if (newHiDef == hiDef) return;
      hiDef = newHiDef;
      resizeWorld();
    }
  }
}

function initGui() {
  document.getElementById("fullscreen").addEventListener("click", () => {
    void document.documentElement.requestFullscreen();
  });
}

function resizeWorld() {

  // Resize WebGL canvas
  let elmWidth = window.innerWidth;
  let elmHeight = window.innerHeight;
  webGLCanvas.style.width = elmWidth + "px";
  webGLCanvas.style.height = elmHeight + "px";
  const mul = hiDef ? devicePixelRatio : 1;
  w = webGLCanvas.width = elmWidth * mul;
  h = webGLCanvas.height = elmHeight * mul;

  // First pingpong output texture
  const dtRender0 = new Uint8Array(w * h * 4);
  dtRender0.fill(0);
  if (txOutput0) gl.deleteTexture(txOutput0);
  txOutput0 = twgl.createTexture(gl, {
    internalFormat: gl.RGBA,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
    width: w,
    height: h,
    src: dtRender0,
  });

  // Other pingpong output texture
  const dtRender1 = new Uint8Array(w * h * 4);
  dtRender1.fill(0);
  if (txOutput1) gl.deleteTexture(txOutput1);
  txOutput1 = twgl.createTexture(gl, {
    internalFormat: gl.RGBA,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
    width: w,
    height: h,
    src: dtRender1,
  });

  // Make sure we re-render
  if (!animating)
    requestAnimationFrame(frame);

  // Report our size to composer
  safeReportSize();
}

function safeReportSize() {
  if (!socket) return;
  const msg = {
    action: SD.ACTION.Report,
    report: SD.REPORT.CanvasSize,
    w: webGLCanvas.width,
    h: webGLCanvas.height,
  };
  socket.send(JSON.stringify(msg));
}

function updateGist(newGist) {
  const isFirstUpdate = sGist == null;
  sGist = newGist;
  compilePrograms();
  if (isFirstUpdate || !animating)
    requestAnimationFrame(frame);
}

async function getClipFrames(clipName, clip) {
  clip.frames.length = 0;
  clip.dims = [0, 0];
  const url = `${SD.kServerUrl}/clips/${clipName}`;
  const resp = await fetch(url, { method: "GET" });
  if (resp.status != 200) {
    console.error(`Failed to get clip info for ${clipName}; status: ${resp.status}`);
    return;
  }
  const info = await resp.json();
  for (let i = 0; i < info.frames; ++i) {
    const url = `${SD.kServerUrl}/clips/${clipName}/${i+1}`;
    const resp = await fetch(url, { method: "GET" });
    if (resp.status != 200) break;
    const blob = await resp.blob();
    const imageBitmap = await createImageBitmap(blob);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    clip.dims[0] = canvas.width = imageBitmap.width;
    clip.dims[1] = canvas.height = imageBitmap.height;
    ctx.drawImage(imageBitmap, 0, 0);
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const { data } = imageData;
    const rgbaArr = new Uint8Array(data);
    clip.frames.push(rgbaArr);
  }
  if (clip.tx) gl.deleteTexture(clip.tx);
  clip.tx = twgl.createTexture(gl, {
    internalFormat: gl.RGBA,
    format: gl.RGBA,
    type: gl.UNSIGNED_BYTE,
    width: clip.dims[0],
    height: clip.dims[1],
    src: clip.frames[0],
  });
  console.log(`Clip "${clipName}": ${clip.dims[0]} x ${clip.dims[1]}; ${clip.frames.length} frames`);
}

function compilePrograms() {

  const del = pi => { if (pi && pi.program) gl.deleteProgram(pi.program); }
  const recreate = (v, f) => twgl.createProgramInfo(gl, [v, f]);

  const ph = "// GIST.GLSL"; // Placeholder text
  const mainFrag = sMainFrag.replace(ph, sGist);
  const npMain = recreate(sSweepVert, mainFrag);
  const npOutputDraw = recreate(sSweepVert, sOutputDrawFrag);

  const compileOK = (npMain && npOutputDraw);
  const msg = {
    action: SD.ACTION.Report,
    report: compileOK ? SD.REPORT.ShaderUpdated : SD.REPORT.BadCode,
  };
  socket.send(JSON.stringify(msg));

  if (!compileOK) return;

  del(progiMain);
  progiMain = npMain;
  progiOutputDraw = npOutputDraw;
}


function frame(time) {

  if (animStartTime == -1) {
    animStartTime = time;
    lastFrameTime = animStartTime - (1000 / 60);
  }
  time -= animStartTime;
  const frameIx = Math.round(time * 60 / 1000);
  if (clip0.tx && (frameIx % 2) == 0) {
    const clipIx = (frameIx/2) % clip0.frames.length;
    const data = clip0.frames[clipIx];
    gl.bindTexture(gl.TEXTURE_2D, clip0.tx);
    gl.texImage2D(
      gl.TEXTURE_2D,
      0,
      gl.RGBA,
      clip0.dims[0],
      clip0.dims[1],
      0,
      gl.RGBA,
      gl.UNSIGNED_BYTE,
      clip0.frames[clipIx],
    );
  }

  // Render to txOutput1
  const unisMain = {
    txPrev: txOutput0,
    txClip0: clip0.tx,
    resolution: [w, h],
    time: time,
  }
  // Bind frame buffer: texture to draw on
  let atmsPR = [{attachment: txOutput1}];
  let fbufPR = twgl.createFramebufferInfo(gl, atmsPR, w, h);
  twgl.bindFramebufferInfo(gl, fbufPR);
  // Set up size, program, uniforms
  gl.viewport(0, 0, w, h);
  gl.useProgram(progiMain.program);
  twgl.setBuffersAndAttributes(gl, progiMain, sweepBufferInfo);
  twgl.setUniforms(progiMain, unisMain);
  // Clear to black
  gl.clearColor(0, 0, 0, 1);
  gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);
  // Render fragment sweep
  twgl.drawBufferInfo(gl, sweepBufferInfo);

  // Render txOutput1 to canvas
  const unisOutputDraw = {
    txOutput: txOutput1,
  }
  twgl.bindFramebufferInfo(gl, null);
  // Set up size, program, uniforms
  gl.viewport(0, 0, w, h);
  gl.useProgram(progiOutputDraw.program);
  twgl.setBuffersAndAttributes(gl, progiOutputDraw, sweepBufferInfo);
  twgl.setUniforms(progiOutputDraw, unisOutputDraw);
  // Render fragment swep
  twgl.drawBufferInfo(gl, sweepBufferInfo);

  // Swap output buffers: current output becomes "prev" texture for next round
  [txOutput0, txOutput1] = [txOutput1, txOutput0];

  // Schedule next frame
  if (animating) requestAnimationFrame(frame);
}
