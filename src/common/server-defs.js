export const kServerUrl = "http://localhost:8090";
export const kSocketUrl = "ws://localhost:8090";
export const kSocketPathProj = "/proj";
export const kSocketPathComp = "/comp";

export const ACTION = {
  GetActiveSketch: "get-active-sketch",
  Sketch: "sketch",
  SketchMain: "sketch-main",
  UpdateActiveSketchMain: "update-active-sketch-main",

  // Command from composer to projectors
  Command: "command",

  // Report from projector to composer
  Report: "report",
};

export const COMMAND = {
  SetAnimate: "set-animate",
  SetHiDef: "set-hidef",
  SetKnob: "set-knob",
}

export const REPORT = {
  BadCode: "bad-code",
  ShaderUpdated: "shader-updated",
  CanvasSize: "canvas-size",
}
