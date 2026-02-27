// WebSocket 游戏通信桥

import type { PoseResult, PoseData } from '../core/types'

export interface GameBridgeConfig {
  url: string
  reconnectInterval: number
}

const DEFAULT_CONFIG: GameBridgeConfig = {
  url: 'ws://localhost:8080',
  reconnectInterval: 2000,
}

type MessageHandler = (data: any) => void

export class GameBridge {
  private ws: WebSocket | null = null
  private config: GameBridgeConfig
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null
  private handlers: Map<string, MessageHandler[]> = new Map()
  private connected = false

  constructor(config: Partial<GameBridgeConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config }
  }

  connect(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        this.ws = new WebSocket(this.config.url)

        this.ws.onopen = () => {
          console.log('[GameBridge] 已连接到游戏服务器')
          this.connected = true
          this.emit('connected', {})
          resolve()
        }

        this.ws.onclose = () => {
          console.log('[GameBridge] 连接已断开')
          this.connected = false
          this.emit('disconnected', {})
          this.scheduleReconnect()
        }

        this.ws.onerror = (error) => {
          console.error('[GameBridge] 连接错误:', error)
          this.emit('error', { error })
          reject(error)
        }

        this.ws.onmessage = (event) => {
          try {
            const data = JSON.parse(event.data)
            this.emit('message', data)
            if (data.type) {
              this.emit(data.type, data)
            }
          } catch (e) {
            console.warn('[GameBridge] 解析消息失败:', e)
          }
        }
      } catch (error) {
        reject(error)
      }
    })
  }

  // 发送姿态数据
  sendPoses(poses: PoseResult[], fps: number): void {
    if (!this.connected || !this.ws) return

    const data: PoseData = {
      poses,
      fps,
      timestamp: Date.now(),
    }

    this.ws.send(
      JSON.stringify({
        type: 'pose_update',
        ...data,
      })
    )
  }

  // 发送自定义事件
  send(event: string, data: any = {}): void {
    if (!this.connected || !this.ws) return

    this.ws.send(
      JSON.stringify({
        type: event,
        ...data,
        timestamp: Date.now(),
      })
    )
  }

  // 事件监听
  on(event: string, handler: MessageHandler): void {
    if (!this.handlers.has(event)) {
      this.handlers.set(event, [])
    }
    this.handlers.get(event)!.push(handler)
  }

  // 移除监听
  off(event: string, handler: MessageHandler): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      const index = handlers.indexOf(handler)
      if (index > -1) {
        handlers.splice(index, 1)
      }
    }
  }

  private emit(event: string, data: any): void {
    const handlers = this.handlers.get(event)
    if (handlers) {
      handlers.forEach((h) => h(data))
    }
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return

    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null
      console.log('[GameBridge] 尝试重新连接...')
      this.connect().catch(() => {
        // 忽略重连错误
      })
    }, this.config.reconnectInterval)
  }

  disconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer)
      this.reconnectTimer = null
    }
    if (this.ws) {
      this.ws.close()
      this.ws = null
    }
    this.connected = false
  }

  isConnected(): boolean {
    return this.connected
  }
}
