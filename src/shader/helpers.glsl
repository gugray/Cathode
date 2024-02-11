vec3 txFetchUV(sampler2D tx, vec2 p) {
    // Our standard coordinates and (-1, 1) for Y and whatever for X (>1 for landscape)
    // For texture access, must normalize X to (-1, -1) too
    p.x *= resolution.y / resolution.x;
    // But actually we need (0, 1) for both lol, because texture
    p = p * 0.5 + vec2(0.5);
    // Get the color
    return texture(tx, p).rgb;
}

