// 姿态检测器 - 使用 MoveNet

import * as poseDetection from '@tensorflow-models/pose-detection'
import * as tf from '@tensorflow/tfjs'

import type { PoseResult, Keypoint, DetectorConfig } from './types'
import { KEYPOINT_NAMES } from './types'

const DEFAULT_CONFIG: DetectorConfig = {
  maxPoses: 6,
  scoreThreshold: 0.3,
  modelType: 'lightning',
  enableSmoothing: true,
}

export class PoseDetector {
  private detector: poseDetection.PoseDetector | null = null
  private config: DetectorConfig
  private initialized = false
  private initPromise: Promise<void> | null = null

  constructor(config: Partial<DetectorConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async init(): Promise<void> {
    // 防止重复初始化
    if (this.initPromise) {
      return this.initPromise
    }

    this.initPromise = this._init()
    return this.initPromise
  }

  private async _init(): Promise<void> {
    console.log('[PoseDetector] 开始初始化...')

    // 按优先级尝试后端
    const backends = ['webgl', 'wasm']
    let backendReady = false

    for (const backend of backends) {
      try {
        if (backend === 'wasm') {
          // @ts-ignore
          const wasm = await import('@tensorflow/tfjs-backend-wasm')
          await wasm.setWasmPaths('https://cdn.jsdelivr.net/npm/@tensorflow/tfjs-backend-wasm@4.21.0/dist/')
        }
        await tf.setBackend(backend)
        await tf.ready()
        backendReady = true
        console.log(`[PoseDetector] 使用后端: ${backend}`)
        break
      } catch (e) {
        console.warn(`[PoseDetector] 后端 ${backend} 初始化失败:`, e)
      }
    }

    if (!backendReady) {
      throw new Error('无法初始化 TensorFlow.js 后端')
    }

    // 创建 MoveNet 检测器
    const modelType =
      this.config.modelType === 'thunder'
        ? poseDetection.movenet.modelType.SINGLEPOSE_THUNDER
        : poseDetection.movenet.modelType.SINGLEPOSE_LIGHTNING

    this.detector = await poseDetection.createDetector(
      poseDetection.SupportedModels.MoveNet,
      {
        modelType,
        enableSmoothing: this.config.enableSmoothing,
      }
    )

    this.initialized = true
    console.log('[PoseDetector] 初始化完成')
  }

  async detect(video: HTMLVideoElement): Promise<PoseResult[]> {
    if (!this.detector || !this.initialized) {
      return []
    }

    try {
      const poses = await this.detector.estimatePoses(video, {
        maxPoses: this.config.maxPoses,
        scoreThreshold: this.config.scoreThreshold,
      })

      const timestamp = Date.now()

      return poses.map((pose, index) => ({
        id: index,
        score: pose.score ?? 0,
        timestamp,
        keypoints: this.normalizeKeypoints(pose.keypoints),
      }))
    } catch (error) {
      console.error('[PoseDetector] 检测错误:', error)
      return []
    }
  }

  private normalizeKeypoints(keypoints: poseDetection.Keypoint[]): Keypoint[] {
    return keypoints.map((kp, index) => ({
      name: KEYPOINT_NAMES[index] || `keypoint_${index}`,
      x: kp.x,
      y: kp.y,
      z: kp.z,
      score: kp.score ?? 0,
    }))
  }

  dispose(): void {
    if (this.detector) {
      this.detector.dispose()
      this.detector = null
    }
    this.initialized = false
    this.initPromise = null
  }

  isReady(): boolean {
    return this.initialized
  }
}
