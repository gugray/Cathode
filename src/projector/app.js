import sSweepVert from "../shader/sweep-vert.glsl";
import sMainFrag from "../shader/main-frag.glsl";
import sDefaultGist from "../shader/default-gist.glsl";
import * as twgl from "twgl.js";
import { truncate } from "../common/utils.js";
import * as SD from "../common/server-defs.js";
import {ACTION} from "../common/server-defs.js";

const logComms = true;
init();

let hiDef = false;
let webGLCanvas, gl, w, h;
let socket;
let sGist;
let sweepArrays, sweepBufferInfo;
let progiMain;
let animating = false;

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

  resizeCanvas();
  window.addEventListener("resize", () => {
    resizeCanvas();
  });

  initSocket();
  initGui();

  setTimeout(() => safeReportSize(), 500);
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
  }
  else if (msg.action == SD.ACTION.SketchGist) {
    updateGist(msg.gist);
  }
  else if (msg.action == SD.ACTION.Command) {
    if (msg.command == SD.COMMAND.SetAnimate) {
      const newAnimating = msg.data;
      if (newAnimating == animating) return;
      animating = newAnimating;
      if (animating) requestAnimationFrame(frame);
    }
    else if (msg.command == SD.COMMAND.SetHiDef) {
      const newHiDef = msg.data;
      if (newHiDef == hiDef) return;
      hiDef = newHiDef;
      resizeCanvas();
    }
  }
}

function initGui() {
  document.getElementById("fullscreen").addEventListener("click", () => {
    void document.documentElement.requestFullscreen();
  });
}

function resizeCanvas() {
  let elmWidth = window.innerWidth;
  let elmHeight = window.innerHeight;
  webGLCanvas.style.width = elmWidth + "px";
  webGLCanvas.style.height = elmHeight + "px";
  const mul = hiDef ? devicePixelRatio : 1;
  w = webGLCanvas.width = elmWidth * mul;
  h = webGLCanvas.height = elmHeight * mul;
  if (!animating)
    requestAnimationFrame(frame);
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

function compilePrograms() {

  const del = pi => { if (pi && pi.program) gl.deleteProgram(pi.program); }
  const recreate = (v, f) => twgl.createProgramInfo(gl, [v, f]);

  const ph = "// GIST.GLSL"; // Placeholder text
  const frag = sMainFrag.replace(ph, sGist);
  const npMain = recreate(sSweepVert, frag);

  const msg = {
    action: SD.ACTION.Report,
    report: npMain ? SD.REPORT.ShaderUpdated : SD.REPORT.BadCode,
  };
  socket.send(JSON.stringify(msg));

  if (!npMain) return;

  del(progiMain);
  progiMain = npMain;
}


function frame(time) {

  const unisMain = {
    resolution: [w, h],
    time: time,
  }
  twgl.bindFramebufferInfo(gl, null);
  gl.viewport(0, 0, w, h);
  gl.useProgram(progiMain.program);
  twgl.setBuffersAndAttributes(gl, progiMain, sweepBufferInfo);
  twgl.setUniforms(progiMain, unisMain);
  twgl.drawBufferInfo(gl, sweepBufferInfo);
  if (animating) requestAnimationFrame(frame);
}
