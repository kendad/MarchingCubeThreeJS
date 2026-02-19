precision mediump float;

varying float vHeight;
varying vec3 vNormal;

uniform float minHeight;
uniform float maxHeight;

vec3 getColorGradient(float t){
    vec3 c1 = vec3(1.0, 0.0, 0.0); // Red
    vec3 c2 = vec3(1.0, 1.0, 0.0); // Yellow
    vec3 c3 = vec3(0.0, 1.0, 0.0); // Green
    vec3 c4 = vec3(0.0, 1.0, 1.0); // Cyan
    vec3 c5 = vec3(0.0, 0.0, 1.0); // Blue

    if (t < 0.25) return mix(c1, c2, t * 4.0);
    if (t < 0.50) return mix(c2, c3, (t - 0.25) * 4.0);
    if (t < 0.75) return mix(c3, c4, (t - 0.50) * 4.0);
    return mix(c4, c5, (t - 0.75) * 4.0);
}

void main(){
    //Get the Color gradient
    float t = (vHeight - minHeight)/(maxHeight-minHeight);
    t = clamp(t,0.0,1.0);
    vec3 baseColor = getColorGradient(t);

    vec3 lightDir = normalize(vec3(0.5,1.0,0.5));

    float lightIntensity = dot(normalize(vNormal),lightDir);

    lightIntensity = clamp(lightIntensity,0.3,1.0);

    gl_FragColor = vec4(baseColor * lightIntensity ,1.0);
}