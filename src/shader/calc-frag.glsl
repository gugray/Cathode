#version 300 es
precision highp float;

uniform sampler2D txPrev;
uniform float knob0;
uniform float knob1;
uniform float knob2;
uniform float knob3;
uniform float knob4;
uniform float knob5;
uniform float knob6;
uniform float knob7;
uniform float dt;
out vec4 outData;

// CALC.GLSL
