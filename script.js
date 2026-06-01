import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

// ===================== SCENE SETUP =====================
const canvas = document.getElementById('bg-canvas');
const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);

const scene = new THREE.Scene();
scene.background = new THREE.Color(0x050510);
scene.fog = new THREE.FogExp2(0x050510, 0.00002);

const camera = new THREE.PerspectiveCamera(55, window.innerWidth / window.innerHeight, 0.1, 200);
camera.position.set(0, 6, 16);
camera.far = 200;

const controls = new OrbitControls(camera, renderer.domElement);
controls.enableDamping = true;
controls.dampingFactor = 0.05;
controls.minDistance = 5;
controls.maxDistance = 40;
controls.target.set(0, 0, 0);
controls.update();

// ===================== LIGHTING =====================
const sunLight = new THREE.PointLight(0xffeedd, 3.0, 0, 0);
sunLight.position.set(0, 0, 0);
scene.add(sunLight);
const ambient = new THREE.AmbientLight(0x111122);
scene.add(ambient);

// ===================== SUN WITH FLAME SHADER =====================
const sunGeo = new THREE.SphereGeometry(1.3, 128, 128);
const sunVertexShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    void main() {
        vUv = uv;
        vNormal = normalize(normalMatrix * normal);
        vPosition = position;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
`;
const sunFragmentShader = `
    varying vec2 vUv;
    varying vec3 vNormal;
    varying vec3 vPosition;
    uniform float uTime;

    float hash(vec2 p) {
        return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
        vec2 i = floor(p);
        vec2 f = fract(p);
        f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
                   mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x), f.y);
    }

    float fbm(vec2 p) {
        float value = 0.0;
        float amplitude = 0.5;
        float frequency = 4.0;
        for (int i = 0; i < 5; i++) {
            value += amplitude * noise(p * frequency);
            frequency *= 2.0;
            amplitude *= 0.5;
        }
        return value;
    }

    void main() {
        vec2 uv = vUv;
        uv.x += uTime * 0.05;
        uv.y += uTime * 0.03;

        float n1 = fbm(uv * 8.0 + uTime * 0.2);
        float n2 = fbm(uv * 4.0 - uTime * 0.15);
        float n3 = fbm(uv * 16.0 + uTime * 0.1);

        float flame = n1 * 0.6 + n2 * 0.3 + n3 * 0.2;
        flame = clamp(flame, 0.0, 1.0);

        vec3 color1 = vec3(0.8, 0.2, 0.0);
        vec3 color2 = vec3(1.0, 0.6, 0.1);
        vec3 color3 = vec3(1.0, 0.9, 0.2);
        vec3 color4 = vec3(1.0, 1.0, 0.8);

        vec3 color = mix(color1, color2, flame);
        color = mix(color, color3, flame * 0.7);
        color = mix(color, color4, flame * 0.4);

        float fresnel = pow(1.0 - abs(dot(vNormal, vec3(0.0, 0.0, 1.0))), 3.0);
        color += fresnel * vec3(0.5, 0.3, 0.1);

        gl_FragColor = vec4(color, 1.0);
    }
`;

const sunMaterial = new THREE.ShaderMaterial({
    vertexShader: sunVertexShader,
    fragmentShader: sunFragmentShader,
    uniforms: { uTime: { value: 0 } },
    emissive: new THREE.Color(0xff4400),
    emissiveIntensity: 0.5,
});
const sun = new THREE.Mesh(sunGeo, sunMaterial);
scene.add(sun);

// Glow
const glowGeo = new THREE.SphereGeometry(1.55, 64, 64);
const glowMat = new THREE.ShaderMaterial({
    vertexShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vNormal = normalize(normalMatrix * normal);
            vPosition = (modelViewMatrix * vec4(position, 1.0)).xyz;
            gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
    `,
    fragmentShader: `
        varying vec3 vNormal;
        varying vec3 vPosition;
        void main() {
            vec3 viewDir = normalize(-vPosition);
            float intensity = pow(0.65 - dot(vNormal, viewDir), 3.0);
            intensity = clamp(intensity, 0.0, 1.0);
            gl_FragColor = vec4(1.0, 0.7, 0.3, intensity * 0.8);
        }
    `,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
});
const glow = new THREE.Mesh(glowGeo, glowMat);
scene.add(glow);

// ===================== TEXTURE HELPERS =====================
function proceduralTexture(width, height, drawFn) {
    const c = document.createElement('canvas');
    c.width = width;
    c.height = height;
    const ctx = c.getContext('2d');
    drawFn(ctx, width, height);
    return new THREE.CanvasTexture(c);
}

// ---------- Planet Textures ----------
const mercuryTex = proceduralTexture(256,128, (ctx,w,h)=>{
    ctx.fillStyle='#b0b0b0'; ctx.fillRect(0,0,w,h);
    for (let i=0;i<150;i++){ ctx.fillStyle=`rgba(150,150,150,0.7)`; ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 1+Math.random()*3,0,Math.PI*2); ctx.fill(); }
});
const venusTex = proceduralTexture(256,128, (ctx,w,h)=>{
    const grad = ctx.createLinearGradient(0,0,0,h); grad.addColorStop(0,'#e8d99a'); grad.addColorStop(0.5,'#f5e8b0'); grad.addColorStop(1,'#d4b86a');
    ctx.fillStyle=grad; ctx.fillRect(0,0,w,h);
    ctx.strokeStyle='rgba(200,170,100,0.3)'; for(let i=0;i<15;i++){ ctx.beginPath(); ctx.moveTo(Math.random()*w,0); ctx.lineTo(Math.random()*w,h); ctx.stroke(); }
});
const earthTex = proceduralTexture(1024,512, (ctx,w,h)=>{
    const grad = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w*0.8);
    grad.addColorStop(0, '#1a4d8c'); grad.addColorStop(1, '#0a2f5a');
    ctx.fillStyle = grad; ctx.fillRect(0,0,w,h);
    ctx.fillStyle='#3a7a3a';
    ctx.beginPath(); ctx.moveTo(200,50); ctx.lineTo(300,40); ctx.lineTo(350,80); ctx.lineTo(320,150); ctx.lineTo(220,160); ctx.lineTo(180,100); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(500,60); ctx.lineTo(650,50); ctx.lineTo(680,110); ctx.lineTo(610,180); ctx.lineTo(520,150); ctx.closePath(); ctx.fill();
    ctx.beginPath(); ctx.moveTo(300,220); ctx.lineTo(420,210); ctx.lineTo(480,350); ctx.lineTo(370,400); ctx.lineTo(280,320); ctx.closePath(); ctx.fill();
    ctx.fillStyle='rgba(255,255,255,0.2)';
    for (let i=0;i<200;i++){ ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 4+Math.random()*12,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='rgba(240,248,255,0.5)'; ctx.fillRect(0,0,w,15); ctx.fillRect(0,h-15,w,15);
});
const marsTex = proceduralTexture(256,128, (ctx,w,h)=>{
    ctx.fillStyle='#c1440e'; ctx.fillRect(0,0,w,h);
    for (let i=0;i<80;i++){ ctx.fillStyle=`rgba(210,120,30,0.6)`; ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 5+Math.random()*15,0,Math.PI*2); ctx.fill(); }
    ctx.fillStyle='#e8dcc8'; ctx.fillRect(0,0,w,8); ctx.fillRect(0,h-8,w,8);
});
const jupiterTex = proceduralTexture(512,256, (ctx,w,h)=>{
    ctx.fillStyle='#d4b896'; ctx.fillRect(0,0,w,h);
    for (let y=0; y<h; y+=15){ ctx.fillStyle=`rgba(190,160,120,0.5)`; ctx.fillRect(0,y,w,7); }
    ctx.fillStyle='#e07040'; ctx.beginPath(); ctx.ellipse(380,130,35,18,0,0,Math.PI*2); ctx.fill();
});
const saturnTex = proceduralTexture(512,256, (ctx,w,h)=>{
    ctx.fillStyle='#f0e6c8'; ctx.fillRect(0,0,w,h);
    for (let y=0; y<h; y+=10){ ctx.fillStyle=`rgba(200,180,140,0.4)`; ctx.fillRect(0,y,w,4); }
});
const uranusTex = proceduralTexture(512,256, (ctx,w,h)=>{
    ctx.fillStyle='#b0e0e6'; ctx.fillRect(0,0,w,h);
    for (let y=0; y<h; y+=8){ ctx.fillStyle=`rgba(150,200,210,0.3)`; ctx.fillRect(0,y,w,4); }
});
const neptuneTex = proceduralTexture(512,256, (ctx,w,h)=>{
    ctx.fillStyle='#2244aa'; ctx.fillRect(0,0,w,h);
    for (let y=0; y<h; y+=10){ ctx.fillStyle=`rgba(100,150,255,0.4)`; ctx.fillRect(0,y,w,5); }
    ctx.fillStyle='rgba(255,255,255,0.5)';
    ctx.beginPath(); ctx.arc(300,100,8,0,Math.PI*2); ctx.fill();
    ctx.beginPath(); ctx.arc(400,180,6,0,Math.PI*2); ctx.fill();
});
const moonTex = proceduralTexture(256,128, (ctx,w,h)=>{
    ctx.fillStyle='#aaaaaa'; ctx.fillRect(0,0,w,h);
    for (let i=0;i<120;i++){ ctx.fillStyle=`rgba(180,180,180,0.5)`; ctx.beginPath(); ctx.arc(Math.random()*w, Math.random()*h, 1+Math.random()*4,0,Math.PI*2); ctx.fill(); }
});

// ===================== PLANET DATA =====================
const planetsData = [
    { name:'Mercury', radius:0.25, distance:2.8, speed:0.008, tex:mercuryTex, desc:'The smallest planet, closest to the Sun. Cratered like our Moon.' },
    { name:'Venus',   radius:0.35, distance:4.2, speed:0.005, tex:venusTex, desc:'Shrouded in thick yellow clouds. Hottest planet due to greenhouse effect.' },
    { name:'Earth',   radius:0.38, distance:5.6, speed:0.004, tex:earthTex, moon:true, desc:'Our blue marble – the only known planet with life.' },
    { name:'Mars',    radius:0.28, distance:7.0, speed:0.003, tex:marsTex, desc:'The Red Planet with giant volcanoes and polar ice caps.' },
    { name:'Jupiter', radius:0.85, distance:9.5, speed:0.002, tex:jupiterTex, desc:'Gas giant, largest planet. Famous for its Great Red Spot.' },
    { name:'Saturn',  radius:0.75, distance:12.0, speed:0.0012, tex:saturnTex, ring:true, desc:'Adorned with spectacular rings made of ice and rock.' },
    { name:'Uranus',  radius:0.7, distance:14.5, speed:0.0009, tex:uranusTex, desc:'Ice giant tilted on its side, pale cyan in color.' },
    { name:'Neptune', radius:0.68, distance:17.0, speed:0.0007, tex:neptuneTex, desc:'Deep blue ice giant with supersonic winds.' },
];

// ===================== CREATING PLANETS & MOONS =====================
const planets = [];          // for raycasting
const orbitGroups = [];

planetsData.forEach((p) => {
    const group = new THREE.Group();
    group.position.set(0,0,0);

    const geo = new THREE.SphereGeometry(p.radius, 48, 48);
    const mat = new THREE.MeshStandardMaterial({ map: p.tex, roughness:0.8, metalness:0.1 });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.position.set(p.distance, 0, 0);
    group.add(mesh);
    mesh.userData = { planetName: p.name, description: p.desc };
    planets.push(mesh);

    if (p.moon) {
        const moonGroup = new THREE.Group();
        moonGroup.position.set(p.distance, 0, 0);
        const moonGeo = new THREE.SphereGeometry(0.1, 32, 32);
        const moonMat = new THREE.MeshStandardMaterial({ map: moonTex, roughness:0.8 });
        const moonMesh = new THREE.Mesh(moonGeo, moonMat);
        moonMesh.position.set(0.8, 0, 0);
        moonGroup.add(moonMesh);
        group.add(moonGroup);
        orbitGroups.push({ group: moonGroup, speed: 0.02 });
    }

    if (p.ring) {
        const ringGeo = new THREE.TorusGeometry(p.radius*1.8, 0.08, 32, 128);
        const ringMat = new THREE.MeshStandardMaterial({
            color:0xddccaa, roughness:0.4, metalness:0.3,
            side:THREE.DoubleSide, transparent:true, opacity:0.7
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(p.distance, 0, 0);
        ring.rotation.x = Math.PI/2.2;
        group.add(ring);
    }

    if (p.name === 'Uranus') {
        const ringGeo = new THREE.TorusGeometry(p.radius*1.4, 0.04, 32, 128);
        const ringMat = new THREE.MeshStandardMaterial({
            color:0xaaccdd, roughness:0.4, metalness:0.2,
            side:THREE.DoubleSide, transparent:true, opacity:0.4
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        ring.position.set(p.distance, 0, 0);
        ring.rotation.x = Math.PI/2.4;
        group.add(ring);
    }

    scene.add(group);
    orbitGroups.push({ group, speed: p.speed });
});

// ===================== ORBIT PATHS =====================
planetsData.forEach(p => {
    const orbitGeo = new THREE.TorusGeometry(p.distance, 0.03, 32, 128);
    const orbitMat = new THREE.MeshBasicMaterial({ color:0xffffff, opacity:0.1, transparent:true, depthWrite:false });
    const orbit = new THREE.Mesh(orbitGeo, orbitMat);
    orbit.rotation.x = Math.PI/2;
    scene.add(orbit);
});

// ===================== ASTEROID BELT =====================
const asteroidCount = 600;
const asteroidGeo = new THREE.BufferGeometry();
const asteroidPositions = [];
const asteroidColors = [];
for (let i = 0; i < asteroidCount; i++) {
    const angle = Math.random() * Math.PI * 2;
    const radius = 8.2 + Math.random() * 1.2;
    const y = (Math.random() - 0.5) * 0.6;
    asteroidPositions.push(Math.cos(angle) * radius, y, Math.sin(angle) * radius);
    const grey = 0.5 + Math.random() * 0.4;
    asteroidColors.push(grey, grey, grey);
}
asteroidGeo.setAttribute('position', new THREE.Float32BufferAttribute(asteroidPositions, 3));
asteroidGeo.setAttribute('color', new THREE.Float32BufferAttribute(asteroidColors, 3));
const asteroidMat = new THREE.PointsMaterial({ size: 0.06, vertexColors: true, blending: THREE.AdditiveBlending });
const asteroids = new THREE.Points(asteroidGeo, asteroidMat);
scene.add(asteroids);

// ===================== DISTANT GALAXIES (ANIMATED) =====================
const galaxies = [];

function createGalaxy(centerX, centerY, centerZ, size, arms, color1, color2) {
    const particlesCount = 400;
    const pointsArray = [];
    const colorsArray = [];

    for (let i = 0; i < particlesCount; i++) {
        const arm = Math.floor(Math.random() * arms);
        const angleOffset = (arm / arms) * Math.PI * 2;
        const radius = size * (0.15 + Math.random() * 0.85);
        const angle = angleOffset + Math.random() * 0.7 - 0.35 + radius * 2.5;
        const x = Math.cos(angle) * radius;
        const z = Math.sin(angle) * radius;
        const y = (Math.random() - 0.5) * size * 0.3;

        pointsArray.push(x, y, z);
        const mixColor = Math.random() < 0.5 ? color1 : color2;
        colorsArray.push(mixColor[0], mixColor[1], mixColor[2]);
    }

    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pointsArray, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(colorsArray, 3));
    const mat = new THREE.PointsMaterial({
        size: 0.12,
        vertexColors: true,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
    });
    const galaxy = new THREE.Points(geo, mat);
    galaxy.position.set(centerX, centerY, centerZ);
    scene.add(galaxy);

    // Random rotation speed for live spiral effect
    const rotSpeed = 0.0002 + Math.random() * 0.0008;
    galaxies.push({ mesh: galaxy, rotSpeed });
}

// Place galaxies in the distance
createGalaxy(-20, 5, -35, 4, 4, [0.9,0.5,1.0], [0.3,0.6,1.0]);
createGalaxy(25, -8, -40, 5, 5, [1.0,0.7,0.2], [1.0,0.3,0.1]);
createGalaxy(-30, -10, -45, 3.5, 3, [0.2,1.0,0.8], [0.5,0.8,1.0]);
createGalaxy(18, 12, -50, 6, 6, [1.0,0.5,0.8], [0.9,0.9,0.3]);
createGalaxy(-12, -15, -55, 4.5, 4, [0.6,0.6,1.0], [0.3,0.8,1.0]);
createGalaxy(35, 0, -60, 7, 5, [0.8,0.9,1.0], [0.9,0.5,0.7]);

// ===================== STARFIELD BACKGROUND =====================
const starsGeo = new THREE.BufferGeometry();
const starsCount = 2000;
const starsPos = [];
const starsCol = [];
for (let i=0; i<starsCount; i++) {
    const r = 30 + Math.random()*50;
    const theta = Math.random()*Math.PI*2;
    const phi = Math.acos(2*Math.random()-1);
    starsPos.push(Math.sin(phi)*Math.cos(theta)*r, Math.sin(phi)*Math.sin(theta)*r, Math.cos(phi)*r);
    const choice = Math.random();
    if (choice<0.3) { starsCol.push(1,0.9,0.6); }
    else if (choice<0.6) { starsCol.push(0.6,0.8,1); }
    else { starsCol.push(1,1,1); }
}
starsGeo.setAttribute('position', new THREE.Float32BufferAttribute(starsPos, 3));
starsGeo.setAttribute('color', new THREE.Float32BufferAttribute(starsCol, 3));
const starsMat = new THREE.PointsMaterial({ size:0.15, vertexColors:true, blending:THREE.AdditiveBlending, depthWrite:false });
const stars = new THREE.Points(starsGeo, starsMat);
scene.add(stars);

// ===================== HOVER TOOLTIP =====================
const tooltip = document.createElement('div');
tooltip.id = 'planet-tooltip';
document.body.appendChild(tooltip);

const raycaster = new THREE.Raycaster();
const mouse = new THREE.Vector2();

window.addEventListener('mousemove', (event) => {
    mouse.x = (event.clientX / window.innerWidth) * 2 - 1;
    mouse.y = -(event.clientY / window.innerHeight) * 2 + 1;

    raycaster.setFromCamera(mouse, camera);
    const intersects = raycaster.intersectObjects(planets);

    if (intersects.length > 0) {
        const obj = intersects[0].object;
        const { planetName, description } = obj.userData;
        tooltip.innerHTML = `<div class="planet-name">${planetName}</div><div class="planet-desc">${description}</div>`;
        tooltip.classList.add('visible');
        tooltip.style.left = (event.clientX + 20) + 'px';
        tooltip.style.top = (event.clientY - 40) + 'px';
    } else {
        tooltip.classList.remove('visible');
    }
});

// ===================== ANIMATION LOOP =====================
function animate() {
    requestAnimationFrame(animate);

    const t = Date.now() * 0.001;
    sunMaterial.uniforms.uTime.value = t;

    sun.rotation.y += 0.001;
    glow.scale.setScalar(1 + Math.sin(t * 1.5) * 0.02);

    // Planet orbital motion
    orbitGroups.forEach(item => {
        item.group.rotation.y += item.speed;
    });

    // Rotate asteroid belt
    asteroids.rotation.y += 0.0002;

    // Rotate starfield
    stars.rotation.y -= 0.00005;
    stars.rotation.x += 0.00003;

    // Animate galaxies: rotate each around its own Y axis to simulate spiral rotation
    galaxies.forEach(g => {
        g.mesh.rotation.y += g.rotSpeed;
    });

    controls.update();
    renderer.render(scene, camera);
}

animate();

// ===================== RESIZE HANDLER =====================
window.addEventListener('resize', () => {
    camera.aspect = window.innerWidth / window.innerHeight;
    camera.updateProjectionMatrix();
    renderer.setSize(window.innerWidth, window.innerHeight);
});

// ===================== UI LOGIC (unchanged) =====================
const progressFill = document.getElementById('progressFill');
const progressText = document.getElementById('progressText');
let targetProgress = 68;
function updateProgressDisplay(value) {
    progressFill.style.width = `${value}%`;
    progressText.textContent = `${Math.round(value)}%`;
}
let currentProgress = 60;
updateProgressDisplay(currentProgress);
setInterval(() => {
    if (currentProgress < targetProgress) {
        currentProgress += Math.random()*0.15+0.05;
        if (currentProgress > targetProgress) currentProgress = targetProgress;
        updateProgressDisplay(currentProgress);
    }
}, 100);

const launchDate = new Date();
launchDate.setDate(launchDate.getDate()+12);
launchDate.setHours(launchDate.getHours()+8);
launchDate.setMinutes(launchDate.getMinutes()+42);
launchDate.setSeconds(launchDate.getSeconds()+17);
function updateCountdown() {
    const now = new Date();
    let diff = launchDate - now;
    if (diff<0) { launchDate.setDate(now.getDate()+30); diff=launchDate-now; }
    const d = Math.floor(diff/(86400000));
    const h = Math.floor((diff%86400000)/3600000);
    const m = Math.floor((diff%3600000)/60000);
    const s = Math.floor((diff%60000)/1000);
    document.getElementById('days').textContent = String(d).padStart(2,'0');
    document.getElementById('hours').textContent = String(h).padStart(2,'0');
    document.getElementById('minutes').textContent = String(m).padStart(2,'0');
    document.getElementById('seconds').textContent = String(s).padStart(2,'0');
}
updateCountdown();
setInterval(updateCountdown, 1000);