import express from "express";
import * as http from "http";
import { WebSocketServer } from "ws";
import cors from "cors";
import { promises as fs } from "fs";
import { createReadStream } from 'fs';
import * as path from "path";
import { truncate } from "./common/utils.js";
import * as SD from "./common/server-defs.js";
import * as Sketch from "./sketch.js";
import {kSocketPathProj} from "./common/server-defs.js";

const dataDir = "./data";
let activeSketch;
let activeSketchName = "henlo";
const projSockets = [];
let compSocket = null;

// Start by loading default sketch
activeSketch = await Sketch.load(dataDir, activeSketchName);

// This is the entry point: starts servers
export async function run(port) {

  // Create app, server, web socket servers
  const app = express();
  app.use(cors());
  const server = http.createServer(app);
  const wsComp = new WebSocketServer({ noServer: true });
  const wsProj = new WebSocketServer({ noServer: true });

  app.get("/clips/:name", handleGetClip);
  app.get("/clips/:name/:frame", handleGetClipFrame);

  // Upgrade connections to web socker
  server.on("upgrade", (request, socket, head) => {
    if (request.url === SD.kSocketPathComp) {
      wsComp.handleUpgrade(request, socket, head, (ws) => {
        wsComp.emit("connection", ws, request);
      });
    }
    else if (request.url === SD.kSocketPathProj) {
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
  if (msg.action == SD.ACTION.GetActiveSketch) {
    const resp = {
      action: SD.ACTION.Sketch,
      name: activeSketchName,
      sketch: activeSketch,
    }
    compSocket.send(JSON.stringify(resp));
  }
  else if (msg.action == SD.ACTION.UpdateActiveSketchMain) {
    activeSketch.main = msg.main;
    const out = {
      action: SD.ACTION.SketchMain,
      main: activeSketch.main,
    };
    const outStr = JSON.stringify(out);
    for (const ps of projSockets) ps.send(outStr);
    void Sketch.save(dataDir, activeSketch);
  }
  else if (msg.action == SD.ACTION.Command) {
    const outStr = JSON.stringify(msg);
    for (const ps of projSockets) ps.send(outStr);
  }
}

function handleProjectorMessage(fromSocket, msg) {
  if (msg.action == SD.ACTION.GetActiveSketch) {
    const resp = {
      action: SD.ACTION.Sketch,
      name: activeSketchName,
      sketch: activeSketch,
    }
    fromSocket.send(JSON.stringify(resp));
  }
  else if (msg.action == SD.ACTION.Report) {
    if (compSocket != null) compSocket.send(JSON.stringify(msg));
  }
}

async function handleGetClip(req, res) {
  let files;
  try {
    files = await fs.readdir(path.join(dataDir, `clip-${req.params.name}`));
  }
  catch (err) {
    if (err.hasOwnProperty("code") && err.code == "ENOENT")
      res.sendStatus(404);
    else res.sendStatus(500);
    return;
  }
  let nFrames = 0;
  for (const fn of files) {
    if (fn.startsWith("frame")) ++nFrames;
  }
  const obj = {
    frames: nFrames,
  };
  await res.json(obj);
}

async function handleGetClipFrame(req, res) {
  const ixStr = parseInt(req.params.frame).toString().padStart(3, '0');
  const fn = path.join(dataDir, `clip-${req.params.name}/frame${ixStr}.png`);
  const s = createReadStream(fn);
  s.on("open", () => {
    res.set("content-type", "image/png");
    s.pipe(res);
  });
  s.on("error", () => {
    res.sendStatus(404);
  });
}
