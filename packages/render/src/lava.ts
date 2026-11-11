import * as THREE from 'three';
import { Tile, type Arena } from '@overboom/core';

/** Tiefe der Lavabecken unter dem Boden */
const TIEFE = 0.22;
const BLASEN = 28;

/**
 * Lavabecken für den neuen Look: abgesenkte Fläche mit fließender, pixeliger Lava
 * (Krustenschollen, glühende Risse, heiße Adern), Steinrand mit Glutschein und
 * aufsteigende Blasen, die platzen. Alles in einem Shader plus einem kleinen Instanz-Pool.
 */
export class LavaBecken {
  readonly group = new THREE.Group();
  private mat: THREE.ShaderMaterial;
  private randMat: THREE.ShaderMaterial;
  private blasen: THREE.InstancedMesh | null = null;
  private orte: [number, number][] = [];
  private zustand: { x: number; z: number; t: number; dauer: number; groesse: number }[] = [];
  private m = new THREE.Matrix4();

  constructor() {
    const zeit = { value: 0 };
    this.mat = new THREE.ShaderMaterial({
      uniforms: { uZeit: zeit },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        uniform float uZeit; varying vec3 vW;
        vec2 h2(vec2 p) { p = vec2(dot(p, vec2(127.1, 311.7)), dot(p, vec2(269.5, 183.3))); return fract(sin(p) * 43758.5453); }
        float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        float rausch(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          return mix(mix(h1(i), h1(i + vec2(1, 0)), f.x), mix(h1(i + vec2(0, 1)), h1(i + vec2(1, 1)), f.x), f.y); }
        float fbm(vec2 p) { float s = 0.0, a = 0.5; for (int i = 0; i < 4; i++) { s += rausch(p) * a; p *= 2.03; a *= 0.5; } return s; }
        // Abstand zur nächsten Zellgrenze (Voronoi): kleine Werte = Riss zwischen zwei Schollen
        float zellen(vec2 p, float t) {
          vec2 i = floor(p), f = fract(p); float d1 = 8.0, d2 = 8.0;
          for (int y = -1; y <= 1; y++) for (int x = -1; x <= 1; x++) {
            vec2 g = vec2(float(x), float(y)); vec2 o = h2(i + g);
            o = 0.5 + 0.4 * sin(t * 0.35 + 6.2831 * o);
            float d = length(g + o - f);
            if (d < d1) { d2 = d1; d1 = d; } else if (d < d2) d2 = d;
          }
          return d2 - d1;
        }
        void main(){
          // auf 16 Pixel pro Kachel rastern: passt zum Voxel-Look des Bodens
          vec2 p = floor(vW.xz * 16.0) / 16.0;
          float t = uZeit;
          // Strömung: Koordinaten langsam verzerren
          vec2 q = p * 0.9 + vec2(fbm(p * 0.6 + t * 0.06), fbm(p * 0.6 - t * 0.05 + 3.7)) * 1.4;
          float riss = zellen(q * 1.3, t);
          float adern = fbm(q * 2.2 + t * 0.15);
          // flüssige Seen zwischen den Schollen: große, langsam wandernde Flächen
          float see = smoothstep(0.5, 0.68, fbm(q * 0.7 + vec2(t * 0.04, -t * 0.03)));
          // Hitze: breite Risse, Seen, pulsierende Adern
          float hitze = smoothstep(0.42, 0.04, riss);
          hitze = max(hitze, see * 0.9);
          hitze = max(hitze, smoothstep(0.64, 0.9, adern) * 0.6);
          hitze *= 0.85 + 0.15 * sin(t * 2.2 + adern * 8.0 + p.x * 1.7);
          hitze = clamp(hitze, 0.0, 1.0);
          // Kruste: dunkle Schollen, am Rand rot angeglüht
          float rand = smoothstep(0.7, 0.2, riss);
          vec3 kruste = mix(vec3(0.07, 0.02, 0.015), vec3(0.22, 0.05, 0.02), fbm(q * 4.0));
          kruste += vec3(0.35, 0.06, 0.0) * rand * 0.6;
          // Glut: tiefrot → orange → gelb, nur ganz heiße Stellen fast weiß
          vec3 glut = mix(vec3(0.75, 0.10, 0.02), vec3(1.0, 0.38, 0.05), smoothstep(0.25, 0.65, hitze));
          glut = mix(glut, vec3(1.0, 0.72, 0.22), smoothstep(0.72, 0.95, hitze));
          glut = mix(glut, vec3(1.0, 0.95, 0.75), smoothstep(0.97, 1.0, hitze));
          vec3 c = mix(kruste * 1.6, glut * 2.6, smoothstep(0.12, 0.45, hitze));
          c += vec3(0.25, 0.05, 0.0);  // Grundglühen auch auf der Kruste
          gl_FragColor = vec4(c, 1.0);
        }`
    });
    this.randMat = new THREE.ShaderMaterial({
      uniforms: { uZeit: zeit },
      vertexShader: 'varying vec3 vW; void main(){ vec4 w = modelMatrix * vec4(position, 1.0); vW = w.xyz; gl_Position = projectionMatrix * viewMatrix * w; }',
      fragmentShader: `
        uniform float uZeit; varying vec3 vW;
        float h1(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }
        void main(){
          // Steinwand des Beckens: unten glühend angestrahlt, oben dunkler Fels in Voxel-Stufen
          vec2 px = floor(vec2(vW.x + vW.z, vW.y) * 16.0);
          float n = h1(px);
          float tief = clamp(-vW.y / ${TIEFE.toFixed(2)}, 0.0, 1.0);
          vec3 fels = mix(vec3(0.16, 0.10, 0.08), vec3(0.24, 0.15, 0.11), n);
          vec3 schein = vec3(1.0, 0.38, 0.08) * pow(tief, 1.5) * (2.6 + 0.4 * sin(uZeit * 2.0 + vW.x));
          gl_FragColor = vec4(fels + schein, 1.0);
        }`
    });
  }

  /** Becken für eine Arena bauen; gibt false zurück, wenn es keine Lava gibt */
  build(a: Arena): boolean {
    this.group.clear();
    this.orte = [];
    const S = a.size;
    const lava = (x: number, z: number) => x >= 0 && z >= 0 && x < S && z < S && a.tile(x, z) === Tile.Lava;
    const flaeche: number[] = [], rand: number[] = [];
    const y = -TIEFE;
    for (let z = 0; z < S; z++) for (let x = 0; x < S; x++) {
      if (!lava(x, z)) continue;
      this.orte.push([x, z]);
      flaeche.push(x, y, z, x, y, z + 1, x + 1, y, z, x + 1, y, z, x, y, z + 1, x + 1, y, z + 1);
      // Wände dort, wo kein Lavafeld angrenzt (nach innen zeigend)
      const wand = (x0: number, z0: number, x1: number, z1: number) => rand.push(x0, 0, z0, x1, 0, z1, x0, y, z0, x1, 0, z1, x1, y, z1, x0, y, z0);
      if (!lava(x, z - 1)) wand(x + 1, z, x, z);
      if (!lava(x, z + 1)) wand(x, z + 1, x + 1, z + 1);
      if (!lava(x - 1, z)) wand(x, z, x, z + 1);
      if (!lava(x + 1, z)) wand(x + 1, z + 1, x + 1, z);
    }
    if (!this.orte.length) return false;
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(flaeche, 3));
    const flaecheMesh = new THREE.Mesh(geo, this.mat);
    this.group.add(flaecheMesh);
    const rg = new THREE.BufferGeometry();
    rg.setAttribute('position', new THREE.Float32BufferAttribute(rand, 3));
    const randMesh = new THREE.Mesh(rg, this.randMat);
    this.randMat.side = THREE.DoubleSide;
    this.group.add(randMesh);

    // warmes Licht über den Becken: höchstens 6, verteilt über die Lavafelder
    const schritt = Math.max(1, Math.floor(this.orte.length / 6));
    for (let i = 0; i < this.orte.length; i += schritt) {
      const [lx, lz] = this.orte[i];
      const l = new THREE.PointLight('#ff6a1a', 7, 5.5, 1.6);
      l.position.set(lx + 0.5, 0.6, lz + 0.5);
      this.group.add(l);
    }
    // Blasen: kleine glühende Würfel, die aufsteigen, wachsen und platzen
    const bg = new THREE.BoxGeometry(1, 1, 1);
    const bm = new THREE.MeshBasicMaterial({ color: new THREE.Color(1.0, 0.42, 0.08).multiplyScalar(2.6), toneMapped: false });
    this.blasen = new THREE.InstancedMesh(bg, bm, BLASEN);
    this.blasen.frustumCulled = false;
    this.group.add(this.blasen);
    this.zustand = Array.from({ length: BLASEN }, (_, i) => this.neueBlase(i * 0.37 % 1.5));
    return true;
  }

  private neueBlase(verzug: number) {
    const [x, z] = this.orte[Math.floor(Math.random() * this.orte.length)];
    return { x: x + 0.15 + Math.random() * 0.7, z: z + 0.15 + Math.random() * 0.7, t: -verzug, dauer: 0.8 + Math.random() * 1.2, groesse: 0.05 + Math.random() * 0.09 };
  }

  update(time: number, dt: number): void {
    this.mat.uniforms.uZeit.value = time;
    if (!this.blasen) return;
    for (let i = 0; i < this.zustand.length; i++) {
      const b = this.zustand[i];
      b.t += dt;
      if (b.t > b.dauer) { this.zustand[i] = this.neueBlase(Math.random() * 1.2); }
      const k = Math.max(0, b.t) / b.dauer;
      // wächst langsam, steigt kaum, platzt am Ende schnell
      const s = b.t < 0 ? 0 : b.groesse * (k < 0.85 ? 0.4 + k * 0.8 : (1 - k) / 0.15 * 1.08);
      this.m.makeScale(s, s * 0.8, s).setPosition(b.x, -TIEFE + s * 0.3, b.z);
      this.blasen.setMatrixAt(i, this.m);
    }
    this.blasen.instanceMatrix.needsUpdate = true;
  }
}
