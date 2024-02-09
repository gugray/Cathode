#version 300 es
precision highp float;

uniform float time;
out vec4 outColor;

#include "sdf.glsl"
// GIST.GLSL
