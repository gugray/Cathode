import {Editor} from "./editor.js";

const serverUrl = "http://localhost:8090/shaders/main/frag";
void init();

let editor;

async function init() {
  initEditor();
  editor.cm.doc.setValue("Haha!");
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

async function submitShader() {
  const resp = await fetch(serverUrl, {
    method: "POST",
    headers: { "Content-Type": "text/plain" },
    body: editor.cm.doc.getValue(),
  });
  if (resp.status >= 300) {
    console.error(`Failed to POST shader; request returned ${resp.status}`);
    // TODO: UI error report
  }
  //await response.text();
}
