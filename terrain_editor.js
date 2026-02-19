import * as THREE from 'three';
import { polygonise } from './marching_cube_lib';
import { createNoise2D } from 'simplex-noise';
import { OrbitControls } from 'three/examples/jsm/Addons.js';

const screen = {
    width: window.innerWidth,
    height: window.innerHeight
};

const canvas = document.getElementById("webgl_canvas");

const scene = new THREE.Scene();

//Draw Lines around the terrain
const geometry = new THREE.BoxGeometry(50, 50, 50);
const edges = new THREE.EdgesGeometry(geometry);
const line = new THREE.LineSegments(edges, new THREE.LineBasicMaterial({ color: 0xffffff }));
scene.add(line);

const camera = new THREE.PerspectiveCamera(45, screen.width / screen.height);
camera.position.set(100, 100, 100);

const ambientLight = new THREE.AmbientLight(0xffffff, 0.3);
scene.add(ambientLight);

const dirLight = new THREE.DirectionalLight(0xffffff, 1.5);
dirLight.position.set(30, 50, 30);
dirLight.castShadow = true;

// Expand the shadow camera frustum to fit a 50x50x50 world
//a 60x60x60 orthographic box outh to do
dirLight.shadow.camera.left = -30;
dirLight.shadow.camera.right = 30;
dirLight.shadow.camera.top = 30;
dirLight.shadow.camera.bottom = -30;
dirLight.shadow.camera.far = 100;

// Increase shadow resolution
dirLight.shadow.mapSize.width = 1024;
dirLight.shadow.mapSize.height = 1024;

dirLight.shadow.bias = -0.0005;
dirLight.shadow.normalBias = 0.02;

scene.add(dirLight);

const controls = new OrbitControls(camera, canvas);
controls.enableDamping = true;

const renderer = new THREE.WebGLRenderer({ canvas: canvas });
renderer.setSize(screen.width, screen.height);
//Enable Shadow Map
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;

//Terrain Configuration
const size = 50;
const res = 50;
const step = size / res;
const isoLevel = 0.0;

//for the entire space store the density values
let densityGrid = [];
function initDensityGrid() {
    for (let x = 0; x <= res; x++) {
        densityGrid[x] = [];
        for (let y = 0; y <= res; y++) {
            densityGrid[x][y] = [];
            for (let z = 0; z <= res; z++) {
                //intial state: a flat plane at the bottom
                //values > isoLevel are solid and less are empty
                densityGrid[x][y][z] = y < 1 ? 1.0 : 0.0;
            }
        }
    }
}
// initDensityGrid();

const noise2D = createNoise2D();
function initDensityGridPerlin() {
    // Terrain parameters
    const scale = 0.01;      // General frequency of the terrain
    const elevation = 40;    // Max height of mountains
    const seaLevel = -25;    // Y-position for the "beach/water" base

    for (let x = 0; x <= res; x++) {
        densityGrid[x] = [];
        for (let y = 0; y <= res; y++) {
            densityGrid[x][y] = [];
            for (let z = 0; z <= res; z++) {

                // 1. Calculate World Coordinates for noise sampling
                const worldX = x * step;
                const worldZ = z * step;

                // 2. Layered Noise (Octaves)
                // Large shapes (Mountains)
                let noiseHeight = noise2D(worldX * scale, worldZ * scale) * elevation;
                // Medium detail (Hills)
                noiseHeight += noise2D(worldX * scale * 2, worldZ * scale * 2) * (elevation * 0.5);
                // Fine detail (Bumps)
                noiseHeight += noise2D(worldX * scale * 4, worldZ * scale * 4) * (elevation * 0.25);

                // 3. Final Height Calculation
                // We offset it by seaLevel so the terrain starts lower in the 50x50x50 box
                const finalHeight = seaLevel + noiseHeight;

                // 4. Convert World Y to Grid density
                const currentWorldY = (y * step) - (size / 2);

                // We use a soft gradient near the surface for smoother Marching Cubes
                const density = finalHeight - currentWorldY;

                if (y === 0) {
                    densityGrid[x][y][z] = 1.0;
                } else {
                    densityGrid[x][y][z] = Math.max(0.0, Math.min(1.0, density));
                }
            }
        }
    }
}
initDensityGridPerlin();

//a mesh holder for our terrain
let terrainMesh = new THREE.Mesh();
// terrainMesh.material = new THREE.RawShaderMaterial({
//     vertexShader:vertexShader,
//     fragmentShader:fragmentShader,
//     uniforms:{
//         minHeight:{value:-size/2.0},
//         maxHeight:{val:size/2.0}
//     }
// });
terrainMesh.material = new THREE.MeshStandardMaterial({
    vertexColors: true,
    flatShading: true,
    roughness: 1.0,
    metalness: 0.0,
    side: THREE.DoubleSide
});


terrainMesh.castShadow = true;
terrainMesh.receiveShadow = true;
scene.add(terrainMesh);

//get a color gradient
function getColorGradient(t) {
    const sea = new THREE.Vector3(0.0, 0.4, 1.0);      // Deep Blue
    const beach = new THREE.Vector3(1.0, 0.95, 0.4);   // Light Sand Yellow
    const grass = new THREE.Vector3(0.2, 0.6, 0.1);   // Vibrant Green
    const hills = new THREE.Vector3(0.7, 0.4, 0.15);  // Brown
    const snow = new THREE.Vector3(0.95, 0.95, 1.0);   // Off-white/Snow

    const result = new THREE.Vector3();

    // 0.0 to 0.10: Sea to Beach (Quick transition)
    if (t < 0.10) {
        return result.lerpVectors(sea, beach, t / 0.10);
    }
    // 0.10 to 0.40: Beach to Grasslands
    if (t < 0.40) {
        return result.lerpVectors(beach, grass, (t - 0.10) / 0.30);
    }
    // 0.40 to 0.95: Grasslands to Bright Hills
    if (t < 0.95) {
        return result.lerpVectors(grass, hills, (t - 0.40) / 0.55);
    }
    // 0.95 to 1.0: Hills to Snow
    return result.lerpVectors(hills, snow, (t - 0.95) / 0.05);
}

//Update the terrain mesh with geometry and materail data
function updateMesh() {
    const triangles = [];

    for (let x = 0; x < res; x++) {
        for (let y = 0; y < res; y++) {
            for (let z = 0; z < res; z++) {
                //the initial starting position of the voxel cube
                const posX = (x * step) - (size / 2);
                const posY = (y * step) - (size / 2);
                const posZ = (z * step) - (size / 2);

                //the eight vertex of the voxel cube and its values
                const grid = {
                    p: [
                        new THREE.Vector3(posX, posY, posZ),
                        new THREE.Vector3(posX + step, posY, posZ),
                        new THREE.Vector3(posX + step, posY, posZ + step),
                        new THREE.Vector3(posX, posY, posZ + step),
                        new THREE.Vector3(posX, posY + step, posZ),
                        new THREE.Vector3(posX + step, posY + step, posZ),
                        new THREE.Vector3(posX + step, posY + step, posZ + step),
                        new THREE.Vector3(posX, posY + step, posZ + step)
                    ],
                    val: [
                        densityGrid[x][y][z],
                        densityGrid[x + 1][y][z],
                        densityGrid[x + 1][y][z + 1],
                        densityGrid[x][y][z + 1],
                        densityGrid[x][y + 1][z],
                        densityGrid[x + 1][y + 1][z],
                        densityGrid[x + 1][y + 1][z + 1],
                        densityGrid[x][y + 1][z + 1]
                    ]
                };
                polygonise(grid, isoLevel, triangles);
            }
        }
    }

    //update the vertex colors
    const colors = [];
    const minHeight = -25.0;
    const maxHeight = 10;

    for (let i = 0; i < triangles.length; i += 3) {
        const y = triangles[i + 1];
        const t = Math.max(0.0, Math.min(1.0, (y - minHeight) / (maxHeight - minHeight)));
        const color = getColorGradient(t);
        colors.push(color.x, color.y, color.z);
    }

    const geometry = new THREE.BufferGeometry();
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(triangles, 3));
    geometry.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3));
    geometry.computeVertexNormals();
    geometry.computeBoundingSphere();

    terrainMesh.geometry.dispose();
    terrainMesh.geometry = geometry;
    terrainMesh.material.needsUpdate = true;
}

updateMesh();

//Mouse events
let isAltLeftClick = false;
let isAltRightClick = false;
const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

function raycastFromMouse(event) {
    //take the mouse position and convert it to range [-1,1]
    mouse.x = (event.clientX / screen.width) * 2 - 1;
    mouse.y = -(event.clientY / screen.height) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObject(terrainMesh);

    if (intersects.length > 0) {
        const point = intersects[0].point;

        //Update Brush Mesh Position
        brushCursor.position.copy(point);
        brushCursor.visible = true;

        if (isAltLeftClick) editTerrain(point, true);
        if (isAltRightClick) editTerrain(point, false);
    }
}

let brushRadius = 5.0;
const strength = 0.5;
function editTerrain(point, add) {
    // 1. Convert World Position to Grid Index
    // Formula: (WorldPos + HalfSize) / Step
    const centerX = Math.round((point.x + size / 2) / step);
    const centerY = Math.round((point.y + size / 2) / step);
    const centerZ = Math.round((point.z + size / 2) / step);

    // 2. Convert Brush Radius to "Grid Units"
    const gridRadius = Math.ceil(brushRadius / step);

    // 3. Loop only within the local bounding box of the brush
    for (let x = centerX - gridRadius; x <= centerX + gridRadius; x++) {
        for (let y = centerY - gridRadius; y <= centerY + gridRadius; y++) {
            for (let z = centerZ - gridRadius; z <= centerZ + gridRadius; z++) {

                // Bounds Check: Ensure we don't go outside the array
                if (x < 0 || x > res || y < 0 || y > res || z < 0 || z > res) continue;

                // 4. Calculate world position of this specific grid vertex to check distance
                const vx = (x * step) - (size / 2);
                const vy = (y * step) - (size / 2);
                const vz = (z * step) - (size / 2);

                const distanceFromBrush = point.distanceTo(new THREE.Vector3(vx, vy, vz));

                if (distanceFromBrush < brushRadius) {
                    const influence = (1 - distanceFromBrush / brushRadius) * strength;
                    if (add) {
                        densityGrid[x][y][z] = Math.min(1.0, densityGrid[x][y][z] + influence);
                    } else {
                        densityGrid[x][y][z] = Math.max(0.0, densityGrid[x][y][z] - influence);
                    }
                }
            }
        }
    }
    updateMesh(); // Don't forget to call this to see the changes!
}

//add a sphere around the mouse when over terrain
const ringGeom = new THREE.RingGeometry(brushRadius - 0.2, brushRadius, 32); // Inner and outer radius
const ringMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    side: THREE.DoubleSide,
    transparent: true,
    opacity: 0.8,
    depthTest: false,
    depthWrite: false
});
const brushCursor = new THREE.Mesh(ringGeom, ringMat);

// Rotate to lie flat on the ground
brushCursor.rotation.x = -Math.PI / 2;
brushCursor.visible = false;
scene.add(brushCursor);



//listen for mouse click while pressing ALT key
window.addEventListener('mousedown', (event) => {
    if (event.altKey && event.button === 0) {
        isAltLeftClick = true;
        controls.enabled = false;

    } else if (event.altKey && event.button === 2) {
        isAltRightClick = true;
        controls.enabled = false;
    }
});
window.addEventListener('mousemove', (event) => {
    if (isAltLeftClick || isAltRightClick || event.altKey) {
        raycastFromMouse(event);
    }
});
window.addEventListener('mouseup', (event) => {
    if (isAltLeftClick) { isAltLeftClick = false; controls.enabled = true; };
    if (isAltRightClick) { isAltRightClick = false; controls.enabled = true; };
    brushCursor.visible = false;
});

window.addEventListener('keyup', (event) => {
    if (event.key === 'Alt') {
        controls.enabled=true;
        brushCursor.visible = false;
    }
});

window.addEventListener('wheel', (event) => {
    if (event.altKey) {
        controls.enabled=false;
        event.preventDefault();

        const delta = Math.sign(event.deltaY);

        const increment = 0.1;

        //update the brush radius
        brushRadius = Math.max(0.5, Math.min(5.0, brushRadius - (delta * increment)));

        const scale = brushRadius/5.0;
        brushCursor.scale.set(scale,scale,scale);
    }
},{passive:false});

// Prevent context menu on right click inside the canvas
window.addEventListener('contextmenu', (e) => e.preventDefault());


const animate = () => {
    controls.update();
    renderer.render(scene, camera);
    window.requestAnimationFrame(animate);
}

animate();

