import * as THREE from 'three';
import { hash2, type Arena } from '@overboom/core';
import type { Insel } from '@overboom/data';

/** Grafik-Look: „neu“ = volle Auflösung, weiche Schatten, Umgebungsverdeckung, Leuchten, Godrays */
export const LOOK = { neu: false };

/**
 * Atmosphäre für den neuen Look: dunkler Dunst unter der Insel und feiner Staub in der Luft.
 * (Lichtstrahlen kommen aus dem Godray-Durchgang im Renderer, nicht aus Geometrie.)
 */
export class Atmosphaere {
  readonly group = new THREE.Group();
  private zeit = { value: 0 };

  build(a: Arena, pal: Insel['farben']): void {
    this.group.clear();
    const S = a.size, c = S / 2;

    // Dunst unter der Klippe: dunkel, damit der Inselrand nicht ins Schwarze fällt
    const dunst = new THREE.Mesh(new THREE.PlaneGeometry(S * 7, S * 7), new THREE.MeshBasicMaterial({ color: new THREE.Color(pal.nebel).lerp(new THREE.Color(pal.himmel), 0.25), depthWrite: false }));
    dunst.rotation.x = -Math.PI / 2;
    dunst.position.set(c, -7, c);
    dunst.renderOrder = -11;
    this.group.add(dunst);

    // Staub und Glühwürmchen: wenige, langsam treibende Punkte, leuchten leicht
    const N = 160;
    const pos = new Float32Array(N * 3), seed = new Float32Array(N);
    for (let i = 0; i < N; i++) { pos[i * 3] = hash2(i, 0, 90) * S; pos[i * 3 + 1] = 0.3 + hash2(i, 1, 90) * 4; pos[i * 3 + 2] = hash2(i, 2, 90) * S; seed[i] = hash2(i, 3, 90); }
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    pg.setAttribute('seed', new THREE.BufferAttribute(seed, 1));
    const pm = new THREE.ShaderMaterial({
      uniforms: { uZeit: this.zeit, color: { value: new THREE.Color(pal.sonne) } },
      vertexShader: 'attribute float seed; uniform float uZeit; varying float vA; void main(){ vec3 p = position; p.x += sin(uZeit * 0.4 + seed * 20.0) * 0.6; p.y += sin(uZeit * 0.7 + seed * 9.0) * 0.4; p.z += cos(uZeit * 0.3 + seed * 13.0) * 0.6; vA = 0.4 + 0.6 * abs(sin(uZeit * 1.3 + seed * 30.0)); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv; gl_PointSize = (seed > 0.85 ? 6.0 : 2.5); }',
      fragmentShader: 'uniform vec3 color; varying float vA; void main(){ float d = length(gl_PointCoord - 0.5); if (d > 0.5) discard; gl_FragColor = vec4(color * 1.6, (1.0 - d * 2.0) * vA * 0.6); }',
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false
    });
    this.group.add(new THREE.Points(pg, pm));
  }

  update(time: number): void {
    this.zeit.value = time;
  }
}
