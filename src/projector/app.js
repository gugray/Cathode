import sSweepVert from "../shader/sweep-vert.glsl";
import sCalcFrag from "../shader/calc-frag.glsl";
import sMainFrag from "../shader/main-frag.glsl";
import sDefaultCalc from "../shader/default-calc.glsl";
import sOutputDrawFrag from "../shader/output-draw-frag.glsl";
import * as twgl from "twgl.js";
import Audio from "./audio.js";
import { truncate } from "../common/utils.js";
import * as SD from "../common/server-defs.js";
import {ACTION} from "../common/server-defs.js";

import "../common/types.js"

const logComms = true;
setTimeout(init, 50);

let hiDef = false;
let audio;
let volFactor = 0.02;
let knobs = [0, 0, 0, 0, 0, 0, 0, 0];
let webGLCanvas, gl, w, h;
let sweepArrays, sweepBufferInfo;
let progiMain, progiOutputDraw, progiCalc;
let txOutput0, txOutput1;
let szData0 = 16;
let txData0, txData1;
/** @type {ProjectorClip} */
let clip0;
let socket;
let sMain;
let sCalc;
let animating = false;
let animStartTime = -1;
let lastFrameTime = -1;

let ctrl;
const ctrlContext = {};

function init() {

  audio = new Audio({});
  ctrl = makeDefaultCtrl();

  // 3D WebGL canvas, and twgl
  webGLCanvas = document.getElementById("webgl-canvas");
  gl = webGLCanvas.getContext("webgl2");
  twgl.addExtensionsToContext(gl);

  // This is for sweeping output range for pure fragment shaders
  sweepArrays = {
    position: {numComponents: 2, data: [-1, -1, -1, 1, 1, -1, -1, 1, 1, -1, 1, 1]},
  };
  sweepBufferInfo = twgl.createBufferInfoFromArrays(gl, sweepArrays);

  // Pingpong data texture
  const dtData0A = new Float32Array(szData0 * szData0 * 4);
  dtData0A.fill(0);
  txData0 = twgl.createTexture(gl, {
    internalFormat: gl.RGBA32F,
    format: gl.RGBA,
    type: gl.FLOAT,
    width: szData0,
    height: szData0,
    src: dtData0A,
  });
  const dtData0B = new Float32Array(szData0 * szData0 * 4);
  dtData0B.fill(0);
  txData1 = twgl.createTexture(gl, {
    internalFormat: gl.RGBA32F,
    format: gl.RGBA,
    type: gl.FLOAT,
    width: szData0,
    height: szData0,
    src: dtData0B,
  });

  resizeWorld();
  window.addEventListener("resize", () => {
    resizeWorld();
  });

  initSocket();
  initGui();

  setTimeout(() => safeReportSize(), 500);
}

function initSocket() {
  socket = new WebSocket(SD.getSocketUrl() + SD.kSocketPathProj);
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
    if (!msg.sketch.hasOwnProperty("main"))
      return;
    updatePrograms([
      { name: "main", shaderCode: msg.sketch.main },
      { name: "calc", shaderCode: msg.sketch.calc ?? null },
      { name: "ctrl", shaderCode: msg.sketch.ctrl ?? null }
    ]);
    if (msg.sketch.clips.length > 0) {
      clip0 = makeEmptyClip();
      void getClipFrames(msg.sketch.clips[0], clip0);
    }
  }
  else if (msg.action == SD.ACTION.SketchShader) {
    updatePrograms([msg]);
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
    else if (msg.command == SD.COMMAND.SetKnob) {
      knobs[msg.data.ix] = msg.data.val;
      console.log(knobs); // DBG
    }
  }
}

function makeEmptyClip() {
  return {
    frames: [],
    dims: [0, 0],
    tx: null,
  };
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
  w = webGLCanvas.width = Math.round(elmWidth * mul);
  h = webGLCanvas.height = Math.round(elmHeight * mul);

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

function updatePrograms(infos) {
  const isFirstUpdate = sMain == null;
  let compileOK = true;
  for (const i of infos) {
    if (i.name == "main") sMain = i.shaderCode;
    else if (i.name == "calc") sCalc = i.shaderCode ?? sDefaultCalc;
    else if (i.name == "ctrl") compileOK &= updateControl(i.shaderCode);
    else console.log("[PROJ] update for unknown shader: " + i.name);
  }
  compileOK &= compilePrograms();
  // Lett composer know
  const msg = {
    action: SD.ACTION.Report,
    report: compileOK ? SD.REPORT.ShaderUpdated : SD.REPORT.BadCode,
  };
  socket.send(JSON.stringify(msg));
  // Redraw if we're not animating
  if (isFirstUpdate || !animating)
    requestAnimationFrame(frame);
}

function updateControl(jsCode) {
  if (!jsCode) return true;
  let compileOK = false;
  try {
    const fun = new Function(jsCode);
    ctrl = fun();
    compileOK = true;
  }
  catch {
    compileOK = false;
  }
  const msg = {
    action: SD.ACTION.Report,
    report: compileOK ? SD.REPORT.ShaderUpdated : SD.REPORT.BadCode,
  };
  socket.send(JSON.stringify(msg));
}

function makeDefaultCtrl() {
  return {
    frame: function(ctxt) {
      if (!ctxt.hasOwnProperty("frameIx")) ctxt.frameIx = -1;
      ctxt.lastFrameIx = ctxt.frameIx;
      ctxt.frameIx = Math.round(ctxt.time * 30 / 1000);
    }
  };
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

  // Fixed programs
  const npOutputDraw = recreate(sSweepVert, sOutputDrawFrag);

  // Calc
  const phCalc = "// CALC.GLSL"; // Placeholder text
  const calcFrag = sCalcFrag.replace(phCalc, sCalc);
  const npCalc = recreate(sSweepVert, calcFrag);

  // Main fragment
  const phMain = "// MAIN.GLSL"; // Placeholder text
  const mainFrag = sMainFrag.replace(phMain, sMain);
  const npMain = recreate(sSweepVert, mainFrag);

  const compileOK = (npMain && npCalc && npOutputDraw);
  if (!compileOK) return false;

  del(progiMain);
  progiMain = npMain;
  progiOutputDraw = npOutputDraw;
  progiCalc = npCalc;
  return true;
}

function frame(time) {

  if (audio) audio.tick();

  if (animStartTime == -1) {
    animStartTime = time;
    lastFrameTime = time - (1000 / 60);
  }
  const deltaTime = time - lastFrameTime;
  lastFrameTime = time;
  time -= animStartTime;

  // Fill current data into context
  // Invoke context update
  ctrlContext.time = time;
  ctrlContext.nFrames = clip0.frames.length;
  ctrlContext.volume = audio.vol;
  ctrlContext.fft = audio.fft;
  ctrl.frame(ctrlContext);

  // Feed movie frames
  if (clip0 && clip0.tx && ctrlContext.lastFrameIx != ctrlContext.frameIx) {
    const clipIx = (ctrlContext.frameIx) % clip0.frames.length;
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
    gl.bindTexture(gl.TEXTURE_2D, null);
  }

  // Run calculations, data0 -> data1
  const unisCalc = {
    txPrev: txData0,
    time: time,
    dt: deltaTime,
    vol: audio.vol * volFactor,
    fft: audio.fft,
    beat: audio.isBeat ? 1 : 0,
    knobs: knobs,
  }
  // Bind frame buffer: texture to draw on
  let atmsCalc = [{attachment: txData1}];
  let fbufCalc = twgl.createFramebufferInfo(gl, atmsCalc, szData0, szData0);
  twgl.bindFramebufferInfo(gl, fbufCalc);
  // Set up size, program, uniforms
  gl.viewport(0, 0, szData0, szData0);
  gl.useProgram(progiCalc.program);
  twgl.setBuffersAndAttributes(gl, progiCalc, sweepBufferInfo);
  twgl.setUniforms(progiCalc, unisCalc);
  // Clear to zeroes
  gl.clearColor(0, 0, 0, 0);
  gl.clear(gl.COLOR_BUFFER_BIT| gl.DEPTH_BUFFER_BIT);
  // Render fragment sweep
  twgl.drawBufferInfo(gl, sweepBufferInfo);
  // Swap buffers
  [txData1, txData0] = [txData0, txData1];

  // Render to txOutput1
  const unisMain = {
    txData: txData0,
    txPrev: txOutput0,
    txClip0: clip0 ? clip0.tx : null,
    resolution: [w, h],
    time: time,
    vol: audio.vol * volFactor,
    fft: audio.fft,
    beat: audio.isBeat ? 1 : 0,
    knobs: knobs,
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
