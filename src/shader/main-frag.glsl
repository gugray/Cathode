#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;
uniform float knob0;
uniform float knob1;
uniform float knob2;
uniform float knob3;
uniform float knob4;
uniform float knob5;
uniform float knob6;
uniform float knob7;
uniform sampler2D txData;
uniform sampler2D txPrev;
uniform sampler2D txClip0;
out vec4 outColor;

#include "helpers.glsl"
#include "sdf.glsl"
// GIST.GLSL
