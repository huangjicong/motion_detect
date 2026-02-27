# XGame Motion Capture

实时多人动作捕捉系统，用于体感游戏和动作建模。

## 特性

- 🚀 **高性能**: 使用 MoveNet 实现 50+ FPS 实时检测
- 👥 **多人支持**: 同时检测最多 6 人
- 🌐 **Web 优先**: 纯浏览器运行，无需安装
- 🎮 **游戏集成**: WebSocket 实时推送动作数据
- 🤖 **动作识别**: 支持举手、T-Pose、挥手、下蹲、跳跃等动作

## 快速开始

```bash
# 安装依赖
npm install

# 启动开发服务器
npm run dev
```

然后在浏览器打开 http://localhost:3000

## 项目结构

```
src/
├── core/                 # 核心模块
│   ├── types.ts          # 类型定义
│   ├── camera.ts         # 摄像头管理
│   ├── detector.ts       # 姿态检测 (MoveNet)
│   └── renderer.ts       # 骨骼渲染
├── game/                 # 游戏集成
│   ├── bridge.ts         # WebSocket 通信
│   └── actions.ts        # 动作识别
└── App.vue               # 主界面
```

## 使用说明

1. 点击「开始检测」按钮
2. 允许浏览器访问摄像头
3. 站在摄像头前即可看到骨骼追踪
4. 尝试以下动作：
   - 双手举起 → raise_hands
   - 双手水平伸展 → t_pose
   - 挥手 → wave
   - 下蹲 → squat
   - 跳跃 → jump

## 游戏集成

通过 WebSocket 连接游戏服务器：

```javascript
// 游戏端接收数据
const ws = new WebSocket('ws://localhost:8080')

ws.onmessage = (event) => {
  const data = JSON.parse(event.data)

  if (data.type === 'pose_update') {
    // data.poses - 所有人物姿态
    // data.fps - 当前帧率
    // data.timestamp - 时间戳

    data.poses.forEach(pose => {
      console.log(`玩家 ${pose.id}:`, pose.keypoints)
    })
  }
}
```

## 技术栈

- [Vue 3](https://vuejs.org/) - 前端框架
- [TensorFlow.js](https://www.tensorflow.org/js) - ML 框架
- [MoveNet](https://github.com/tensorflow/tfjs-models/tree/master/pose-detection) - 姿态检测模型
- [Vite](https://vitejs.dev/) - 构建工具

## 性能参考

| 设备 | FPS | 人数 |
|------|-----|------|
| MacBook M1 | 50+ | 6 |
| 普通 PC | 30+ | 4 |
| 手机浏览器 | 20+ | 2 |

## License

MIT
