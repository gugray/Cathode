import {Editor} from "./editor.js";
import {LPD8} from "./lpd8.js";
import sDefaultMain from "../shader/default-main.glsl";
import { truncate } from "../common/utils.js";
import * as SD from "../common/server-defs.js";

const logComms = true;
void init();

let socket;
let editor;
let lpd8;

let elmEmblem, elmBg, elmResolution, elmHiDef;

async function init() {
  initGui();
  initEditor();
  initSocket();
  initMidi();
}

function initMidi() {
  lpd8 = new LPD8();
  lpd8.onknobchange = (knobIx, val) => sendKnobVal(knobIx, val);
}

function sendKnobVal(knobIx, val) {
  if (socket == null) return;
  const msg = {
    action: SD.ACTION.Command,
    command: SD.COMMAND.SetKnob,
    data: { ix: knobIx, val: val },
  };
  socket.send(JSON.stringify(msg));
}

function sendAllKnobVals() {
  for (let i = 0; i < 8; ++i)
    sendKnobVal(i, lpd8.getKnobVal((i)));
}


function initEditor() {
  const elmHost = document.getElementById("editorHost");
  elmHost.style.display = "block";
  editor = new Editor(elmHost);
  editor.onSubmit = () => submitShader();
  editor.onToggleAnimate = () => toggleAnimate();

  document.body.addEventListener("keydown", e => {
    let handled = false;
    //if (e.metaKey && e.key == "e")
    if (handled) {
      e.preventDefault();
      return false;
    }
  });
}

function initGui() {

  elmBg = document.getElementById("editorBg");
  elmEmblem = document.getElementById("emblem");
  elmResolution = document.getElementById("resolution");
  elmHiDef = document.getElementById("hidef");

  elmEmblem.addEventListener("click", () => {
    toggleAnimate();
    editor.cm.display.input.focus();
  });

  safeGetStoredResolution();
  elmResolution.addEventListener("change", () => updateResolution());

  safeGetStoredHiDef();
  elmHiDef.addEventListener("click", () => toggleHiDef());
}

function safeGetStoredHiDef() {
  const storedStr = localStorage.getItem("hidef");
  let isHiDef = true;
  if (storedStr != null && storedStr != "true") isHiDef = false;
  if (!isHiDef) elmHiDef.classList.remove("on");
  else elmHiDef.classList.add("on");
  // This happens when composer loads. Tell projectors, after they've had time to also load.
  setTimeout(() => {
    const msg = {
      action: SD.ACTION.Command,
      command: SD.COMMAND.SetHiDef,
      data: isHiDef,
    }
    socket.send(JSON.stringify(msg));
  }, 1000);
}

function toggleHiDef() {
  const newHiDef = !elmHiDef.classList.contains("on");
  if (newHiDef) elmHiDef.classList.add("on");
  else elmHiDef.classList.remove("on");
  localStorage.setItem("hidef", newHiDef);
  const msg = {
    action: SD.ACTION.Command,
    command: SD.COMMAND.SetHiDef,
    data: newHiDef,
  }
  socket.send(JSON.stringify(msg));
}

function safeGetStoredResolution() {
  const storedStr = localStorage.getItem("resolution");
  const values = [];
  for (const opt of elmResolution.options) values.push(opt.value);
  if (values.indexOf(storedStr) != -1)
    elmResolution.value = storedStr;
  updateResolution();
}

function updateResolution() {
  const dims = elmResolution.value.split(' ');
  const w = parseInt(dims[0], 10);
  const h = parseInt(dims[1], 10);
  const r = document.documentElement;
  r.style.setProperty("--previewWidth", `${w}px`);
  r.style.setProperty("--previewHeight", `${h}px`);
  localStorage.setItem("resolution", elmResolution.value);
}

function toggleAnimate() {
  const newAnimating = !elmEmblem.classList.contains("animating");
  if (newAnimating) elmEmblem.classList.add("animating");
  else elmEmblem.classList.remove("animating");
  const msg = {
    action: SD.ACTION.Command,
    command: SD.COMMAND.SetAnimate,
    data: newAnimating,
  };
  socket.send(JSON.stringify(msg));
}

function initSocket() {
  socket = new WebSocket(SD.kSocketUrl + SD.kSocketPathComp);
  socket.addEventListener("open", () => {
    if (logComms) console.log("[COMP] Socket open");
    requestActiveSketch();
    setTimeout(sendAllKnobVals, 100);
  });
  socket.addEventListener("message", (event) => {
    const msgStr = event.data;
    if (logComms) console.log(`[COMP] Message: ${truncate(msgStr, 64)}`);
    const msg = JSON.parse(msgStr);
    handleSocketMessage(msg);
  });
  socket.addEventListener("close", () => {
    if (logComms) console.log("[COMP] Socket closed");
    socket = null;
  });
}

function requestActiveSketch() {
  const msg = {
    action: SD.ACTION.GetActiveSketch,
  };
  socket.send(JSON.stringify(msg));
}

function flashEditor(className) {
  if (elmBg.classList.contains(className)) return;
  elmBg.classList.add(className);
  setTimeout(() => elmBg.classList.remove(className), 200);
}

function handleSocketMessage(msg) {
  if (msg.action == SD.ACTION.Sketch) {
    if (msg.sketch.hasOwnProperty("main"))
      editor.cm.doc.setValue(msg.sketch.main);
    else {
      editor.cm.doc.setValue(sDefaultMain);
      void submitShader();
    }
  }
  else if (msg.action == SD.ACTION.Report) {
    if (msg.report == SD.REPORT.BadCode) flashEditor("error");
    else if (msg.report == SD.REPORT.ShaderUpdated) flashEditor("apply");
    else if (msg.report == SD.REPORT.CanvasSize) {
      console.log(`Canvas size: ${msg.w} x ${msg.h}`);
    }
  }
}

async function submitShader() {
  if (socket == null) return;
  const msg = {
    action: SD.ACTION.UpdateActiveSketchMain,
    main: editor.cm.doc.getValue(),
  };
  socket.send(JSON.stringify(msg));
}
