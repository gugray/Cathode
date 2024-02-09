// Import CodeMirror
import CodeMirror from 'codemirror';
import 'codemirror/addon/search/search';
import 'codemirror/addon/search/searchcursor';
import 'codemirror/addon/comment/comment';
import 'codemirror/addon/dialog/dialog';
import 'codemirror/addon/edit/matchbrackets';
import 'codemirror/addon/edit/closebrackets';
import 'codemirror/addon/wrap/hardwrap';
import 'codemirror/addon/fold/foldcode';
import 'codemirror/addon/fold/foldgutter';
import 'codemirror/addon/fold/indent-fold';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/addon/hint/javascript-hint';
import 'codemirror/addon/display/rulers';
import 'codemirror/addon/display/panel';
import 'codemirror/addon/hint/show-hint';
import 'codemirror/mode/clike/clike.js';
import 'codemirror/keymap/sublime';


class Editor {
  constructor(parent) {

    this.parent = parent;
    this.onSubmit = null;
    this.onFullScreen = null;

    this.cm = CodeMirror(parent, {
      value: "void hello() {}",
      viewportMargin: Infinity,
      lineNumbers: true,
      matchBrackets: true,
      mode: 'x-shader/x-fragment',
      keyMap: 'sublime',
      autoCloseBrackets: true,
      showCursorWhenSelecting: true,
      theme: "monokai",
      dragDrop: false,
      indentUnit: 4,
      tabSize: 4,
      indentWithTabs: false,
      gutters: ["CodeMirror-linenumbers"],
      lineWrapping: false,
      autofocus: true,
      extraKeys: {
        "Cmd-Enter": () => this.onSubmit && this.onSubmit(),
        "Shift-Cmd-Enter": () => this.onFullScreen && this.onFullScreen(),
      },
    });

    this.cm.on("change", (e) => {
    });

    this.cm.on("focus", () => {
      this.parent.classList.add("focused");
    });

    this.cm.on("blur", () => {
      this.parent.classList.remove("focused");
    });
  }
}

export {Editor}
