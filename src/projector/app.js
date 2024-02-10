import sSweepVert from "../shader/sweep-vert.glsl";
import sMainFrag from "../shader/main-frag.glsl";
import sDefaultGist from "../shader/default-gist.glsl";
import * as twgl from "twgl.js";
import { truncate } from "../common/utils.js";

const socketUrl = "ws://localhost:8090/proj";
const logComms = true;

init();

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
}

function initSocket() {
  socket = new WebSocket(socketUrl);
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
  const msg = {
    action: "get-active-sketch",
  };
  socket.send(JSON.stringify(msg));
}

function handleSocketMessage(msg) {
  if (msg.action == "sketch") {
    if (!msg.sketch.hasOwnProperty("gist"))
      return;
    updateGist(msg.sketch.gist);
  }
  else if (msg.action == "sketch-gist") {
    updateGist(msg.gist);
  }
}

function resizeCanvas() {
  let elmWidth = window.innerWidth;
  let elmHeight = window.innerHeight;
  webGLCanvas.style.width = elmWidth + "px";
  webGLCanvas.style.height = elmHeight + "px";
  w = webGLCanvas.width = elmWidth * devicePixelRatio;
  h = webGLCanvas.height = elmHeight * devicePixelRatio;
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

  if (!npMain) {
    // TODO: Signal error via server
    return;
  }

  del(progiMain);
  progiMain = npMain;
}


function frame(time) {

  const unisMain = {
    trgRes: [w, h],
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
