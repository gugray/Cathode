// https://www.shadertoy.com/view/MllcD2

const float squares = 1.0;
const float amt = 0.2;
const float offset = 0.125;

void main() {
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    vec2 p = uv;
    p.x *= resolution.x/resolution.y;

    // convert the input coordinates by a cosinus
    // warpMultiplier is the frequency
    float warpMultiplier = (3.0 + 2.5 * sin(time * 0.001 * 0.15 - 2.));
    vec2 warped = sin(uv * 6.28318530718 * warpMultiplier);

    // blend between the warpeffect and no effect
    // don't go all the way to the warp effect
    float warpornot = smoothstep(-0.9, 1.3, -sin(time * 0.001 * 0.23));
    vec2 q = mix(p, warped, warpornot);


    vec3 clr = txFetchUV(txClip0, q);

    vec3 prev = texelFetch(txPrev, ivec2(gl_FragCoord.xy) + ivec2(4, 0), 0).rgb;
    // vec3 prev = txFetchUV(txPrev, q + vec2(0.01, 0.0));
    clr += 0.75 * (pow(prev, vec3(2.0)) - vec3(0.2));

    outColor = vec4(clr.rgb, 1.0);
}
