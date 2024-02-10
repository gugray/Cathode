import {Editor} from "./editor.js";
import sDefaultGist from "../shader/default-gist.glsl";
import { truncate } from "../common/utils.js";

const socketUrl = "ws://localhost:8090/comp";
const logComms = true;
void init();

let socket;
let editor;

async function init() {
  initEditor();
  initSocket();
}

function initEditor() {
  const elmHost = document.getElementById("editorHost");
  elmHost.style.display = "block";
  editor = new Editor(elmHost);
  editor.onSubmit = () => submitShader();
  editor.onFullScreen = () => document.documentElement.requestFullscreen();

  document.body.addEventListener("keydown", e => {
    let handled = false;
    if (e.metaKey && e.key == "e") {
      if (editor.cm.hasFocus()) editor.cm.display.input.blur();
      else editor.cm.display.input.focus();
      handled = true;
    }
    if (handled) {
      e.preventDefault();
      return false;
    }
  });
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
    action: "get-active-sketch",
  };
  socket.send(JSON.stringify(msg));
}

function handleSocketMessage(msg) {
  if (msg.action == "sketch") {
    if (msg.sketch.hasOwnProperty("gist"))
      editor.cm.doc.setValue(msg.sketch.gist);
    else {
      editor.cm.doc.setValue(sDefaultGist);
      void submitShader();
    }
  }
}

async function submitShader() {
  if (socket == null) return;
  const msg = {
    action: "update-active-sketch-gist",
    gist: editor.cm.doc.getValue(),
  };
  socket.send(JSON.stringify(msg));

  // const gist = editor.cm.doc.getValue();
  // const ph = "// GIST.GLSL"; // Placeholder text
  // const sFrag = sMainFrag.replace(ph, gist);
  //
  // const resp = await fetch(serverUrl, {
  //   method: "POST",
  //   headers: { "Content-Type": "text/plain" },
  //   body: sFrag,
  // });
  // if (resp.status >= 300) {
  //   console.error(`Failed to POST shader; request returned ${resp.status}`);
  //   // TODO: UI error report
  // }
  // //await response.text();
}
