// Sine SDF by blackle: https://www.shadertoy.com/view/3lSyDG
// Though ended up not using it here
#define PI 3.141592653

// Intensity of faux sine SDF at coordinate
float ifs(vec2 p, float amp, float freq, float ofs) {
    float s = amp * sin(p.x * freq + ofs);
    float d = abs(p.y - s);
    return 1.0 - smoothstep(0.0015, 0.02, d);
}

void main() {
    vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
    vec2 p = uv;
    p.x *= resolution.x/resolution.y;

    float in1, in2, in3, in4;

    float amp1 = sin(time * 0.001) * 0.3 + 0.5;
    float freq1 = (sin(time * 0.0013) + 2.0) * PI * 0.5;
    float ofs1 = (sin(time * 0.0007) + 2.0) * PI * 0.5;
    in1 = ifs(p + vec2(0.0, -0.4), amp1, freq1, ofs1);

    float amp2 = sin(time * 0.000757) * 0.7;
    float freq2 = (sin(time * 0.0009546) + 2.0) * PI * 0.5;
    float ofs2 = (sin(time * 0.001057) + 2.0) * PI * 0.5;
    in2 = ifs(p + vec2(0.0, 0.4), amp2, freq2, ofs2);

    vec3 clr;
    clr += in1 * vec3(1.0, 0.4, 0.0);
    clr += in2 * vec3(0.3, 0.7, 0.6);

    vec3 clrClip0 = txFetchUV(txClip0, p);
    vec3 clrPrev = txFetchUV(txPrev, p);
    clrPrev = clrPrev * 0.995 - vec3(0.001);
    clr = clrPrev + clr * 0.1;
    vec3 clrx = clr * 0.99 + clrClip0 * length(clr) * 0.02;

    outColor = vec4(clrx.rgb, 1.0);
}

