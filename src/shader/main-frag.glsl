#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;
uniform sampler2D txPrev;
uniform sampler2D txClip0;
out vec4 outColor;

#include "helpers.glsl"
#include "sdf.glsl"
// GIST.GLSL
