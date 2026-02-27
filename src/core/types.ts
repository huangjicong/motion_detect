// 核心类型定义

export interface Keypoint {
  name: string
  x: number
  y: number
  z?: number
  score: number
}

export interface PoseResult {
  id: number
  keypoints: Keypoint[]
  score: number
  timestamp: number
}

export interface PoseData {
  poses: PoseResult[]
  fps: number
  timestamp: number
}

export interface CameraConfig {
  width: number
  height: number
  frameRate: number
  facingMode: 'user' | 'environment'
}

export interface DetectorConfig {
  maxPoses: number
  scoreThreshold: number
  modelType: 'lightning' | 'thunder'
  enableSmoothing: boolean
}

// MoveNet 17 个关键点名称
export const KEYPOINT_NAMES = [
  'nose',
  'left_eye',
  'right_eye',
  'left_ear',
  'right_ear',
  'left_shoulder',
  'right_shoulder',
  'left_elbow',
  'right_elbow',
  'left_wrist',
  'right_wrist',
  'left_hip',
  'right_hip',
  'left_knee',
  'right_knee',
  'left_ankle',
  'right_ankle',
] as const

export type KeypointName = (typeof KEYPOINT_NAMES)[number]

// 骨骼连接关系
export const SKELETON_CONNECTIONS: [KeypointName, KeypointName][] = [
  // 头部
  ['nose', 'left_eye'],
  ['nose', 'right_eye'],
  ['left_eye', 'left_ear'],
  ['right_eye', 'right_ear'],
  // 躯干
  ['left_shoulder', 'right_shoulder'],
  ['left_shoulder', 'left_hip'],
  ['right_shoulder', 'right_hip'],
  ['left_hip', 'right_hip'],
  // 左臂
  ['left_shoulder', 'left_elbow'],
  ['left_elbow', 'left_wrist'],
  // 右臂
  ['right_shoulder', 'right_elbow'],
  ['right_elbow', 'right_wrist'],
  // 左腿
  ['left_hip', 'left_knee'],
  ['left_knee', 'left_ankle'],
  // 右腿
  ['right_hip', 'right_knee'],
  ['right_knee', 'right_ankle'],
]

// 简单动作类型
export enum ActionType {
  IDLE = 'idle',
  JUMP = 'jump',
  WAVE = 'wave',
  SQUAT = 'squat',
  RAISE_HANDS = 'raise_hands',
  T_POSE = 't_pose',
  WALK = 'walk',
  RUN = 'run',
}

// 动作中文名称映射
export const ACTION_LABELS: Record<ActionType, string> = {
  [ActionType.IDLE]: '静止',
  [ActionType.JUMP]: '跳跃',
  [ActionType.WAVE]: '挥手',
  [ActionType.SQUAT]: '下蹲',
  [ActionType.RAISE_HANDS]: '举手',
  [ActionType.T_POSE]: 'T-Pose',
  [ActionType.WALK]: '走路',
  [ActionType.RUN]: '跑步',
}

export interface ActionEvent {
  type: ActionType
  playerId: number
  confidence: number
  timestamp: number
}
