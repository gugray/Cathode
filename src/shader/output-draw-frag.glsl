#version 300 es
precision highp float;

uniform sampler2D txOutput;
out vec4 outColor;

void main() {
    outColor.a = 1.;
    vec4 tx = texelFetch(txOutput, ivec2(gl_FragCoord.xy), 0);
    outColor.rgb = tx.rgb;
}
