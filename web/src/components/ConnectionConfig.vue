<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '@/api'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'

const loading = ref(false)
const saving = ref(false)

const localConfig = ref({
  serverUrl: '',
  clientVersion: '',
  platform: 'qq',
  os: 'iOS',
  sysSoftware: '',
  network: 'wifi',
  memory: '',
  deviceId: '',
})

const platformOptions = [
  { label: 'QQ', value: 'qq' },
  { label: '微信', value: 'wx' },
]

const osOptions = [
  { label: 'iOS', value: 'iOS' },
  { label: 'Android', value: 'Android' },
]

const networkOptions = [
  { label: 'WiFi', value: 'wifi' },
  { label: '4G', value: '4g' },
  { label: '5G', value: '5g' },
]

const emit = defineEmits<{
  alert: [message: string, type?: 'primary' | 'danger']
}>()

async function loadConfig() {
  loading.value = true
  try {
    const { data } = await api.get('/api/settings/connection')
    if (data?.ok && data?.data) {
      localConfig.value = {
        serverUrl: data.data.serverUrl || '',
        clientVersion: data.data.clientVersion || '',
        platform: data.data.platform || 'qq',
        os: data.data.os || 'iOS',
        sysSoftware: data.data.sysSoftware || '',
        network: data.data.network || 'wifi',
        memory: data.data.memory || '',
        deviceId: data.data.deviceId || '',
      }
    }
  }
  catch (e: any) {
    console.error('加载连接配置失败', e)
  }
  finally {
    loading.value = false
  }
}

async function saveConfig() {
  saving.value = true
  try {
    const { data } = await api.post('/api/settings/connection', localConfig.value)
    if (data?.ok) {
      emit('alert', '连接配置已保存，重启账号后生效')
    }
    else {
      emit('alert', `保存失败: ${data?.error || '未知错误'}`, 'danger')
    }
  }
  catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '请求失败'
    emit('alert', `保存失败: ${msg}`, 'danger')
  }
  finally {
    saving.value = false
  }
}

async function resetToDefault() {
  try {
    const { data } = await api.post('/api/settings/connection/reset')
    if (data?.ok) {
      await loadConfig()
      emit('alert', '已恢复默认配置')
    }
    else {
      emit('alert', `恢复失败: ${data?.error || '未知错误'}`, 'danger')
    }
  }
  catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '请求失败'
    emit('alert', `恢复失败: ${msg}`, 'danger')
  }
}

onMounted(() => {
  loadConfig()
})
</script>

<template>
  <div class="connection-config">
    <div v-if="loading" class="py-4 text-center text-gray-500">
      <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl" />
      <p>加载中...</p>
    </div>

    <div v-else class="space-y-3">
      <div class="rounded border border-blue-200 bg-blue-50/60 p-3 dark:border-blue-800/60 dark:bg-blue-900/10">
        <div class="mb-2 flex items-center gap-2 text-sm text-blue-800 font-medium dark:text-blue-300">
          <div class="i-carbon-information" />
          <span>服务器配置</span>
        </div>
        <div class="space-y-3">
          <BaseInput
            v-model="localConfig.serverUrl"
            label="WebSocket 地址"
            type="text"
            placeholder="wss://gate-obt.nqf.qq.com/prod/ws"
          />
          <BaseInput
            v-model="localConfig.clientVersion"
            label="客户端版本号"
            type="text"
            placeholder="1.7.0.6_20260313"
          />
        </div>
      </div>

      <div class="rounded border border-purple-200 bg-purple-50/60 p-3 dark:border-purple-800/60 dark:bg-purple-900/10">
        <div class="mb-2 flex items-center gap-2 text-sm text-purple-800 font-medium dark:text-purple-300">
          <div class="i-carbon-devices" />
          <span>设备信息</span>
        </div>
        <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
          <BaseSelect
            v-model="localConfig.platform"
            label="平台类型"
            :options="platformOptions"
          />
          <BaseSelect
            v-model="localConfig.os"
            label="操作系统"
            :options="osOptions"
          />
          <BaseInput
            v-model="localConfig.sysSoftware"
            label="系统版本"
            type="text"
            placeholder="iOS 26.2.1"
          />
          <BaseSelect
            v-model="localConfig.network"
            label="网络类型"
            :options="networkOptions"
          />
          <BaseInput
            v-model="localConfig.memory"
            label="内存大小 (MB)"
            type="text"
            placeholder="7672"
          />
          <BaseInput
            v-model="localConfig.deviceId"
            label="设备 ID"
            type="text"
            placeholder="iPhone X<iPhone18,3>"
          />
        </div>
      </div>

      <div class="rounded border border-amber-200 bg-amber-50/60 p-2 dark:border-amber-800/60 dark:bg-amber-900/10">
        <p class="text-xs text-amber-700 dark:text-amber-300">
          <span class="font-medium">提示：</span>修改这些配置可能影响账号登录和游戏连接，请谨慎操作。修改后需要重启账号才能生效。
        </p>
      </div>
    </div>

    <div class="mt-4 flex justify-end gap-2">
      <BaseButton
        variant="secondary"
        size="sm"
        @click="resetToDefault"
      >
        恢复默认
      </BaseButton>
      <BaseButton
        variant="primary"
        size="sm"
        :loading="saving"
        @click="saveConfig"
      >
        保存连接配置
      </BaseButton>
    </div>
  </div>
</template>
