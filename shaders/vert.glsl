uniform mat4 modelMatrix;
uniform mat4 viewMatrix;
uniform mat4 projectionMatrix;

attribute vec3 position;
attribute vec3 normal;

varying float vHeight;
varying vec3 vNormal;

void main(){
    vHeight = position.y;
    vNormal = normal;
    gl_Position =  projectionMatrix * viewMatrix * modelMatrix * vec4(position,1.0);
}