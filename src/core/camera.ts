// 摄像头管理模块

import type { CameraConfig } from './types'

const DEFAULT_CONFIG: CameraConfig = {
  width: 1280,
  height: 720,
  frameRate: 30,
  facingMode: 'user',
}

export class CameraManager {
  private stream: MediaStream | null = null
  private video: HTMLVideoElement | null = null
  private config: CameraConfig

  constructor(config: Partial<CameraConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  async start(videoElement: HTMLVideoElement): Promise<void> {
    this.video = videoElement

    // 检查浏览器支持
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new Error('浏览器不支持摄像头访问')
    }

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          width: { ideal: this.config.width },
          height: { ideal: this.config.height },
          frameRate: { ideal: this.config.frameRate },
          facingMode: this.config.facingMode,
        },
        audio: false,
      })

      this.video.srcObject = this.stream
      await this.video.play()
    } catch (error) {
      if ((error as Error).name === 'NotAllowedError') {
        throw new Error('请允许访问摄像头权限')
      }
      throw error
    }
  }

  stop(): void {
    if (this.stream) {
      this.stream.getTracks().forEach((track) => track.stop())
      this.stream = null
    }
    if (this.video) {
      this.video.srcObject = null
      this.video = null
    }
  }

  getVideo(): HTMLVideoElement | null {
    return this.video
  }

  getResolution(): { width: number; height: number } {
    if (!this.video) return { width: 0, height: 0 }
    return {
      width: this.video.videoWidth,
      height: this.video.videoHeight,
    }
  }

  // 镜像翻转（用于前置摄像头）
  flipHorizontal(): void {
    if (this.video) {
      this.video.style.transform = 'scaleX(-1)'
    }
  }
}
