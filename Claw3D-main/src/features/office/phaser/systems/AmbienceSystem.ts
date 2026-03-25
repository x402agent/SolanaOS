import type Phaser from "phaser";

import type { OfficeAmbienceEmitter, OfficeZone } from "@/lib/office/schema";

type AmbienceSystemParams = {
  scene: Phaser.Scene;
};

type ZoneBounds = {
  x: number;
  y: number;
  w: number;
  h: number;
};

const resolveZoneBounds = (zone: OfficeZone): ZoneBounds => {
  const points = zone.shape.points;
  if (points.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  const xs = points.map((point) => point.x);
  const ys = points.map((point) => point.y);
  const minX = Math.min(...xs);
  const maxX = Math.max(...xs);
  const minY = Math.min(...ys);
  const maxY = Math.max(...ys);
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
};

export class AmbienceSystem {
  private readonly scene: Phaser.Scene;
  private readonly particles = new Map<string, Phaser.GameObjects.Particles.ParticleEmitter>();

  constructor(params: AmbienceSystemParams) {
    this.scene = params.scene;
  }

  update(emitters: OfficeAmbienceEmitter[], zones: OfficeZone[], enabled: boolean) {
    const keep = new Set<string>();
    const zonesById = new Map(zones.map((zone) => [zone.id, zone]));
    for (const emitterDef of emitters) {
      if (!enabled || !emitterDef.enabled) continue;
      const zone = zonesById.get(emitterDef.zoneId);
      if (!zone) continue;
      keep.add(emitterDef.id);
      if (this.particles.has(emitterDef.id)) continue;

      const texture = this.resolveTexture(emitterDef.preset);
      if (!this.scene.textures.exists(texture)) {
        const gfx = this.scene.add.graphics();
        gfx.fillStyle(0xffffff, 0.8);
        gfx.fillCircle(4, 4, 4);
        gfx.generateTexture(texture, 8, 8);
        gfx.destroy();
      }
      const bounds = resolveZoneBounds(zone);
      const emitter = this.scene.add.particles(0, 0, texture, {
        x: { min: bounds.x, max: bounds.x + Math.max(bounds.w, 1) },
        y: { min: bounds.y, max: bounds.y + Math.max(bounds.h, 1) },
        quantity: 1,
        frequency: Math.max(30, Math.floor(1000 / Math.max(emitterDef.spawnRate, 0.01))),
        lifespan: 3000,
        alpha: { start: 0.0, end: 0.35 },
        speedY: { min: -8, max: -2 },
        speedX: { min: -3, max: 3 },
        scale: { start: 0.2, end: 0.05 },
        maxParticles: Math.max(1, emitterDef.maxParticles),
      });
      emitter.setDepth(3_000);
      this.particles.set(emitterDef.id, emitter);
    }

    for (const [key, emitter] of this.particles) {
      if (keep.has(key)) continue;
      this.destroyEmitter(emitter);
      this.particles.delete(key);
    }
  }

  destroy() {
    for (const emitter of this.particles.values()) {
      this.destroyEmitter(emitter);
    }
    this.particles.clear();
  }

  private destroyEmitter(emitter: Phaser.GameObjects.Particles.ParticleEmitter) {
    const unsafe = emitter as unknown as {
      stop: () => void;
      manager?: { destroy: () => void };
    };
    unsafe.stop();
    unsafe.manager?.destroy();
  }

  private resolveTexture(preset: OfficeAmbienceEmitter["preset"]) {
    if (preset === "coffee_steam") return "office-ambience-steam";
    if (preset === "window_dust") return "office-ambience-dust";
    if (preset === "game_sparkle") return "office-ambience-sparkle";
    return "office-ambience-pollen";
  }
}
