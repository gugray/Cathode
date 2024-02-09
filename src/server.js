import express from "express";
import cors from "cors";
import * as fs from "fs";

const shaderStore = {};

export async function run(port) {
  const app = express();
  app.use(cors());
  app.post("/shaders/:name/:sub", express.text(), handlePostShader);
  app.get("/shaders/:name/:sub", handleGetShader);
  try {
    await listen(app, port);
    console.log(`Server is listening on port ${port}`);
  }
  catch (err) {
    console.error(`Server failed to start; error:\n${err}`);
  }
}

function listen(app, port) {
  return new Promise((resolve, reject) => {
    app.listen(port)
      .once('listening', resolve)
      .once('error', reject);
  });
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