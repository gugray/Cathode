import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { promises as fs } from "fs";
import * as path from "path";
import { truncate } from "./common/utils.js";
import { ACTION } from "./common/actions.js";

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
  if (msg.action == ACTION.GetActiveSketch) {
    const resp = {
      action: ACTION.Sketch,
      name: activeSketchName,
      sketch: activeSketch,
    }
    compSocket.send(JSON.stringify(resp));
  }
  else if (msg.action == ACTION.UpdateActiveSketchGist) {
    activeSketch.gist = msg.gist;
    const out = {
      action: ACTION.SketchGist,
      gist: activeSketch.gist,
    };
    const outStr = JSON.stringify(out);
    for (const ps of projSockets) ps.send(outStr);
    void saveActiveSketch();
  }
  else if (msg.action == ACTION.Command) {
    const outStr = JSON.stringify(msg);
    for (const ps of projSockets) ps.send(outStr);
  }
}

function handleProjectorMessage(fromSocket, msg) {
  if (msg.action == ACTION.GetActiveSketch) {
    const resp = {
      action: ACTION.Sketch,
      name: activeSketchName,
      sketch: activeSketch,
    }
    fromSocket.send(JSON.stringify(resp));
  }
  else if (msg.action == ACTION.BadCode) {
    if (compSocket != null) compSocket.send(JSON.stringify(msg));
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
