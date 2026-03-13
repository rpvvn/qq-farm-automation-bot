<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import type { OfflineConfig } from '@/stores/setting'

interface Props {
  accountId: string
  useGlobal: boolean
  globalConfig: OfflineConfig
  accountConfig: OfflineConfig | null
}

const props = defineProps<Props>()

const emit = defineEmits<{
  'update:useGlobal': [value: boolean]
  'update:accountConfig': [config: OfflineConfig]
  'saved': []
}>()

const localUseGlobal = ref(props.useGlobal)
const localAccountConfig = ref<OfflineConfig>(props.accountConfig || {
  channel: 'webhook',
  reloginUrlMode: 'none',
  endpoint: '',
  token: '',
  title: '账号下线提醒',
  msg: '账号下线',
  offlineDeleteSec: 0,
})

watch(() => props.useGlobal, (val) => {
  localUseGlobal.value = val
})

watch(() => props.accountConfig, (val) => {
  if (val) {
    localAccountConfig.value = { ...val }
  }
})

watch(localUseGlobal, (val) => {
  emit('update:useGlobal', val)
})

watch(localAccountConfig, (val) => {
  emit('update:accountConfig', val)
}, { deep: true })

const displayConfig = computed(() => {
  return localUseGlobal.value ? props.globalConfig : localAccountConfig.value
})

const handleTestPush = () => {
  // TODO: 实现测试推送功能
  console.log('测试推送', displayConfig.value)
}
</script>

<template>
  <div class="offline-reminder-config">
    <div class="switch-section">
      <label class="switch-label">
        <input
          v-model="localUseGlobal"
          type="checkbox"
          class="switch-input"
        >
        <span>使用全局配置</span>
      </label>
    </div>

    <div v-if="localUseGlobal" class="global-config-preview">
      <h4>当前全局配置</h4>
      <div class="config-display">
        <div class="config-item">
          <label>推送渠道:</label>
          <span>{{ displayConfig.channel }}</span>
        </div>
        <div class="config-item">
          <label>接口地址:</label>
          <span>{{ displayConfig.endpoint || '(空)' }}</span>
        </div>
        <div class="config-item">
          <label>Token:</label>
          <span>{{ displayConfig.token ? '已设置' : '(空)' }}</span>
        </div>
        <div class="config-item">
          <label>通知标题:</label>
          <span>{{ displayConfig.title }}</span>
        </div>
        <div class="config-item">
          <label>通知内容:</label>
          <span>{{ displayConfig.msg }}</span>
        </div>
        <div class="config-item">
          <label>离线自动删除时间:</label>
          <span>{{ displayConfig.offlineDeleteSec }} 秒</span>
        </div>
        <div class="config-item">
          <label>重登录链接模式:</label>
          <span>{{ displayConfig.reloginUrlMode }}</span>
        </div>
      </div>
    </div>

    <div v-else class="account-config-form">
      <h4>账号专属配置</h4>
      <div class="form-group">
        <label>推送渠道</label>
        <select v-model="localAccountConfig.channel" class="form-control">
          <option value="webhook">Webhook</option>
          <option value="dingtalk">钉钉</option>
          <option value="wecom">企业微信</option>
          <option value="bark">Bark</option>
          <option value="telegram">Telegram</option>
        </select>
      </div>

      <div class="form-group">
        <label>接口地址</label>
        <input
          v-model="localAccountConfig.endpoint"
          type="text"
          class="form-control"
          placeholder="Webhook URL 或其他接口地址"
        >
      </div>

      <div class="form-group">
        <label>Token</label>
        <input
          v-model="localAccountConfig.token"
          type="text"
          class="form-control"
          placeholder="认证令牌"
        >
      </div>

      <div class="form-group">
        <label>通知标题</label>
        <input
          v-model="localAccountConfig.title"
          type="text"
          class="form-control"
          placeholder="账号下线提醒"
        >
      </div>

      <div class="form-group">
        <label>通知内容</label>
        <textarea
          v-model="localAccountConfig.msg"
          class="form-control"
          rows="3"
          placeholder="账号下线"
        />
      </div>

      <div class="form-group">
        <label>离线自动删除时间（秒）</label>
        <input
          v-model.number="localAccountConfig.offlineDeleteSec"
          type="number"
          class="form-control"
          placeholder="0 表示不自动删除"
          min="0"
        >
      </div>

      <div class="form-group">
        <label>重登录链接模式</label>
        <select v-model="localAccountConfig.reloginUrlMode" class="form-control">
          <option value="none">不包含</option>
          <option value="qq_link">QQ 链接</option>
          <option value="qr_link">二维码链接</option>
        </select>
      </div>

      <div class="actions">
        <button class="btn btn-primary" @click="handleTestPush">
          测试推送
        </button>
        <button class="btn btn-secondary" @click="$emit('saved')">
          保存账号级配置
        </button>
      </div>
    </div>
  </div>
</template>

<style scoped>
.offline-reminder-config {
  padding: 1rem;
}

.switch-section {
  margin-bottom: 1.5rem;
}

.switch-label {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  cursor: pointer;
}

.switch-input {
  cursor: pointer;
}

.global-config-preview {
  padding: 1rem;
  background-color: #f5f5f5;
  border-radius: 4px;
}

.config-display {
  display: flex;
  flex-direction: column;
  gap: 0.75rem;
}

.config-item {
  display: flex;
  gap: 0.5rem;
}

.config-item label {
  font-weight: 600;
  min-width: 150px;
}

.account-config-form {
  padding: 1rem;
}

.form-group {
  margin-bottom: 1rem;
}

.form-group label {
  display: block;
  margin-bottom: 0.5rem;
  font-weight: 600;
}

.form-control {
  width: 100%;
  padding: 0.5rem;
  border: 1px solid #ddd;
  border-radius: 4px;
  font-size: 14px;
}

.form-control:focus {
  outline: none;
  border-color: #4CAF50;
}

textarea.form-control {
  resize: vertical;
}

.actions {
  margin-top: 1.5rem;
  display: flex;
  gap: 1rem;
}

.btn {
  padding: 0.5rem 1rem;
  border: none;
  border-radius: 4px;
  cursor: pointer;
  font-size: 14px;
}

.btn-secondary {
  background-color: #4CAF50;
  color: white;
}

.btn-secondary:hover {
  background-color: #45a049;
}

h4 {
  margin-top: 0;
  margin-bottom: 1rem;
}
</style>
