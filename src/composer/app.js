import {Editor} from "./editor.js";
import {LPD8} from "./lpd8.js";
import sDefaultMain from "../shader/default-main.glsl";
import { truncate } from "../common/utils.js";
import * as SD from "../common/server-defs.js";

const logComms = true;
setTimeout(() => void init(), 50);

let editors = {};
let socket;
let lpd8;

let elmEmblem, elmResolution, elmHiDef, elmCurrentSketch;
let elmInsetVideo;

async function init() {
  initGui();
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


function addEditor(name, content, active) {

  const elmHost = document.createElement("div");
  elmHost.classList.add("editorHost");
  if (active) elmHost.classList.add("active");
  elmHost.dataset.name = name;
  elmHost.innerHTML = '<div class="editorBg"></div>';
  document.getElementById("tabContent").appendChild(elmHost);

  const editor = new Editor(elmHost);
  editor.onSubmit = () => submitShader(name);
  editor.onToggleAnimate = () => toggleAnimate();
  editor.cm.doc.setValue(content);
  editors[name] = {elmHost, editor};

  const elmBtn = document.createElement("button");
  elmBtn.dataset.name = name;
  elmBtn.innerText = name;
  if (active) elmBtn.classList.add("active");
  document.getElementById("tabHeader").appendChild(elmBtn);

  elmBtn.addEventListener("click", () => {
    const btns = document.querySelectorAll("#tabHeader button");
    const hosts = document.querySelectorAll("#tabContent .editorHost");
    for (const btn of btns) btn.classList.remove("active");
    for (const host of hosts) host.classList.remove("active");
    elmBtn.classList.add("active");
    document.querySelector(`#tabContent .editorHost[data-name="${name}"]`).classList.add("active");
    editor.cm.refresh();
    focusActiveEditor();
  });
}

function initGui() {

  elmEmblem = document.getElementById("emblem");
  elmResolution = document.getElementById("resolution");
  elmHiDef = document.getElementById("hidef");
  elmCurrentSketch = document.getElementById("currentSketch");
  elmInsetVideo = document.getElementById("insetVideo");

  elmEmblem.addEventListener("click", () => {
    toggleAnimate();
    focusActiveEditor();
  });

  elmCurrentSketch.addEventListener("change", () => onSketchChanged());

  safeGetStoredResolution();
  elmResolution.addEventListener("change", () => updateResolution());

  safeGetStoredHiDef();
  elmHiDef.addEventListener("click", () => toggleHiDef());

  elmInsetVideo.addEventListener("click", () => toggleInsetVideo());

  document.body.addEventListener("keydown", e => {
    let handled = false;
    //if (e.metaKey && e.key == "e")
    if (handled) {
      e.preventDefault();
      return false;
    }
  });
}

function focusActiveEditor() {
  const elmHost = document.querySelector("#tabContent .editorHost.active");
  const editor = editors[elmHost.dataset.name].editor;
  editor.cm.display.input.focus();
}

function flashActiveEditor(className) {
  const elmBg = document.querySelector("#tabContent .editorHost.active .editorBg");
  if (!elmBg) return;
  if (elmBg.classList.contains(className)) return;
  elmBg.classList.add(className);
  setTimeout(() => elmBg.classList.remove(className), 200);
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
  const leftWidth = r.clientWidth - w - 32;
  const editorHosts = document.querySelectorAll(".editorHost");
  for (const elm of editorHosts)
    elm.style.width = `${leftWidth}px`;
}

function toggleInsetVideo() {
  const newVal = !elmInsetVideo.classList.contains("on");
  if (newVal) elmInsetVideo.classList.add("on");
  else elmInsetVideo.classList.remove("on");
  if (!newVal) document.getElementById("previewFrame").remove();
  else {
    const elm = document.createElement("iframe");
    elm.id = "previewFrame";
    elm.classList.add("preview");
    elm.src = "http://localhost:8081";
    elm.allow = "camera *;microphone *";
    document.getElementById("previewHost").appendChild(elm);
  }
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
  socket = new WebSocket(SD.getSocketUrl() + SD.kSocketPathComp);
  socket.addEventListener("open", () => {
    if (logComms) console.log("[COMP] Socket open");
    requestSketchList();
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

function requestSketchList() {
  const msg = { action: SD.ACTION.ListSketches };
  socket.send(JSON.stringify(msg));
}

function onSketchChanged() {
  const name = elmCurrentSketch.value;
  if (name.startsWith("--")) return;
  const msg = { action: SD.ACTION.ActivateSketch, name: name };
  socket.send(JSON.stringify(msg));
  localStorage.setItem("active-sketch", name);
}

function selectSavedSketch() {
  // Retrieve stored sketch name; see if it's on list now
  const storedName = localStorage.getItem("active-sketch");
  if (!storedName) return;
  const values = [];
  for (const opt of elmCurrentSketch.options) values.push(opt.value);
  if (values.indexOf(storedName) == -1) return;
  // If it's on list, activate it
  elmCurrentSketch.value = storedName;
  const msg = { action: SD.ACTION.ActivateSketch, name: storedName };
  socket.send(JSON.stringify(msg));
}

function handleSocketMessage(msg) {
  if (msg.action == SD.ACTION.ListSketches) {
    // Populate dropdown
    elmCurrentSketch.innerHTML = "";
    const addSketch = name => {
      const elm = document.createElement("option");
      elm.value = name;
      elm.innerText = name;
      elmCurrentSketch.appendChild(elm);
    };
    addSketch("-------");
    for (const name of msg.names) addSketch(name);
    selectSavedSketch();
  }
  else if (msg.action == SD.ACTION.Sketch) {
    // Remove old editors
    document.getElementById("tabHeader").innerHTML = "";
    document.getElementById("tabContent").innerHTML = "";
    // Main shader
    addEditor("main", msg.sketch.main, true);
    editors["main"].editor.cm.doc.setValue(msg.sketch.main);
    // Optional: calc shader
    let calcGlsl = null;
    if (msg.sketch.hasOwnProperty("calc")) calcGlsl = msg.sketch.calc;
    if (calcGlsl) {
      addEditor("calc", msg.sketch.calc, false);
      editors["calc"].editor.cm.doc.setValue(msg.sketch.calc);
    }
    // Set sizes
    updateResolution();
  }
  else if (msg.action == SD.ACTION.Report) {
    if (msg.report == SD.REPORT.BadCode) flashActiveEditor("error");
    else if (msg.report == SD.REPORT.ShaderUpdated) flashActiveEditor("apply");
    else if (msg.report == SD.REPORT.CanvasSize) {
      console.log(`Canvas size: ${msg.w} x ${msg.h}`);
    }
  }
}

async function submitShader(name) {
  if (socket == null) return;
  const msg = {
    action: SD.ACTION.UpdateActiveSketchShader,
    name: name,
    shaderCode: editors[name].editor.cm.doc.getValue(),
  };
  socket.send(JSON.stringify(msg));
}
