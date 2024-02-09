import sSweepVert from "../shader/sweep-vert.glsl";
import sMainFrag from "../shader/main-frag.glsl";
import sGist from "../shader/gist.glsl";
import * as twgl from "twgl.js";

const serverUrl = "http://localhost:8090/shaders/main/frag";
const checkInterval = 50;
void init();

let webGLCanvas, gl, w, h;
let sFrag;
let sweepArrays, sweepBufferInfo;
let progiMain;
let animating = false;
let seq = -1;

async function init() {

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

  sFrag = buildInitialShader();
  compilePrograms();
  requestAnimationFrame(frame);
  setInterval(checkShaders, checkInterval);
}

function resizeCanvas() {
  let elmWidth = window.innerWidth;
  let elmHeight = window.innerHeight;
  webGLCanvas.style.width = elmWidth + "px";
  webGLCanvas.style.height = elmHeight + "px";
  w = webGLCanvas.width = elmWidth * devicePixelRatio;
  h = webGLCanvas.height = elmHeight * devicePixelRatio;
}

async function checkShaders() {
  const url = `${serverUrl}?seq=${seq}`;
  const resp = await fetch(url, { method: "GET" });
  if (resp.status == 304) return;
  else if (resp.status != 200) {
    console.error(`Failed to query for shader update; status: ${resp.status}`);
    return;
  }
  const data = await resp.json();
  seq = data.seq;
  sFrag = data.val;
  compilePrograms();
  if (!animating)
    requestAnimationFrame(frame);
}

function buildInitialShader() {
  const ph = "// GIST.GLSL"; // Placeholder text
  return sMainFrag.replace(ph, sGist);
}

function compilePrograms() {

  const del = pi => { if (pi && pi.program) gl.deleteProgram(pi.program); }
  const recreate = (v, f) => twgl.createProgramInfo(gl, [v, f]);

  const npMain = recreate(sSweepVert, sFrag);

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
