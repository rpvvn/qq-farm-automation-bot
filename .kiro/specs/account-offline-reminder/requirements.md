# 需求文档：账号下线提醒功能

## 功能概述

实现一个三层级的账号下线提醒系统，支持全局配置、用户级别配置和账号级别配置，允许不同粒度的通知管理。

## 需求列表

### 需求 1：三层级配置系统

**用户故事**：作为系统管理员，我希望能够在不同层级配置下线提醒，以便灵活管理不同账号的通知策略。

#### 验收标准

1.1. WHEN 系统查找下线提醒配置 THEN 系统 SHALL 按照账号级别 > 用户级别 > 全局配置的优先级顺序查找

1.2. WHEN 账号级别配置存在 THEN 系统 SHALL 使用账号级别配置，忽略用户级别和全局配置

1.3. WHEN 账号级别配置不存在且用户级别配置存在 THEN 系统 SHALL 使用用户级别配置，忽略全局配置

1.4. WHEN 账号级别和用户级别配置都不存在 THEN 系统 SHALL 使用全局配置

### 需求 2：账号级别配置管理

**用户故事**：作为用户，我希望能够为特定账号设置专属的下线提醒配置，以便对重要账号进行特殊处理。

#### 验收标准

2.1. WHEN 用户访问账号设置页面 THEN 系统 SHALL 显示"使用全局配置"开关

2.2. WHEN 用户关闭"使用全局配置"开关 THEN 系统 SHALL 显示账号专属配置表单

2.3. WHEN 用户保存账号级别配置 THEN 系统 SHALL 将配置存储到 `accountConfigs[accountId].offlineReminder`

2.4. WHEN 用户删除账号级别配置（设置为 null） THEN 系统 SHALL 回退到使用用户级别或全局配置

### 需求 3：配置数据持久化

**用户故事**：作为系统，我需要正确存储和加载配置数据，以确保配置在重启后仍然有效。

#### 验收标准

3.1. WHEN 系统保存账号级别配置 THEN 系统 SHALL 将配置写入 store.json 文件的 `accountConfigs[accountId].offlineReminder` 字段

3.2. WHEN 系统启动时 THEN 系统 SHALL 从 store.json 加载所有层级的配置

3.3. WHEN 配置字段缺失或无效 THEN 系统 SHALL 使用默认值进行规范化

3.4. WHEN 保存配置时 THEN 系统 SHALL 对所有字段进行验证和规范化

### 需求 4：下线提醒触发

**用户故事**：作为用户，我希望在账号离线时收到通知，以便及时了解账号状态。

#### 验收标准

4.1. WHEN 账号 WebSocket 连接断开 THEN 系统 SHALL 触发下线提醒流程

4.2. WHEN 触发下线提醒 THEN 系统 SHALL 按优先级查找有效配置

4.3. WHEN 找到有效配置 THEN 系统 SHALL 使用配置的渠道和参数发送通知

4.4. WHEN 配置中包含重登录链接模式 THEN 系统 SHALL 生成相应的重登录链接并附加到通知内容

### 需求 5：自动删除功能

**用户故事**：作为用户，我希望能够设置账号离线后自动删除的时间，以便自动清理长期离线的账号。

#### 验收标准

5.1. WHEN 账号离线时间达到配置的 `offlineDeleteSec` THEN 系统 SHALL 自动删除该账号

5.2. WHEN `offlineDeleteSec` 为 0 THEN 系统 SHALL 不自动删除账号

5.3. WHEN 账号在删除前重新连接 THEN 系统 SHALL 取消自动删除计时

5.4. WHEN 执行自动删除 THEN 系统 SHALL 先发送下线提醒，然后停止 Worker 进程，最后从存储中删除账号信息

### 需求 6：API 端点实现

**用户故事**：作为前端开发者，我需要 API 端点来管理账号级别配置。

#### 验收标准

6.1. WHEN 调用 GET /api/settings/account-offline-reminder THEN 系统 SHALL 返回指定账号的配置或 null

6.2. WHEN 调用 POST /api/settings/account-offline-reminder THEN 系统 SHALL 保存账号级别配置并返回保存后的配置

6.3. WHEN 调用 POST /api/settings/account-offline-reminder/test THEN 系统 SHALL 使用提供的配置发送测试通知

6.4. WHEN 调用 GET /api/settings THEN 系统 SHALL 在响应中包含 `useGlobalOfflineReminder` 标识

### 需求 7：权限控制

**用户故事**：作为系统，我需要确保用户只能访问和修改自己的账号配置。

#### 验收标准

7.1. WHEN 普通用户访问账号配置 THEN 系统 SHALL 验证该账号属于当前用户

7.2. WHEN 管理员访问账号配置 THEN 系统 SHALL 允许访问所有账号

7.3. WHEN 用户尝试访问不属于自己的账号 THEN 系统 SHALL 返回 403 Forbidden 错误

### 需求 8：配置验证

**用户故事**：作为系统，我需要验证配置的有效性，以防止错误配置导致功能异常。

#### 验收标准

8.1. WHEN 保存配置时 THEN 系统 SHALL 验证 `channel` 是否为支持的渠道

8.2. WHEN 保存配置时 THEN 系统 SHALL 验证必填字段（token, title, msg）不为空

8.3. WHEN 保存 Webhook 渠道配置时 THEN 系统 SHALL 验证 `endpoint` 不为空

8.4. WHEN 保存配置时 THEN 系统 SHALL 验证 `offlineDeleteSec` >= 0

8.5. WHEN 保存配置时 THEN 系统 SHALL 验证 `reloginUrlMode` 是否为有效值（none, qq_link, qr_link）

### 需求 9：前端组件

**用户故事**：作为用户，我需要友好的界面来配置账号级别的下线提醒。

#### 验收标准

9.1. WHEN 用户打开账号设置页面 THEN 系统 SHALL 显示 OfflineReminderConfig 组件

9.2. WHEN "使用全局配置"开关打开 THEN 系统 SHALL 显示全局配置的只读预览

9.3. WHEN "使用全局配置"开关关闭 THEN 系统 SHALL 显示可编辑的账号级别配置表单

9.4. WHEN 用户点击"测试推送"按钮 THEN 系统 SHALL 使用当前配置发送测试通知并显示结果

9.5. WHEN 用户点击"保存账号级配置"按钮 THEN 系统 SHALL 保存配置并显示成功提示

### 需求 10：向后兼容性

**用户故事**：作为系统，我需要确保新功能不破坏现有配置和功能。

#### 验收标准

10.1. WHEN 系统加载旧版本的 store.json THEN 系统 SHALL 正确处理缺失的 `offlineReminder` 字段

10.2. WHEN 账号配置中没有 `offlineReminder` 字段 THEN 系统 SHALL 将其视为 null

10.3. WHEN 系统规范化账号配置 THEN 系统 SHALL 保留所有现有字段

10.4. WHEN 系统保存配置 THEN 系统 SHALL 不删除或修改其他配置字段

