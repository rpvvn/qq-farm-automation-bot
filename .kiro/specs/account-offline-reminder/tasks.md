# 实现计划：账号下线提醒系统

## 概述

实现一个三层级的账号下线提醒系统，支持全局配置、用户级别配置和账号级别配置。配置优先级：账号级别 > 用户级别 > 全局配置。系统将修改后端数据模型、运行时逻辑、API 端点，并创建前端配置组件和状态管理。

## 任务

- [x] 1. 实现数据模型层 (store.js)
  - [x] 1.1 扩展 DEFAULT_ACCOUNT_CONFIG 添加 offlineReminder 字段
    - 在 DEFAULT_ACCOUNT_CONFIG 对象中添加 `offlineReminder: null`
    - _需求: 2.1, 2.2, 3.1, 3.2_
  
  - [x] 1.2 实现 getAccountOfflineReminder 函数
    - 接收 accountId 参数
    - 返回账号级别配置或 null
    - 处理无效 accountId 的情况
    - _需求: 2.3, 6.1_
  
  - [x] 1.3 实现 setAccountOfflineReminder 函数
    - 接收 accountId 和 cfg 参数
    - 保存配置到 accountConfigs[accountId].offlineReminder
    - 支持 null 值（表示删除配置）
    - 调用 saveGlobalConfig 持久化
    - _需求: 2.3, 3.3, 6.2_
  
  - [x] 1.4 实现 getEffectiveOfflineReminder 函数
    - 接收 accountId 和 username 参数
    - 按优先级查找：账号级别 > 用户级别 > 全局配置
    - 返回第一个非 null 配置
    - _需求: 1.1, 1.2, 1.3, 1.4, 4.1_
  
  - [x] 1.5 修改 cloneAccountConfig 函数
    - 添加 offlineReminder 字段的克隆逻辑
    - 如果存在则调用 normalizeOfflineReminder
    - _需求: 6.1_
  
  - [x] 1.6 修改 normalizeAccountConfig 函数
    - 添加 offlineReminder 字段的规范化逻辑
    - 处理 null 和对象两种情况
    - _需求: 6.1_
  
  - [x] 1.7 导出新增函数
    - 在 module.exports 中添加三个新函数
    - _需求: 6.1_

- [x] 2. 实现运行时层 (relogin-reminder.js)
  - [x] 2.1 修改 getOfflineAutoDeleteMs 函数
    - 添加 accountId 参数（保留 username 参数）
    - 调用 store.getEffectiveOfflineReminder 获取配置
    - 根据 offlineDeleteSec 计算毫秒数
    - offlineDeleteSec 为 0 时返回 Infinity
    - _需求: 4.2, 5.2, 6.2_
  
  - [x] 2.2 修改 triggerOfflineReminder 函数
    - 从 payload 中提取 accountId 和 username
    - 调用 store.getEffectiveOfflineReminder 获取配置
    - 如果配置不存在，记录错误并返回
    - 使用配置中的参数构建通知
    - _需求: 4.1, 4.3, 6.2_

- [x] 3. 实现工作管理层 (worker-manager.js)
  - [x] 3.1 修改 handleWorkerMessage 中的离线处理逻辑
    - 调用 getOfflineAutoDeleteMs 时传入 accountId 和 username
    - 调用 triggerOfflineReminder 时传入完整的 payload（包含 accountId）
    - _需求: 4.1, 6.3_

- [x] 4. 实现 API 层 (admin.js)
  - [x] 4.1 实现 GET /api/settings/account-offline-reminder 端点
    - 添加 authRequired 中间件
    - 从请求头获取 x-account-id
    - 检查用户权限（管理员或账号所有者）
    - 调用 store.getAccountOfflineReminder 获取配置
    - 返回配置或 null
    - _需求: 3.3, 6.4, 7.1_
  
  - [x] 4.2 实现 POST /api/settings/account-offline-reminder 端点
    - 添加 authRequired 中间件
    - 从请求头获取 x-account-id
    - 检查用户权限
    - 从请求体获取配置对象
    - 调用 store.setAccountOfflineReminder 保存配置
    - 返回保存后的配置
    - _需求: 3.3, 6.4, 7.2_
  
  - [x] 4.3 实现 POST /api/settings/account-offline-reminder/test 端点
    - 添加 authRequired 中间件
    - 从请求头获取 x-account-id
    - 检查用户权限
    - 验证配置完整性（必填字段）
    - 获取账号信息构建测试通知
    - 调用 sendPushooMessage 发送测试通知
    - 返回发送结果
    - _需求: 3.3, 3.4, 6.4_
  
  - [x] 4.4 修改 GET /api/settings 端点
    - 添加 useGlobalOfflineReminder 字段到响应
    - 判断用户级别配置是否存在
    - _需求: 2.1, 6.4_

- [x] 5. Checkpoint - 后端代码验证
  - 运行后端代码语法检查，确保所有修改无语法错误，询问用户是否有问题

- [x] 6. 实现前端状态管理 (setting.ts)
  - [x] 6.1 添加状态字段
    - 添加 accountOfflineReminder 字段（类型：OfflineReminderConfig | null）
    - 添加 useGlobalOfflineReminder 字段（类型：boolean）
    - _需求: 7.1_
  
  - [x] 6.2 实现 fetchAccountOfflineReminder 方法
    - 接收 accountId 参数
    - 调用 GET /api/settings/account-offline-reminder
    - 设置请求头 x-account-id
    - 更新 accountOfflineReminder 状态
    - _需求: 7.1_
  
  - [x] 6.3 实现 saveAccountOfflineReminder 方法
    - 接收 accountId 和 config 参数
    - 调用 POST /api/settings/account-offline-reminder
    - 设置请求头 x-account-id
    - 更新 accountOfflineReminder 状态
    - _需求: 7.1_
  
  - [x] 6.4 实现 testAccountOfflineReminder 方法
    - 接收 accountId 和 config 参数
    - 调用 POST /api/settings/account-offline-reminder/test
    - 设置请求头 x-account-id
    - 返回测试结果
    - _需求: 7.1_
  
  - [x] 6.5 修改 fetchSettings 方法
    - 同步 useGlobalOfflineReminder 字段到状态
    - _需求: 7.1_

- [x] 7. 创建 OfflineReminderConfig 组件
  - [x] 7.1 创建组件文件和基本结构
    - 创建 web/src/components/OfflineReminderConfig.vue
    - 定义 Props: accountId, useGlobal, globalConfig, accountConfig
    - 定义 Events: update:useGlobal, update:accountConfig, saved
    - _需求: 3.4, 7.2_
  
  - [x] 7.2 实现"使用全局配置"开关
    - 添加 checkbox 绑定到 useGlobal
    - 触发 update:useGlobal 事件
    - _需求: 3.1, 3.4_
  
  - [x] 7.3 实现全局配置预览区域
    - 当 useGlobal 为 true 时显示
    - 只读显示全局配置的所有字段
    - _需求: 3.4_
  
  - [x] 7.4 实现账号级别配置表单
    - 当 useGlobal 为 false 时显示
    - 包含所有配置字段：channel, endpoint, token, title, msg, offlineDeleteSec, reloginUrlMode
    - 双向绑定到 accountConfig
    - _需求: 3.1, 3.4_
  
  - [x] 7.5 实现测试推送功能
    - 添加"测试推送"按钮
    - 调用 testAccountOfflineReminder 方法
    - 显示测试结果（成功/失败消息）
    - _需求: 3.4_
  
  - [x] 7.6 实现保存配置功能
    - 添加"保存账号级配置"按钮
    - 调用 saveAccountOfflineReminder 方法
    - 触发 saved 事件
    - 显示保存结果
    - _需求: 3.4_

- [x] 8. 集成到 Settings 页面
  - [x] 8.1 导入 OfflineReminderConfig 组件
    - 在 Settings.vue 中导入组件
    - 注册组件
    - _需求: 7.3_
  
  - [x] 8.2 添加下线提醒设置区域
    - 在账号设置页面添加新的 section
    - 使用 OfflineReminderConfig 组件
    - 传入必要的 props
    - _需求: 7.3_
  
  - [x] 8.3 实现配置加载逻辑
    - 当选择账号时调用 fetchAccountOfflineReminder
    - 加载全局配置和账号配置
    - _需求: 7.3_
  
  - [x] 8.4 实现事件处理
    - 处理 update:useGlobal 事件
    - 处理 update:accountConfig 事件
    - 处理 saved 事件（显示成功提示）
    - _需求: 7.3_

- [x] 9. Checkpoint - 前端代码验证
  - 运行 TypeScript 类型检查，运行前端构建，确保所有修改无错误，询问用户是否有问题

- [ ]* 10. 编写配置优先级测试
  - [ ]* 10.1 测试账号级别配置优先
    - **属性 1: 配置查找优先级**
    - **验证需求: 1.1, 1.2, 1.3, 1.4, 2.4, 4.2**
    - 设置账号级别配置，验证 getEffectiveOfflineReminder 返回账号配置
  
  - [ ]* 10.2 测试用户级别配置回退
    - **属性 1: 配置查找优先级**
    - **验证需求: 1.1, 1.2, 1.3, 1.4, 2.4, 4.2**
    - 删除账号级别配置，验证回退到用户配置
  
  - [ ]* 10.3 测试全局配置回退
    - **属性 1: 配置查找优先级**
    - **验证需求: 1.1, 1.2, 1.3, 1.4, 2.4, 4.2**
    - 删除账号和用户配置，验证回退到全局配置

- [ ]* 11. 编写配置持久化测试
  - [ ]* 11.1 测试配置保存和读取一致性
    - **属性 2: 配置持久化 Round-Trip**
    - **验证需求: 2.3, 3.1, 6.2**
    - 保存配置后立即读取，验证所有字段值相同

- [ ]* 12. 编写配置验证测试
  - [ ]* 12.1 测试必填字段验证
    - **属性 4: 配置验证**
    - **验证需求: 8.1, 8.2, 8.3, 8.4, 8.5**
    - 测试空 token、title、msg 被拒绝
  
  - [ ]* 12.2 测试 channel 验证
    - **属性 4: 配置验证**
    - **验证需求: 8.1, 8.2, 8.3, 8.4, 8.5**
    - 测试不支持的 channel 值被拒绝
  
  - [ ]* 12.3 测试 offlineDeleteSec 验证
    - **属性 4: 配置验证**
    - **验证需求: 8.1, 8.2, 8.3, 8.4, 8.5**
    - 测试负数被拒绝或规范化为 0

- [ ]* 13. 编写删除时间计算测试
  - [ ]* 13.1 测试 offlineDeleteSec 为 0 返回 Infinity
    - **属性 5: 删除时间计算**
    - **验证需求: 5.2**
  
  - [ ]* 13.2 测试 offlineDeleteSec > 0 返回正确毫秒数
    - **属性 5: 删除时间计算**
    - **验证需求: 5.2**

- [ ]* 14. 编写通知内容构建测试
  - [ ]* 14.1 测试 reloginUrlMode 为 none 不包含链接
    - **属性 6: 通知内容构建**
    - **验证需求: 4.4**
  
  - [ ]* 14.2 测试 reloginUrlMode 不为 none 包含链接
    - **属性 6: 通知内容构建**
    - **验证需求: 4.4**

- [ ]* 15. 编写 API 权限测试
  - [ ]* 15.1 测试管理员访问任意账号配置
    - **属性 8: 权限检查**
    - **验证需求: 7.1, 7.2, 7.3**
  
  - [ ]* 15.2 测试普通用户访问自己的账号配置
    - **属性 8: 权限检查**
    - **验证需求: 7.1, 7.2, 7.3**
  
  - [ ]* 15.3 测试普通用户访问他人账号配置被拒绝
    - **属性 8: 权限检查**
    - **验证需求: 7.1, 7.2, 7.3**

- [x] 16. 最终验证和集成测试
  - 验证完整流程：配置 → 保存 → 测试推送 → 账号离线 → 收到通知
  - 确保所有组件正确集成，询问用户是否有问题

## 注意事项

- 标记 `*` 的任务为可选测试任务，可跳过以加快 MVP 开发
- 每个任务都引用了具体的需求编号以确保可追溯性
- Checkpoint 任务确保增量验证
- 属性测试验证系统的通用正确性属性
- 实现任务按照依赖顺序排列：数据层 → 运行时层 → API 层 → 前端层
