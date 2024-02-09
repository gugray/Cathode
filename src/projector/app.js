import * as twgl from "twgl.js";

const serverUrl = "http://localhost:8090/shaders/main/frag";
const checkInterval = 50;
void init();

let seq = -1;

async function init() {
  setInterval(checkShaders, checkInterval);
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
  updateShaders(data.val);
}

function updateShaders(frag) {
  const elm = document.getElementById("dbg");
  dbg.innerText = frag;
}
