/**
 * Soul of Meal - Sprite & Asset Renderer
 * Quản lý tải và vẽ sprite animation, map tiles, VFX và card art.
 */

export const CLIP_ROWS = Object.freeze({
  idle: 0,
  walk: 1,
  run: 2,
  attack_a: 3,
  attack_b: 4,
  hit: 5,
  skill_01: 6,
  ultimate_01: 7,
  defeat: 8,
  victory: 9,
});

export class SpriteRenderer {
  constructor({ basePath = "./assets/sprites" } = {}) {
    this.basePath = basePath;
    this.sheets = new Map(); // characterId -> { image, manifest, loaded }
    this.images = new Map(); // key -> Image
    this.loading = new Map();
  }

  /**
   * Tải hình ảnh bất đồng bộ với bộ nhớ đệm
   */
  loadImage(src) {
    if (this.images.has(src)) return Promise.resolve(this.images.get(src));
    if (this.loading.has(src)) return this.loading.get(src);

    if (typeof Image === "undefined") {
      return Promise.resolve(null);
    }

    const promise = new Promise((resolve) => {
      const img = new Image();
      img.onload = () => {
        this.images.set(src, img);
        this.loading.delete(src);
        resolve(img);
      };
      img.onerror = () => {
        this.loading.delete(src);
        resolve(null);
      };
      img.src = src;
    });

    this.loading.set(src, promise);
    return promise;
  }

  /**
   * Đăng ký và nạp sprite sheet kèm manifest cho nhân vật
   */
  async loadCharacter(characterId, imagePath, manifestPath) {
    const fullImgPath = imagePath || `${this.basePath}/${characterId}.png`;
    const fullManPath =
      manifestPath || `${this.basePath}/${characterId}.manifest.json`;

    let manifest = null;
    try {
      if (typeof fetch !== "undefined") {
        const res = await fetch(fullManPath);
        if (res.ok) manifest = await res.json();
      }
    } catch (_) {
      // Bỏ qua lỗi fetch nếu chạy offline/test
    }

    let frames = normalizeAtlasFrames(manifest?.frames);
    const metadataPath =
      manifest?.atlas_metadata ??
      fullImgPath.replace(/\.png([?#].*)?$/i, ".json$1");
    if (
      !frames &&
      manifest?.atlas_metadata &&
      metadataPath !== fullImgPath &&
      typeof fetch !== "undefined"
    ) {
      try {
        const res = await fetch(metadataPath);
        if (res.ok) frames = normalizeAtlasFrames((await res.json())?.frames);
      } catch (_) {
        // Atlas metadata is optional while the legacy sheet is in use.
      }
    }

    const image = await this.loadImage(fullImgPath);
    const entry = {
      characterId,
      image,
      manifest,
      frames,
      loaded: Boolean(image && image.complete && image.naturalWidth > 0),
      frameWidth:
        manifest?.frame_width ?? (characterId.includes("boss") ? 96 : 64),
      frameHeight:
        manifest?.frame_height ?? (characterId.includes("boss") ? 96 : 64),
    };

    this.sheets.set(characterId, entry);
    return entry;
  }

  isLoaded(characterId) {
    const entry = this.sheets.get(characterId);
    return Boolean(
      entry?.image && entry.image.complete && entry.image.naturalWidth > 0,
    );
  }

  /**
   * Vẽ sprite nhân vật theo animation snapshot
   */
  drawSprite(
    ctx,
    characterId,
    animation,
    x,
    y,
    { scale = 1.0, flipX = false, opacity = 1.0, tint = null } = {},
  ) {
    const entry = this.sheets.get(characterId);
    if (
      !entry ||
      !entry.image ||
      !entry.image.complete ||
      entry.image.naturalWidth === 0
    ) {
      return false; // Trả về false để caller vẽ fallback
    }

    const frameId = animation?.frameId;
    const frame = entry.frames?.[frameId];
    if (entry.frames) {
      if (
        !frame ||
        frame.x < 0 ||
        frame.y < 0 ||
        frame.width <= 0 ||
        frame.height <= 0 ||
        frame.x + frame.width > entry.image.naturalWidth ||
        frame.y + frame.height > entry.image.naturalHeight
      )
        return false;

      const anchorX = animation?.anchor?.[0] ?? 0.5;
      const anchorY = animation?.anchor?.[1] ?? 0.9;
      const scaleX = scale;
      const scaleY = scale;
      const logicalWidth = frame.sourceWidth;
      const logicalHeight = frame.sourceHeight;
      const dx = -anchorX * logicalWidth + frame.offsetX;
      const dy = -anchorY * logicalHeight + frame.offsetY;

      ctx.save();
      ctx.translate(x, y);
      if (flipX) ctx.scale(-1, 1);
      if (opacity < 1.0) ctx.globalAlpha = Math.max(0, opacity);
      ctx.drawImage(
        entry.image,
        frame.x,
        frame.y,
        frame.width,
        frame.height,
        dx * scaleX,
        dy * scaleY,
        frame.width * scaleX,
        frame.height * scaleY,
      );
      ctx.restore();
      return true;
    }

    const fw = entry.frameWidth;
    const fh = entry.frameHeight;
    const clipId = animation?.requestedClipId ?? animation?.clipId ?? "idle";
    const row = CLIP_ROWS[clipId] ?? 0;
    const frameIndex = animation?.frameIndex ?? 0;

    // Kích thước sheet
    const maxCols = Math.floor(entry.image.naturalWidth / fw) || 6;
    const col = Math.min(frameIndex, maxCols - 1);

    const sx = col * fw;
    const sy = row * fh;

    // Anchor: mặc định chân giữa [0.5, 0.9]
    const anchorX = animation?.anchor?.[0] ?? 0.5;
    const anchorY = animation?.anchor?.[1] ?? 0.9;

    if (
      ![fw, fh, scale, x, y, anchorX, anchorY].every(Number.isFinite) ||
      fw <= 0 ||
      fh <= 0 ||
      scale <= 0 ||
      sx < 0 ||
      sy < 0 ||
      sx + fw > entry.image.naturalWidth ||
      sy + fh > entry.image.naturalHeight
    )
      return false;

    const dw = fw * scale;
    const dh = fh * scale;
    const dx = -anchorX * dw;
    const dy = -anchorY * dh;

    ctx.save();
    ctx.translate(x, y);
    if (flipX) ctx.scale(-1, 1);
    if (opacity < 1.0) ctx.globalAlpha = Math.max(0, opacity);

    ctx.drawImage(entry.image, sx, sy, fw, fh, dx, dy, dw, dh);

    ctx.restore();
    return true;
  }

  /**
   * Vẽ hình ảnh tĩnh đơn lẻ (icon, map tile, prop)
   */
  drawImage(ctx, imageKey, x, y, width, height) {
    const img = this.images.get(imageKey);
    if (!img || !img.complete) return false;
    if (width !== undefined && height !== undefined) {
      ctx.drawImage(img, x, y, width, height);
    } else {
      ctx.drawImage(img, x, y);
    }
    return true;
  }
}

export const spriteRenderer = new SpriteRenderer();

function normalizeAtlasFrames(frames) {
  if (!frames || typeof frames !== "object" || Array.isArray(frames))
    return null;
  const normalized = {};
  for (const [frameId, metadata] of Object.entries(frames)) {
    const rect = metadata?.frame ?? metadata;
    if (!rect || ![rect.x, rect.y, rect.w, rect.h].every(Number.isFinite))
      continue;
    const sourceSize = metadata.sourceSize ?? {};
    const spriteSourceSize = metadata.spriteSourceSize ?? {};
    normalized[frameId.replace(/\.png$/i, "")] = {
      x: rect.x,
      y: rect.y,
      width: rect.w,
      height: rect.h,
      sourceWidth: sourceSize.w ?? rect.w,
      sourceHeight: sourceSize.h ?? rect.h,
      offsetX: spriteSourceSize.x ?? 0,
      offsetY: spriteSourceSize.y ?? 0,
    };
  }
  return Object.keys(normalized).length ? normalized : null;
}
