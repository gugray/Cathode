import {eventInWidget} from "codemirror/src/measurement/widgets.js";

export class LPD8 {
  constructor() {
    this.isOffsetting = false;
    this.knobval = [64, 64, 64, 64, 64, 64, 64, 64];
    this.pads = [false, false, false, false, false, false, false];
    this.onknobchange = null;
    this.onpadchange = null;

    navigator.requestMIDIAccess()
      .then(
        (midi) => midiReady(this, midi),
        (err) => console.log("Failed to access MIDI", err));
  }

  getKnobVal(knobIx) {
    return this.knobval[knobIx];
  }

  getPadVal(padIx) {
    return this.pads[padIx];
  }
}

function midiReady(lpd8, midi) {
  const inputs = midi.inputs.values();
  for (let input = inputs.next(); input && !input.done; input = inputs.next()) {
    if (input.value.name != "LPD8") continue;
    input.value.onmidimessage = e => onMidiMessage(lpd8, e);
  }
  midi.onstatechange = e => onStateChange(lpd8, e);
}

function onMidiMessage(lpd8, e) {
  // CC change. Knobs are expected to be sending on CC numbers 1 thru 8.
  if (e.data[0] == 176) {
    const knobIx = e.data[1] - 1;
    if (knobIx < 0 || knobIx > 7) return;
    lpd8.knobval[knobIx] = e.data[2];
    if (lpd8.onknobchange)
      lpd8.onknobchange(knobIx, lpd8.getKnobVal(knobIx));
  }
  // Pad press or release. Looking for MIDI notes 1 thru 8.
  else if (e.data[0] == 144 || e.data[0] == 128) {
    const pressed = e.data[0] == 144;
    const note = e.data[1];
    // Pad 8: Offsetting mode
    if (note == 8) {
      lpd8.isOffsetting = pressed;
    }
    // Other pads
    else if (note >= 1 && note < 8) {
      lpd8.pads[note-1] = pressed;
      if (lpd8.onpadchange)
        lpd8.onpadchange(note, lpd8.getPadVal(note));
    }
  }
}

function onStateChange(lpd8, e) {
  console.log(`MIDI state change: ${e.port.name} / ${e.port.connection} / ${e.port.state}`);
}
