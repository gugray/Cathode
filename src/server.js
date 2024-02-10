import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { promises as fs } from "fs";
import * as path from "path";
import { truncate } from "./common/utils.js";

const dataDir = "./data";
let activeSketch = {};
let activeSketchName = "default";
const projSockets = [];
let compSocket = null;

// Start by loading default sketch
await loadActiveSketch();

// This is the entry point: starts servers
export async function run(port) {

  // Create app, server, web socket servers
  const app = express();
  app.use(cors());
  const server = http.createServer(app);
  const wsComp = new WebSocketServer({ noServer: true });
  const wsProj = new WebSocketServer({ noServer: true });

  // Upgrade connections to web socker
  server.on("upgrade", (request, socket, head) => {
    if (request.url === '/comp') {
      wsComp.handleUpgrade(request, socket, head, (ws) => {
        wsComp.emit("connection", ws, request);
      });
    }
    else if (request.url === '/proj') {
      wsProj.handleUpgrade(request, socket, head, (ws) => {
        wsProj.emit("connection", ws, request);
      });
    }
    else {
      socket.destroy(); // Close the connection for other paths
    }
  });

  // Web socket event handlers
  wsComp.on("connection", (ws) => {
    console.log("Composer connected");
    if (compSocket) {
      console.log("There is already a composer connection; closing it.");
      compSocket.close();
    }
    compSocket = ws;

    ws.on("close", () => {
      console.log("Composer disconnected");
      compSocket = null;
    });

    ws.on("message", (msgStr) => {
      console.log(`Composer: ${truncate(msgStr, 64)}`);
      handleComposerMessage(JSON.parse(msgStr));
    });
  });

  wsProj.on("connection", (ws) => {
    console.log("Projector connected");
    projSockets.push(ws);

    ws.on("close", () => {
      console.log("Projector disconnected");
      const ix = projSockets.indexOf(ws);
      if (ix != -1) projSockets.splice(ix, 1);
    });

    ws.on("message", (msgStr) => {
      console.log(`Projector: ${truncate(msgStr, 64)}`);
      handleProjectorMessage(ws, JSON.parse(msgStr));
    });
  });

  // app.post("/shaders/:name/:sub", express.text(), handlePostShader);
  // app.get("/shaders/:name/:sub", handleGetShader);

  // Run
  try {
    await listen(server, port);
    console.log(`Server is listening on port ${port}`);
  }
  catch (err) {
    console.error(`Server failed to start; error:\n${err}`);
  }
}

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.listen(port)
      .once('listening', resolve)
      .once('error', reject);
  });
}

function handleComposerMessage(msg) {
  if (msg.action == "get-active-sketch") {
    const resp = {
      action: "sketch",
      name: activeSketchName,
      sketch: activeSketch,
    }
    compSocket.send(JSON.stringify(resp));
  }
  else if (msg.action == "update-active-sketch-gist") {
    activeSketch.gist = msg.gist;
    const out = {
      action: "sketch-gist",
      gist: activeSketch.gist,
    };
    const outStr = JSON.stringify(out);
    for (const ps of projSockets) ps.send(outStr);
    void saveActiveSketch();
  }
}

function handleProjectorMessage(fromSocket, msg) {
  if (msg.action == "get-active-sketch") {
    const resp = {
      action: "sketch",
      name: activeSketchName,
      sketch: activeSketch,
    }
    fromSocket.send(JSON.stringify(resp));
  }
}

async function existsAsync(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

async function loadActiveSketch() {
  activeSketch = {};
  const fn = path.join(dataDir, `${activeSketchName}.json`);
  const exists = await existsAsync(fn);
  if (!exists) return;
  const json = await fs.readFile(fn, 'utf8');
  activeSketch = JSON.parse(json);
}

async function saveActiveSketch() {
  const fn = path.join(dataDir, `${activeSketchName}.json`);
  const json = JSON.stringify(activeSketch, null, 2);
  fs.writeFile(fn, json, 'utf8');
}

async function handlePostShader(req, res) {

  let nameObj = {};
  if (shaderStore.hasOwnProperty(req.params.name))
    nameObj = shaderStore[req.params.name];
  else shaderStore[req.params.name] = nameObj;

  let subObj = {
    seq: -1,
    val: null,
  };
  if (nameObj.hasOwnProperty(req.params.sub))
    subObj = nameObj[req.params.sub];
  else nameObj[req.params.sub] = subObj;

  if (subObj.val != req.body) {
    subObj.val = req.body;
    ++subObj.seq;
  }
  res.sendStatus(200);
  // TODO: save history
}


async function handleGetShader(req, res) {
  let seq = -1;
  if (req.query.hasOwnProperty("seq")) {
    seq = parseInt(req.query.seq);
    if (isNaN(seq)) seq = -1;
  }
  if (!shaderStore.hasOwnProperty(req.params.name)) {
    res.sendStatus(404);
    return;
  }
  const nameObj = shaderStore[req.params.name];
  if (!nameObj.hasOwnProperty(req.params.sub)) {
    res.sendStatus(404);
    return;
  }
  const subObj = nameObj[req.params.sub];
  if (seq == subObj.seq) {
    res.sendStatus(304);
    return;
  }
  res.setHeader("content-type", "text/plain");
  await res.json(subObj);
}