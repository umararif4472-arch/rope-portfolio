/**
 * RopeSim — a tiny verlet rope simulation (no physics engine needed).
 *
 * HOW IT WORKS (beginner version):
 *  - The rope is a chain of points. Each frame, every point remembers where
 *    it was, falls a little under gravity, and then we pull neighbouring
 *    points back to their correct distance a few times ("constraints").
 *  - Point 0 is pinned to the anchor at the top of the screen.
 *  - The LAST point is where the character hangs.
 *  - `targetLength` controls how long the rope wants to be. We ease the
 *    real length toward it, so you can SEE the rope stretch and shorten
 *    when the character travels between sections.
 *
 * We chose custom verlet over @react-three/rapier / cannon-es on purpose:
 * one rope + one character does not need a physics engine — this is ~100
 * lines, zero extra bundle weight, and it never fights React's render loop.
 */
import * as THREE from 'three';
import { ROPE } from '../config/character';

export class RopeSim {
  points: THREE.Vector3[] = [];
  prev: THREE.Vector3[] = [];
  /** Current total rope length (eased toward targetLength every step). */
  length: number;
  /** The length we are easing toward — set this to move the character. */
  targetLength: number;
  /** World position of the pinned top end. */
  anchor = new THREE.Vector3();
  /**
   * Desired SIDEWAYS OFFSET of the free (character) end, in world units.
   * The rope is hard-locked to hang straight down from the anchor (see the
   * X-lock at the end of step()); this offset is the ONE allowed sideways
   * movement — a deliberate micro-sway of a couple of hundredths of a unit.
   * Points nearer the anchor get proportionally less offset, so the rope
   * stays an almost-straight vertical line that leans very slightly.
   */
  swayOffsetX = 0;
  /**
   * Damping to use for the next step. RopeCharacter lowers this while the
   * character is travelling (ROPE.motionDamping) so glides are dead-calm,
   * and restores ROPE.damping when he is hanging still.
   */
  motionDamping: number = ROPE.damping;

  constructor(anchor: THREE.Vector3, initialLength: number) {
    this.anchor.copy(anchor);
    this.length = initialLength;
    this.targetLength = initialLength;
    for (let i = 0; i <= ROPE.segments; i++) {
      const p = anchor
        .clone()
        .add(new THREE.Vector3(0, -(initialLength * i) / ROPE.segments, 0));
      this.points.push(p);
      this.prev.push(p.clone());
    }
  }

  setAnchor(anchor: THREE.Vector3) {
    this.anchor.copy(anchor);
    this.points[0].copy(anchor);
    this.prev[0].copy(anchor);
  }

  step(dt: number) {
    // Ease the rope length toward its target → visible stretch/shrink.
    this.length += (this.targetLength - this.length) * Math.min(1, dt * ROPE.lengthEase);
    const segLen = this.length / ROPE.segments;
    const gravityStep = ROPE.gravity * dt * dt;

    // Verlet integration: newPos = pos + (pos - prevPos) + acceleration.
    // Velocity is damped each step (motionDamping — extra-strong while he
    // is travelling), and hard-clamped to ROPE.maxPointSpeed so no point
    // can ever whip across the screen.
    const maxDisp = ROPE.maxPointSpeed * dt; // max distance one step may move
    for (let i = 1; i < this.points.length; i++) {
      const p = this.points[i];
      const pr = this.prev[i];
      let vx = (p.x - pr.x) * this.motionDamping;
      let vy = (p.y - pr.y) * this.motionDamping;
      let vz = (p.z - pr.z) * this.motionDamping;
      const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);
      if (speed > maxDisp) {
        const s = maxDisp / speed;
        vx *= s;
        vy *= s;
        vz *= s;
      }
      pr.copy(p);
      p.x += vx;
      p.y += vy + gravityStep;
      p.z += vz;
    }
    this.points[0].copy(this.anchor);

    // Constraint passes: keep every segment at segLen.
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (let n = 0; n < ROPE.iterations; n++) {
      for (let i = 0; i < ROPE.segments; i++) {
        a.copy(this.points[i]);
        b.copy(this.points[i + 1]);
        const diff = b.sub(a);
        const dist = Math.max(diff.length(), 0.0001);
        const offset = diff.multiplyScalar((dist - segLen) / dist);
        if (i === 0) {
          this.points[i + 1].add(offset.multiplyScalar(-1));
        } else {
          this.points[i].add(offset.clone().multiplyScalar(0.5));
          this.points[i + 1].add(offset.multiplyScalar(-0.5));
        }
      }
      this.points[0].copy(this.anchor);
    }

    // X-LOCK (fix pass 2 — "don't move anywhere, just go down with me"):
    // pull every point back toward the straight vertical line below the
    // anchor. Both the position AND the previous position are corrected,
    // so no sideways velocity can survive either. The only sideways
    // position allowed is the deliberate micro-sway: swayOffsetX, scaled
    // by depth so the rope leans as one nearly-straight line and the
    // character (the last point) gets the full (tiny) offset.
    const last = this.points.length - 1;
    for (let i = 1; i <= last; i++) {
      const w = i / last;
      const desiredX = this.anchor.x + this.swayOffsetX * w;
      const p = this.points[i];
      const pr = this.prev[i];
      p.x += (desiredX - p.x) * ROPE.xLock;
      pr.x += (desiredX - pr.x) * ROPE.xLock;
      p.z += (0 - p.z) * ROPE.xLock;
      pr.z += (0 - pr.z) * ROPE.xLock;
    }
    this.points[0].copy(this.anchor);
  }

  /** Position of the character (last rope point). */
  get endPoint() {
    return this.points[this.points.length - 1];
  }

  /** Swing angle of the bottom segment, for tilting the character. */
  get bottomAngle() {
    const last = this.points[this.points.length - 1];
    const before = this.points[this.points.length - 2];
    return Math.atan2(last.x - before.x, -(last.y - before.y));
  }
}
