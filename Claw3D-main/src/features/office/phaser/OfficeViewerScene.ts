import type Phaser from "phaser";

import type { OfficeSceneBridge } from "@/features/office/phaser/OfficeSceneBridge";
import { AgentEffectsSystem } from "@/features/office/phaser/systems/AgentEffectsSystem";
import { AmbienceSystem } from "@/features/office/phaser/systems/AmbienceSystem";
import { LightingSystem } from "@/features/office/phaser/systems/LightingSystem";

export const createOfficeViewerScene = (params: {
  PhaserLib: typeof import("phaser");
  bridge: OfficeSceneBridge;
}): Phaser.Scene => {
  const { PhaserLib, bridge } = params;

  class ViewerScene extends PhaserLib.Scene {
    private unsubscribe: (() => void) | null = null;
    private lighting: LightingSystem | null = null;
    private ambience: AmbienceSystem | null = null;
    private agents: AgentEffectsSystem | null = null;
    private floor: Phaser.GameObjects.Graphics | null = null;
    private staticLayer: Phaser.GameObjects.Group | null = null;
    private debugGfx: Phaser.GameObjects.Graphics | null = null;
    private metricsText: Phaser.GameObjects.Text | null = null;
    private startedAt = 0;

    private createTextureGraphics() {
      const gfx = this.add.graphics();
      gfx.setVisible(false);
      return gfx;
    }

    constructor() {
      super("office-viewer-scene");
    }

    preload() {
      this.load.image("office_bg", "/office-assets/backgrounds/office-bg.png");
    }

    create() {
      this.startedAt = this.time.now;

      // Generate procedural textures
      this.generateTextures();

      this.floor = this.add.graphics();
      this.floor.setDepth(100);
      this.staticLayer = this.add.group();
      this.debugGfx = this.add.graphics();
      this.debugGfx.setDepth(20_000);
      this.lighting = new LightingSystem({ scene: this });
      this.ambience = new AmbienceSystem({ scene: this });
      this.agents = new AgentEffectsSystem({ scene: this });
      this.metricsText = this.add.text(12, 12, "", {
        fontFamily: "var(--font-mono)",
        fontSize: "10px",
        color: "#d8e9ff",
        backgroundColor: "rgba(0,0,0,0.35)",
        padding: { left: 6, right: 6, top: 4, bottom: 4 },
      });
      this.metricsText.setScrollFactor(0);
      this.metricsText.setDepth(60_000);
      this.unsubscribe = bridge.subscribe(() => {
        this.renderStatic();
      });
      this.renderStatic();
    }

    update(_: number, delta: number) {
      const state = bridge.getState();
      const elapsedS = (this.time.now - this.startedAt) / 1000;

      this.ambience?.update(
        state.map.ambienceEmitters ?? [],
        state.map.zones,
        state.runtime.enableAmbience,
      );
      this.lighting?.update(
        state.runtime.enableLighting ? (state.map.lights ?? []) : [],
        state.map.lightingOverlay?.baseDarkness ?? 0,
        elapsedS,
      );
      this.agents?.update({
        map: state.map,
        agents: state.presence,
        elapsedMs: delta,
        thoughtBubblesEnabled:
          state.runtime.enableThoughtBubbles &&
          (state.map.theme?.enableThoughtBubbles ?? true),
      });

      if (state.debug.showMetrics && this.metricsText) {
        const fps = this.game.loop.actualFps;
        const textureCount = this.textures.list
          ? Object.keys(this.textures.list).length
          : 0;
        const memory = (
          performance as Performance & { memory?: { usedJSHeapSize: number } }
        ).memory;
        const usedMb = memory
          ? Math.round(memory.usedJSHeapSize / 1024 / 1024)
          : null;
        this.metricsText.setVisible(true);
        this.metricsText.setText(
          usedMb === null
            ? `fps ${fps.toFixed(1)}  textures ${textureCount}`
            : `fps ${fps.toFixed(1)}  textures ${textureCount}  heapMb ${usedMb}`,
        );
      } else if (this.metricsText) {
        this.metricsText.setVisible(false);
      }
    }

    shutdown() {
      this.unsubscribe?.();
      this.unsubscribe = null;
      this.floor?.destroy();
      this.floor = null;
      this.staticLayer?.destroy(true, true);
      this.staticLayer = null;
      this.debugGfx?.destroy();
      this.debugGfx = null;
      this.metricsText?.destroy();
      this.metricsText = null;
      this.lighting?.destroy();
      this.lighting = null;
      this.ambience?.destroy();
      this.ambience = null;
      this.agents?.destroy();
      this.agents = null;
    }

    private generateTextures() {
      // Desk texture (brown rectangle with wood grain hint)
      if (!this.textures.exists("desk_modern")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x8b5a2b, 1);
        gfx.fillRect(0, 0, 64, 32);
        gfx.fillStyle(0x6b4226, 1);
        gfx.fillRect(0, 30, 64, 2); // shadow/edge
        gfx.generateTexture("desk_modern", 64, 32);
        gfx.destroy();
      }

      // Meeting table texture (large oval/rect)
      if (!this.textures.exists("meeting_table")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x3e2723, 1);
        gfx.fillRoundedRect(0, 0, 160, 80, 10);
        gfx.fillStyle(0x5d4037, 1);
        gfx.fillRoundedRect(4, 4, 152, 72, 6); // inset
        gfx.generateTexture("meeting_table", 160, 80);
        gfx.destroy();
      }

      // Floor tile (subtle grid)
      if (!this.textures.exists("floor_tile")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x2a2a2a, 1);
        gfx.fillRect(0, 0, 32, 32);
        gfx.lineStyle(1, 0x333333, 1);
        gfx.strokeRect(0, 0, 32, 32);
        gfx.generateTexture("floor_tile", 32, 32);
        gfx.destroy();
      }

      // Plant (green circle/cluster)
      if (!this.textures.exists("plant_potted")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x2e7d32, 1);
        gfx.fillCircle(16, 16, 12);
        gfx.fillStyle(0x4caf50, 1);
        gfx.fillCircle(14, 14, 8);
        gfx.generateTexture("plant_potted", 32, 32);
        gfx.destroy();
      }

      // Wall (solid block)
      if (!this.textures.exists("wall_block")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x546e7a, 1);
        gfx.fillRect(0, 0, 32, 32);
        gfx.lineStyle(2, 0x37474f, 1);
        gfx.strokeRect(0, 0, 32, 32);
        gfx.generateTexture("wall_block", 32, 32);
        gfx.destroy();
      }

      // Arcade machine (glowy screen)
      if (!this.textures.exists("arcade_machine")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x212121, 1);
        gfx.fillRect(0, 0, 32, 48);
        gfx.fillStyle(0x00e5ff, 1); // Screen
        gfx.fillRect(4, 8, 24, 20);
        gfx.fillStyle(0xff1744, 1); // Buttons
        gfx.fillCircle(8, 36, 2);
        gfx.fillCircle(16, 36, 2);
        gfx.generateTexture("arcade_machine", 32, 48);
        gfx.destroy();
      }

      // Coffee station (counter with machine)
      if (!this.textures.exists("coffee_station")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x616161, 1); // Counter
        gfx.fillRect(0, 0, 64, 32);
        gfx.fillStyle(0x212121, 1); // Machine
        gfx.fillRect(8, 4, 16, 20);
        gfx.fillStyle(0xffeb3b, 1); // Light
        gfx.fillCircle(12, 8, 1);
        gfx.generateTexture("coffee_station", 64, 32);
        gfx.destroy();
      }

      // TV Wall
      if (!this.textures.exists("tv_wall")) {
        const gfx = this.createTextureGraphics();
        gfx.fillStyle(0x000000, 1);
        gfx.fillRect(0, 0, 80, 10);
        gfx.generateTexture("tv_wall", 80, 10);
        gfx.destroy();
      }
    }

    private renderStatic() {
      const state = bridge.getState();
      if (!this.floor || !this.debugGfx || !this.staticLayer) return;

      this.floor.clear();
      this.debugGfx.clear();
      this.staticLayer.clear(true, true); // Clear existing sprites

      this.cameras.main.setBackgroundColor(state.map.canvas.backgroundColor);

      for (const layer of state.map.layers) {
        if (!layer.visible) continue;
        const objects = state.map.objects
          .filter((entry) => entry.layerId === layer.id)
          .sort((left, right) => left.zIndex - right.zIndex);
        for (const object of objects) {
          if (this.textures.exists(object.assetId)) {
            const sprite = this.add.sprite(object.x, object.y, object.assetId);
            sprite.setDepth(object.zIndex);
            sprite.setAngle(object.rotation);
            sprite.setFlip(object.flipX, object.flipY);
            // If the sprite is on the floor layer, tint it slightly to recede
            if (layer.id === "floor") {
              sprite.setTint(0xdddddd);
            }
          } else {
            // Fallback for missing assets
            this.floor.fillStyle(0x4679ab, layer.opacity);
            this.floor.fillRect(object.x - 16, object.y - 16, 32, 32);
          }
        }
      }

      if (state.debug.showZones) {
        this.debugGfx.lineStyle(1, 0x63f2ce, 0.7);
        for (const zone of state.map.zones) {
          const points = zone.shape.points;
          if (points.length < 2) continue;
          this.debugGfx.beginPath();
          this.debugGfx.moveTo(points[0].x, points[0].y);
          for (let index = 1; index < points.length; index += 1) {
            this.debugGfx.lineTo(points[index].x, points[index].y);
          }
          this.debugGfx.closePath();
          this.debugGfx.strokePath();
        }
      }

      if (state.debug.showAnchors) {
        this.debugGfx.fillStyle(0xe9d875, 0.9);
        for (const point of state.map.interactionPoints ?? []) {
          this.debugGfx.fillCircle(point.x, point.y, 4);
        }
      }
      if (state.debug.showEmitterBounds) {
        this.debugGfx.lineStyle(1, 0xe9b7ff, 0.7);
        for (const emitter of state.map.ambienceEmitters ?? []) {
          const zone = state.map.zones.find(
            (entry) => entry.id === emitter.zoneId,
          );
          if (!zone || zone.shape.points.length < 2) continue;
          this.debugGfx.beginPath();
          this.debugGfx.moveTo(zone.shape.points[0].x, zone.shape.points[0].y);
          for (let index = 1; index < zone.shape.points.length; index += 1) {
            this.debugGfx.lineTo(
              zone.shape.points[index].x,
              zone.shape.points[index].y,
            );
          }
          this.debugGfx.closePath();
          this.debugGfx.strokePath();
        }
      }
      if (state.debug.showLightBounds) {
        this.debugGfx.lineStyle(1, 0xffdb6d, 0.6);
        for (const light of state.map.lights ?? []) {
          this.debugGfx.strokeCircle(light.x, light.y, light.radius);
        }
      }
    }
  }

  return new ViewerScene();
};
