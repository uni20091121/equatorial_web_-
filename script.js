document.addEventListener("DOMContentLoaded", () => {
"use strict";

const container = document.getElementById("scene");

if (!container) {
    console.error('Missing element: #scene');
    return;
}

if (typeof THREE === "undefined") {
    container.textContent = "Error: Three.js has not loaded.";
    return;
}

if (container.clientHeight === 0) {
    container.style.height = "600px";
}

// =====================================================
// 1. SCENE, CAMERA AND RENDERER
// =====================================================

const scene = new THREE.Scene();
scene.background = new THREE.Color("#030712");

const camera = new THREE.PerspectiveCamera(
    45,
    container.clientWidth / container.clientHeight,
    0.01,
    100
);

camera.position.set(2.5, -3.2, 2.4);
camera.up.set(0, 0, 1);
camera.lookAt(0, 0, 0);

const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(container.clientWidth, container.clientHeight);

if (THREE.SRGBColorSpace) {
    renderer.outputColorSpace = THREE.SRGBColorSpace;
} else {
    renderer.outputEncoding = THREE.sRGBEncoding;
}

renderer.domElement.style.display = "block";
renderer.domElement.style.width = "100%";
renderer.domElement.style.height = "100%";
renderer.domElement.style.touchAction = "none";

container.appendChild(renderer.domElement);

// =====================================================
// 2. CAMERA CONTROLS
// =====================================================

let dragging = false;
let lastX = 0;
let lastY = 0;

let cameraAzimuth = Math.atan2(camera.position.y, camera.position.x);
let cameraElevation = Math.asin(
    camera.position.z / camera.position.length()
);
let cameraDistance = camera.position.length();

function updateCamera() {
    cameraElevation = Math.max(
        -1.5,
        Math.min(1.5, cameraElevation)
    );

    cameraDistance = Math.max(
        1.3,
        Math.min(7, cameraDistance)
    );

    camera.position.set(
        cameraDistance * Math.cos(cameraElevation) * Math.cos(cameraAzimuth),
        cameraDistance * Math.cos(cameraElevation) * Math.sin(cameraAzimuth),
        cameraDistance * Math.sin(cameraElevation)
    );

    camera.lookAt(0, 0, 0);
}

renderer.domElement.addEventListener("pointerdown", event => {
    dragging = true;
    lastX = event.clientX;
    lastY = event.clientY;

    renderer.domElement.setPointerCapture(event.pointerId);
});

renderer.domElement.addEventListener("pointermove", event => {
    if (!dragging) return;

    cameraAzimuth -= (event.clientX - lastX) * 0.008;
    cameraElevation += (event.clientY - lastY) * 0.008;

    lastX = event.clientX;
    lastY = event.clientY;

    updateCamera();
});

renderer.domElement.addEventListener("pointerup", () => {
    dragging = false;
});

renderer.domElement.addEventListener("pointercancel", () => {
    dragging = false;
});

renderer.domElement.addEventListener("wheel", event => {
    event.preventDefault();
    cameraDistance *= event.deltaY > 0 ? 1.08 : 0.92;
    updateCamera();
}, { passive: false });

// =====================================================
// 3. LIGHTING
// =====================================================

scene.add(new THREE.AmbientLight(0x8da9d8, 0.7));

const light = new THREE.PointLight(0xffffff, 1.5);
light.position.set(3, -4, 5);
scene.add(light);

// =====================================================
// 4. GROUPS AND COORDINATE CONVENTION
// =====================================================

// +X = RA 0°
// +Y = RA 90°
// +Z = north celestial pole
// XY = celestial equatorial plane

const R = 1;
const earthR = 0.17;

const gridGroup = new THREE.Group();
const earthGroup = new THREE.Group();
const axesGroup = new THREE.Group();
const arcsGroup = new THREE.Group();
const vectorGroup = new THREE.Group();

scene.add(gridGroup, earthGroup, axesGroup, arcsGroup, vectorGroup);

// =====================================================
// 5. HELPER FUNCTIONS
// =====================================================

function sphericalPosition(raDegrees, decDegrees, radius = R) {
    const ra = THREE.MathUtils.degToRad(raDegrees);
    const dec = THREE.MathUtils.degToRad(decDegrees);

    return new THREE.Vector3(
        radius * Math.cos(dec) * Math.cos(ra),
        radius * Math.cos(dec) * Math.sin(ra),
        radius * Math.sin(dec)
    );
}

function addLine(group, points, color, opacity = 1) {
    const geometry = new THREE.BufferGeometry().setFromPoints(points);

    const material = new THREE.LineBasicMaterial({
        color,
        transparent: opacity < 1,
        opacity,
        depthWrite: false
    });

    const line = new THREE.Line(geometry, material);
    group.add(line);
    return line;
}

function replaceLineGeometry(line, points) {
    line.geometry.dispose();
    line.geometry = new THREE.BufferGeometry().setFromPoints(points);
}

function makeArcPoints(radius, start, end, plane, ra = 0) {
    const points = [];
    const steps = Math.max(
        60,
        Math.ceil(Math.abs(end - start) * 100)
    );

    for (let i = 0; i <= steps; i++) {
        const a = start + (end - start) * i / steps;

        if (plane === "XY") {
            points.push(new THREE.Vector3(
                radius * Math.cos(a),
                radius * Math.sin(a),
                0
            ));
        } else {
            points.push(new THREE.Vector3(
                radius * Math.cos(a) * Math.cos(ra),
                radius * Math.cos(a) * Math.sin(ra),
                radius * Math.sin(a)
            ));
        }
    }

    return points;
}

function makeTextSprite(text, color, scale = 0.07) {
    const canvas = document.createElement("canvas");
    canvas.width = 512;
    canvas.height = 128;

    const ctx = canvas.getContext("2d");

    function draw(textValue) {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.font = "bold 36px Arial";
        ctx.textAlign = "center";
        ctx.textBaseline = "middle";
        ctx.shadowColor = color;
        ctx.shadowBlur = 8;
        ctx.fillStyle = color;
        ctx.fillText(textValue, 256, 64);
    }

    draw(text);

    const texture = new THREE.CanvasTexture(canvas);

    if (THREE.SRGBColorSpace) {
        texture.colorSpace = THREE.SRGBColorSpace;
    }

    const sprite = new THREE.Sprite(
        new THREE.SpriteMaterial({
            map: texture,
            transparent: true,
            depthTest: false
        })
    );

    sprite.scale.set(scale * 4, scale, 1);

    sprite.userData.setText = textValue => {
        draw(textValue);
        texture.needsUpdate = true;
    };

    return sprite;
}

// =====================================================
// 6. CELESTIAL SPHERE
// =====================================================

const celestialSphere = new THREE.Mesh(
    new THREE.SphereGeometry(R, 64, 48),
    new THREE.MeshBasicMaterial({
        color: 0x244a7b,
        transparent: true,
        opacity: 0.075,
        side: THREE.DoubleSide,
        depthWrite: false
    })
);

gridGroup.add(celestialSphere);

// Declination circles
for (let dec = -60; dec <= 60; dec += 30) {
    if (dec === 0) continue;

    const d = THREE.MathUtils.degToRad(dec);
    const radius = R * Math.cos(d);
    const z = R * Math.sin(d);
    const points = [];

    for (let i = 0; i <= 240; i++) {
        const a = i / 240 * Math.PI * 2;

        points.push(new THREE.Vector3(
            radius * Math.cos(a),
            radius * Math.sin(a),
            z
        ));
    }

    addLine(gridGroup, points, 0x42658d, 0.8);
}

// RA meridians
for (let ra = 0; ra < 360; ra += 30) {
    const a = THREE.MathUtils.degToRad(ra);
    const points = [];

    for (let i = 0; i <= 160; i++) {
        const dec = -Math.PI / 2 + i / 160 * Math.PI;

        points.push(new THREE.Vector3(
            R * Math.cos(dec) * Math.cos(a),
            R * Math.cos(dec) * Math.sin(a),
            R * Math.sin(dec)
        ));
    }

    addLine(gridGroup, points, 0x42658d, 0.75);
}

// Celestial equator
addLine(
    gridGroup,
    makeArcPoints(R, 0, Math.PI * 2, "XY"),
    0x55eaff
);

// =====================================================
// 7. EARTH
// =====================================================

const earth = new THREE.Mesh(
    new THREE.SphereGeometry(earthR, 48, 32),
    new THREE.MeshPhongMaterial({
        color: 0x1261a0,
        shininess: 45,
        specular: 0x3b8bd4
    })
);

earthGroup.add(earth);

addLine(
    earthGroup,
    makeArcPoints(earthR, 0, Math.PI * 2, "XY"),
    0xffffff
);

addLine(
    earthGroup,
    [
        new THREE.Vector3(0, 0, -earthR * 1.6),
        new THREE.Vector3(0, 0, earthR * 1.6)
    ],
    0xffffff
);

const ncpLabel = makeTextSprite("NCP", "#ffffff");
ncpLabel.position.set(0, 0, earthR * 2.05);
earthGroup.add(ncpLabel);

// =====================================================
// 8. COORDINATE AXES
// =====================================================

const axisLength = 1.12;

addLine(axesGroup, [
    new THREE.Vector3(-axisLength, 0, 0),
    new THREE.Vector3(axisLength, 0, 0)
], 0xff5555);

addLine(axesGroup, [
    new THREE.Vector3(0, -axisLength, 0),
    new THREE.Vector3(0, axisLength, 0)
], 0x55eaff);

addLine(axesGroup, [
    new THREE.Vector3(0, 0, -axisLength),
    new THREE.Vector3(0, 0, axisLength)
], 0xffe66d);

[
    ["+X (RA 0°)", "#ff5555", [1.2, 0, 0]],
    ["-X", "#ff5555", [-1.2, 0, 0]],
    ["+Y (RA 90°)", "#55eaff", [0, 1.2, 0]],
    ["-Y", "#55eaff", [0, -1.2, 0]],
    ["North pole", "#ffe66d", [0, 0, 1.22]],
    ["-Z", "#ffe66d", [0, 0, -1.22]]
].forEach(([text, color, position]) => {
    const label = makeTextSprite(text, color);
    label.position.set(...position);
    axesGroup.add(label);
});

// =====================================================
// 9. STAR AND EARTH-TO-STAR VECTOR
// =====================================================

const star = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0xffe66d })
);

const starGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.035, 20, 20),
    new THREE.MeshBasicMaterial({
        color: 0xffffff,
        transparent: true,
        opacity: 0.3
    })
);

vectorGroup.add(star, starGlow);

// Actual 3D vector from Earth's center to star
const starVector = addLine(
    vectorGroup,
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
    0xffcc66
);

// =====================================================
// 10. XY PROJECTION
// =====================================================

// Cyan line: projection of the star vector onto the XY plane.
// It runs from Earth's center to (x_star, y_star, 0).

const xyProjectionLine = addLine(
    vectorGroup,
    [new THREE.Vector3(0, 0, 0), new THREE.Vector3(1, 0, 0)],
    0x00ffff
);

const xyProjectionPoint = new THREE.Mesh(
    new THREE.SphereGeometry(0.014, 20, 20),
    new THREE.MeshBasicMaterial({ color: 0x00ffff })
);

vectorGroup.add(xyProjectionPoint);

// Dashed vertical line from the projected point up to the star
const dropLine = new THREE.Line(
    new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(1, 0, 0),
        new THREE.Vector3(1, 0, 0.5)
    ]),
    new THREE.LineDashedMaterial({
        color: 0x00ffff,
        dashSize: 0.035,
        gapSize: 0.02,
        transparent: true,
        opacity: 0.85
    })
);

vectorGroup.add(dropLine);

// =====================================================
// 11. RA AND DECLINATION ANGULAR ARCS
// =====================================================

// Orange RA arc, in the equatorial XY plane
const raArcRadius = earthR * 2.15;

const raArc = addLine(
    arcsGroup,
    makeArcPoints(raArcRadius, 0, Math.PI / 4, "XY"),
    0xff9f43
);

const raArcLabel = makeTextSprite("RA 45°", "#ff9f43");
arcsGroup.add(raArcLabel);

// Yellow declination arc, on the star's RA meridian
const decArc = addLine(
    arcsGroup,
    makeArcPoints(R, 0, Math.PI / 6, "DEC", Math.PI / 4),
    0xffe66d
);

const decArcLabel = makeTextSprite("Dec +30°", "#ffe66d");
arcsGroup.add(decArcLabel);

// =====================================================
// 12. HTML SLIDERS AND READOUTS
// =====================================================

const requiredIds = [
    "raSlider",
    "decSlider",
    "raOutput",
    "decOutput",
    "raHours",
    "raDegrees",
    "decValue",
    "gridToggle",
    "earthToggle",
    "axesToggle",
    "arcsToggle"
];

const missingIds = requiredIds.filter(
    id => !document.getElementById(id)
);

if (missingIds.length) {
    console.error("Missing HTML IDs:", missingIds);
    return;
}

const raSlider = document.getElementById("raSlider");
const decSlider = document.getElementById("decSlider");

// =====================================================
// 13. UPDATE ALL GEOMETRY
// =====================================================

function updateVisualization() {
    const ra = Number(raSlider.value);
    const dec = Number(decSlider.value);

    const raRad = THREE.MathUtils.degToRad(ra);
    const decRad = THREE.MathUtils.degToRad(dec);

    const position = sphericalPosition(ra, dec);

    // Move the star
    star.position.copy(position);
    starGlow.position.copy(position);

    // Update actual vector
    replaceLineGeometry(starVector, [
        new THREE.Vector3(0, 0, 0),
        position
    ]);

    // -------------------------------------------------
    // XY PROJECTION OF STAR VECTOR
    // -------------------------------------------------

    const projectedPosition = new THREE.Vector3(
        position.x,
        position.y,
        0
    );

    replaceLineGeometry(xyProjectionLine, [
        new THREE.Vector3(0, 0, 0),
        projectedPosition
    ]);

    xyProjectionPoint.position.copy(projectedPosition);

    replaceLineGeometry(dropLine, [
        projectedPosition,
        position
    ]);

    // Recompute distances for dashed line
    dropLine.computeLineDistances();

    // -------------------------------------------------
    // RIGHT ASCENSION ARC
    // -------------------------------------------------

    replaceLineGeometry(
        raArc,
        makeArcPoints(raArcRadius, 0, raRad, "XY")
    );

    const raMid = raRad / 2;

    raArcLabel.position.set(
        (raArcRadius + 0.12) * Math.cos(raMid),
        (raArcRadius + 0.12) * Math.sin(raMid),
        0.035
    );

    raArcLabel.userData.setText(
        "RA " + ra.toFixed(1) + "°"
    );

    // -------------------------------------------------
    // DECLINATION ARC
    // -------------------------------------------------

    replaceLineGeometry(
        decArc,
        makeArcPoints(R, 0, decRad, "DEC", raRad)
    );

    const decMid = decRad / 2;
    const labelRadius = 1.08;

    decArcLabel.position.set(
        labelRadius * Math.cos(decMid) * Math.cos(raRad),
        labelRadius * Math.cos(decMid) * Math.sin(raRad),
        labelRadius * Math.sin(decMid)
    );

    decArcLabel.userData.setText(
        "Dec " + (dec >= 0 ? "+" : "") + dec.toFixed(1) + "°"
    );

    // -------------------------------------------------
    // NUMERIC READOUTS
    // -------------------------------------------------

    document.getElementById("raOutput").textContent =
        ra.toFixed(2) + "°";

    document.getElementById("decOutput").textContent =
        (dec >= 0 ? "+" : "") + dec.toFixed(2) + "°";

    document.getElementById("raHours").textContent =
        (ra / 15).toFixed(3) + " h";

    document.getElementById("raDegrees").textContent =
        ra.toFixed(2) + "°";

    document.getElementById("decValue").textContent =
        (dec >= 0 ? "+" : "") + dec.toFixed(2) + "°";
}

raSlider.addEventListener("input", updateVisualization);
decSlider.addEventListener("input", updateVisualization);

// =====================================================
// 14. VISIBILITY TOGGLES
// =====================================================

document.getElementById("gridToggle").addEventListener("change", e => {
    gridGroup.visible = e.target.checked;
});

document.getElementById("earthToggle").addEventListener("change", e => {
    earthGroup.visible = e.target.checked;
});

document.getElementById("axesToggle").addEventListener("change", e => {
    axesGroup.visible = e.target.checked;
});

document.getElementById("arcsToggle").addEventListener("change", e => {
    arcsGroup.visible = e.target.checked;
});

// =====================================================
// 15. RESPONSIVE RESIZING
// =====================================================

function resizeRenderer() {
    const width = Math.max(container.clientWidth, 1);
    const height = Math.max(container.clientHeight, 1);

    camera.aspect = width / height;
    camera.updateProjectionMatrix();

    renderer.setSize(width, height);
}

window.addEventListener("resize", resizeRenderer);

if (typeof ResizeObserver !== "undefined") {
    new ResizeObserver(resizeRenderer).observe(container);
}

// =====================================================
// 16. START
// =====================================================

updateVisualization();

function animate() {
    requestAnimationFrame(animate);
    renderer.render(scene, camera);
}

animate();

});