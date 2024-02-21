vec3 txFetchUV(sampler2D tx, vec2 p) {
    // Our standard coordinates and (-1, 1) for Y and whatever for X (>1 for landscape)
    // For texture access, must normalize X to (-1, -1) too
    p.x *= resolution.y / resolution.x;
    // But actually we need (0, 1) for both lol, because texture
    p = p * 0.5 + vec2(0.5);
    // Get the color
    return texture(tx, p).rgb;
}

#define TX_DATA_SZ 16

float getData(int ix) {
    int j = ix / 4;
    int k = ix % 4;
    int y = j / TX_DATA_SZ;
    int x = j % TX_DATA_SZ;
    vec4 v = texelFetch(txData, ivec2(x, y), 0);
    return v[k];
}
