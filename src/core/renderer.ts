// 骨骼渲染模块

import type { PoseResult } from './types'
import { SKELETON_CONNECTIONS, type KeypointName } from './types'

// 多人颜色方案
const PLAYER_COLORS = [
  '#FF6B6B', // 红色
  '#4ECDC4', // 青色
  '#45B7D1', // 蓝色
  '#96CEB4', // 绿色
  '#FFEAA7', // 黄色
  '#DDA0DD', // 紫色
]

export class SkeletonRenderer {
  private ctx: CanvasRenderingContext2D
  private width: number = 0
  private height: number = 0
  private flipHorizontal: boolean = true
  private zoom: number = 1.0

  constructor(ctx: CanvasRenderingContext2D) {
    this.ctx = ctx
  }

  setSize(width: number, height: number): void {
    this.width = width
    this.height = height
    this.ctx.canvas.width = width
    this.ctx.canvas.height = height
  }

  setFlip(flip: boolean): void {
    this.flipHorizontal = flip
  }

  setZoom(zoom: number): void {
    this.zoom = zoom
  }

  render(poses: PoseResult[]): void {
    const ctx = this.ctx
    const scale = 1 / this.zoom // Inverse scale for coordinates

    // 清空画布
    ctx.clearRect(0, 0, this.width, this.height)

    // 如果需要镜像翻转
    if (this.flipHorizontal) {
      ctx.save()
      ctx.scale(-1, 1)
      ctx.translate(-this.width, 0)
    }

    // Scale for zoom
    ctx.save()
    ctx.scale(scale, scale)

    // 绘制每个检测到的人
    poses.forEach((pose, index) => {
      this.drawPerson(pose, index)
    })

    ctx.restore()

    if (this.flipHorizontal) {
      ctx.restore()
    }
  }

  private drawPerson(pose: PoseResult, index: number): void {
    const ctx = this.ctx
    const color = PLAYER_COLORS[index % PLAYER_COLORS.length]
    const keypointMap = new Map(pose.keypoints.map((kp) => [kp.name, kp]))

    // 绘制骨骼连接线
    ctx.strokeStyle = color
    ctx.lineWidth = 3
    ctx.lineCap = 'round'

    SKELETON_CONNECTIONS.forEach(([a, b]) => {
      const kpA = keypointMap.get(a as KeypointName)
      const kpB = keypointMap.get(b as KeypointName)

      if (kpA && kpB && kpA.score > 0.3 && kpB.score > 0.3) {
        ctx.beginPath()
        ctx.moveTo(kpA.x, kpA.y)
        ctx.lineTo(kpB.x, kpB.y)
        ctx.stroke()
      }
    })

    // 绘制关键点
    ctx.fillStyle = color
    pose.keypoints.forEach((kp) => {
      if (kp.score > 0.3) {
        ctx.beginPath()
        ctx.arc(kp.x, kp.y, 6, 0, 2 * Math.PI)
        ctx.fill()

        // 白色边框
        ctx.strokeStyle = '#fff'
        ctx.lineWidth = 2
        ctx.stroke()
      }
    })

    // 绘制玩家标签
    const nose = keypointMap.get('nose')
    if (nose && nose.score > 0.3) {
      ctx.font = 'bold 16px Arial'
      ctx.fillStyle = color
      ctx.strokeStyle = '#000'
      ctx.lineWidth = 3

      const label = `玩家 ${index + 1}`
      const x = nose.x
      const y = nose.y - 20

      ctx.strokeText(label, x, y)
      ctx.fillText(label, x, y)
    }
  }

  // 绘制状态信息
  renderStats(fps: number, playerCount: number): void {
    const ctx = this.ctx
    ctx.save()
    ctx.font = '14px Arial'
    ctx.fillStyle = '#00ff00'
    ctx.strokeStyle = '#000'
    ctx.lineWidth = 2

    const stats = [`FPS: ${fps}`, `人数: ${playerCount}`]
    stats.forEach((text, i) => {
      ctx.strokeText(text, 10, 25 + i * 20)
      ctx.fillText(text, 10, 25 + i * 20)
    })

    ctx.restore()
  }
}
