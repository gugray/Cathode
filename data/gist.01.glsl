void main() {

  vec2 uv = (gl_FragCoord.xy / resolution.xy) * 2.0 - 1.0;
  uv.x *= resolution.x/resolution.y;

  // This pixel in previous frame
  vec3 prevClr = txFetchUV(txPrev, uv);

  vec2 p = uv;
  float t = time;

  vec2 a = vec2(sin(t * 0.001), cos(t * 0.0007));
  vec2 b = vec2(sin(t * 0.00097), cos(t * 0.0013));
  float d = sdSegment(p, a, b);
  float inLine = 1.0 - smoothstep(0.01, 0.012, d);
  float r = inLine * 0.9;

  vec3 clr = vec3(r, 0.0, 0.0);

  clr += texelFetch(txPrev, ivec2(gl_FragCoord.xy) + ivec2(1, 0), 0).rgb - vec3(0.01);

  outColor = vec4(clr.rgb, 1.0);
}
