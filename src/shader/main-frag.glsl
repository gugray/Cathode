#version 300 es
precision highp float;

uniform float time;
uniform vec2 resolution;
out vec4 outColor;

#include "sdf.glsl"
// GIST.GLSL
