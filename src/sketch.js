import path from "path";
import {promises as fs} from "fs";

import "./common/types.js";

async function existsAsync(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Creates an empty sketch.
 * @returns {Sketch}
 */
export function makeEmpty(name) {
  return {
    name: name,
    main: "",
    calc: null,
    ctrl: null,
    clips: [],
  };
}

export async function listSketches(dir) {
  const res = [];
  let files;
  try {
    files = await fs.readdir(dir);
  }
  catch (err) {
    console.error(`Failed to list files in director: ${dir}`);
    return res;
  }
  for (const fn of files) {
    if (!fn.endsWith(".json")) continue;
    res.push(fn.replaceAll(".json", ""));
  }
  return res;
}

/**
 * Loads a sketch from disk. Returns empty sketch if doesn't exist / failed to parse.
 * @returns {Sketch}
 */
export async function load(dataDir, sketchName) {
  const fnJson = path.join(dataDir, `${sketchName}.json`);
  const exists = await existsAsync(fnJson);
  if (!exists) return makeEmpty(sketchName);
  const json = await fs.readFile(fnJson, 'utf8');
  const sketch = JSON.parse(json);
  sketch.name = sketchName;
  sketch.calc = null;
  sketch.ctrl = null;
  const fnMain = path.join(dataDir, `${sketch.name}.main.glsl`);
  sketch.main = await fs.readFile(fnMain, "utf8");
  const fnCalc = path.join(dataDir, `${sketch.name}.calc.glsl`);
  if (await existsAsync(fnCalc))
    sketch.calc = await fs.readFile(fnCalc, "utf8");
  const fnCtrl = path.join(dataDir, `${sketch.name}.ctrl.js`)
  if (await existsAsync(fnCtrl))
    sketch.ctrl = await fs.readFile(fnCtrl, "utf8");
  return sketch;
}

export async function save(dataDir, sketch) {
  const obj = {
    clips: sketch.clips,
  }
  const fnJson = path.join(dataDir, `${sketch.name}.json`);
  await fs.writeFile(fnJson, JSON.stringify(obj, null, 2), "utf8");
  const fnMain = path.join(dataDir, `${sketch.name}.main.glsl`);
  await fs.writeFile(fnMain, sketch.main, "utf8");
  if (sketch.calc) {
    const fnCalc = path.join(dataDir, `${sketch.name}.calc.glsl`);
    await fs.writeFile(fnCalc, sketch.calc, "utf8");
  }
  if (sketch.ctrl) {
    const fnCtrl = path.join(dataDir, `${sketch.name}.ctrl.js`);
    await fs.writeFile(fnCtrl, sketch.ctrl, "utf8");
  }
}

