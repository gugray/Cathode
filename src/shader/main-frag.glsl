#version 300 es
precision highp float;

uniform float time;
uniform float vol;
uniform float fft[4];
uniform float beat;
uniform float knobs[8];

uniform vec2 resolution;
uniform sampler2D txData;
uniform sampler2D txPrev;
uniform sampler2D txClip0;
out vec4 outColor;

#include "helpers.glsl"
#include "random.glsl"
#include "sdf.glsl"
#include "spectrum.glsl"

// MAIN.GLSL
