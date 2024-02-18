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
