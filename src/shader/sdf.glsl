float sdSegment(vec2 p, vec2 a, vec2 b)
{
    vec2 pa = p-a, ba = b-a;
    float h = clamp(dot(pa, ba)/dot(ba, ba), 0.0, 1.0);
    return length(pa - ba*h);
}

float sdCircle(vec2 p, float r)
{
    return length(p) - r;
}

float sdBox(vec2 p, vec2 b)
{
    vec2 d = abs(p)-b;
    return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0);
}
