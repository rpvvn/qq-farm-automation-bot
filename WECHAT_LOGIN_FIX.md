# 微信账号登录问题修复说明

## 问题描述
添加微信小程序账号时出现 `[WS] 错误: Unexpected server response: 400` 错误，导致账号无法正常连接和运行。

## 问题原因
微信账号和QQ账号使用不同的 `platform` 参数连接服务器：
- QQ账号：`platform=qq`
- 微信账号：`platform=wx`

前端在添加微信账号时正确设置了 `platform: 'wx'`，但后端在建立 WebSocket 连接时没有使用账号的 platform 信息，导致所有账号都使用默认的 `platform=qq` 连接，微信账号因此被服务器拒绝（400错误）。

## 修复内容

### 1. core/src/utils/network.js
- 添加 `savedPlatform` 变量保存账号的 platform 信息
- 修改 `connect()` 函数签名，添加 `platform` 参数：
  ```javascript
  function connect(code, onLoginSuccess, platform = null)
  ```
- 在构建 WebSocket URL 时使用账号的 platform：
  ```javascript
  const effectivePlatform = savedPlatform || connConfig.platform;
  const url = `${connConfig.serverUrl}?platform=${effectivePlatform}&os=...`;
  ```
- 修改 `reconnect()` 函数，确保重连时也使用正确的 platform

### 2. core/src/core/worker.js
- 修改 `startBot()` 函数中的 `connect()` 调用，传递 platform 参数：
  ```javascript
  connect(code, onLoginSuccess, platform);
  ```

## 测试方法
1. 在前端添加一个微信账号（使用微信扫码登录）
2. 账号应该能够正常连接并运行
3. 日志中不应再出现 `Unexpected server response: 400` 错误
4. 账号状态应显示为"运行中"

## 注意事项
- 确保账号数据中的 `platform` 字段正确设置（QQ账号为 `qq`，微信账号为 `wx`）
- 如果之前添加的微信账号仍然无法连接，可以尝试删除后重新添加
- 连接配置（ConnectionConfig）中的 platform 设置仅作为默认值，实际连接时会优先使用账号自身的 platform 信息

## 相关文件
- `core/src/utils/network.js` - WebSocket 连接层
- `core/src/core/worker.js` - 账号运行时
- `web/src/components/WxLoginModal.vue` - 微信登录界面
- `web/src/components/AccountModal.vue` - 账号管理界面
