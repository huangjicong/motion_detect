// 简单动作识别

import type { PoseResult, Keypoint } from '../core/types'
import { ActionType, type ActionEvent } from '../core/types'

// 历史帧数据结构
interface PoseHistory {
  poses: PoseResult[]
  lastUpdate: number
}

export class ActionRecognizer {
  private poseHistory: Map<number, PoseHistory> = new Map()
  private readonly historySize = 30 // 保留最近30帧用于走路/跑步检测

  // 识别当前帧的动作
  recognize(pose: PoseResult): ActionEvent | null {
    const keypointMap = new Map(pose.keypoints.map((kp) => [kp.name, kp]))

    // 更新历史帧
    this.updateHistory(pose)

    let action: ActionType = ActionType.IDLE
    let confidence = 0

    // 检测举手
    if (this.checkRaiseHands(keypointMap)) {
      action = ActionType.RAISE_HANDS
      confidence = 0.9
    }
    // 检测 T-Pose
    else if (this.checkTPose(keypointMap)) {
      action = ActionType.T_POSE
      confidence = 0.85
    }
    // 检测跑步（优先于走路）
    else if (this.checkRun(pose.id)) {
      action = ActionType.RUN
      confidence = 0.8
    }
    // 检测走路
    else if (this.checkWalk(pose.id)) {
      action = ActionType.WALK
      confidence = 0.75
    }
    // 检测挥手
    else if (this.checkWave(pose.id)) {
      action = ActionType.WAVE
      confidence = 0.8
    }
    // 检测下蹲
    else if (this.checkSquat(pose.id)) {
      action = ActionType.SQUAT
      confidence = 0.75
    }
    // 检测跳跃
    else if (this.checkJump(pose.id)) {
      action = ActionType.JUMP
      confidence = 0.7
    }

    if (action !== ActionType.IDLE && confidence > 0.5) {
      return {
        type: action,
        playerId: pose.id,
        confidence,
        timestamp: Date.now(),
      }
    }

    return null
  }

  // 更新历史帧
  private updateHistory(pose: PoseResult): void {
    let history = this.poseHistory.get(pose.id)
    if (!history) {
      history = { poses: [], lastUpdate: Date.now() }
      this.poseHistory.set(pose.id, history)
    }

    history.poses.push(pose)
    history.lastUpdate = Date.now()

    // 保持历史帧数量
    if (history.poses.length > this.historySize) {
      history.poses.shift()
    }

    // 清理过期的历史数据
    this.cleanupOldHistory()
  }

  // 清理过期数据
  private cleanupOldHistory(): void {
    const now = Date.now()
    const timeout = 5000 // 5秒超时

    for (const [id, history] of this.poseHistory.entries()) {
      if (now - history.lastUpdate > timeout) {
        this.poseHistory.delete(id)
      }
    }
  }

  // 获取历史帧
  private getHistory(playerId: number): PoseResult[] {
    return this.poseHistory.get(playerId)?.poses || []
  }

  // 检测双手举起
  private checkRaiseHands(keypointMap: Map<string, Keypoint>): boolean {
    const leftWrist = keypointMap.get('left_wrist')
    const rightWrist = keypointMap.get('right_wrist')
    const leftShoulder = keypointMap.get('left_shoulder')
    const rightShoulder = keypointMap.get('right_shoulder')

    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false

    const threshold = 0.3
    return (
      leftWrist.score > threshold &&
      rightWrist.score > threshold &&
      leftWrist.y < leftShoulder.y - 50 &&
      rightWrist.y < rightShoulder.y - 50
    )
  }

  // 检测 T-Pose（双手水平伸展）
  private checkTPose(keypointMap: Map<string, Keypoint>): boolean {
    const leftWrist = keypointMap.get('left_wrist')
    const rightWrist = keypointMap.get('right_wrist')
    const leftShoulder = keypointMap.get('left_shoulder')
    const rightShoulder = keypointMap.get('right_shoulder')

    if (!leftWrist || !rightWrist || !leftShoulder || !rightShoulder) return false

    const threshold = 0.3
    // 手腕和肩膀差不多高度（水平）
    const leftLevel = Math.abs(leftWrist.y - leftShoulder.y) < 50
    const rightLevel = Math.abs(rightWrist.y - rightShoulder.y) < 50
    // 手腕在肩膀外侧
    const leftExtended = leftWrist.x < leftShoulder.x - 100
    const rightExtended = rightWrist.x > rightShoulder.x + 100

    return (
      leftWrist.score > threshold &&
      rightWrist.score > threshold &&
      leftLevel &&
      rightLevel &&
      leftExtended &&
      rightExtended
    )
  }

  // 检测走路 - 通过腿部交替移动模式
  private checkWalk(playerId: number): boolean {
    const history = this.getHistory(playerId)
    if (history.length < 10) return false

    // 计算左右膝盖和脚踝的移动模式
    const legMovements: number[] = []
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1]
      const curr = history[i]

      // 检查膝盖移动
      const leftKneeMove = this.getKeypointMovement(prev, curr, 'left_knee')
      const rightKneeMove = this.getKeypointMovement(prev, curr, 'right_knee')

      if (leftKneeMove !== null && rightKneeMove !== null) {
        legMovements.push(leftKneeMove + rightKneeMove)
      }
    }

    if (legMovements.length < 6) return false

    // 计算平均移动速度
    const avgMovement = legMovements.reduce((a, b) => a + b, 0) / legMovements.length

    // 走路：中等速度的腿部移动 (3-15 像素/帧)
    const horizontalDisplacement = this.getHorizontalDisplacement(history)

    return avgMovement > 3 && avgMovement <= 15 && horizontalDisplacement > 5
  }

  // 检测跑步 - 更快的腿部移动
  private checkRun(playerId: number): boolean {
    const history = this.getHistory(playerId)
    if (history.length < 10) return false

    // 计算腿部移动速度
    const legMovements: number[] = []
    for (let i = 1; i < history.length; i++) {
      const prev = history[i - 1]
      const curr = history[i]

      const leftKneeMove = this.getKeypointMovement(prev, curr, 'left_knee')
      const rightKneeMove = this.getKeypointMovement(prev, curr, 'right_knee')

      if (leftKneeMove !== null && rightKneeMove !== null) {
        legMovements.push(leftKneeMove + rightKneeMove)
      }
    }

    if (legMovements.length < 6) return false

    // 计算平均移动速度
    const avgMovement = legMovements.reduce((a, b) => a + b, 0) / legMovements.length

    // 跑步：更快的腿部移动 (>15 像素/帧)
    const armSwing = this.getArmSwing(history)
    const horizontalDisplacement = this.getHorizontalDisplacement(history)

    return avgMovement > 15 && armSwing > 10 && horizontalDisplacement > 10
  }

  // 辅助方法：获取关键点移动距离
  private getKeypointMovement(
    prevPose: PoseResult,
    currPose: PoseResult,
    keypointName: string
  ): number | null {
    const prevKp = prevPose.keypoints.find((k) => k.name === keypointName)
    const currKp = currPose.keypoints.find((k) => k.name === keypointName)

    if (!prevKp || !currKp || prevKp.score < 0.3 || currKp.score < 0.3) {
      return null
    }

    const dx = Math.abs(currKp.x - prevKp.x)
    const dy = Math.abs(currKp.y - prevKp.y)

    return Math.sqrt(dx * dx + dy * dy)
  }

  // 获取手臂摆动幅度
  private getArmSwing(history: PoseResult[]): number {
    const wristPositions: number[] = []
    for (const pose of history) {
      const leftWrist = pose.keypoints.find((k) => k.name === 'left_wrist')
      const rightWrist = pose.keypoints.find((k) => k.name === 'right_wrist')
      if (leftWrist && rightWrist) {
        wristPositions.push(leftWrist.x + rightWrist.x)
      }
    }

    if (wristPositions.length < 5) return 0

    const maxPos = Math.max(...wristPositions)
    const minPos = Math.min(...wristPositions)
    return maxPos - minPos
  }

  // 获取水平位移
  private getHorizontalDisplacement(history: PoseResult[]): number {
    if (history.length < 2) return 0

    const firstNose = history[0].keypoints.find((k) => k.name === 'nose')
    const lastNose = history[history.length - 1].keypoints.find((k) => k.name === 'nose')

    if (!firstNose || !lastNose) return 0

    return Math.abs(lastNose.x - firstNose.x)
  }

  // 检测挥手
  private checkWave(playerId: number): boolean {
    const history = this.getHistory(playerId)
    if (history.length < 5) return false

    const prevPose = history[history.length - 2]
    const currPose = history[history.length - 1]

    if (!prevPose || !currPose) return false

    const currWrist = currPose.keypoints.find((k) => k.name === 'right_wrist')
    const prevWrist = prevPose.keypoints.find((k) => k.name === 'right_wrist')

    if (!currWrist || !prevWrist) return false

    const dx = Math.abs(currWrist.x - prevWrist.x)
    const dy = Math.abs(currWrist.y - prevWrist.y)

    // 手腕有明显的水平移动，但身体没有明显位移
    const horizontalDisplacement = this.getHorizontalDisplacement(history)

    return dx > 30 && dy < 20 && horizontalDisplacement < 30
  }

  // 检测下蹲 - 使用多帧累积检测
  private checkSquat(playerId: number): boolean {
    const history = this.getHistory(playerId)
    if (history.length < 5) return false

    // 比较当前帧和5帧前的位置
    const currPose = history[history.length - 1]
    const oldPose = history[history.length - 5]

    if (!currPose || !oldPose) return false

    // 获取臀部关键点（使用双侧，取平均）
    const currLeftHip = currPose.keypoints.find((k) => k.name === 'left_hip')
    const currRightHip = currPose.keypoints.find((k) => k.name === 'right_hip')
    const oldLeftHip = oldPose.keypoints.find((k) => k.name === 'left_hip')
    const oldRightHip = oldPose.keypoints.find((k) => k.name === 'right_hip')

    const threshold = 0.3

    // 计算当前和过去的臀部 Y 坐标
    let currHipY: number | null = null
    let oldHipY: number | null = null

    // 优先使用双侧平均，其次使用单侧
    if (currLeftHip && currRightHip &&
        currLeftHip.score > threshold && currRightHip.score > threshold) {
      currHipY = (currLeftHip.y + currRightHip.y) / 2
    } else if (currLeftHip && currLeftHip.score > threshold) {
      currHipY = currLeftHip.y
    } else if (currRightHip && currRightHip.score > threshold) {
      currHipY = currRightHip.y
    }

    if (oldLeftHip && oldRightHip &&
        oldLeftHip.score > threshold && oldRightHip.score > threshold) {
      oldHipY = (oldLeftHip.y + oldRightHip.y) / 2
    } else if (oldLeftHip && oldLeftHip.score > threshold) {
      oldHipY = oldLeftHip.y
    } else if (oldRightHip && oldRightHip.score > threshold) {
      oldHipY = oldRightHip.y
    }

    if (currHipY === null || oldHipY === null) return false

    // 臀部明显下移（Y 坐标增大）
    const dy = currHipY - oldHipY
    return dy > 30
  }

  // 检测跳跃 - 使用多帧累积检测
  private checkJump(playerId: number): boolean {
    const history = this.getHistory(playerId)
    if (history.length < 5) return false

    // 比较当前帧和5帧前的位置
    const currPose = history[history.length - 1]
    const oldPose = history[history.length - 5]

    if (!currPose || !oldPose) return false

    // 获取臀部关键点（使用双侧，取平均）
    const currLeftHip = currPose.keypoints.find((k) => k.name === 'left_hip')
    const currRightHip = currPose.keypoints.find((k) => k.name === 'right_hip')
    const oldLeftHip = oldPose.keypoints.find((k) => k.name === 'left_hip')
    const oldRightHip = oldPose.keypoints.find((k) => k.name === 'right_hip')

    const threshold = 0.3

    // 计算当前和过去的臀部 Y 坐标
    let currHipY: number | null = null
    let oldHipY: number | null = null

    // 优先使用双侧平均，其次使用单侧
    if (currLeftHip && currRightHip &&
        currLeftHip.score > threshold && currRightHip.score > threshold) {
      currHipY = (currLeftHip.y + currRightHip.y) / 2
    } else if (currLeftHip && currLeftHip.score > threshold) {
      currHipY = currLeftHip.y
    } else if (currRightHip && currRightHip.score > threshold) {
      currHipY = currRightHip.y
    }

    if (oldLeftHip && oldRightHip &&
        oldLeftHip.score > threshold && oldRightHip.score > threshold) {
      oldHipY = (oldLeftHip.y + oldRightHip.y) / 2
    } else if (oldLeftHip && oldLeftHip.score > threshold) {
      oldHipY = oldLeftHip.y
    } else if (oldRightHip && oldRightHip.score > threshold) {
      oldHipY = oldRightHip.y
    }

    if (currHipY === null || oldHipY === null) return false

    // 臀部明显上移（Y 坐标减小）
    const dy = oldHipY - currHipY
    return dy > 30
  }
}
