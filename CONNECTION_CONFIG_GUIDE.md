# 运行连接配置功能说明

## 功能概述

在设置页面新增了"运行连接配置"区域，允许用户自定义修改游戏客户端的连接参数，包括服务器地址、设备信息等。

## 配置位置

- **前端界面**：设置页面 → 下线提醒下方 → 运行连接配置
- **后端存储**：`core/data/store.json` 中的 `connectionConfig` 字段

## 可配置参数

### 服务器配置
- **WebSocket 地址**：游戏服务器的 WebSocket 连接地址
  - 默认值：`wss://gate-obt.nqf.qq.com/prod/ws`
- **客户端版本号**：游戏客户端版本标识
  - 默认值：`1.7.0.6_20260313`

### 设备信息
- **平台类型**：QQ 或微信
  - 默认值：`qq`
  - 可选值：`qq`, `wx`
- **操作系统**：设备操作系统
  - 默认值：`iOS`
  - 可选值：`iOS`, `Android`
- **系统版本**：操作系统版本号
  - 默认值：`iOS 26.2.1`
- **网络类型**：网络连接类型
  - 默认值：`wifi`
  - 可选值：`wifi`, `4g`, `5g`
- **内存大小**：设备内存（MB）
  - 默认值：`7672`
- **设备 ID**：设备标识符
  - 默认值：`iPhone X<iPhone18,3>`

## 使用说明

1. **查看配置**：打开设置页面，滚动到"运行连接配置"区域
2. **修改配置**：在输入框中修改需要更改的参数
3. **保存配置**：点击"保存连接配置"按钮
4. **重启生效**：修改后需要重启对应账号才能生效
5. **恢复默认**：点击"恢复默认"按钮可以重置为默认配置

## 技术实现

### 前端组件
- `web/src/components/ConnectionConfig.vue`：连接配置组件
- `web/src/views/Settings.vue`：设置页面（已集成连接配置组件）

### 后端 API
- `GET /api/settings/connection`：获取连接配置
- `POST /api/settings/connection`：保存连接配置
- `POST /api/settings/connection/reset`：恢复默认配置

### 核心逻辑
- `core/src/config/config.js`：定义默认连接配置
- `core/src/models/store.js`：存储和读取连接配置
- `core/src/utils/network.js`：使用动态连接配置建立连接

### 配置优先级
1. 用户自定义配置（存储在 `store.json` 中）
2. 默认配置（定义在 `config.js` 中）

## 注意事项

⚠️ **重要提示**：
- 修改这些配置可能影响账号登录和游戏连接
- 请谨慎操作，确保填写正确的参数
- 修改后需要重启账号才能生效
- 如果连接失败，可以使用"恢复默认"功能

## 配置示例

```json
{
  "serverUrl": "wss://gate-obt.nqf.qq.com/prod/ws",
  "clientVersion": "1.7.0.6_20260313",
  "platform": "qq",
  "os": "iOS",
  "sysSoftware": "iOS 26.2.1",
  "network": "wifi",
  "memory": "7672",
  "deviceId": "iPhone X<iPhone18,3>"
}
```
