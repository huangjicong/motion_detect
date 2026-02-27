# Camera Zoom Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add zoom in/out functionality so users can adjust camera view when standing too close.

**Architecture:** Software zoom using CSS transform scale on video container. Zoom slider in sidebar controls scale factor (1.0-2.0x). Coordinate transformation applied to skeleton rendering to match zoom level.

**Tech Stack:** Vue 3 reactive state, CSS transform, Canvas coordinate scaling

---

### Task 1: Add Zoom State and UI

**Files:**
- Modify: `src/App.vue:14-17` (add zoom state)
- Modify: `src/App.vue:224-233` (add zoom slider)

**Step 1: Add zoom reactive state**

Add after line 17 in `<script setup>`:

```typescript
const zoom = ref(1.0) // 1.0 = 100%, 2.0 = 200%
```

**Step 2: Add zoom slider in sidebar**

Add after the controls panel (around line 233):

```vue
<div class="panel">
  <h3>摄像头缩放</h3>
  <div class="zoom-control">
    <input
      type="range"
      min="1"
      max="2"
      step="0.1"
      v-model.number="zoom"
      :disabled="status !== 'running'"
    />
    <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
  </div>
  <p class="zoom-hint">离摄像头近时放大，远时缩小</p>
</div>
```

**Step 3: Add zoom CSS styles**

Add to `<style scoped>` section:

```css
.zoom-control {
  display: flex;
  align-items: center;
  gap: 12px;
}

.zoom-control input[type="range"] {
  flex: 1;
  height: 6px;
  -webkit-appearance: none;
  background: #0f3460;
  border-radius: 3px;
  cursor: pointer;
}

.zoom-control input[type="range"]::-webkit-slider-thumb {
  -webkit-appearance: none;
  width: 16px;
  height: 16px;
  background: #e94560;
  border-radius: 50%;
  cursor: pointer;
}

.zoom-control input[type="range"]:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.zoom-value {
  min-width: 50px;
  text-align: right;
  font-weight: bold;
  color: #fff;
}

.zoom-hint {
  margin-top: 8px;
  font-size: 0.8rem;
  color: #666;
}
```

**Step 4: Verify UI renders**

Run: `npm run dev -- --port 3001`
Expected: Sidebar shows zoom slider with percentage display

**Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat(ui): add zoom slider control"
```

---

### Task 2: Apply Zoom to Video Display

**Files:**
- Modify: `src/App.vue:332-340` (video CSS)
- Modify: `src/App.vue:212-214` (video element)

**Step 1: Apply zoom transform to video container**

Replace the `.video-container` style (around line 322):

```css
.video-container {
  position: relative;
  flex: 1;
  max-width: 960px;
  background: #000;
  border-radius: 8px;
  overflow: hidden;
  aspect-ratio: 16 / 9;
}

.video-container video,
.video-container canvas {
  transform-origin: center center;
}
```

**Step 2: Add dynamic zoom style to video element**

Replace video element (around line 213):

```vue
<video
  ref="videoRef"
  autoplay
  playsinline
  muted
  :style="{ transform: `scaleX(-1) scale(${zoom})` }"
></video>
```

**Step 3: Add dynamic zoom style to canvas element**

Replace canvas element (around line 214):

```vue
<canvas ref="canvasRef" :style="{ transform: `scale(${zoom})` }"></canvas>
```

**Step 4: Verify zoom affects video display**

Run: Open browser, start detection, move zoom slider
Expected: Video and skeleton scale together when zoom changes

**Step 5: Commit**

```bash
git add src/App.vue
git commit -m "feat(zoom): apply zoom transform to video and canvas"
```

---

### Task 3: Fix Skeleton Coordinate Scaling

**Files:**
- Modify: `src/core/renderer.ts:20-21` (add zoom property)
- Modify: `src/core/renderer.ts:33-35` (add setZoom method)
- Modify: `src/App.vue:100` (pass zoom to renderer)

**Step 1: Add zoom property to SkeletonRenderer**

Add after line 20 in renderer.ts:

```typescript
private zoom: number = 1.0
```

**Step 2: Add setZoom method**

Add after `setFlip` method (around line 35):

```typescript
setZoom(zoom: number): void {
  this.zoom = zoom
}
```

**Step 3: Apply inverse scale in render method**

Modify the render method to scale coordinates (around line 44):

```typescript
render(poses: PoseResult[]): void {
  const ctx = this.ctx
  const scale = 1 / this.zoom // Inverse scale for coordinates

  // Clear canvas at original size
  ctx.clearRect(0, 0, this.width, this.height)

  // If need mirror flip
  if (this.flipHorizontal) {
    ctx.save()
    ctx.scale(-1, 1)
    ctx.translate(-this.width, 0)
  }

  // Scale for zoom
  ctx.save()
  ctx.scale(scale, scale)

  // Draw each detected person
  poses.forEach((pose, index) => {
    this.drawPerson(pose, index)
  })

  ctx.restore()

  if (this.flipHorizontal) {
    ctx.restore()
  }
}
```

**Step 4: Pass zoom to renderer in App.vue**

Add after `renderer.setFlip(true)` (around line 100):

```typescript
renderer.setZoom(zoom.value)
```

**Step 5: Watch zoom changes and update renderer**

Add watcher after the zoom ref declaration:

```typescript
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'

// Add after zoom ref:
watch(zoom, (newZoom) => {
  if (renderer) {
    renderer.setZoom(newZoom)
  }
})
```

**Step 6: Verify skeleton stays aligned**

Run: Open browser, start detection, move zoom slider
Expected: Skeleton overlays stay aligned with body at all zoom levels

**Step 7: Commit**

```bash
git add src/core/renderer.ts src/App.vue
git commit -m "feat(zoom): scale skeleton coordinates with zoom"
```

---

### Task 4: Add Reset Button

**Files:**
- Modify: `src/App.vue:224-233` (add reset button)

**Step 1: Add reset button next to zoom slider**

Add button after the zoom slider:

```vue
<div class="panel">
  <h3>摄像头缩放</h3>
  <div class="zoom-control">
    <input
      type="range"
      min="1"
      max="2"
      step="0.1"
      v-model.number="zoom"
      :disabled="status !== 'running'"
    />
    <span class="zoom-value">{{ Math.round(zoom * 100) }}%</span>
  </div>
  <button
    class="zoom-reset"
    @click="zoom = 1.0"
    :disabled="status !== 'running' || zoom === 1.0"
  >
    重置
  </button>
  <p class="zoom-hint">离摄像头近时放大，远时缩小</p>
</div>
```

**Step 2: Add reset button CSS**

```css
.zoom-reset {
  margin-top: 8px;
  width: 100%;
  padding: 6px 12px;
  background: #0f3460;
  color: #fff;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 0.85rem;
}

.zoom-reset:hover:not(:disabled) {
  background: #1a4a7a;
}

.zoom-reset:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
```

**Step 3: Verify reset button works**

Run: Open browser, start detection, change zoom, click reset
Expected: Zoom resets to 100%

**Step 4: Final commit**

```bash
git add src/App.vue
git commit -m "feat(zoom): add reset button"
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Add zoom state and UI slider | App.vue |
| 2 | Apply CSS transform zoom | App.vue |
| 3 | Scale skeleton coordinates | renderer.ts, App.vue |
| 4 | Add reset button | App.vue |
