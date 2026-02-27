<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch } from 'vue'
import { CameraManager, PoseDetector, SkeletonRenderer, ACTION_LABELS } from './core'
import { GameBridge, ActionRecognizer } from './game'
import type { ActionEvent } from './core'

// DOM 引用
const videoRef = ref<HTMLVideoElement>()
const canvasRef = ref<HTMLCanvasElement>()

// 状态
const status = ref<'idle' | 'loading' | 'running' | 'error'>('idle')
const errorMessage = ref('')
const fps = ref(0)
const playerCount = ref(0)
const detectedActions = ref<{ type: string; label: string; playerId: number }[]>([])
const serverConnected = ref(false)
const zoom = ref(1.0) // 1.0 = 100%, 2.0 = 200%

// Watch zoom changes and update renderer
watch(zoom, (newZoom) => {
  if (renderer) {
    renderer.setZoom(newZoom)
  }
})

// 核心实例
let camera: CameraManager
let detector: PoseDetector
let renderer: SkeletonRenderer
let gameBridge: GameBridge
let actionRecognizer: ActionRecognizer

// 动画循环
let animationId: number | null = null
let lastFrameTime = performance.now()
let frameCount = 0

// 计算属性
const statusText = computed(() => {
  switch (status.value) {
    case 'idle':
      return '准备就绪'
    case 'loading':
      return '正在初始化...'
    case 'running':
      return '运行中'
    case 'error':
      return errorMessage.value
  }
})

const statusClass = computed(() => {
  switch (status.value) {
    case 'running':
      return 'status-running'
    case 'error':
      return 'status-error'
    default:
      return 'status-idle'
  }
})

onMounted(async () => {
  // 初始化核心组件
  camera = new CameraManager()
  detector = new PoseDetector({ maxPoses: 6 })
  gameBridge = new GameBridge()
  actionRecognizer = new ActionRecognizer()

  // 监听游戏服务器连接状态
  gameBridge.on('connected', () => {
    serverConnected.value = true
  })
  gameBridge.on('disconnected', () => {
    serverConnected.value = false
  })
})

onUnmounted(() => {
  stop()
  detector.dispose()
  gameBridge.disconnect()
})

async function start() {
  if (!videoRef.value || !canvasRef.value) return

  try {
    status.value = 'loading'
    errorMessage.value = ''

    // 初始化检测器
    await detector.init()

    // 初始化渲染器
    const ctx = canvasRef.value.getContext('2d')
    if (!ctx) throw new Error('无法获取 Canvas 上下文')
    renderer = new SkeletonRenderer(ctx)

    // 启动摄像头
    await camera.start(videoRef.value)
    camera.flipHorizontal()

    // 设置渲染器尺寸
    const resolution = camera.getResolution()
    renderer.setSize(resolution.width, resolution.height)
    renderer.setFlip(true)
    renderer.setZoom(zoom.value)

    // 连接游戏服务器（可选）
    gameBridge.connect().catch(() => {
      console.log('游戏服务器未启动，继续运行离线模式')
    })

    status.value = 'running'
    detect()
  } catch (error) {
    status.value = 'error'
    errorMessage.value = (error as Error).message
    console.error('启动失败:', error)
  }
}

function stop() {
  status.value = 'idle'
  camera?.stop()
  if (animationId) {
    cancelAnimationFrame(animationId)
    animationId = null
  }
}

// 动作超时清理
const actionTimeouts = new Map<string, ReturnType<typeof setTimeout>>()

function updateActions(actions: ActionEvent[]) {
  // 清除所有超时
  actionTimeouts.forEach((timeout) => clearTimeout(timeout))
  actionTimeouts.clear()

  // 更新动作列表
  detectedActions.value = actions.map((a) => ({
    type: a.type,
    label: ACTION_LABELS[a.type] || a.type,
    playerId: a.playerId,
  }))

  // 1秒后清除（走路/跑步需要更频繁更新）
  const timeout = setTimeout(() => {
    detectedActions.value = []
  }, 1000)

  actions.forEach((a) => {
    actionTimeouts.set(`${a.playerId}-${a.type}`, timeout)
  })
}

async function detect() {
  if (status.value !== 'running') return
  if (!videoRef.value || !canvasRef.value) return

  const video = videoRef.value

  // 确保视频已准备好
  if (video.readyState < 2) {
    animationId = requestAnimationFrame(detect)
    return
  }

  // 检测姿态
  const poses = await detector.detect(video)

  // 渲染骨骼
  renderer.render(poses)
  renderer.renderStats(fps.value, poses.length)

  // 识别动作
  const actions: ActionEvent[] = []
  poses.forEach((pose) => {
    const action = actionRecognizer.recognize(pose)
    if (action) {
      actions.push(action)
    }
  })

  // 更新状态
  playerCount.value = poses.length

  // 更新检测到的动作
  updateActions(actions)

  // 发送到游戏服务器
  if (serverConnected.value) {
    gameBridge.sendPoses(poses, fps.value)
  }

  // 计算 FPS
  frameCount++
  const now = performance.now()
  if (now - lastFrameTime >= 1000) {
    fps.value = frameCount
    frameCount = 0
    lastFrameTime = now
  }

  animationId = requestAnimationFrame(detect)
}
</script>

<template>
  <div class="app">
    <header class="header">
      <h1>XGame Motion Capture</h1>
      <div class="status" :class="statusClass">
        {{ statusText }}
      </div>
    </header>

    <main class="main">
      <div class="video-container">
        <video
          ref="videoRef"
          autoplay
          playsinline
          muted
          :style="{ transform: `scaleX(-1) scale(${zoom})` }"
        ></video>
        <canvas ref="canvasRef" :style="{ transform: `scale(${zoom})` }"></canvas>

        <!-- 动作提示 -->
        <div v-if="detectedActions.length > 0" class="action-overlay">
          <span v-for="action in detectedActions" :key="`${action.playerId}-${action.type}`" class="action-badge">
            玩家{{ action.playerId + 1 }}: {{ action.label }}
          </span>
        </div>
      </div>

      <div class="sidebar">
        <div class="panel">
          <h3>控制面板</h3>
          <div class="controls">
            <button @click="start" :disabled="status === 'running' || status === 'loading'">
              开始检测
            </button>
            <button @click="stop" :disabled="status !== 'running'">停止</button>
          </div>
        </div>

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

        <div class="panel">
          <h3>实时数据</h3>
          <div class="stats">
            <div class="stat-item">
              <span class="label">FPS</span>
              <span class="value">{{ fps }}</span>
            </div>
            <div class="stat-item">
              <span class="label">检测人数</span>
              <span class="value">{{ playerCount }}</span>
            </div>
            <div class="stat-item">
              <span class="label">游戏服务器</span>
              <span class="value" :class="serverConnected ? 'connected' : 'disconnected'">
                {{ serverConnected ? '已连接' : '未连接' }}
              </span>
            </div>
          </div>
        </div>

        <div class="panel">
          <h3>支持的动作</h3>
          <ul class="action-list">
            <li>🚶 走路 (walk)</li>
            <li>🏃 跑步 (run)</li>
            <li>🙋 举手 (raise_hands)</li>
            <li>✋ T-Pose (t_pose)</li>
            <li>👋 挥手 (wave)</li>
            <li>🏋️ 下蹲 (squat)</li>
            <li>⬆️ 跳跃 (jump)</li>
          </ul>
        </div>
      </div>
    </main>
  </div>
</template>

<style scoped>
.app {
  min-height: 100vh;
  display: flex;
  flex-direction: column;
}

.header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 16px 24px;
  background: #16213e;
  border-bottom: 1px solid #0f3460;
}

.header h1 {
  font-size: 1.5rem;
  color: #e94560;
}

.status {
  padding: 6px 16px;
  border-radius: 20px;
  font-size: 0.9rem;
  font-weight: 500;
}

.status-idle {
  background: #2d3436;
  color: #dfe6e9;
}

.status-running {
  background: #00b894;
  color: #fff;
}

.status-error {
  background: #d63031;
  color: #fff;
}

.main {
  flex: 1;
  display: flex;
  padding: 24px;
  gap: 24px;
}

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

video {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}

canvas {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
}

.action-overlay {
  position: absolute;
  top: 16px;
  left: 16px;
  display: flex;
  gap: 8px;
}

.action-badge {
  padding: 8px 16px;
  background: rgba(233, 69, 96, 0.9);
  color: #fff;
  border-radius: 20px;
  font-weight: bold;
  animation: fadeIn 0.3s ease;
}

@keyframes fadeIn {
  from {
    opacity: 0;
    transform: translateY(-10px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

.sidebar {
  width: 280px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.panel {
  background: #16213e;
  border-radius: 8px;
  padding: 16px;
}

.panel h3 {
  margin-bottom: 12px;
  font-size: 1rem;
  color: #e94560;
}

.controls {
  display: flex;
  gap: 12px;
}

button {
  flex: 1;
  padding: 10px 16px;
  border: none;
  border-radius: 6px;
  font-size: 0.9rem;
  cursor: pointer;
  transition: all 0.2s;
}

button:first-child {
  background: #e94560;
  color: #fff;
}

button:first-child:hover:not(:disabled) {
  background: #ff6b6b;
}

button:last-child {
  background: #0f3460;
  color: #fff;
}

button:last-child:hover:not(:disabled) {
  background: #1a4a7a;
}

button:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.stats {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.stat-item {
  display: flex;
  justify-content: space-between;
  align-items: center;
}

.stat-item .label {
  color: #a0a0a0;
}

.stat-item .value {
  font-weight: bold;
  color: #fff;
}

.connected {
  color: #00b894 !important;
}

.disconnected {
  color: #d63031 !important;
}

.action-list {
  list-style: none;
  font-size: 0.9rem;
  color: #a0a0a0;
}

.action-list li {
  padding: 6px 0;
  border-bottom: 1px solid #0f3460;
}

.action-list li:last-child {
  border-bottom: none;
}

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
</style>
