#version 300 es
precision highp float;

#define TX_DATA_SZ 16

uniform sampler2D txPrev;

uniform float time;
uniform float dt;
uniform float vol;
uniform float fft[4];
uniform float beat;
uniform float knobs[8];

out vec4 outData;

float getData(int ix) {
    int j = ix / 4;
    int k = ix % 4;
    int y = j / TX_DATA_SZ;
    int x = j % TX_DATA_SZ;
    vec4 v = texelFetch(txPrev, ivec2(x, y), 0);
    return v[k];
}

// CALC.GLSL

void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 val = texelFetch(txPrev, p, 0);
    int ix = 4 * (p.y * TX_DATA_SZ + p.x);
    outData[0] = calc(ix, val[0]);
    outData[1] = calc(ix + 1, val[1]);
    outData[2] = calc(ix + 2, val[2]);
    outData[3] = calc(ix + 3, val[3]);
}
