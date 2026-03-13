# 账号下线提醒功能规格说明

## 功能概述

实现一个三层级的账号下线提醒系统，支持全局配置、用户级别配置和账号级别配置，允许不同粒度的通知管理。

## 核心需求

### 1. 配置层级结构

系统支持三个配置层级，优先级从高到低：

1. **账号级别配置** - 最高优先级，针对单个账号的专属配置
2. **用户级别配置** - 中等优先级，针对整个用户的配置
3. **全局配置** - 最低优先级，系统默认配置

当账号离线时，系统按优先级依次查找配置，使用第一个找到的配置。

### 2. 全局功能需求

#### 2.1 全局配置管理
- 在系统设置中提供全局下线提醒配置界面
- 支持配置以下参数：
  - 推送渠道（Webhook、钉钉、企业微信等）
  - 接口地址/Webhook URL
  - 认证 Token/密钥
  - 通知标题
  - 通知消息内容
  - 离线自动删除时间（秒）
  - 重登录链接模式

#### 2.2 全局配置存储
- 存储位置：`store.json` 的 `offlineReminder` 字段
- 数据结构：
  ```json
  {
    "channel": "webhook|dingtalk|wechat",
    "endpoint": "https://...",
    "token": "xxx",
    "title": "账号下线提醒",
    "msg": "您的账号已下线",
    "offlineDeleteSec": 3600,
    "reloginUrlMode": "include|exclude"
  }
  ```

#### 2.3 全局配置 API
- `GET /api/settings` - 获取全局设置（包含 `useGlobalOfflineReminder` 标识）
- 返回示例：
  ```json
  {
    "ok": true,
    "data": {
      "offlineReminder": { ... },
      "useGlobalOfflineReminder": true
    }
  }
  ```

### 3. 账号级别功能需求

#### 3.1 账号级别配置管理
- 在账号设置页面提供"使用全局配置"开关
- 开关关闭时，显示账号专属的配置表单
- 支持与全局配置相同的所有参数

#### 3.2 账号级别配置存储
- 存储位置：`store.json` 的 `accountConfigs[accountId].offlineReminder` 字段
- 默认值：`null`（表示使用全局配置）
- 数据结构与全局配置相同

#### 3.3 账号级别 API
- `GET /api/settings/account-offline-reminder` - 获取账号级别配置
  - 请求头：`x-account-id: <accountId>`
  - 返回：账号级别配置或 null
  
- `POST /api/settings/account-offline-reminder` - 保存账号级别配置
  - 请求头：`x-account-id: <accountId>`
  - 请求体：配置对象
  - 返回：保存后的配置
  
- `POST /api/settings/account-offline-reminder/test` - 测试推送
  - 请求头：`x-account-id: <accountId>`
  - 请求体：配置对象
  - 返回：推送结果

#### 3.4 账号级别配置 UI
- 创建可复用的 `OfflineReminderConfig` 组件
- 功能：
  - 显示"使用全局配置"开关
  - 开关打开时显示全局配置信息（只读）
  - 开关关闭时显示可编辑的账号级别配置表单
  - 提供"测试推送"按钮
  - 提供"保存账号级配置"按钮

### 4. 运行时行为

#### 4.1 下线提醒触发
- 当账号检测到离线时，触发下线提醒流程
- 获取配置的优先级：账号级别 > 用户级别 > 全局配置
- 使用获取到的配置发送通知

#### 4.2 自动删除逻辑
- 根据配置的 `offlineDeleteSec` 参数
- 账号离线后，等待指定时间后自动删除账号
- 如果 `offlineDeleteSec` 为 0，则不自动删除

#### 4.3 重登录链接
- 根据 `reloginUrlMode` 参数决定是否在通知中包含重登录链接
- `include` - 在通知中包含重登录链接
- `exclude` - 不包含重登录链接

### 5. 数据模型

#### 5.1 账号配置对象
```javascript
{
  accountId: string,
  offlineReminder: {
    channel: string,           // 推送渠道
    endpoint: string,          // 接口地址
    token: string,             // 认证令牌
    title: string,             // 通知标题
    msg: string,               // 通知内容
    offlineDeleteSec: number,  // 离线删除时间（秒）
    reloginUrlMode: string     // 重登录链接模式
  } | null
}
```

#### 5.2 存储结构
```javascript
// store.json
{
  "offlineReminder": { ... },  // 全局配置
  "userOfflineReminders": {
    "[username]": { ... }      // 用户级别配置
  },
  "accountConfigs": {
    "[accountId]": {
      "offlineReminder": { ... } | null  // 账号级别配置
    }
  }
}
```

### 6. 后端实现需求

#### 6.1 数据模型层 (store.js)
- 添加 `offlineReminder: null` 到 `DEFAULT_ACCOUNT_CONFIG`
- 实现 `getAccountOfflineReminder(accountId)` 方法
- 实现 `setAccountOfflineReminder(accountId, cfg)` 方法
- 更新 `cloneAccountConfig()` 和 `normalizeAccountConfig()` 方法

#### 6.2 运行时层 (relogin-reminder.js)
- 修改 `getOfflineAutoDeleteMs(accountId)` 方法
  - 添加 `accountId` 参数
  - 优先使用账号级别配置
  - 回退到用户级别配置
  - 最后回退到全局配置
  
- 修改 `triggerOfflineReminder(accountId, ...)` 方法
  - 添加 `accountId` 参数
  - 应用相同的配置优先级逻辑

#### 6.3 工作管理层 (worker-manager.js)
- 调用 `getOfflineAutoDeleteMs()` 时传入 `accountId` 参数

#### 6.4 API 层 (admin.js)
- 实现 4 个新的 API 端点（见 3.3 部分）
- 修改 `GET /api/settings` 返回 `useGlobalOfflineReminder` 标识

### 7. 前端实现需求

#### 7.1 状态管理 (setting.ts)
- 添加 `accountOfflineReminder` 状态字段
- 添加 `useGlobalOfflineReminder` 状态字段
- 实现 `fetchAccountOfflineReminder(accountId)` 方法
- 实现 `saveAccountOfflineReminder(accountId, config)` 方法
- 更新 `fetchSettings()` 方法同步新字段

#### 7.2 UI 组件 (OfflineReminderConfig.vue)
- 创建可复用的配置组件
- Props：
  - `accountId: string` - 账号 ID
  - `useGlobal: boolean` - 是否使用全局配置
  - `globalConfig: object` - 全局配置
  - `accountConfig: object | null` - 账号级别配置
  
- Events：
  - `update:useGlobal` - 更新全局配置开关
  - `update:accountConfig` - 更新账号配置
  - `saved` - 配置保存成功
  
- 功能：
  - 显示"使用全局配置"开关
  - 根据开关状态显示/隐藏配置表单
  - 提供测试推送功能
  - 提供保存功能

#### 7.3 页面集成 (Settings.vue)
- 导入 `OfflineReminderConfig` 组件
- 在账号设置页面集成组件
- 处理配置加载和保存

### 8. 向后兼容性

- 现有的全局和用户级别配置保持不变
- 新增的账号级别配置为可选，默认为 null
- 旧版本的配置数据自动兼容
- 系统自动处理缺失的配置字段

### 9. 测试需求

- 后端代码语法检查通过
- 前端代码 TypeScript 检查通过
- 前端构建成功
- 后端启动成功
- API 端点可访问
- 组件正确渲染
- 配置保存功能正常
- 测试推送功能正常
- 配置优先级逻辑正确

### 10. 使用流程

1. 进入设置页面，选择要配置的账号
2. 在下线提醒部分，默认显示"使用全局配置"开关为开启
3. 关闭开关切换到账号级别配置
4. 编辑账号专属的通知参数
5. 点击"测试推送"验证配置
6. 点击"保存账号级配置"保存配置
7. 后续该账号离线时将使用此配置发送通知

## 文件清单

### 后端文件
- `core/src/models/store.js` - 数据模型
- `core/src/runtime/relogin-reminder.js` - 下线提醒逻辑
- `core/src/runtime/worker-manager.js` - 工作管理
- `core/src/controllers/admin.js` - API 端点

### 前端文件
- `web/src/stores/setting.ts` - 状态管理
- `web/src/components/OfflineReminderConfig.vue` - 配置组件
- `web/src/views/Settings.vue` - 设置页面

## 关键设计原则

1. **优先级清晰** - 配置优先级明确，便于理解和维护
2. **向后兼容** - 不破坏现有配置，新功能为可选
3. **可复用组件** - UI 组件独立，可在多个地方复用
4. **灵活配置** - 支持多种推送渠道和通知方式
5. **易于测试** - 提供测试推送功能验证配置
