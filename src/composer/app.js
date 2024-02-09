import {Editor} from "./editor.js";

void init();

let editor;

async function init() {
  initEditor();
  editor.setValue("Haha!");
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
    // if (e.metaKey && e.key == "s") {
    //   H.saveHistory(e.shiftKey);
    //   if (e.shiftKey) seqId = 0;
    //   handled = true;
    // }
    if (handled) {
      e.preventDefault();
      return false;
    }
  });
}

function submitShader() {

}
