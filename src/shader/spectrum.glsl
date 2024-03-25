
vec3 audioSpectrum(vec2 p, vec3 clr, float ar) {
    const vec2 wsz = vec2(0.75, 0.5); // Widget size
    p.x -= (ar - wsz.x);
    p.x /= wsz.x;
    if (p.x < 0. || p.x > 1.0) return clr;
    p.y += 1.0;
    p.y /= wsz.y;
    if (p.y < 0. || p.y > 1.0) return clr;
    // Now p is (0,0) -> (1,1) for our area
    clr = vec3(0.08, 0.08, 0.01);
    float edgeL = 1.0 - step(0.01, p.x);
    float edgeT = step(0.99, p.y);
    clr += vec3(0.2, 0.2, 0.2) * max(edgeL, edgeT);
    // Total volume on the right
    const float volW = 0.17;
    float volH = vol;
    float d = sdBox(p - vec2(0.99 - volW * 0.5, volH * 0.5), vec2(volW * 0.5, volH * 0.5));
    if (d<0.) clr = vec3(0.2, 0.4, 0.1);
    // FFT buckets
    for (float i = 0.0; i < 4.0; i += 1.0) {
        const float fftW = 0.19;
        float fftH = fft[int(i)];
        d = sdBox(p - vec2(0.01 + 0.20 * (i+1.0) - fftW * 0.5, fftH * 0.5), vec2(fftW * 0.5, fftH * 0.5));
        if (d<0.) clr = vec3(0.4, 0.2, 0.1);
    }
    return clr;
}
