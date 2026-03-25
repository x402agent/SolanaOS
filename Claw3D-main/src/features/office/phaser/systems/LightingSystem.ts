import type Phaser from "phaser";

import type { OfficeLightObject } from "@/lib/office/schema";

type LightingSystemParams = {
  scene: Phaser.Scene;
};

export class LightingSystem {
  private readonly scene: Phaser.Scene;
  private readonly darknessGraphics: Phaser.GameObjects.Graphics;
  private readonly glowGraphics: Phaser.GameObjects.Graphics;
  private readonly lightIntensity = new Map<string, number>();

  constructor(params: LightingSystemParams) {
    this.scene = params.scene;
    this.darknessGraphics = this.scene.add.graphics();
    this.darknessGraphics.setDepth(50_000);
    this.darknessGraphics.setScrollFactor(0);
    this.glowGraphics = this.scene.add.graphics();
    this.glowGraphics.setDepth(49_900);
    this.glowGraphics.setScrollFactor(0);
  }

  update(lights: OfficeLightObject[], overlayDarkness: number, elapsedS: number) {
    this.darknessGraphics.clear();
    this.glowGraphics.clear();
    const darkness = Math.min(Math.max(overlayDarkness, 0), 0.65);
    this.darknessGraphics.setBlendMode("NORMAL");
    this.darknessGraphics.fillStyle(0x000000, darkness);
    this.darknessGraphics.fillRect(
      0,
      0,
      this.scene.scale.width,
      this.scene.scale.height
    );
    this.glowGraphics.setBlendMode("ADD");

    for (const light of lights) {
      const intensity = this.resolveAnimatedIntensity(light, elapsedS);
      this.lightIntensity.set(light.id, intensity);
      const alpha = Math.min(Math.max(intensity, 0), 1) * 0.18;
      this.glowGraphics.fillStyle(0xf8f2ce, alpha);
      this.glowGraphics.fillCircle(light.x, light.y, light.radius);
    }
  }

  getIntensity(lightId: string) {
    return this.lightIntensity.get(lightId) ?? 0;
  }

  destroy() {
    this.darknessGraphics.destroy();
    this.glowGraphics.destroy();
  }

  private resolveAnimatedIntensity(light: OfficeLightObject, elapsedS: number) {
    const base = light.baseIntensity;
    if (light.animationPreset === "steady") return base;
    if (light.animationPreset === "soft_flicker") {
      const speed = light.flicker?.speed ?? 1.2;
      const amplitude = light.flicker?.amplitude ?? 0.08;
      return base + Math.sin(elapsedS * speed * 3.2) * amplitude;
    }
    if (light.animationPreset === "breathing_pulse") {
      return base + Math.sin(elapsedS * 1.7) * 0.1;
    }
    return base + (Math.sin(elapsedS * 7.5) > 0 ? 0.09 : -0.07);
  }
}
