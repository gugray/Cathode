void main() {
    ivec2 p = ivec2(gl_FragCoord.xy);
    vec4 val = texelFetch(txPrev, p, 0);
    outData = val;
}
