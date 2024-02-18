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

void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 val = texelFetch(txPrev, p, 0);
    if (p == ivec2(0, 0)) {
        val[0] += (knob0 - 32.) * 0.1 * dt;
        val[1] += (knob1 - 32.) * 0.1 * dt;
        val[2] += (knob2 - 32.) * 0.1 * dt;
        val[3] += (knob3 - 32.) * 0.1 * dt;
    }
    outData = val;
}
