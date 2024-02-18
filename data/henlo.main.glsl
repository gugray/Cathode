void main() {
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    vec2 p = uv;
    p.x *= resolution.x/resolution.y;

    vec3 clr = vec3(0.3, 0.3, 0.0);
    outColor = vec4(clr.rgb, 1.0);
}
