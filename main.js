/**
 * MARIA HELENA // CHROME DREAMS
 * main.js — Motor Three.js, GSAP, Cursor Físico, Navegação por Cenas
 *
 * Arquitetura:
 * 01. Verificação WebGL & Setup inicial
 * 02. Loading Screen
 * 03. Motor Three.js — Escultura 3D, Câmera, Iluminação, Renderização
 * 04. Cursor Personalizado com física (Production Portugal)
 * 05. Sistema de Navegação entre Cenas (GSAP)
 * 06. Conteúdo da Cena 04 — Projetos
 * 07. Áudio Ambiente (Web Audio API)
 * 08. Formulário de Contato
 * 09. Atalhos de Teclado
 */

'use strict';

document.addEventListener('DOMContentLoaded', () => {

  // ===================================================================
  // 01. CONFIGURAÇÃO GLOBAL & DETECÇÃO
  // ===================================================================
  const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const isFinePointer = window.matchMedia('(pointer: fine)').matches;

  // Verifica WebGL
  function hasWebGL() {
    try {
      const canvas = document.createElement('canvas');
      return !!(
        window.WebGLRenderingContext &&
        (canvas.getContext('webgl') || canvas.getContext('experimental-webgl'))
      );
    } catch (e) {
      return false;
    }
  }

  const webglAvailable = hasWebGL() && typeof THREE !== 'undefined';

  if (!webglAvailable) {
    const notice = document.getElementById('cdNoWebgl');
    if (notice) notice.hidden = false;
  }

  // ===================================================================
  // 02. LOADING SCREEN
  // ===================================================================
  const loadingEl = document.getElementById('cdLoading');
  const loadFill = document.getElementById('cdLoadFill');

  let loadProgress = 0;

  function updateLoadProgress(val) {
    loadProgress = Math.min(100, val);
    if (loadFill) loadFill.style.width = loadProgress + '%';
  }

  function hideLoading() {
    if (!loadingEl) return;
    loadingEl.classList.add('is-hidden');
    document.body.classList.remove('is-loading');
    // Mostrar HUD após loading
    setTimeout(() => {
      const hudTop = document.getElementById('cdHudTop');
      const hudBot = document.getElementById('cdHudBot');
      if (hudTop) hudTop.classList.add('is-visible');
      if (hudBot) hudBot.classList.add('is-visible');
    }, 400);
  }

  // Simular progresso de carregamento
  let fakeProgress = 0;
  const fakeInterval = setInterval(() => {
    fakeProgress += Math.random() * 18;
    updateLoadProgress(fakeProgress);
    if (fakeProgress >= 100) {
      clearInterval(fakeInterval);
      updateLoadProgress(100);
      setTimeout(hideLoading, 600);
    }
  }, 120);


  // ===================================================================
  // 03. MOTOR THREE.JS — ESCULTURA 3D CROMADA
  // ===================================================================
  const canvas = document.getElementById('cd-canvas');

  let scene, camera, renderer;
  let mainSculpture = null;   // Escultura principal (cena 1)
  let aboutSculpture = null;  // Escultura secundária (cena 3)
  let heroName3DGroup = null; // Tipografia 3D Cromada Monumental (Three.js)
  let heroLetterMeshes = [];  // Malhas 3D das letras individuais para transição coreografada
  let skills3DGroup = null;   // Placas 3D de tecnologias (Cena 5)
  let skillsBadges = [];
  let starField = null;
  let dustField = null;       // Partículas de poeira cósmica
  let animationId = null;
  let knotMeshRef, icoMeshRef, sphereMeshRef, octaMeshRef, ringMeshRef;

  // Estado do mouse para parallax
  let mouseNormX = 0;
  let mouseNormY = 0;
  let targetCamRotX = 0;
  let targetCamRotY = 0;

  if (webglAvailable && canvas) {
    // ---------------------------------------------------------------
    // Setup da cena
    // ---------------------------------------------------------------
    scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x07060A, 0.0035);
    scene.background = new THREE.Color(0x08070B);

    camera = new THREE.PerspectiveCamera(45, window.innerWidth / window.innerHeight, 0.1, 300);
    camera.position.set(0, 0, 8);

    renderer = new THREE.WebGLRenderer({
      canvas: canvas,
      alpha: false,
      antialias: true,
      powerPreference: 'high-performance'
    });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.45;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // ---------------------------------------------------------------
    // ENVIRONMENT MAP PROCEDURAL — reflexos cromados realistas
    // ---------------------------------------------------------------
    const pmremGen = new THREE.PMREMGenerator(renderer);
    pmremGen.compileEquirectangularShader();

    // Cria um cubeMap sintético com gradiente de estúdio
    const envScene = new THREE.Scene();
    // Esfera gradiente como "estúdio" de iluminação
    const envGeo = new THREE.SphereGeometry(50, 32, 32);
    const envMat = new THREE.MeshBasicMaterial({
      side: THREE.BackSide,
      vertexColors: false
    });
    // Gradiente via shader inline
    envMat.onBeforeCompile = (shader) => {
      shader.fragmentShader = shader.fragmentShader.replace(
        'vec4 diffuseColor = vec4( diffuse, opacity );',
        `vec3 upColor = vec3(0.08, 0.06, 0.16);
         vec3 midColor = vec3(0.20, 0.16, 0.30);
         vec3 downColor = vec3(0.03, 0.03, 0.06);
         vec3 roseHl = vec3(0.98, 0.74, 0.84);
         float y = normalize(vNormal).y;
         vec3 grad = mix(downColor, midColor, smoothstep(-1.0, 0.0, y));
         grad = mix(grad, upColor, smoothstep(0.0, 1.0, y));
         // Hot spot rosa no topo-esquerdo
         float hl = smoothstep(0.6, 1.0, dot(normalize(vNormal), normalize(vec3(-0.5, 0.8, 0.3))));
         grad += roseHl * hl * 0.45;
         vec4 diffuseColor = vec4(grad, opacity);`
      );
    };
    const envMesh = new THREE.Mesh(envGeo, envMat);
    envScene.add(envMesh);
    const envRT = pmremGen.fromScene(envScene, 0.04);
    scene.environment = envRT.texture;
    pmremGen.dispose();

    // ---------------------------------------------------------------
    // ILUMINAÇÃO CINEMATOGRÁFICA — Brilho e vivacidade aumentados
    // ---------------------------------------------------------------
    // Luz ambiente base
    const ambientLight = new THREE.AmbientLight(0x181528, 1.3);
    scene.add(ambientLight);

    // Luz direcional principal — prata fria com brilho aprimorado
    const dirLight = new THREE.DirectionalLight(0xF5F2FA, 3.8);
    dirLight.position.set(4, 7, 8);
    dirLight.castShadow = true;
    scene.add(dirLight);

    // Point light rosa — acento de iluminação esquerdo vibrante e evidente
    const roseLight = new THREE.PointLight(0xF3B6CB, 7.8, 32);
    roseLight.position.set(-5, 2, 3);
    scene.add(roseLight);

    // Point light lavanda — acento direito radiante
    const lavLight = new THREE.PointLight(0xB9A8DC, 6.8, 30);
    lavLight.position.set(5, -1, 4);
    scene.add(lavLight);

    // Rim light traseiro — realce de bordas luminosas
    const rimLight = new THREE.PointLight(0x88D0FF, 3.4, 22);
    rimLight.position.set(0, -4, -5);
    scene.add(rimLight);

    // ---------------------------------------------------------------
    // CAMPO ESTELAR
    // ---------------------------------------------------------------
    const starsCount = 2200;
    const starPos = new Float32Array(starsCount * 3);
    for (let i = 0; i < starsCount * 3; i += 3) {
      starPos[i] = (Math.random() - 0.5) * 120;
      starPos[i + 1] = (Math.random() - 0.5) * 120;
      starPos[i + 2] = (Math.random() - 0.5) * 120 - 20;
    }
    const starsGeo = new THREE.BufferGeometry();
    starsGeo.setAttribute('position', new THREE.BufferAttribute(starPos, 3));
    const starsMat = new THREE.PointsMaterial({
      size: 0.06,
      color: 0xC8B6FF,
      transparent: true,
      opacity: 0.6,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    starField = new THREE.Points(starsGeo, starsMat);

    // Poeira cósmica (partículas flutuantes maiores e mais visíveis)
    const dustCount = 350;
    const dustPositions = new Float32Array(dustCount * 3);
    const dustSizes = new Float32Array(dustCount);
    for (let i = 0; i < dustCount; i++) {
      dustPositions[i * 3] = (Math.random() - 0.5) * 40;
      dustPositions[i * 3 + 1] = (Math.random() - 0.5) * 30;
      dustPositions[i * 3 + 2] = (Math.random() - 0.5) * 30 - 3;
      dustSizes[i] = Math.random() * 0.15 + 0.03;
    }
    const dustGeo = new THREE.BufferGeometry();
    dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPositions, 3));
    dustGeo.setAttribute('size', new THREE.BufferAttribute(dustSizes, 1));
    const dustMat = new THREE.PointsMaterial({
      size: 0.12,
      color: 0xF3B6CB,
      transparent: true,
      opacity: 0.25,
      blending: THREE.AdditiveBlending,
      sizeAttenuation: true
    });
    dustField = new THREE.Points(dustGeo, dustMat);
    scene.add(dustField);
    scene.add(starField);

    // ---------------------------------------------------------------
    // ESCULTURA PRINCIPAL — Metal Líquido Cromado e Formas Geométricas
    // (Hero + Cena 02 Travessia)
    // ---------------------------------------------------------------
    const sculptureGroup = new THREE.Group();
    sculptureGroup.position.set(0, -0.15, -2.8);
    sculptureGroup.scale.set(1.05, 1.05, 1.05);

    // Material cromo principal — brilho espelhado e reflexos vívidos
    const chromeMat = new THREE.MeshPhysicalMaterial({
      color: 0xEAEAF5,
      metalness: 0.98,
      roughness: 0.05,
      reflectivity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.03,
      envMapIntensity: 1.6
    });

    // Material vidro rosa — alta transmissão e brilho vívido
    const glassMat = new THREE.MeshPhysicalMaterial({
      color: 0xF3B6CB,
      metalness: 0.05,
      roughness: 0.02,
      transmission: 0.92,
      opacity: 0.94,
      transparent: true,
      ior: 1.54,
      clearcoat: 1.0
    });

    // Material lavanda acetinado — reflexos e saturação aprimorados
    const satingMat = new THREE.MeshPhysicalMaterial({
      color: 0xB9A8DC,
      metalness: 0.65,
      roughness: 0.15,
      reflectivity: 0.85,
      clearcoat: 0.7
    });

    // Elemento 1: TorusKnot central — forma orgânica principal
    const knotGeo = new THREE.TorusKnotGeometry(1.6, 0.45, 160, 30, 2, 3);
    const knotMesh = new THREE.Mesh(knotGeo, chromeMat);
    knotMesh.castShadow = true;
    sculptureGroup.add(knotMesh);
    knotMeshRef = knotMesh;

    // Elemento 2: Icosaedro de vidro rosa (flutuando à esquerda)
    const icoGeo = new THREE.IcosahedronGeometry(0.9, 1);
    const icoMesh = new THREE.Mesh(icoGeo, glassMat);
    icoMesh.position.set(-3.2, 1.0, 0.5);
    icoMesh.castShadow = true;
    sculptureGroup.add(icoMesh);
    icoMeshRef = icoMesh;

    // Elemento 3: Esfera cromada pequena (flutuando à direita)
    const sphereGeo = new THREE.SphereGeometry(0.65, 64, 64);
    const sphereMesh = new THREE.Mesh(sphereGeo, chromeMat);
    sphereMesh.position.set(3.0, -0.8, 1.0);
    sphereMesh.castShadow = true;
    sculptureGroup.add(sphereMesh);
    sphereMeshRef = sphereMesh;

    // Elemento 4: Octaedro lavanda
    const octaGeo = new THREE.OctahedronGeometry(0.7, 0);
    const octaMesh = new THREE.Mesh(octaGeo, satingMat);
    octaMesh.position.set(-2.0, -1.8, -0.5);
    octaMesh.castShadow = true;
    sculptureGroup.add(octaMesh);
    octaMeshRef = octaMesh;

    // Elemento 5: Torus pequeno (anel)
    const ringGeo = new THREE.TorusGeometry(2.8, 0.08, 16, 80);
    const ringMat = new THREE.MeshPhysicalMaterial({
      color: 0xB9A8DC,
      metalness: 0.6,
      roughness: 0.2,
      transparent: true,
      opacity: 0.5
    });
    const ringMesh = new THREE.Mesh(ringGeo, ringMat);
    ringMesh.rotation.x = Math.PI / 3.5;
    ringMesh.rotation.y = 0.3;
    ringMeshRef = ringMesh;
    sculptureGroup.add(ringMesh);

    mainSculpture = sculptureGroup;
    scene.add(sculptureGroup);

    // ---------------------------------------------------------------
    // ESCULTURA SECUNDÁRIA — HALO 3D CROMADO — Cena 03 "Sobre Mim"
    // Halo escultural minimalista e orgânico posicionado atrás do retrato
    // ---------------------------------------------------------------
    const aboutGroup = new THREE.Group();
    const isDesktopAbout = window.innerWidth > 900;
    aboutGroup.position.set(isDesktopAbout ? 3.0 : 0, isDesktopAbout ? -0.1 : 0.6, -2.4);
    aboutGroup.visible = false;

    // Material Cromo Espelhado de Alta Fidelidade
    const aboutHaloMat = new THREE.MeshPhysicalMaterial({
      color: 0xF2F0F8,
      metalness: 0.98,
      roughness: 0.05,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      reflectivity: 1.0,
      envMapIntensity: 2.2
    });

    // Material Vidro Translúcido Rosa / Lavanda
    const aboutGlassMat = new THREE.MeshPhysicalMaterial({
      color: 0xF3B6CB,
      metalness: 0.1,
      roughness: 0.04,
      transmission: 0.88,
      opacity: 0.75,
      transparent: true,
      ior: 1.52,
      clearcoat: 1.0
    });

    // Anel orbital de metal líquido cromado
    const haloOrbitGeo = new THREE.TorusGeometry(2.1, 0.038, 32, 120);
    const haloOrbitMesh = new THREE.Mesh(haloOrbitGeo, aboutHaloMat);
    haloOrbitMesh.rotation.x = Math.PI / 2.8;
    haloOrbitMesh.rotation.y = 0.25;
    aboutGroup.add(haloOrbitMesh);

    // Fita escultural orgânica com curvatura suave (halo)
    const haloWaveGeo = new THREE.TorusKnotGeometry(1.65, 0.024, 180, 24, 2, 5);
    const haloWaveMesh = new THREE.Mesh(haloWaveGeo, aboutGlassMat);
    aboutGroup.add(haloWaveMesh);

    // Luz pontual própria (luz de recorte lavanda suave)
    const aboutHaloLight = new THREE.PointLight(0xB9A8DC, 3.2, 12);
    aboutHaloLight.position.set(0, 0, -0.5);
    aboutGroup.add(aboutHaloLight);

    aboutSculpture = aboutGroup;
    scene.add(aboutGroup);

    // ---------------------------------------------------------------
    // TIPOGRAFIA 3D CROMADA MONUMENTAL — "MARIA HELENA"
    // Letras com geometria extrudada real, chanfros e reflexos espelhados
    // (Referência Ascension: nome monumental cromado no centro da experiência)
    // ---------------------------------------------------------------
    function buildHero3DName(mat) {
      const group = new THREE.Group();
      group.position.set(0, 0.25, 0.6);

      const extrudeSettings = {
        depth: 0.32,
        bevelEnabled: true,
        bevelSegments: 4,
        steps: 1,
        bevelSize: 0.045,
        bevelThickness: 0.045
      };

      function getLetterShape(char) {
        const s = new THREE.Shape();
        switch (char) {
          case 'M':
            s.moveTo(0, 0);
            s.lineTo(0.2, 0);
            s.lineTo(0.2, 0.58);
            s.lineTo(0.44, 0.22);
            s.lineTo(0.46, 0.22);
            s.lineTo(0.7, 0.58);
            s.lineTo(0.7, 0);
            s.lineTo(0.9, 0);
            s.lineTo(0.9, 1.0);
            s.lineTo(0.68, 1.0);
            s.lineTo(0.45, 0.52);
            s.lineTo(0.22, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.9 };
          case 'A':
            s.moveTo(0, 0);
            s.lineTo(0.22, 0);
            s.lineTo(0.32, 0.3);
            s.lineTo(0.53, 0.3);
            s.lineTo(0.63, 0);
            s.lineTo(0.85, 0);
            s.lineTo(0.53, 1.0);
            s.lineTo(0.32, 1.0);
            s.closePath();
            const holeA = new THREE.Path();
            holeA.moveTo(0.36, 0.46);
            holeA.lineTo(0.49, 0.46);
            holeA.lineTo(0.425, 0.76);
            holeA.closePath();
            s.holes.push(holeA);
            return { shape: s, width: 0.85 };
          case 'R':
            s.moveTo(0, 0);
            s.lineTo(0.22, 0);
            s.lineTo(0.22, 0.44);
            s.lineTo(0.44, 0.44);
            s.lineTo(0.64, 0);
            s.lineTo(0.85, 0);
            s.lineTo(0.62, 0.48);
            s.bezierCurveTo(0.82, 0.52, 0.85, 0.74, 0.85, 0.8);
            s.bezierCurveTo(0.85, 0.95, 0.72, 1.0, 0.52, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            const holeR = new THREE.Path();
            holeR.moveTo(0.22, 0.62);
            holeR.lineTo(0.48, 0.62);
            holeR.bezierCurveTo(0.6, 0.62, 0.6, 0.82, 0.48, 0.82);
            holeR.lineTo(0.22, 0.82);
            holeR.closePath();
            s.holes.push(holeR);
            return { shape: s, width: 0.85 };
          case 'I':
            s.moveTo(0, 0);
            s.lineTo(0.24, 0);
            s.lineTo(0.24, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.24 };
          case 'H':
            s.moveTo(0, 0);
            s.lineTo(0.22, 0);
            s.lineTo(0.22, 0.42);
            s.lineTo(0.58, 0.42);
            s.lineTo(0.58, 0);
            s.lineTo(0.8, 0);
            s.lineTo(0.8, 1.0);
            s.lineTo(0.58, 1.0);
            s.lineTo(0.58, 0.6);
            s.lineTo(0.22, 0.6);
            s.lineTo(0.22, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.8 };
          case 'E':
            s.moveTo(0, 0);
            s.lineTo(0.72, 0);
            s.lineTo(0.72, 0.22);
            s.lineTo(0.22, 0.22);
            s.lineTo(0.22, 0.42);
            s.lineTo(0.62, 0.42);
            s.lineTo(0.62, 0.6);
            s.lineTo(0.22, 0.6);
            s.lineTo(0.22, 0.78);
            s.lineTo(0.72, 0.78);
            s.lineTo(0.72, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.72 };
          case 'L':
            s.moveTo(0, 0);
            s.lineTo(0.68, 0);
            s.lineTo(0.68, 0.22);
            s.lineTo(0.22, 0.22);
            s.lineTo(0.22, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.68 };
          case 'N':
            s.moveTo(0, 0);
            s.lineTo(0.22, 0);
            s.lineTo(0.58, 0.58);
            s.lineTo(0.58, 0);
            s.lineTo(0.8, 0);
            s.lineTo(0.8, 1.0);
            s.lineTo(0.58, 1.0);
            s.lineTo(0.22, 0.42);
            s.lineTo(0.22, 1.0);
            s.lineTo(0, 1.0);
            s.closePath();
            return { shape: s, width: 0.8 };
          default:
            s.moveTo(0, 0);
            s.lineTo(0.5, 0);
            s.lineTo(0.5, 1);
            s.lineTo(0, 1);
            s.closePath();
            return { shape: s, width: 0.5 };
        }
      }

      const letterMeshes = [];
      const spacing = 0.14;

      function buildRow(text, yPos) {
        let totalW = 0;
        const items = [];
        for (let i = 0; i < text.length; i++) {
          const { shape, width } = getLetterShape(text[i]);
          items.push({ shape, width, char: text[i] });
          totalW += width + (i < text.length - 1 ? spacing : 0);
        }
        let curX = -totalW / 2;
        items.forEach((item) => {
          const geo = new THREE.ExtrudeGeometry(item.shape, extrudeSettings);
          geo.computeVertexNormals();
          const mesh = new THREE.Mesh(geo, mat);
          mesh.position.set(curX, yPos, 0);
          mesh.castShadow = true;
          mesh.receiveShadow = true;
          mesh.userData = {
            origX: curX,
            origY: yPos,
            origZ: 0,
            char: item.char
          };
          group.add(mesh);
          letterMeshes.push(mesh);
          curX += item.width + spacing;
        });
      }

      buildRow('MARIA', 0.72);
      buildRow('HELENA', -0.72);

      const isMobile = window.innerWidth < 768;
      const initialScale = isMobile ? 0.65 : 1.15;
      group.scale.set(initialScale, initialScale, initialScale);

      return { group, letterMeshes };
    }

    // Material 3D Monumental — Grande, luminoso e metálico iridescente chamativo
    const heroNameMat = new THREE.MeshPhysicalMaterial({
      color: 0xF5F2FA,
      emissive: 0x582046,
      emissiveIntensity: 0.95,
      metalness: 0.98,
      roughness: 0.03,
      reflectivity: 1.0,
      clearcoat: 1.0,
      clearcoatRoughness: 0.02,
      ior: 1.6,
      envMapIntensity: 2.4
    });

    const hero3D = buildHero3DName(heroNameMat);
    heroName3DGroup = hero3D.group;
    heroLetterMeshes = hero3D.letterMeshes;
    heroName3DGroup.visible = true; // Monumental e em pleno destaque na Cena 1
    scene.add(heroName3DGroup);

    // Luzes dedicadas para o Nome 3D brilhar com cores chamativas e estéticas
    const nameLightRose = new THREE.PointLight(0xF3B6CB, 12.0, 16);
    nameLightRose.position.set(-2.8, 1.2, 3.2);
    scene.add(nameLightRose);

    const nameLightLav = new THREE.PointLight(0xB9A8DC, 10.0, 16);
    nameLightLav.position.set(2.8, -0.8, 3.2);
    scene.add(nameLightLav);

    // ---------------------------------------------------------------
    // ELEMENTOS 3D DE HABILIDADES — Cena 05 (Placas cromadas no espaço Z)
    // ---------------------------------------------------------------
    function buildSkills3DGroup() {
      const group = new THREE.Group();
      group.position.set(0, 0, -3);
      group.visible = false;

      const techColors = [0x70C8FF, 0xF3B6CB, 0xB9A8DC, 0xD9D9E3, 0x9D91B8, 0xF5F2FA];
      const badges = [];

      for (let i = 0; i < 6; i++) {
        const bGroup = new THREE.Group();
        const ringGeo = new THREE.TorusGeometry(0.7, 0.03, 16, 48);
        const ringMat = new THREE.MeshPhysicalMaterial({
          color: 0xD9D9E3,
          metalness: 0.95,
          roughness: 0.1,
          clearcoat: 1.0
        });
        const ring = new THREE.Mesh(ringGeo, ringMat);
        bGroup.add(ring);

        const plateGeo = new THREE.CylinderGeometry(0.65, 0.65, 0.04, 32);
        plateGeo.rotateX(Math.PI / 2);
        const plateMat = new THREE.MeshPhysicalMaterial({
          color: techColors[i],
          metalness: 0.2,
          roughness: 0.1,
          transmission: 0.85,
          transparent: true,
          opacity: 0.7
        });
        const plate = new THREE.Mesh(plateGeo, plateMat);
        bGroup.add(plate);

        const xPos = ((i % 3) - 1) * 3.4;
        const yPos = (i < 3 ? 1.4 : -1.4);
        const zPos = -1 + (i % 2) * 1.5 - (i === 4 ? 1.5 : 0);
        bGroup.position.set(xPos, yPos, zPos);
        bGroup.userData = { origY: yPos, phase: i * 1.1 };

        group.add(bGroup);
        badges.push(bGroup);
      }

      return { group, badges };
    }

    const skills3D = buildSkills3DGroup();
    skills3DGroup = skills3D.group;
    skillsBadges = skills3D.badges;
    scene.add(skills3DGroup);

    document.body.classList.add('has-webgl-letters');

    // ---------------------------------------------------------------
    // PARALLAX — Mouse
    // ---------------------------------------------------------------
    window.addEventListener('mousemove', (e) => {
      mouseNormX = (e.clientX / window.innerWidth) * 2 - 1;
      mouseNormY = -((e.clientY / window.innerHeight) * 2 - 1);

      // Atualiza posição das luzes dinamicamente
      roseLight.position.x = -5 + mouseNormX * 2;
      lavLight.position.x = 5 - mouseNormX * 2;
      dirLight.position.x = 4 + mouseNormX * 3;
      dirLight.position.y = 7 + mouseNormY * 2;

      // Rotação alvo da câmera
      targetCamRotY = -mouseNormX * 0.06;
      targetCamRotX = mouseNormY * 0.04;
    });

    // ---------------------------------------------------------------
    // RESIZE
    // ---------------------------------------------------------------
    window.addEventListener('resize', () => {
      camera.aspect = window.innerWidth / window.innerHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(window.innerWidth, window.innerHeight);
    });

    // ---------------------------------------------------------------
    // LOOP DE RENDERIZAÇÃO
    // ---------------------------------------------------------------
    let lastTime = 0;
    const ROTATION_DAMPING = prefersReducedMotion ? 0 : 1;

    function renderLoop(time) {
      animationId = requestAnimationFrame(renderLoop);

      const delta = Math.min((time - lastTime) * 0.001, 0.1);
      lastTime = time;

      if (!prefersReducedMotion) {
        // Rotação suave da escultura principal
        if (mainSculpture) {
          mainSculpture.rotation.y += 0.08 * delta;
          mainSculpture.rotation.x += 0.03 * delta;
        }

        // Halo 3D "sobre mim" orbita serenamente atrás do retrato
        if (aboutSculpture && aboutSculpture.visible) {
          aboutSculpture.rotation.y -= 0.025 * delta;
          aboutSculpture.rotation.z += 0.012 * delta;
        }

        // Sub-elementos com animação independente
        if (knotMeshRef) knotMeshRef.rotation.z += 0.12 * delta;
        if (icoMeshRef) {
          icoMeshRef.rotation.x += 0.18 * delta;
          icoMeshRef.rotation.y -= 0.12 * delta;
        }
        if (sphereMeshRef) {
          sphereMeshRef.position.y = -0.8 + Math.sin(time * 0.001) * 0.3;
        }
        if (octaMeshRef) {
          octaMeshRef.rotation.y += 0.25 * delta;
        }

        // Campo estelar rotação lenta
        if (starField) {
          starField.rotation.y += 0.01 * delta;
        }

        // Poeira cósmica flutuando
        if (dustField) {
          dustField.rotation.y -= 0.008 * delta;
          dustField.rotation.x += 0.004 * delta;
          // Oscilação vertical suave
          const dPos = dustField.geometry.attributes.position.array;
          for (let dp = 1; dp < dPos.length; dp += 3) {
            dPos[dp] += Math.sin(time * 0.0003 + dp) * 0.0008;
          }
          dustField.geometry.attributes.position.needsUpdate = true;
        }

        // Parallax suave da câmera
        camera.rotation.x += (targetCamRotX - camera.rotation.x) * 0.06;
        camera.rotation.y += (targetCamRotY - camera.rotation.y) * 0.06;

        // Animação 3D do Nome Monumental (Cena 1 & 8)
        if (heroName3DGroup && heroName3DGroup.visible) {
          heroName3DGroup.rotation.y = targetCamRotY * 0.6 + Math.sin(time * 0.0008) * 0.03;
          heroName3DGroup.rotation.x = targetCamRotX * 0.6 + Math.cos(time * 0.0006) * 0.02;
        }

        // Animação 3D dos Badges de Habilidades (Cena 5)
        if (skills3DGroup && skills3DGroup.visible && skillsBadges.length > 0) {
          skillsBadges.forEach((b, idx) => {
            b.position.y = b.userData.origY + Math.sin(time * 0.0012 + b.userData.phase) * 0.12;
            b.rotation.y += 0.02 * delta;
            b.rotation.x = Math.sin(time * 0.001 + idx) * 0.05;
          });
        }
      }

      renderer.render(scene, camera);
    }

    requestAnimationFrame(renderLoop);
  }


  // ===================================================================
  // 04. CURSOR PERSONALIZADO (Physics — Production Portugal style)
  // ===================================================================
  const cursorDot = document.getElementById('cdCursorDot');
  const cursorRing = document.getElementById('cdCursorRing');
  const cursorLabel = document.getElementById('cdCursorLabel');

  let mouseX = window.innerWidth / 2;
  let mouseY = window.innerHeight / 2;
  let prevX = mouseX, prevY = mouseY;
  let ringX = mouseX, ringY = mouseY;
  let curSpeed = 0;
  let targetAngle = 0;
  let curAngle = 0;

  if (isFinePointer) {
    window.addEventListener('mousemove', (e) => {
      mouseX = e.clientX;
      mouseY = e.clientY;
      if (cursorDot) {
        cursorDot.style.left = mouseX + 'px';
        cursorDot.style.top = mouseY + 'px';
      }
    });

    function updateCursorPhysics() {
      const vx = mouseX - prevX;
      const vy = mouseY - prevY;
      const speed = Math.sqrt(vx * vx + vy * vy);
      curSpeed += (speed - curSpeed) * 0.18;
      prevX = mouseX;
      prevY = mouseY;

      if (speed > 1.5) targetAngle = Math.atan2(vy, vx);
      curAngle += (targetAngle - curAngle) * 0.18;

      // Lerp com inércia
      ringX += (mouseX - ringX) * 0.13;
      ringY += (mouseY - ringY) * 0.13;

      // Squash & stretch físico
      const scaleX = Math.min(1.9, Math.max(0.65, 1 + curSpeed * 0.02));
      const scaleY = Math.min(1.4, Math.max(0.55, 1 - curSpeed * 0.012));

      if (cursorRing) {
        cursorRing.style.left = ringX + 'px';
        cursorRing.style.top = ringY + 'px';
        cursorRing.style.transform =
          `translate(-50%, -50%) rotate(${curAngle}rad) scale(${scaleX}, ${scaleY})`;
      }

      requestAnimationFrame(updateCursorPhysics);
    }
    requestAnimationFrame(updateCursorPhysics);

    // Rótulos contextuais
    const interactiveEls = document.querySelectorAll(
      'a[href], button, input, textarea, [tabindex="0"]'
    );

    interactiveEls.forEach((el) => {
      el.addEventListener('mouseenter', () => {
        document.body.classList.add('cursor-active');
        if (!cursorLabel) return;
        if (el.id === 'cdHeroName' || el.id === 'cdBtnEnter') {
          cursorLabel.textContent = 'ENTER';
        } else if (el.classList.contains('cd-btn-proj') || (el.tagName === 'A' && el.target === '_blank')) {
          cursorLabel.textContent = 'ABRIR';
        } else if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
          cursorLabel.textContent = 'DIGITAR';
        } else if (el.tagName === 'BUTTON') {
          cursorLabel.textContent = 'CLICAR';
        } else {
          cursorLabel.textContent = '';
        }
      });
      el.addEventListener('mouseleave', () => {
        document.body.classList.remove('cursor-active');
      });
    });
  }


  // ===================================================================
  // 04-B. CURSOR — ESTADO .hoverable
  // O anel expande e muda de cor quando passa sobre .hoverable
  // ===================================================================
  if (isFinePointer) {
    function bindHoverable() {
      document.querySelectorAll('.hoverable').forEach((el) => {
        el.addEventListener('mouseenter', () => {
          document.body.classList.add('cursor-hovering');
        });
        el.addEventListener('mouseleave', () => {
          document.body.classList.remove('cursor-hovering');
        });
      });
    }
    bindHoverable();

    // Re-bind se novos .hoverable forem adicionados dinamicamente
    const hoverableObserver = new MutationObserver(() => bindHoverable());
    hoverableObserver.observe(document.body, { childList: true, subtree: true });
  }


  // ===================================================================
  // 04-C. LENIS — SMOOTH SCROLL com inércia orgânica
  // A navegação por cena usa wheel, então Lenis só anima o container
  // de scroll interno (.cd-proj-list) e outros elementos que façam scroll
  // ===================================================================
  let lenis = null;
  function revealNavOnScroll() {
    const navEl = document.querySelector('.cd-nav');
    if (navEl && !navEl.classList.contains('is-revealed')) {
      navEl.classList.add('is-revealed');
    }
  }

  if (typeof Lenis !== 'undefined') {
    lenis = new Lenis({
      wrapper: document.querySelector('.cd-proj-list') || null,
      content: document.querySelector('.cd-proj-list') || null,
      lerp: 0.08,
      smoothWheel: true,
      touchMultiplier: 1.5,
    });

    lenis.on('scroll', () => {
      revealNavOnScroll();
    });

    function rafLenis(time) {
      lenis.raf(time);
      requestAnimationFrame(rafLenis);
    }
    requestAnimationFrame(rafLenis);
  }


  // ===================================================================
  // 04-D. PROJETOS (CENA 04) — EXPERIÊNCIA INTERATIVA & MODAL EXPANDIDO
  // 1. Floating cursor preview com GSAP quickTo (inércia e rotação por velocidade)
  // 2. Dimming das linhas vizinhas e shift no hover
  // 3. Modal expandido com transição cinematográfica (detalhes, desafio/aprendizado)
  // 4. Navegação por setas (← →) e swipe lateral no mobile
  // 5. Preloading e fallback em gradiente cromado
  // ===================================================================
  (() => {
    const projList = document.getElementById('cdProjList');
    const projItems = document.querySelectorAll('.cd-proj-item');
    if (!projList || !projItems.length) return;

    // Dados estruturados dos 6 projetos
    const PROJECTS_DATA = [
      {
        num: '01',
        slug: 'briar-u',
        title: 'Briar U <em>Hockey</em>',
        plainTitle: 'Briar U Hockey',
        desc: 'Inspirado no universo esportivo universitário, o Briar U Hockey é um simulador interativo de air hockey desenvolvido com a HTML5 Canvas API e JavaScript puro. O jogo reproduz a física real de uma mesa de hóquei: colisões elásticas com conservação de momento linear, atrito cinético progressivo contra as tabelas e rebote dinâmico do disco. Possui inteligência artificial responsiva com diferentes níveis de reação, sistema de pontuação em tempo real, detecção contínua de impacto para evitar tunelamento de colisão em velocidades extremas e áudio sintético para cada impacto.',
        tags: ['JavaScript ES6+', 'Canvas 2D', 'Física Vetorial', 'Game Loop', 'CSS3'],
        learning: 'Modelagem matemática de vetores euclidianos em JavaScript para cálculo contínuo de colisão círculo-círculo e círculo-segmento sem frameworks auxiliares, com ciclo de renderização estabilizado em 60 FPS via requestAnimationFrame.',
        url: 'https://briar-u.vercel.app/',
        img: 'assets/projetos/briar-u.webp'
      },
      {
        num: '02',
        slug: 'projeto-js',
        title: 'Projeto JS — <em>Frases de Cinema</em>',
        plainTitle: 'Projeto JS — Frases de Cinema',
        desc: 'Console cinematográfico interativo que funde design tipográfico editorial à atmosfera estética dos terminais computacionais retro-futuristas. A plataforma realiza o sorteio dinâmico de falas icônicas da história do cinema mundial, acompanhadas de metadados contextuais com diretor, ano de lançamento e gênero da obra cinematográfica. Cada troca de frase apresenta efeito de digitação progressiva (typewriter), controle de debounce para impedir chamadas duplicadas e botão de cópia com feedback visual instantâneo.',
        tags: ['JavaScript ES6+', 'DOM API', 'Design Editorial', 'Async / Await', 'CSS3'],
        learning: 'Manipulação assíncrona do DOM para encadear animações de texto letra por letra com temporizadores canceláveis e debounce de eventos, mantendo a arquitetura do código modular e totalmente desacoplada.',
        url: 'https://js-eight-sage.vercel.app/',
        img: 'assets/projetos/projeto-js.webp'
      },
      {
        num: '03',
        slug: 'aespa',
        title: 'AESPA <em>Members</em>',
        plainTitle: 'AESPA Members',
        desc: 'Portal conceitual imersivo ambientado no universo audiovisual do grupo aespa, construído sob a identidade cyber-Y2K e cromo líquido. O projeto reúne perfis interativos detalhados de cada uma das quatro integrantes (Karina, Giselle, Winter e Ningning), explorando seus avatares digitais (æ) por meio de cartões holográficos com reflexos dinâmicos, tipografia em metal líquido, filtros SVG customizados e player multimídia integrado com faixas selecionadas via API do Spotify.',
        tags: ['HTML5 Semântico', 'CSS Grid Avançado', 'JavaScript', 'Spotify API', 'Cyber-Y2K'],
        learning: 'Composição de layouts complexos com CSS Grid bidimensional e microinterações metálicas responsivas, além do tratamento de estados assíncronos ao carregar e incorporar widgets de streaming sem prejudicar o tempo de renderização da página.',
        url: 'https://helenamaria09.github.io/aespamembers/',
        img: 'assets/projetos/aespa.webp'
      },
      {
        num: '04',
        slug: 'diario',
        title: 'O Diário <em>Secreto</em>',
        plainTitle: 'O Diário Secreto',
        desc: 'Scrapbook digital sensorial e afetivo que traduz a experiência tátil dos diários físicos de colagem para o ambiente web. O projeto documenta a rotina pessoal da autora entre os treinos de natação, as aulas de ballet clássico e a formação técnica em informática no Colégio Raphael Di Santo. A navegação utiliza transformações espaciais tridimensionais em CSS, com páginas que viram e se projetam ao comando do usuário, simulando papéis rasgados, texturas artesanais e caligrafia manuscrita digitalizada.',
        tags: ['CSS 3D Transforms', 'UI Sensorial', 'JavaScript', 'Perspectiva Espacial'],
        learning: 'Orquestração de matrizes tridimensionais com perspective, transform-style: preserve-3d e backface-visibility em CSS3 para reproduzir a física tátil do folhear de papéis com aceleração de hardware e navegação acessível por teclado.',
        url: 'https://diario-opal.vercel.app/',
        img: 'assets/projetos/diario.webp'
      },
      {
        num: '05',
        slug: 'goty',
        title: 'GOTY <em>Academia</em>',
        plainTitle: 'GOTY Academia',
        desc: 'Plataforma institucional de alta conversão projetada para um centro esportivo e de condicionamento físico. A interface apresenta o catálogo completo de modalidades de treino (musculação, crossfit, artes marciais e natação), grade de horários interativa com filtros dinâmicos, calculadora de índice de massa corporal (IMC) e metas de treino, mapa interativo de unidades e formulário de agendamento de aula experimental com validação em tempo de execução.',
        tags: ['HTML5', 'CSS3 Flex & Grid', 'JavaScript', 'UI/UX Design', 'Alta Conversão'],
        learning: 'Planejamento de arquitetura da informação voltada à retenção e conversão de usuários, priorizando contraste rigoroso segundo as diretrizes WCAG AA, validação instantânea de entradas no front-end e carregamento veloz em redes móveis.',
        url: 'https://helenamaria09.github.io/goty--academia/',
        img: 'assets/projetos/goty.webp'
      },
      {
        num: '06',
        slug: 'cat-cafe',
        title: 'Cat Café <em>Tycoon</em>',
        plainTitle: 'Cat Café Tycoon',
        desc: 'Jogo tridimensional e simulador de cafeteria felina desenvolvido em WebGL com Three.js. No comando de um acolhedor café temático, o jogador deve gerenciar pedidos, atender visitantes e zelar pelo bem-estar dos gatos residentes. O destaque do jogo é o evento especial "Hora do Fuzuê", no qual os gatos aceleram pela cafeteria e brincam com objetos do salão, com física animada, iluminação dinâmica realista (PBR), sombras suaves e trilha sonora lo-fi relaxante.',
        tags: ['Three.js', 'WebGL', 'JavaScript ES6+', 'Game Loop', 'PBR Lighting'],
        learning: 'Construção de uma cena 3D interativa em WebGL: estruturação hierárquica de malhas poligonais, aplicação de luzes pontuais dinâmicas, desacoplamento do estado lógico no game loop e otimização de renderização para garantir 60 FPS contínuos no navegador.',
        url: 'https://jogo-1-three.vercel.app/',
        img: 'assets/projetos/cat-cafe.webp'
      }
    ];

    // Elementos do Preview Flutuante
    const floatEl = document.getElementById('cdProjFloating');
    const floatImg = document.getElementById('cdProjFloatingImg');
    const floatFallback = document.getElementById('cdProjFloatingFallback');
    const floatFallbackTitle = document.getElementById('cdProjFloatingFallbackTitle');
    const floatFallbackTech = document.getElementById('cdProjFloatingFallbackTech');
    const floatNum = document.getElementById('cdProjFloatingNum');

    // Elementos do Modal Expandido
    const modal = document.getElementById('cdProjModal');
    const modalBackdrop = document.getElementById('cdModalBackdrop');
    const modalDialog = document.getElementById('cdModalDialog');
    const modalClose = document.getElementById('cdModalClose');
    const modalImg = document.getElementById('cdModalImg');
    const modalFallback = document.getElementById('cdModalFallback');
    const modalFallbackName = document.getElementById('cdModalFallbackName');
    const modalBtnPrev = document.getElementById('cdModalBtnPrev');
    const modalBtnNext = document.getElementById('cdModalBtnNext');
    const modalCounter = document.getElementById('cdModalCounter');
    const modalMeta = document.getElementById('cdModalMeta');
    const modalTitle = document.getElementById('cdModalTitle');
    const modalTags = document.getElementById('cdModalTags');
    const modalDesc = document.getElementById('cdModalDesc');
    const modalChallenge = document.getElementById('cdModalChallenge');
    const modalCta = document.getElementById('cdModalCta');

    let currentModalIndex = 0;
    let isModalOpen = false;
    let lastActiveTrigger = null;

    // -----------------------------------------------------------------
    // 1. FLOATING PREVIEW (Desktop com cursor fino)
    // -----------------------------------------------------------------
    let setFloatX = null;
    let setFloatY = null;
    let setFloatRot = null;
    let lastMouseX = 0;

    if (isFinePointer && floatEl && typeof gsap !== 'undefined') {
      setFloatX = gsap.quickTo(floatEl, 'x', { duration: 0.38, ease: 'power2.out' });
      setFloatY = gsap.quickTo(floatEl, 'y', { duration: 0.38, ease: 'power2.out' });
      setFloatRot = gsap.quickTo(floatEl, 'rotation', { duration: 0.45, ease: 'power2.out' });

      window.addEventListener('mousemove', (e) => {
        if (isModalOpen) return;

        // Velocidade horizontal para leve rotação
        const deltaX = e.clientX - lastMouseX;
        lastMouseX = e.clientX;
        const targetRot = Math.max(-7, Math.min(7, deltaX * 0.35));

        // Clamping para não cobrir o texto nem vazar do viewport
        const PREVIEW_W = 340;
        const PREVIEW_H = 220;
        let tx = e.clientX + 36;
        let ty = e.clientY - 100;

        // Se passar da borda direita da tela, inverte para o lado esquerdo
        if (tx + PREVIEW_W > window.innerWidth - 20) {
          tx = e.clientX - PREVIEW_W - 24;
        }

        // Clamp vertical para respeitar HUD superior e navegação inferior
        ty = Math.max(70, Math.min(window.innerHeight - PREVIEW_H - 70, ty));

        setFloatX(tx);
        setFloatY(ty);
        if (!prefersReducedMotion) {
          setFloatRot(targetRot);
        }
      });
    }

    function showFloatingPreview(index) {
      if (!isFinePointer || !floatEl || isModalOpen) return;
      const proj = PROJECTS_DATA[index];
      if (!proj) return;

      // Atualiza textos do card flutuante
      if (floatNum) floatNum.textContent = proj.num;
      if (floatFallbackTitle) floatFallbackTitle.textContent = proj.plainTitle;
      if (floatFallbackTech) floatFallbackTech.textContent = proj.tags.slice(0, 2).join(' · ');

      // Atualiza imagem com tratamento seguro de erro/placeholder
      if (floatImg) {
        floatImg.onerror = () => {
          floatImg.classList.add('is-hidden');
          if (floatFallback) floatFallback.style.display = 'flex';
        };
        floatImg.onload = () => {
          floatImg.classList.remove('is-hidden');
          if (floatFallback) floatFallback.style.display = 'none';
        };
        floatImg.src = proj.img;
      }

      floatEl.style.visibility = 'visible';

      if (typeof gsap !== 'undefined') {
        gsap.killTweensOf(floatEl);
        if (prefersReducedMotion) {
          gsap.to(floatEl, { opacity: 1, duration: 0.2 });
        } else {
          gsap.fromTo(
            floatEl,
            { opacity: 0, scale: 0.88, filter: 'blur(4px)' },
            { opacity: 1, scale: 1, filter: 'blur(0px)', duration: 0.35, ease: 'power2.out', overwrite: 'auto' }
          );
        }
      } else {
        floatEl.style.opacity = '1';
      }
    }

    function hideFloatingPreview() {
      if (!floatEl) return;
      if (typeof gsap !== 'undefined') {
        gsap.killTweensOf(floatEl);
        gsap.to(floatEl, {
          opacity: 0,
          scale: prefersReducedMotion ? 1 : 0.9,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            floatEl.style.visibility = 'hidden';
          }
        });
      } else {
        floatEl.style.opacity = '0';
        floatEl.style.visibility = 'hidden';
      }
    }

    // -----------------------------------------------------------------
    // 2. HOVER E FOCO NAS LINHAS DA LISTA
    // -----------------------------------------------------------------
    projItems.forEach((item, index) => {
      item.addEventListener('mouseenter', () => {
        projList.classList.add('has-hover');
        projItems.forEach((other, j) => {
          if (j !== index) other.classList.add('is-dimmed');
          else other.classList.remove('is-dimmed');
        });
        showFloatingPreview(index);
      });

      item.addEventListener('mouseleave', () => {
        projList.classList.remove('has-hover');
        projItems.forEach((el) => el.classList.remove('is-dimmed'));
        hideFloatingPreview();
      });

      // Foco por teclado
      item.addEventListener('focus', () => {
        showFloatingPreview(index);
      });
      item.addEventListener('blur', () => {
        hideFloatingPreview();
      });

      // Clique ou Enter/Space abre o modal expandido
      item.addEventListener('click', () => {
        lastActiveTrigger = item;
        openProjectModal(index);
      });

      item.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          lastActiveTrigger = item;
          openProjectModal(index);
        }
      });
    });

    // -----------------------------------------------------------------
    // 3. PRELOADING DE IMAGENS
    // -----------------------------------------------------------------
    function preloadAdjacentImages(centerIndex) {
      const nextIdx = (centerIndex + 1) % PROJECTS_DATA.length;
      const prevIdx = (centerIndex - 1 + PROJECTS_DATA.length) % PROJECTS_DATA.length;
      const p1 = new Image();
      p1.src = PROJECTS_DATA[nextIdx].img;
      const p2 = new Image();
      p2.src = PROJECTS_DATA[prevIdx].img;
    }

    // -----------------------------------------------------------------
    // 4. MODAL EXPANDIDO (OVERLAY DENTRO DA CENA)
    // -----------------------------------------------------------------
    function populateModalData(index) {
      const proj = PROJECTS_DATA[index];
      if (!proj) return;

      if (modalMeta) modalMeta.textContent = `[ PROJETO ${proj.num} // 06 ]`;
      if (modalTitle) modalTitle.innerHTML = proj.title;
      if (modalDesc) modalDesc.textContent = proj.desc;
      if (modalChallenge) modalChallenge.textContent = proj.learning;
      if (modalCounter) modalCounter.textContent = `${proj.num} // 06`;
      if (modalCta) {
        modalCta.href = proj.url;
        modalCta.setAttribute('aria-label', `Abrir projeto ${proj.plainTitle} em nova aba`);
      }
      if (modalFallbackName) modalFallbackName.textContent = proj.plainTitle;

      // Tags
      if (modalTags) {
        modalTags.innerHTML = '';
        proj.tags.forEach((tag) => {
          const span = document.createElement('span');
          span.textContent = tag;
          modalTags.appendChild(span);
        });
      }

      // Imagem grande com fallback
      if (modalImg) {
        modalImg.onerror = () => {
          modalImg.classList.add('is-hidden');
          if (modalFallback) modalFallback.style.display = 'flex';
        };
        modalImg.onload = () => {
          modalImg.classList.remove('is-hidden');
          if (modalFallback) modalFallback.style.display = 'none';
        };
        modalImg.src = proj.img;
        modalImg.alt = `Screenshot do projeto ${proj.plainTitle}`;
      }

      preloadAdjacentImages(index);
    }

    function openProjectModal(index) {
      if (!modal) return;
      currentModalIndex = index;
      isModalOpen = true;

      hideFloatingPreview();
      populateModalData(index);

      modal.hidden = false;
      modal.setAttribute('aria-hidden', 'false');

      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        gsap.killTweensOf([modalBackdrop, modalDialog]);
        gsap.fromTo(modalBackdrop, { opacity: 0 }, { opacity: 1, duration: 0.35, ease: 'power2.out' });
        gsap.fromTo(
          modalDialog,
          { opacity: 0, scale: 0.92, y: 30 },
          { opacity: 1, scale: 1, y: 0, duration: 0.45, ease: 'power3.out' }
        );
      } else if (typeof gsap !== 'undefined' && prefersReducedMotion) {
        gsap.fromTo(modalDialog, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      }

      // Move foco para o modal para acessibilidade
      setTimeout(() => {
        if (modalClose) modalClose.focus();
        else if (modalDialog) modalDialog.focus();
      }, 50);
    }

    function closeProjectModal() {
      if (!modal || !isModalOpen) return;
      isModalOpen = false;

      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        gsap.killTweensOf([modalBackdrop, modalDialog]);
        gsap.to(modalDialog, { opacity: 0, scale: 0.94, y: 20, duration: 0.25, ease: 'power2.in' });
        gsap.to(modalBackdrop, {
          opacity: 0,
          duration: 0.25,
          ease: 'power2.in',
          onComplete: () => {
            modal.hidden = true;
            modal.setAttribute('aria-hidden', 'true');
          }
        });
      } else {
        modal.hidden = true;
        modal.setAttribute('aria-hidden', 'true');
      }

      // Restaura foco
      if (lastActiveTrigger) {
        lastActiveTrigger.focus();
      }
    }

    function navigateModal(direction) {
      if (!isModalOpen) return;
      const nextIndex = (currentModalIndex + direction + PROJECTS_DATA.length) % PROJECTS_DATA.length;
      currentModalIndex = nextIndex;

      if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
        const visual = modal.querySelector('.cd-proj-modal__visual');
        const details = modal.querySelector('.cd-proj-modal__details');
        const targets = [visual, details].filter(Boolean);

        gsap.to(targets, {
          opacity: 0.35,
          x: -direction * 12,
          duration: 0.15,
          ease: 'power2.in',
          onComplete: () => {
            populateModalData(currentModalIndex);
            gsap.fromTo(
              targets,
              { opacity: 0.35, x: direction * 15 },
              { opacity: 1, x: 0, duration: 0.3, ease: 'power2.out' }
            );
          }
        });
      } else {
        populateModalData(currentModalIndex);
      }
    }

    // Botões e fechar
    if (modalClose) modalClose.addEventListener('click', closeProjectModal);
    if (modalBackdrop) modalBackdrop.addEventListener('click', closeProjectModal);
    if (modalBtnPrev) modalBtnPrev.addEventListener('click', () => navigateModal(-1));
    if (modalBtnNext) modalBtnNext.addEventListener('click', () => navigateModal(1));

    // Teclado (ESC fecha, ← → navega)
    window.addEventListener('keydown', (e) => {
      if (!isModalOpen) return;
      if (e.key === 'Escape') {
        e.preventDefault();
        closeProjectModal();
      } else if (e.key === 'ArrowLeft') {
        e.preventDefault();
        navigateModal(-1);
      } else if (e.key === 'ArrowRight') {
        e.preventDefault();
        navigateModal(1);
      }
    });

    // -----------------------------------------------------------------
    // 5. SUPORTE A TOUCH & SWIPE LATERAL (MOBILE)
    // -----------------------------------------------------------------
    let touchStartX = 0;
    let touchStartY = 0;

    if (modalDialog) {
      modalDialog.addEventListener(
        'touchstart',
        (e) => {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          touchStartX = e.changedTouches[0].clientX;
          touchStartY = e.changedTouches[0].clientY;
        },
        { passive: true }
      );

      modalDialog.addEventListener(
        'touchend',
        (e) => {
          if (!e.changedTouches || !e.changedTouches[0]) return;
          const deltaX = e.changedTouches[0].clientX - touchStartX;
          const deltaY = e.changedTouches[0].clientY - touchStartY;

          // Se movimento foi predominantemente horizontal e passou de 45px
          if (Math.abs(deltaX) > 45 && Math.abs(deltaX) > Math.abs(deltaY) * 1.4) {
            if (deltaX > 0) {
              navigateModal(-1); // Swipe para a direita -> Anterior
            } else {
              navigateModal(1);  // Swipe para a esquerda -> Próximo
            }
          }
        },
        { passive: true }
      );
    }
  })();

  // ===================================================================
  // 04B. INTERATIVIDADE DA MOLDURA 3D DO RETRATO (CENA 03)
  // Parallax 3D físico responsivo à posição do cursor
  // ===================================================================
  (() => {
    const portraitWrap = document.querySelector('.cd-about__portrait-wrap');
    const portraitStage = document.getElementById('cdAboutPortrait');
    if (!portraitWrap || !portraitStage || prefersReducedMotion) return;

    let targetRotX = 0;
    let targetRotY = 0;
    let currentRotX = 0;
    let currentRotY = 0;
    let isHovering = false;
    let rafId = null;

    function updatePortraitTilt() {
      // Lerp suave para inércia orgânica (referência Production Portugal)
      currentRotX += (targetRotX - currentRotX) * 0.12;
      currentRotY += (targetRotY - currentRotY) * 0.12;

      if (isHovering || Math.abs(currentRotX) > 0.05 || Math.abs(currentRotY) > 0.05) {
        portraitStage.style.transform = `perspective(1200px) rotateX(${currentRotX.toFixed(2)}deg) rotateY(${currentRotY.toFixed(2)}deg) translateY(-6px)`;
        rafId = requestAnimationFrame(updatePortraitTilt);
      } else {
        portraitStage.style.transform = '';
        rafId = null;
      }
    }

    portraitWrap.addEventListener('mousemove', (e) => {
      const rect = portraitWrap.getBoundingClientRect();
      const normX = (e.clientX - rect.left) / rect.width - 0.5;
      const normY = (e.clientY - rect.top) / rect.height - 0.5;

      targetRotX = -normY * 16;
      targetRotY = normX * 18;
      isHovering = true;

      if (!rafId) {
        rafId = requestAnimationFrame(updatePortraitTilt);
      }
    });

    portraitWrap.addEventListener('mouseleave', () => {
      targetRotX = 0;
      targetRotY = 0;
      isHovering = false;
    });
  })();

  // ===================================================================
  // 05. SISTEMA DE NAVEGAÇÃO ENTRE CENAS
  // ===================================================================
  const TOTAL_SCENES = 8;

  const scenes = document.querySelectorAll('.cd-scene');
  const pills = document.querySelectorAll('.cd-nav__pill');
  const btnPrev = document.getElementById('cdBtnPrev');
  const btnNext = document.getElementById('cdBtnNext');
  const sceneTag = document.getElementById('cdSceneTag');
  const barFill = document.getElementById('cdBarFill');
  const progressBar = document.getElementById('cdProgressBar');
  const btnHome = document.getElementById('cdBtnHome');
  const btnEnter = document.getElementById('cdBtnEnter');
  const heroName = document.getElementById('cdHeroName');

  const SCENE_NAMES = [
    '', 'INTRODUÇÃO', 'TRAVESSIA', 'SOBRE MIM', 'PROJETOS',
    'HABILIDADES', 'TECNOLOGIA & JORNALISMO', 'EDUCAÇÃO & INTERESSES', 'CONTATO'
  ];

  let activeScene = 1;
  let isTransitioning = false;

  function goToScene(targetNum, direction) {
    if (isTransitioning) return;
    if (targetNum < 1 || targetNum > TOTAL_SCENES) return;
    if (targetNum === activeScene) return;

    isTransitioning = true;
    const prevNum = activeScene;
    activeScene = targetNum;

    // Cenas DOM
    const prevPanel = document.getElementById('cd-scene-' + String(prevNum).padStart(2, '0'));
    const nextPanel = document.getElementById('cd-scene-' + String(targetNum).padStart(2, '0'));

    // Calcular direção
    const dir = direction || (targetNum > prevNum ? 1 : -1);
    if (typeof playTransitionChime === 'function') {
      playTransitionChime(dir);
    }

    // Animar saída da cena anterior
    if (typeof gsap !== 'undefined' && !prefersReducedMotion) {
      if (prevPanel) {
        gsap.to(prevPanel, {
          opacity: 0,
          y: dir > 0 ? -40 : 40,
          duration: 0.55,
          ease: 'power2.in',
          onComplete: () => {
            prevPanel.classList.remove('cd-scene--active');
            prevPanel.setAttribute('aria-hidden', 'true');
            prevPanel.style.pointerEvents = 'none';
          }
        });
      }

      // Animação da câmera (Three.js)
      if (webglAvailable && camera) {
        gsap.to(camera.position, {
          z: 8 + (targetNum - 1) * 0.4,
          duration: 1.0,
          ease: 'power2.inOut'
        });
      }

      // Animar entrada da próxima cena
      setTimeout(() => {
        if (nextPanel) {
          nextPanel.classList.add('cd-scene--active');
          nextPanel.removeAttribute('aria-hidden');
          nextPanel.style.pointerEvents = 'auto';
          gsap.fromTo(nextPanel,
            { opacity: 0, y: dir > 0 ? 50 : -50 },
            { opacity: 1, y: 0, duration: 0.7, ease: 'power2.out' }
          );
        }

        updateHud(targetNum);

        // Gerenciar visibilidade das esculturas 3D
        updateSculptureForScene(targetNum);

        setTimeout(() => { isTransitioning = false; }, 400);
      }, 350);

    } else {
      // Sem GSAP / reduced motion
      if (prevPanel) {
        prevPanel.classList.remove('cd-scene--active');
        prevPanel.setAttribute('aria-hidden', 'true');
        prevPanel.style.pointerEvents = 'none';
      }
      if (nextPanel) {
        nextPanel.classList.add('cd-scene--active');
        nextPanel.removeAttribute('aria-hidden');
        nextPanel.style.pointerEvents = 'auto';
      }
      updateHud(targetNum);
      updateSculptureForScene(targetNum);
      isTransitioning = false;
    }
  }

  function updateHud(num) {
    // Scene tag
    if (sceneTag) {
      sceneTag.textContent =
        'CENA ' + String(num).padStart(2, '0') + ' / ' + TOTAL_SCENES + ' \u2022 ' + SCENE_NAMES[num];
    }

    // Progress bar
    if (barFill) {
      barFill.style.width = (num / TOTAL_SCENES * 100) + '%';
    }
    if (progressBar) {
      progressBar.setAttribute('aria-valuenow', num);
    }

    // Pills
    pills.forEach((p) => {
      const pNum = parseInt(p.getAttribute('data-scene'), 10);
      if (pNum === num) {
        p.classList.add('cd-nav__pill--active');
        p.setAttribute('aria-selected', 'true');
      } else {
        p.classList.remove('cd-nav__pill--active');
        p.setAttribute('aria-selected', 'false');
      }
    });

    // Botões prev/next
    if (btnPrev) btnPrev.disabled = (num === 1);
    if (btnNext) btnNext.disabled = (num === TOTAL_SCENES);

    // Barra de paginação oculta na abertura e revelada elegantemente nas cenas seguintes
    const navEl = document.querySelector('.cd-nav');
    if (navEl) {
      if (num > 1) {
        navEl.classList.add('is-revealed');
      } else {
        navEl.classList.remove('is-revealed');
      }
    }
  }

  function updateSculptureForScene(num) {
    if (!webglAvailable) return;

    const useGsap = typeof gsap !== 'undefined' && !prefersReducedMotion;

    // ---------------------------------------------------------------
    // Escultura principal — visível em TODAS as cenas, EVOLUI entre elas
    // (Referência Léo Parpeix: "o objeto evolui e se transforma")
    // ---------------------------------------------------------------
    if (mainSculpture) {
      mainSculpture.visible = true;

      const sculptureStates = {
        1: { pos: [0, -0.15, -2.8], scale: 1.05, rotSpeed: 0.08 },
        2: { pos: [0, 0.5, 0], scale: 1.3, rotSpeed: 0.12 },
        3: { pos: [4.5, 0, -3], scale: 0.65, rotSpeed: 0.06 },
        4: { pos: [-5, 1, -5], scale: 0.5, rotSpeed: 0.04 },
        5: { pos: [-4, -1, -4], scale: 0.7, rotSpeed: 0.05 },
        6: { pos: [3.5, 1.5, -5], scale: 0.6, rotSpeed: 0.07 },
        7: { pos: [5, -0.5, -4], scale: 0.55, rotSpeed: 0.05 },
        8: { pos: [0, 2, -6], scale: 0.45, rotSpeed: 0.03 }
      };

      const state = sculptureStates[num] || sculptureStates[1];

      if (useGsap) {
        gsap.to(mainSculpture.position, {
          x: state.pos[0], y: state.pos[1], z: state.pos[2],
          duration: 1.8, ease: 'power3.inOut'
        });
        gsap.to(mainSculpture.scale, {
          x: state.scale, y: state.scale, z: state.scale,
          duration: 1.8, ease: 'power3.inOut'
        });
      } else {
        mainSculpture.position.set(...state.pos);
        mainSculpture.scale.setScalar(state.scale);
      }
    }

    // Sub-elementos morph sutil por cena
    if (useGsap) {
      if (icoMeshRef) {
        const icoPositions = {
          1: [-3.2, 1.0, 0.5], 2: [-2, 2, 1.5], 3: [-1, 1.5, 1],
          4: [-2.5, 0.5, 0], 5: [-3, -0.5, 0.5], 6: [-2, 1, 1],
          7: [-3.5, 0, 0], 8: [-1.5, 1.5, 1]
        };
        const ip = icoPositions[num] || icoPositions[1];
        gsap.to(icoMeshRef.position, { x: ip[0], y: ip[1], z: ip[2], duration: 1.5, ease: 'power2.inOut' });
      }
      if (octaMeshRef) {
        const octaPositions = {
          1: [-2, -1.8, -0.5], 2: [0, -2, 0], 3: [-1.5, -1, 0],
          4: [-1, -2.5, -1], 5: [-2.5, -1.5, 0], 6: [1, -2, -0.5],
          7: [-2, -1, 0], 8: [0.5, -1.5, 0.5]
        };
        const op = octaPositions[num] || octaPositions[1];
        gsap.to(octaMeshRef.position, { x: op[0], y: op[1], z: op[2], duration: 1.5, ease: 'power2.inOut' });
      }
    }

    // Escultura secundária: visível na cena 3 (Sobre Mim)
    if (aboutSculpture) {
      if (num === 3) {
        aboutSculpture.visible = true;
        if (useGsap) {
          gsap.fromTo(aboutSculpture.scale,
            { x: 0.01, y: 0.01, z: 0.01 },
            { x: 1, y: 1, z: 1, duration: 1.2, ease: 'elastic.out(1, 0.6)' }
          );
        }
      } else {
        if (useGsap) {
          gsap.to(aboutSculpture.scale, {
            x: 0.01, y: 0.01, z: 0.01, duration: 0.5, ease: 'power2.in',
            onComplete: () => { aboutSculpture.visible = false; }
          });
        } else {
          aboutSculpture.visible = false;
        }
      }
    }

    // Ajustes de câmera por cena
    if (camera) {
      if (useGsap) {
        const camZTargets = { 1: 8, 2: 5, 3: 7, 4: 9, 5: 8, 6: 8, 7: 9, 8: 10 };
        gsap.to(camera.position, {
          z: camZTargets[num] || 8,
          duration: 1.2,
          ease: 'power2.inOut'
        });
      }
    }

    // Névoa dinâmica com transição suave
    if (scene && scene.fog) {
      const fogDensities = { 1: 0.009, 2: 0.02, 3: 0.007, 4: 0.004, 5: 0.008, 6: 0.01, 7: 0.006, 8: 0.004 };
      const targetDensity = fogDensities[num] || 0.009;
      if (useGsap) {
        gsap.to(scene.fog, { density: targetDensity, duration: 1.5, ease: 'power2.inOut' });
      } else {
        scene.fog.density = targetDensity;
      }
    }

    // Poeira cósmica: mais visível na travessia (cena 2)
    if (dustField && dustField.material) {
      const dustOpacities = { 1: 0.25, 2: 0.55, 3: 0.2, 4: 0.1, 5: 0.15, 6: 0.2, 7: 0.15, 8: 0.3 };
      if (useGsap) {
        gsap.to(dustField.material, {
          opacity: dustOpacities[num] || 0.25,
          duration: 1.0, ease: 'power2.inOut'
        });
      } else {
        dustField.material.opacity = dustOpacities[num] || 0.25;
      }
    }

    // ---------------------------------------------------------------
    // Nome Monumental 3D (Cromado) — Travessia & Evolução
    // ---------------------------------------------------------------
    if (heroName3DGroup) {
      if (num === 1) {
        heroName3DGroup.visible = true; // Monumental e em pleno destaque na Cena 1
        const initialScale = window.innerWidth < 768 ? 0.65 : 1.15;
        if (useGsap) {
          gsap.to(heroName3DGroup.position, { x: 0, y: 0.25, z: 0.6, duration: 1.5, ease: 'power3.out' });
          gsap.to(heroName3DGroup.scale, { x: initialScale, y: initialScale, z: initialScale, duration: 1.5, ease: 'power3.out' });
          heroLetterMeshes.forEach((mesh, idx) => {
            gsap.to(mesh.position, {
              x: mesh.userData.origX,
              y: mesh.userData.origY,
              z: mesh.userData.origZ,
              duration: 1.4,
              delay: idx * 0.02,
              ease: 'power3.out'
            });
            gsap.to(mesh.rotation, { x: 0, y: 0, z: 0, duration: 1.2, ease: 'power2.out' });
          });
        } else {
          heroName3DGroup.position.set(0, 0.25, 0.6);
          heroName3DGroup.scale.setScalar(initialScale);
          heroLetterMeshes.forEach(mesh => {
            mesh.position.set(mesh.userData.origX, mesh.userData.origY, mesh.userData.origZ);
            mesh.rotation.set(0, 0, 0);
          });
        }
        if (typeof nameLightRose !== 'undefined' && nameLightRose) nameLightRose.intensity = 12.0;
        if (typeof nameLightLav !== 'undefined' && nameLightLav) nameLightLav.intensity = 10.0;
      } else if (num === 2) {
        // CENA 02: Travessia cinematográfica através das letras cromadas
        heroName3DGroup.visible = true;
        if (typeof nameLightRose !== 'undefined' && nameLightRose) nameLightRose.intensity = 4.0;
        if (typeof nameLightLav !== 'undefined' && nameLightLav) nameLightLav.intensity = 4.0;
        if (useGsap) {
          heroLetterMeshes.forEach((mesh, idx) => {
            const spreadFactor = 3.6;
            gsap.to(mesh.position, {
              x: mesh.userData.origX * spreadFactor + (Math.sin(idx * 0.8) * 2.2),
              y: mesh.userData.origY * spreadFactor + (Math.cos(idx * 0.8) * 1.8),
              z: 8.5 + idx * 0.35,
              duration: 1.8,
              ease: 'power2.inOut'
            });
            gsap.to(mesh.rotation, {
              x: (Math.sin(idx) - 0.5) * 2.5,
              y: (Math.cos(idx) - 0.5) * 2.5,
              duration: 1.8,
              ease: 'power2.inOut'
            });
          });
        }
      } else if (num === 8) {
        // CENA 08: Retorno elegante e minimalista do nome ao final
        heroName3DGroup.visible = true;
        if (typeof nameLightRose !== 'undefined' && nameLightRose) nameLightRose.intensity = 2.0;
        if (typeof nameLightLav !== 'undefined' && nameLightLav) nameLightLav.intensity = 2.0;
        const endScale = window.innerWidth < 768 ? 0.28 : 0.38;
        if (useGsap) {
          gsap.to(heroName3DGroup.position, { x: 0, y: -2.2, z: 0.5, duration: 1.4, ease: 'power2.out' });
          gsap.to(heroName3DGroup.scale, { x: endScale, y: endScale, z: endScale, duration: 1.4, ease: 'power2.out' });
          heroLetterMeshes.forEach((mesh) => {
            gsap.to(mesh.position, { x: mesh.userData.origX, y: mesh.userData.origY, z: mesh.userData.origZ, duration: 1.2 });
            gsap.to(mesh.rotation, { x: 0, y: 0, z: 0, duration: 1.2 });
          });
        } else {
          heroName3DGroup.position.set(0, -2.2, 0.5);
          heroName3DGroup.scale.setScalar(endScale);
        }
      } else {
        heroName3DGroup.visible = false;
        if (typeof nameLightRose !== 'undefined' && nameLightRose) nameLightRose.intensity = 0;
        if (typeof nameLightLav !== 'undefined' && nameLightLav) nameLightLav.intensity = 0;
      }
    }

    // ---------------------------------------------------------------
    // Badges 3D de Habilidades (Cena 05)
    // ---------------------------------------------------------------
    if (skills3DGroup) {
      if (num === 5) {
        skills3DGroup.visible = true;
        if (useGsap) {
          skillsBadges.forEach((badge, bi) => {
            gsap.fromTo(badge.scale,
              { x: 0.01, y: 0.01, z: 0.01 },
              { x: 1, y: 1, z: 1, duration: 1.0, delay: bi * 0.1, ease: 'back.out(1.5)' }
            );
          });
        }
      } else {
        if (useGsap) {
          gsap.to(skills3DGroup.position, {
            z: -10, duration: 0.5, ease: 'power2.in',
            onComplete: () => {
              skills3DGroup.visible = false;
              skills3DGroup.position.z = -3;
            }
          });
        } else {
          skills3DGroup.visible = false;
        }
      }
    }
  }

  // Botões de navegação
  if (btnPrev) btnPrev.addEventListener('click', () => goToScene(activeScene - 1, -1));
  if (btnNext) btnNext.addEventListener('click', () => goToScene(activeScene + 1, 1));

  // Pills
  pills.forEach((pill) => {
    pill.addEventListener('click', () => {
      const num = parseInt(pill.getAttribute('data-scene'), 10);
      goToScene(num);
    });
  });

  // Botão Home
  if (btnHome) btnHome.addEventListener('click', () => goToScene(1));

  // Enter experience
  function enterExperience() {
    goToScene(2, 1);
  }

  if (btnEnter) btnEnter.addEventListener('click', enterExperience);
  if (heroName) {
    heroName.addEventListener('click', enterExperience);
    heroName.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        enterExperience();
      }
    });
  }

  // Estado inicial dos botões
  updateHud(1);


  // ===================================================================
  // 06. CENA 04 — PROJETOS (Galeria Experimental)
  // ===================================================================
  const projects = [
    {
      name: 'Briar U — Hawks Hockey',
      url: 'https://briar-u.vercel.app/',
      desc: 'Projeto inspirado no universo universitário de hóquei. Experiência interativa com identidade visual de inverno e elementos reais de jogo implementados na arena com física Canvas 2D.',
      tech: ['JavaScript ES6+', 'Canvas 2D', 'SVG', 'CSS3', 'HTML5'],
      index: '01',
      hasQuote: false
    },
    {
      name: 'Projeto JS — Frases de Cinema',
      url: 'https://js-eight-sage.vercel.app/',
      desc: 'Projeto desenvolvido em JavaScript puro com manipulação do DOM e console interativo. Gera frases clássicas do cinema de forma dinâmica com animações de texto.',
      tech: ['JavaScript ES6+', 'DOM API', 'HTML5', 'CSS3'],
      index: '02',
      hasQuote: true
    },
    {
      name: 'AESPA Members',
      url: 'https://helenamaria09.github.io/aespamembers/',
      desc: 'Portal conceitual dedicado ao grupo aespa. Apresenta os perfis das 4 integrantes com estética cyber-Y2K, embed do Spotify e organização editorial das informações.',
      tech: ['HTML5', 'CSS3', 'JavaScript', 'Spotify Embed'],
      index: '03',
      hasQuote: false
    },
    {
      name: 'O Diário Secreto',
      url: 'https://diario-opal.vercel.app/',
      desc: 'Diário digital no estilo scrapbook com CSS 3D Transforms. Registra memórias visuais de natação e ballet com composição artesanal e texturas digitais.',
      tech: ['HTML5', 'CSS3 Transforms', 'JavaScript', 'Layout Grid'],
      index: '04',
      hasQuote: false
    },
    {
      name: 'GOTY Academia',
      url: 'https://helenamaria09.github.io/goty--academia/',
      desc: 'Site institucional para centro esportivo e academia fitness com catálogo de serviços, mapa de unidades e interface limpa e responsiva. Projeto completo de comunicação digital.',
      tech: ['HTML5', 'CSS3', 'JavaScript', 'Responsive Design'],
      index: '05',
      hasQuote: false
    },
    {
      name: 'Cat Café Tycoon',
      url: 'https://jogo-1-three.vercel.app/',
      desc: 'Jogo 3D desenvolvido com Three.js WebGL. Sistema de gerenciamento de cafeteria com gatos, modo "Hora do Fuzuê" e mecânicas de jogo implementadas do zero.',
      tech: ['Three.js', 'WebGL', 'JavaScript ES6+', 'GSAP', '3D Game Logic'],
      index: '06',
      hasQuote: false
    }
  ];

  const movieQuotes = [
    { q: 'Que a Força esteja com você.', m: 'Star Wars' },
    { q: 'Vou fazer uma proposta que ele não poderá recusar.', m: 'O Poderoso Chefão' },
    { q: 'Não há lugar como o nosso lar.', m: 'O Mágico de Oz' },
    { q: 'Ao infinito e além!', m: 'Toy Story' },
    { q: 'A vida, uh... encontra um caminho.', m: 'Jurassic Park' },
    { q: 'Hasta la vista, baby.', m: 'O Exterminador do Futuro 2' },
    { q: 'Que os jogos comecem.', m: 'Jogos Vorazes' },
    { q: 'Apenas os mortos viram o fim da guerra.', m: 'Platoon' }
  ];

  const galleryTabs = document.querySelectorAll('.cd-gallery__tab');
  const projIndex = document.getElementById('cdProjIndex');
  const projName = document.getElementById('cdProjName');
  const projDesc = document.getElementById('cdProjDesc');
  const projStack = document.getElementById('cdProjStack');
  const projLink = document.getElementById('cdProjLink');
  const quoteConsole = document.getElementById('cdQuoteConsole');
  const quoteText = document.getElementById('cdQuoteText');
  const btnQuote = document.getElementById('cdBtnQuote');
  const mockupStage = document.getElementById('cdMockup');
  const btnPrevProj = document.getElementById('cdBtnPrevProj');
  const btnNextProj = document.getElementById('cdBtnNextProj');

  let currentProj = 0;

  function renderProjectMockup(proj, container) {
    if (!container) return;
    container.innerHTML = '';

    const frame = document.createElement('div');
    frame.className = 'cd-mockup-frame';

    // Top browser bar
    const bar = document.createElement('div');
    bar.className = 'cd-mockup-bar';
    bar.innerHTML = `
      <div class="cd-mockup-dots" aria-hidden="true">
        <span class="dot-red"></span>
        <span class="dot-yellow"></span>
        <span class="dot-green"></span>
      </div>
      <div class="cd-mockup-url"><span>${proj.url.replace('https://', '')}</span></div>
      <div class="cd-mockup-status">ONLINE</div>
    `;
    frame.appendChild(bar);

    // Screen area
    const screen = document.createElement('div');
    screen.className = 'cd-mockup-screen cd-preview-' + proj.index;

    if (proj.index === '01') {
      screen.innerHTML = `
        <div class="cd-m-briar">
          <div class="cd-m-briar__top">
            <span class="cd-m-briar__title">BRIAR U // HAWKS HOCKEY</span>
            <div class="cd-m-briar__board">
              <span class="h-score">HAWKS <strong>4</strong></span>
              <span class="h-period">PER 3</span>
              <span class="a-score"><strong>2</strong> OPP</span>
            </div>
          </div>
          <div class="cd-m-briar__arena">
            <div class="cd-m-briar__rink">
              <div class="rink-center"></div>
              <div class="rink-goal rink-goal--left"></div>
              <div class="rink-goal rink-goal--right"></div>
              <div class="rink-puck"></div>
            </div>
          </div>
          <div class="cd-m-briar__footer">
            <span>CANVAS 2D &bull; FISICA DE COLISAO REAL &bull; ARENA INTERATIVA</span>
          </div>
        </div>
      `;
    } else if (proj.index === '02') {
      screen.innerHTML = `
        <div class="cd-m-js">
          <div class="cd-m-js__head">
            <span>JS TERMINAL &bull; FRASES DE CINEMA</span>
            <span class="cd-m-js__dot"></span>
          </div>
          <div class="cd-m-js__console">
            <div class="c-line"><span class="c-p">&gt;</span> cinema.loadQuotes({ genre: 'classic' })</div>
            <div class="c-line c-ok">[OK] 8 classicos do cinema carregados na memoria</div>
            <div class="c-line"><span class="c-p">&gt;</span> cinema.generateActiveQuote()</div>
            <div class="cd-m-js__quote">
              <div class="q-mark">"</div>
              <div class="q-content">Que a Forca esteja com voce.</div>
              <div class="q-author">- Star Wars (1977)</div>
            </div>
            <div class="c-line"><span class="c-p">&gt;</span> <span class="c-blink">_</span></div>
          </div>
        </div>
      `;
    } else if (proj.index === '03') {
      screen.innerHTML = `
        <div class="cd-m-aespa">
          <div class="cd-m-aespa__top">
            <span class="aespa-glitch">AESPA // CYBER PORTAL</span>
            <span class="aespa-badge">Y2K EDITION</span>
          </div>
          <div class="cd-m-aespa__members">
            <div class="m-card"><strong>KARINA</strong><small>Leader &bull; Rocket</small></div>
            <div class="m-card"><strong>GISELLE</strong><small>Main Rapper</small></div>
            <div class="m-card"><strong>WINTER</strong><small>Lead Vocal</small></div>
            <div class="m-card"><strong>NINGNING</strong><small>Main Vocal</small></div>
          </div>
          <div class="cd-m-aespa__spotify">
            <div class="sp-icon">&#9658;</div>
            <div class="sp-text">DRAMA &bull; aespa mini album</div>
            <div class="sp-bars"><span></span><span></span><span></span><span></span></div>
          </div>
        </div>
      `;
    } else if (proj.index === '04') {
      screen.innerHTML = `
        <div class="cd-m-diario">
          <div class="cd-m-diario__tape tape-top"></div>
          <div class="cd-m-diario__head">
            <span>O DIARIO SECRETO // SCRAPBOOK</span>
          </div>
          <div class="cd-m-diario__polaroids">
            <div class="p-card p-1">
              <div class="p-img p-swim">&#127946;</div>
              <div class="p-caption">Treino de Natacao</div>
            </div>
            <div class="p-card p-2">
              <div class="p-img p-ballet">&#129680;</div>
              <div class="p-caption">Ballet Classico</div>
            </div>
          </div>
          <div class="cd-m-diario__tape tape-bot"></div>
        </div>
      `;
    } else if (proj.index === '05') {
      screen.innerHTML = `
        <div class="cd-m-goty">
          <div class="cd-m-goty__header">
            <span class="goty-logo">GOTY ACADEMIA</span>
            <span class="goty-tag">FITNESS PORTAL</span>
          </div>
          <div class="cd-m-goty__stats">
            <div class="g-box"><small>FREQUENCIA</small><strong>142 <span>BPM</span></strong></div>
            <div class="g-box"><small>CALORIAS</small><strong>580 <span>KCAL</span></strong></div>
          </div>
          <div class="cd-m-goty__grid">
            <div class="g-item">&#10003; Musculacao & Performance</div>
            <div class="g-item">&#10003; Catalogo e Mapa de Unidades</div>
          </div>
        </div>
      `;
    } else if (proj.index === '06') {
      screen.innerHTML = `
        <div class="cd-m-catcafe">
          <div class="cd-m-catcafe__bar">
            <span class="c-badge">THREE.JS 3D WEBGL</span>
            <span class="c-fuzue">&#9889; HORA DO FUZUE!</span>
          </div>
          <div class="cd-m-catcafe__scene">
            <div class="c-cat cat-left">&#128049; <small>Cafeteira</small></div>
            <div class="c-cat cat-right">&#128008; <small>Balcao</small></div>
            <div class="c-counter">&#9749; Cafe Especial Servido</div>
          </div>
          <div class="cd-m-catcafe__footer">
            <span>Satisfacao: 98%</span>
            <span>2.450 moedas</span>
          </div>
        </div>
      `;
    }

    frame.appendChild(screen);
    container.appendChild(frame);
  }

  function loadProject(idx, animate) {
    currentProj = Math.max(0, Math.min(projects.length - 1, idx));
    const proj = projects[currentProj];

    // Update tabs
    galleryTabs.forEach((t, i) => {
      t.classList.toggle('cd-gallery__tab--active', i === currentProj);
    });

    function applyContent() {
      if (projIndex) projIndex.textContent = 'PROJETO ' + proj.index + ' // 06';
      if (projName) projName.textContent = proj.name;
      if (projDesc) projDesc.textContent = proj.desc;

      // Stack
      if (projStack) {
        projStack.innerHTML = proj.tech.map(t => '<span>' + t + '</span>').join('');
      }

      // Link
      if (projLink) {
        projLink.href = proj.url;
        projLink.setAttribute('aria-label', 'Abrir ' + proj.name + ' em nova aba');
      }

      // Quote console
      if (quoteConsole) {
        quoteConsole.hidden = !proj.hasQuote;
      }

      // Renderizar mockup de alta fidelidade
      if (mockupStage) {
        renderProjectMockup(proj, mockupStage);
      }
    }

    if (typeof gsap !== 'undefined' && !prefersReducedMotion && animate) {
      const contentEl = document.querySelector('.cd-showcase__content');
      if (contentEl) {
        gsap.to(contentEl, {
          opacity: 0, y: 15, duration: 0.25, ease: 'power2.in',
          onComplete: () => {
            applyContent();
            gsap.to(contentEl, { opacity: 1, y: 0, duration: 0.4, ease: 'power2.out' });
          }
        });
      } else {
        applyContent();
      }
    } else {
      applyContent();
    }
  }

  // Tabs
  galleryTabs.forEach((tab, i) => {
    tab.addEventListener('click', () => loadProject(i, true));
  });

  // Prev/Next projeto
  if (btnPrevProj) btnPrevProj.addEventListener('click', () => loadProject(currentProj - 1, true));
  if (btnNextProj) btnNextProj.addEventListener('click', () => loadProject(currentProj + 1, true));

  // Gerador de frases (Projeto 02)
  if (btnQuote && quoteText) {
    btnQuote.addEventListener('click', () => {
      const q = movieQuotes[Math.floor(Math.random() * movieQuotes.length)];
      if (typeof gsap !== 'undefined') {
        gsap.to(quoteText, {
          opacity: 0, duration: 0.15,
          onComplete: () => {
            quoteText.textContent = '"' + q.q + '" — ' + q.m;
            gsap.to(quoteText, { opacity: 1, duration: 0.3 });
          }
        });
      } else {
        quoteText.textContent = '"' + q.q + '" — ' + q.m;
      }
    });
  }

  // Inicializar galeria
  loadProject(0, false);


  // ===================================================================
  // 07. ÁUDIO AMBIENTE (Web Audio API)
  // ===================================================================
  const btnAudio = document.getElementById('cdBtnAudio');
  let audioCtx = null;
  let audioGain = null;
  let audioNodes = [];
  let audioActive = false;

  function createAmbientAudio() {
    audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    audioGain = audioCtx.createGain();
    audioGain.gain.setValueAtTime(0, audioCtx.currentTime);
    audioGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 2);
    audioGain.connect(audioCtx.destination);

    // Drones harmônicos etéreos
    const frequencies = [55, 82.5, 110, 165, 220];
    frequencies.forEach((freq) => {
      const osc = audioCtx.createOscillator();
      osc.type = 'sine';
      osc.frequency.value = freq;

      const oscGain = audioCtx.createGain();
      oscGain.gain.value = 0.07 + Math.random() * 0.05;

      osc.connect(oscGain);
      oscGain.connect(audioGain);
      osc.start();
      audioNodes.push(osc, oscGain);
    });
  }

  function playTransitionChime(direction) {
    if (!audioCtx || !audioActive) return;
    try {
      const osc = audioCtx.createOscillator();
      const g = audioCtx.createGain();
      osc.type = 'sine';
      const startF = direction > 0 ? 320 : 480;
      const endF = direction > 0 ? 640 : 240;
      osc.frequency.setValueAtTime(startF, audioCtx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(endF, audioCtx.currentTime + 0.45);
      g.gain.setValueAtTime(0.06, audioCtx.currentTime);
      g.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + 0.45);
      osc.connect(g);
      g.connect(audioGain);
      osc.start();
      osc.stop(audioCtx.currentTime + 0.48);
    } catch (e) { }
  }

  function toggleAudio() {
    if (!audioActive) {
      if (!audioCtx) createAmbientAudio();
      else audioGain.gain.linearRampToValueAtTime(0.12, audioCtx.currentTime + 1.5);
      audioActive = true;
      if (btnAudio) {
        btnAudio.setAttribute('aria-pressed', 'true');
        btnAudio.setAttribute('aria-label', 'Desativar audio ambiente');
      }
    } else {
      if (audioGain) audioGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 1.5);
      audioActive = false;
      if (btnAudio) {
        btnAudio.setAttribute('aria-pressed', 'false');
        btnAudio.setAttribute('aria-label', 'Ativar audio ambiente');
      }
    }
  }

  if (btnAudio) btnAudio.addEventListener('click', toggleAudio);


  // ===================================================================
  // 08. CONTROLE DE MOVIMENTO
  // ===================================================================
  const btnMotion = document.getElementById('cdBtnMotion');
  let motionReduced = prefersReducedMotion;

  if (btnMotion) {
    if (motionReduced) {
      btnMotion.setAttribute('aria-pressed', 'true');
    }

    btnMotion.addEventListener('click', () => {
      motionReduced = !motionReduced;
      btnMotion.setAttribute('aria-pressed', motionReduced ? 'true' : 'false');
      // Aplicar ao documento
      document.documentElement.style.setProperty(
        '--transition-override',
        motionReduced ? '0.01ms' : ''
      );
    });
  }


  // ===================================================================
  // 09. FORMULÁRIO DE CONTATO
  // ===================================================================
  const contactForm = document.getElementById('cdContactForm');
  const formNote = document.getElementById('cdFormNote');
  const btnCopyEmail = document.getElementById('cdBtnCopyEmail');
  const copyText = document.getElementById('cdCopyText');

  const EMAIL = 'tecmariahelenasilva@gmail.com';

  if (contactForm) {
    contactForm.addEventListener('submit', (e) => {
      e.preventDefault();
      const name = (document.getElementById('cdName')?.value || 'Visitante').trim();
      const email = (document.getElementById('cdEmail')?.value || '').trim();
      const message = (document.getElementById('cdMessage')?.value || '').trim();

      const subject = encodeURIComponent('[Portfólio] Mensagem de ' + name);
      const body = encodeURIComponent(
        'Olá Maria Helena,\n\nMeu nome é ' + name + ' (' + email + ').\n\nMensagem:\n' + message +
        '\n\nEnviado através do universo CHROME DREAMS.'
      );

      if (formNote) {
        formNote.hidden = false;
        setTimeout(() => { formNote.hidden = true; }, 5000);
      }

      window.location.href = 'mailto:' + EMAIL + '?subject=' + subject + '&body=' + body;
    });
  }

  if (btnCopyEmail && copyText) {
    btnCopyEmail.addEventListener('click', () => {
      navigator.clipboard.writeText(EMAIL)
        .then(() => {
          copyText.textContent = 'Copiado! OK';
          setTimeout(() => { copyText.textContent = 'Copiar E-mail'; }, 2500);
        })
        .catch(() => {
          window.location.href = 'mailto:' + EMAIL;
        });
    });
  }


  // ===================================================================
  // 10. ATALHOS DE TECLADO
  // ===================================================================
  window.addEventListener('keydown', (e) => {
    // Ignora quando está em campos de texto ou quando o modal de projeto está aberto
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    const modalEl = document.getElementById('cdProjModal');
    if (modalEl && !modalEl.hidden) return;

    const key = e.key;

    // Teclas 1–8: pular para cenas
    if (['1', '2', '3', '4', '5', '6', '7', '8'].includes(key)) {
      e.preventDefault();
      goToScene(parseInt(key, 10));
      return;
    }

    // Setas
    if (key === 'ArrowRight' || key === 'ArrowDown') {
      e.preventDefault();
      goToScene(activeScene + 1, 1);
    } else if (key === 'ArrowLeft' || key === 'ArrowUp') {
      e.preventDefault();
      goToScene(activeScene - 1, -1);
    }
  });


  // ===================================================================
  // 10b. NAVEGAÇÃO POR SCROLL / WHEEL
  // ===================================================================
  let lastWheelTime = 0;
  const WHEEL_COOLDOWN = 1200; // ms entre transições

  window.addEventListener('wheel', (e) => {
    if (Math.abs(e.deltaY) > 6) {
      if (typeof revealNavOnScroll === 'function') revealNavOnScroll();
    }

    // Ignora quando o modal de projeto está aberto
    const modalEl = document.getElementById('cdProjModal');
    if (modalEl && !modalEl.hidden) return;

    const now = Date.now();
    if (now - lastWheelTime < WHEEL_COOLDOWN) return;
    if (isTransitioning) return;

    // Ignorar se o alvo é um campo de texto ou elemento scrollável
    if (e.target.tagName === 'TEXTAREA' || e.target.tagName === 'INPUT') return;
    if (e.target.closest && e.target.closest('.cd-gallery__tabs')) return;

    if (e.deltaY > 30) {
      lastWheelTime = now;
      goToScene(activeScene + 1, 1);
    } else if (e.deltaY < -30) {
      lastWheelTime = now;
      goToScene(activeScene - 1, -1);
    }
  }, { passive: true });


  // ===================================================================
  // 10c. NAVEGAÇÃO POR TOUCH / SWIPE (Mobile)
  // ===================================================================
  let touchStartY = 0;
  let touchStartX = 0;
  let touchActive = false;

  document.addEventListener('touchstart', (e) => {
    if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
    touchStartY = e.touches[0].clientY;
    touchStartX = e.touches[0].clientX;
    touchActive = true;
  }, { passive: true });

  document.addEventListener('touchend', (e) => {
    if (!touchActive) return;
    touchActive = false;
    if (isTransitioning) return;

    const touchEndY = e.changedTouches[0].clientY;
    const touchEndX = e.changedTouches[0].clientX;
    const diffY = touchStartY - touchEndY;
    const diffX = touchStartX - touchEndX;

    // Só aceita swipes verticais com pelo menos 50px
    if (Math.abs(diffY) < 50) return;
    if (Math.abs(diffX) > Math.abs(diffY)) return; // swipe horizontal ignorado

    if (diffY > 0) {
      goToScene(activeScene + 1, 1);
    } else {
      goToScene(activeScene - 1, -1);
    }
  }, { passive: true });


  // ===================================================================
  // 11. ANIMAÇÕES DE ENTRADA GSAP (Cenas de conteúdo)
  // ===================================================================
  function animateSceneIn(sceneEl) {
    if (typeof gsap === 'undefined' || prefersReducedMotion || !sceneEl) return;

    const panels = sceneEl.querySelectorAll('.cd-panel__meta, .cd-panel__title, .cd-about__text, .cd-cred, .cd-skill, .cd-triad-item, .cd-timeline__event, .cd-lang, .cd-interest, .cd-vision__quote, .cd-contact__title, .cd-channel, .cd-form__row');

    if (panels.length > 0) {
      gsap.fromTo(panels,
        { opacity: 0, y: 24 },
        {
          opacity: 1,
          y: 0,
          duration: 0.6,
          stagger: 0.08,
          ease: 'power2.out',
          delay: 0.2
        }
      );
    }
  }

  // Observar mudanças de cena para animar
  const sceneObserver = new MutationObserver((mutations) => {
    mutations.forEach((mutation) => {
      if (mutation.target.classList.contains('cd-scene--active')) {
        animateSceneIn(mutation.target);
      }
    });
  });

  scenes.forEach((s) => {
    sceneObserver.observe(s, { attributes: true, attributeFilter: ['class'] });
  });


  // ===================================================================
  // 12. SHIMMER DO NOME (após animações CSS terminam)
  // ===================================================================
  const heroNameEl = document.getElementById('cdHeroName');
  if (heroNameEl && !prefersReducedMotion && typeof gsap !== 'undefined') {
    // Adiciona shimmer periódico via GSAP após as letras aparecerem
    setTimeout(() => {
      const letters = heroNameEl.querySelectorAll('span');
      function shimmerLoop() {
        gsap.fromTo(letters,
          { backgroundPosition: '0% 50%' },
          {
            backgroundPosition: '200% 50%',
            duration: 2,
            stagger: 0.05,
            ease: 'none',
            repeat: 0,
            onComplete: () => {
              setTimeout(shimmerLoop, 4000);
            }
          }
        );
      }
      setTimeout(shimmerLoop, 3500);
    }, 100);
  }
}); // DOMContentLoaded
