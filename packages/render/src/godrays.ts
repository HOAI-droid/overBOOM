import * as THREE from 'three';
import { Pass, FullScreenQuad } from 'three/examples/jsm/postprocessing/Pass.js';

/**
 * Godrays (Lichtschächte): Für jedes Pixel wird der Blickstrahl zwischen Boden (y = 0) und
 * einer Höhe über der Arena in wenigen Schritten abgelaufen und je Schritt in der Schattenkarte
 * der Sonne nachgesehen, ob dort Licht ankommt. Wo Säulen und Mauern das Licht abschirmen,
 * bleibt die Luft dunkel – sichtbare Strahlen entstehen an den Kanten.
 * Läuft in halber Auflösung, 10 Schritte; Kosten: ein kleiner Vollbild-Durchgang.
 */
export class GodrayPass extends Pass {
  private quad: FullScreenQuad;
  private mat: THREE.ShaderMaterial;
  private mix: THREE.ShaderMaterial;
  private mixQuad: FullScreenQuad;
  private rt: THREE.WebGLRenderTarget;
  /** Stärke der Strahlen (0 = aus) */
  staerke = 0.42;

  constructor(private camera: THREE.OrthographicCamera, private sonne: THREE.DirectionalLight) {
    super();
    this.rt = new THREE.WebGLRenderTarget(4, 4, { type: THREE.HalfFloatType, depthBuffer: false });
    this.mat = new THREE.ShaderMaterial({
      uniforms: {
        tShadow: { value: null },
        uShadowMatrix: { value: new THREE.Matrix4() },
        uProjInv: { value: new THREE.Matrix4() },
        uCamWorld: { value: new THREE.Matrix4() },
        uSonne: { value: new THREE.Color('#ffd9a0') },
        uHoehe: { value: 7.0 },
        uZeit: { value: 0 }
      },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        #include <packing>
        uniform sampler2D tShadow; uniform mat4 uShadowMatrix, uProjInv, uCamWorld; uniform vec3 uSonne; uniform float uHoehe, uZeit;
        varying vec2 vUv;
        // weiches 3D-Rauschen (Wertrauschen) für Dunstschwaden
        float h3(vec3 p) { return fract(sin(dot(p, vec3(127.1, 311.7, 74.7))) * 43758.5453); }
        float rausch(vec3 p) {
          vec3 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
          float a = h3(i), b = h3(i + vec3(1,0,0)), c = h3(i + vec3(0,1,0)), d = h3(i + vec3(1,1,0));
          float e = h3(i + vec3(0,0,1)), g = h3(i + vec3(1,0,1)), k = h3(i + vec3(0,1,1)), l = h3(i + vec3(1,1,1));
          return mix(mix(mix(a, b, f.x), mix(c, d, f.x), f.y), mix(mix(e, g, f.x), mix(k, l, f.x), f.y), f.z);
        }
        float licht(vec3 w) {
          vec4 s = uShadowMatrix * vec4(w, 1.0);
          s.xyz /= s.w;
          if (s.x < 0.0 || s.x > 1.0 || s.y < 0.0 || s.y > 1.0) return 1.0;
          float d = unpackRGBAToDepth(texture2D(tShadow, s.xy));
          return s.z - 0.002 < d ? 1.0 : 0.0;
        }
        void main(){
          vec2 ndc = vUv * 2.0 - 1.0;
          vec4 a = uCamWorld * (uProjInv * vec4(ndc, -1.0, 1.0));
          vec4 b = uCamWorld * (uProjInv * vec4(ndc, 1.0, 1.0));
          vec3 o = a.xyz / a.w, e = b.xyz / b.w;
          vec3 dir = normalize(e - o);
          // Strecke des Blickstrahls zwischen y = uHoehe und y = 0
          float t0 = (uHoehe - o.y) / dir.y, t1 = (0.0 - o.y) / dir.y;
          const int N = 10;
          float j = fract(sin(dot(vUv * 913.0, vec2(12.9898, 78.233))) * 43758.5453);
          float sum = 0.0;
          for (int i = 0; i < N; i++) {
            float t = mix(t0, t1, (float(i) + j) / float(N));
            vec3 w = o + dir * t;
            // Dunst in Schwaden, die langsam ziehen; unten dichter als oben
            float n = rausch(w * vec3(0.22, 0.35, 0.22) + vec3(uZeit * 0.05, 0.0, uZeit * 0.03)) * 0.6 + rausch(w * 0.7 + uZeit * 0.08) * 0.4;
            float dichte = smoothstep(0.5, 0.9, n) * (0.4 + 0.6 * (1.0 - w.y / uHoehe));
            sum += licht(w) * dichte;
          }
          float l = sum / float(N);
          gl_FragColor = vec4(uSonne * l, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    this.quad = new FullScreenQuad(this.mat);
    this.mix = new THREE.ShaderMaterial({
      uniforms: { tDiffuse: { value: null }, tRays: { value: null }, uStaerke: { value: 0.5 } },
      vertexShader: 'varying vec2 vUv; void main(){ vUv = uv; gl_Position = vec4(position.xy, 0.0, 1.0); }',
      fragmentShader: `
        uniform sampler2D tDiffuse, tRays; uniform float uStaerke; varying vec2 vUv;
        void main(){
          vec3 c = texture2D(tDiffuse, vUv).rgb;
          // leicht weichgezeichnet lesen, damit die halbe Auflösung nicht auffällt
          vec3 r = texture2D(tRays, vUv).rgb * 0.5 + texture2D(tRays, vUv + vec2(0.002, 0.0)).rgb * 0.25 + texture2D(tRays, vUv - vec2(0.002, 0.0)).rgb * 0.25;
          gl_FragColor = vec4(c + r * uStaerke, 1.0);
        }`,
      depthTest: false, depthWrite: false
    });
    this.mixQuad = new FullScreenQuad(this.mix);
  }

  setSize(w: number, h: number): void {
    this.rt.setSize(Math.max(1, Math.round(w / 2)), Math.max(1, Math.round(h / 2)));
  }

  setSonne(c: THREE.Color): void { this.mat.uniforms.uSonne.value.copy(c); }
  setZeit(t: number): void { this.mat.uniforms.uZeit.value = t; }

  render(renderer: THREE.WebGLRenderer, writeBuffer: THREE.WebGLRenderTarget, readBuffer: THREE.WebGLRenderTarget): void {
    const sh = this.sonne.shadow;
    if (!sh.map || this.staerke <= 0) {
      // ohne Schattenkarte einfach durchreichen
      this.mix.uniforms.tDiffuse.value = readBuffer.texture;
      this.mix.uniforms.uStaerke.value = 0;
    } else {
      const u = this.mat.uniforms;
      u.tShadow.value = sh.map.texture;
      u.uShadowMatrix.value.copy(sh.matrix);
      u.uProjInv.value.copy(this.camera.projectionMatrixInverse);
      u.uCamWorld.value.copy(this.camera.matrixWorld);
      renderer.setRenderTarget(this.rt);
      this.quad.render(renderer);
      this.mix.uniforms.tDiffuse.value = readBuffer.texture;
      this.mix.uniforms.tRays.value = this.rt.texture;
      this.mix.uniforms.uStaerke.value = this.staerke;
    }
    renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
    this.mixQuad.render(renderer);
  }

  dispose(): void { this.rt.dispose(); this.mat.dispose(); this.mix.dispose(); this.quad.dispose(); this.mixQuad.dispose(); }
}
