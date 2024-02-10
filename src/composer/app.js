import {Editor} from "./editor.js";
import sDefaultGist from "../shader/default-gist.glsl";
import { truncate } from "../common/utils.js";
import { ACTION, COMMAND } from "../common/actions.js";

const socketUrl = "ws://localhost:8090/comp";
const logComms = true;
void init();

let socket;
let editor;

let elmEmblem, elmBg, elmResolution, elmHiDef;

async function init() {
  initGui();
  initEditor();
  initSocket();
}

function initEditor() {
  const elmHost = document.getElementById("editorHost");
  elmHost.style.display = "block";
  editor = new Editor(elmHost);
  editor.onSubmit = () => submitShader();
  editor.onToggleAnimate = () => toggleAnimate();

  document.body.addEventListener("keydown", e => {
    let handled = false;
    // if (e.metaKey && e.key == "e") {
    //   if (editor.cm.hasFocus()) editor.cm.display.input.blur();
    //   else editor.cm.display.input.focus();
    //   handled = true;
    // }
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
}

function toggleHiDef() {
  const newHiDef = !elmHiDef.classList.contains("on");
  if (newHiDef) elmHiDef.classList.add("on");
  else elmHiDef.classList.remove("on");
  localStorage.setItem("hidef", newHiDef);
  const msg = {
    action: ACTION.Command,
    command: COMMAND.SetHiDef,
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
    action: ACTION.Command,
    command: COMMAND.SetAnimate,
    data: newAnimating,
  };
  socket.send(JSON.stringify(msg));
}

function initSocket() {
  socket = new WebSocket(socketUrl);
  socket.addEventListener("open", () => {
    if (logComms) console.log("[COMP] Socket open");
    requestActiveSketch();
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
    action: ACTION.GetActiveSketch,
  };
  socket.send(JSON.stringify(msg));
}

function handleSocketMessage(msg) {
  if (msg.action == ACTION.Sketch) {
    if (msg.sketch.hasOwnProperty("gist"))
      editor.cm.doc.setValue(msg.sketch.gist);
    else {
      editor.cm.doc.setValue(sDefaultGist);
      void submitShader();
    }
  }
  else if (msg.action == ACTION.BadCode) {
    elmBg.classList.add("error");
    setTimeout(() => elmBg.classList.remove("error"), 200);
  }
}

async function submitShader() {
  if (socket == null) return;
  const msg = {
    action: ACTION.UpdateActiveSketchGist,
    gist: editor.cm.doc.getValue(),
  };
  socket.send(JSON.stringify(msg));
}
