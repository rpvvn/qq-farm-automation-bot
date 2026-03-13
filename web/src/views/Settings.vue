<script setup lang="ts">
import { storeToRefs } from 'pinia'
import { computed, onMounted, ref, watch, watchEffect } from 'vue'
import api from '@/api'
import ConfirmModal from '@/components/ConfirmModal.vue'
import ConnectionConfig from '@/components/ConnectionConfig.vue'
import BaseButton from '@/components/ui/BaseButton.vue'
import BaseInput from '@/components/ui/BaseInput.vue'
import BaseSelect from '@/components/ui/BaseSelect.vue'
import BaseSwitch from '@/components/ui/BaseSwitch.vue'
import { useAccountStore } from '@/stores/account'
import { useFarmStore } from '@/stores/farm'
import { useSettingStore } from '@/stores/setting'
import { useUserStore } from '@/stores/user'

const settingStore = useSettingStore()
const accountStore = useAccountStore()
const farmStore = useFarmStore()
const userStore = useUserStore()

const { settings, loading } = storeToRefs(settingStore)
const { currentAccountId, accounts } = storeToRefs(accountStore)
const { seeds } = storeToRefs(farmStore)

const saving = ref(false)
const passwordSaving = ref(false)
const offlineSaving = ref(false)
const offlineTesting = ref(false)
const applyingDefaults = ref(false)
const strategyCollapsed = ref(localStorage.getItem('settings_strategy_collapsed') === 'true')
const automationCollapsed = ref(localStorage.getItem('settings_automation_collapsed') === 'true')

watch(strategyCollapsed, (val) => {
  localStorage.setItem('settings_strategy_collapsed', String(val))
})

watch(automationCollapsed, (val) => {
  localStorage.setItem('settings_automation_collapsed', String(val))
})

const modalVisible = ref(false)
const modalConfig = ref({
  title: '',
  message: '',
  type: 'primary' as 'primary' | 'danger',
  isAlert: true,
})

function showAlert(message: string, type: 'primary' | 'danger' = 'primary') {
  modalConfig.value = {
    title: type === 'danger' ? '错误' : '提示',
    message,
    type,
    isAlert: true,
  }
  modalVisible.value = true
}

const currentAccountName = computed(() => {
  const acc = accounts.value.find((a: any) => a.id === currentAccountId.value)
  return acc ? (acc.name || acc.nick || acc.id) : null
})

const allFertilizerLandTypes = ['gold', 'black', 'red', 'normal']

const fertilizerLandTypeOptions = [
  { label: '金土地', value: 'gold' },
  { label: '黑土地', value: 'black' },
  { label: '红土地', value: 'red' },
  { label: '普通土地', value: 'normal' },
]

function normalizeFertilizerLandTypes(input: unknown) {
  const source = Array.isArray(input) ? input : allFertilizerLandTypes
  const normalized: string[] = []
  for (const item of source) {
    const value = String(item || '').trim().toLowerCase()
    if (!allFertilizerLandTypes.includes(value))
      continue
    if (normalized.includes(value))
      continue
    normalized.push(value)
  }
  return normalized
}

const localSettings = ref({
  plantingStrategy: 'max_exp',
  preferredSeedId: 0,
  bagSeedPriority: [] as number[],
  bagSeedFallbackStrategy: 'level',
  stealDelaySeconds: 0,
  plantOrderRandom: false,
  plantDelaySeconds: 0,
  intervals: { farmMin: 2, farmMax: 5, helpMin: 10, helpMax: 15, stealMin: 10, stealMax: 15 },
  friendQuietHours: { enabled: false, start: '23:00', end: '07:00' },
  automation: {
    farm: false,
    task: false,
    sell: false,
    friend: false,
    farm_push: false,
    land_upgrade: false,
    friend_steal: false,
    friend_help: false,
    friend_bad: false,
    friend_help_exp_limit: false,
    fertilizer_gift: false,
    fertilizer_buy: false,
    fertilizer: 'normal',
    skip_own_weed_bug: false,
    fertilizer_multi_season: false,
    fertilizer_land_types: [...allFertilizerLandTypes],
    fertilizer_smart_seconds: 300,
  },
  fertilizerBuyType: 'inorganic',
  fertilizerBuyCount: 10,
})

const localOffline = ref({
  channel: 'webhook',
  reloginUrlMode: 'none',
  endpoint: '',
  token: '',
  title: '',
  msg: '',
  offlineDeleteSec: 0,
})

const passwordForm = ref({
  old: '',
  new: '',
  confirm: '',
})

function syncLocalSettings() {
  if (settings.value) {
    localSettings.value = JSON.parse(JSON.stringify({
      plantingStrategy: settings.value.plantingStrategy,
      preferredSeedId: settings.value.preferredSeedId,
      bagSeedPriority: settings.value.bagSeedPriority ?? [],
      bagSeedFallbackStrategy: settings.value.bagSeedFallbackStrategy ?? 'level',
      stealDelaySeconds: settings.value.stealDelaySeconds ?? 0,
      plantOrderRandom: !!settings.value.plantOrderRandom,
      plantDelaySeconds: settings.value.plantDelaySeconds ?? 0,
      intervals: settings.value.intervals,
      friendQuietHours: settings.value.friendQuietHours,
      automation: settings.value.automation,
      fertilizerBuyType: settings.value.fertilizerBuyType ?? 'organic',
      fertilizerBuyCount: settings.value.fertilizerBuyCount ?? 0,
    }))

    if (!localSettings.value.automation) {
      localSettings.value.automation = {
        farm: false,
        task: false,
        sell: false,
        friend: false,
        farm_push: false,
        land_upgrade: false,
        friend_steal: false,
        friend_help: false,
        friend_bad: false,
        friend_help_exp_limit: false,
        fertilizer_gift: false,
        fertilizer_buy: false,
        fertilizer: 'none',
        skip_own_weed_bug: false,
        fertilizer_multi_season: false,
        fertilizer_land_types: [...allFertilizerLandTypes],
        fertilizer_smart_seconds: 300,
      }
    }
    else {
      const defaults = {
        farm: false,
        task: false,
        sell: false,
        friend: false,
        farm_push: false,
        land_upgrade: false,
        friend_steal: false,
        friend_help: false,
        friend_bad: false,
        friend_help_exp_limit: false,
        fertilizer_gift: false,
        fertilizer_buy: false,
        fertilizer: 'none',
        skip_own_weed_bug: false,
        fertilizer_multi_season: false,
        fertilizer_land_types: [...allFertilizerLandTypes],
        fertilizer_smart_seconds: 300,
      }
      localSettings.value.automation = {
        ...defaults,
        ...localSettings.value.automation,
      }
    }
    localSettings.value.automation.fertilizer_land_types = normalizeFertilizerLandTypes(localSettings.value.automation.fertilizer_land_types)
    if (localSettings.value.automation.fertilizer_smart_seconds === undefined) {
      localSettings.value.automation.fertilizer_smart_seconds = 300
    }
    if (settings.value.offlineReminder) {
      localOffline.value = JSON.parse(JSON.stringify(settings.value.offlineReminder))
    }
  }
}

async function loadData() {
  if (currentAccountId.value) {
    await settingStore.fetchSettings(currentAccountId.value)
    syncLocalSettings()
    await farmStore.fetchSeeds(currentAccountId.value)
  }
}

onMounted(() => {
  loadData()
})

watch(currentAccountId, () => {
  loadData()
})

const fertilizerOptions = [
  { label: '普通 + 有机', value: 'both' },
  { label: '普通 + 快成熟有机', value: 'smart' },
  { label: '仅普通化肥', value: 'normal' },
  { label: '仅有机化肥', value: 'organic' },
  { label: '不施肥', value: 'none' },
]

const fertilizerBuyTypeOptions = [
  { label: '有机化肥', value: 'organic' },
  { label: '无机化肥', value: 'normal' },
]

const plantingStrategyOptions = [
  { label: '优先种植种子', value: 'preferred' },
  { label: '最高等级作物', value: 'level' },
  { label: '最大经验/时', value: 'max_exp' },
  { label: '最大普通肥经验/时', value: 'max_fert_exp' },
  { label: '最大净利润/时', value: 'max_profit' },
  { label: '最大普通肥净利润/时', value: 'max_fert_profit' },
  { label: '背包种子优先', value: 'bag_priority' },
]

const BAG_FALLBACK_STRATEGY_OPTIONS = [
  { label: '最高等级作物', value: 'level' },
  { label: '最大经验/时', value: 'max_exp' },
  { label: '最大普通肥经验/时', value: 'max_fert_exp' },
  { label: '最大净利润/时', value: 'max_profit' },
  { label: '最大普通肥净利润/时', value: 'max_fert_profit' },
  { label: '优先种植种子', value: 'preferred' },
]

const channelOptions = [
  { label: 'Webhook(自定义接口)', value: 'webhook' },
  { label: 'Qmsg 酱', value: 'qmsg' },
  { label: 'Server 酱', value: 'serverchan' },
  { label: 'Push Plus', value: 'pushplus' },
  { label: 'Push Plus Hxtrip', value: 'pushplushxtrip' },
  { label: '钉钉', value: 'dingtalk' },
  { label: '企业微信', value: 'wecom' },
  { label: 'Bark', value: 'bark' },
  { label: 'Go-cqhttp', value: 'gocqhttp' },
  { label: 'OneBot', value: 'onebot' },
  { label: 'Atri', value: 'atri' },
  { label: 'PushDeer', value: 'pushdeer' },
  { label: 'iGot', value: 'igot' },
  { label: 'Telegram', value: 'telegram' },
  { label: '飞书', value: 'feishu' },
  { label: 'IFTTT', value: 'ifttt' },
  { label: '企业微信群机器人', value: 'wecombot' },
  { label: 'Discord', value: 'discord' },
  { label: 'WxPusher', value: 'wxpusher' },
]

const CHANNEL_DOCS: Record<string, string> = {
  webhook: '',
  qmsg: 'https://qmsg.zendee.cn/',
  serverchan: 'https://sct.ftqq.com/',
  pushplus: 'https://www.pushplus.plus/',
  pushplushxtrip: 'https://pushplus.hxtrip.com/',
  dingtalk: 'https://open.dingtalk.com/document/group/custom-robot-access',
  wecom: 'https://guole.fun/posts/626/',
  wecombot: 'https://developer.work.weixin.qq.com/document/path/91770',
  bark: 'https://github.com/Finb/Bark',
  gocqhttp: 'https://docs.go-cqhttp.org/api/',
  onebot: 'https://docs.go-cqhttp.org/api/',
  atri: 'https://blog.tianli0.top/',
  pushdeer: 'https://www.pushdeer.com/',
  igot: 'https://push.hellyw.com/',
  telegram: 'https://core.telegram.org/bots',
  feishu: 'https://www.feishu.cn/hc/zh-CN/articles/360024984973',
  ifttt: 'https://ifttt.com/maker_webhooks',
  discord: 'https://discord.com/developers/docs/resources/webhook#execute-webhook',
  wxpusher: 'https://wxpusher.zjiecode.com/docs/#/',
}

const reloginUrlModeOptions = [
  { label: '不需要', value: 'none' },
  { label: 'QQ直链', value: 'qq_link' },
  { label: '二维码链接', value: 'qr_link' },
]

const currentChannelDocUrl = computed(() => {
  const key = String(localOffline.value.channel || '').trim().toLowerCase()
  return CHANNEL_DOCS[key] || ''
})

function openChannelDocs() {
  const url = currentChannelDocUrl.value
  if (!url)
    return
  window.open(url, '_blank', 'noopener,noreferrer')
}

const preferredSeedOptions = computed(() => {
  const options = [{ label: '自动选择', value: 0 }]
  if (seeds.value) {
    options.push(...seeds.value.map(seed => ({
      label: `${seed.requiredLevel}级 ${seed.name} (${seed.price}金)`,
      value: seed.seedId,
      disabled: seed.locked || seed.soldOut,
    })))
  }
  return options
})

const analyticsSortByMap: Record<string, string> = {
  max_exp: 'exp',
  max_fert_exp: 'fert',
  max_profit: 'profit',
  max_fert_profit: 'fert_profit',
}

const strategyPreviewLabel = ref<string | null>(null)

// 背包种子优先策略相关
interface BagSeedItem {
  seedId: number
  name: string
  count: number
  requiredLevel: number
  plantSize: number
}

const bagSeeds = ref<BagSeedItem[]>([])
const bagSeedsLoading = ref(false)
const bagSeedsError = ref<string | null>(null)
const draggingBagSeedId = ref<number | null>(null)

const sortedBagSeeds = computed(() => {
  const priority = localSettings.value.bagSeedPriority || []
  const indexMap = new Map<number, number>()
  priority.forEach((seedId, index) => indexMap.set(seedId, index))

  return [...bagSeeds.value].sort((a, b) => {
    const aIndex = indexMap.has(a.seedId) ? indexMap.get(a.seedId)! : Number.MAX_SAFE_INTEGER
    const bIndex = indexMap.has(b.seedId) ? indexMap.get(b.seedId)! : Number.MAX_SAFE_INTEGER
    if (aIndex !== bIndex) return aIndex - bIndex
    if (a.requiredLevel !== b.requiredLevel) return b.requiredLevel - a.requiredLevel
    return a.seedId - b.seedId
  })
})

async function fetchBagSeeds() {
  if (!currentAccountId.value) return
  bagSeedsLoading.value = true
  bagSeedsError.value = null
  try {
    const res = await api.get('/api/bag/seeds', {
      headers: { 'x-account-id': currentAccountId.value },
    })
    if (res.data.ok) {
      bagSeeds.value = (res.data.data || []).filter((s: BagSeedItem) => s.plantSize === 1)
    }
  }
  catch (e: any) {
    bagSeedsError.value = e.message || '加载失败'
  }
  finally {
    bagSeedsLoading.value = false
  }
}

function resetBagSeedPriority() {
  localSettings.value.bagSeedPriority = []
}

function moveBagSeed(seedId: number, direction: -1 | 1) {
  const nextOrder = [...(localSettings.value.bagSeedPriority || [])]
  const index = nextOrder.indexOf(seedId)
  const targetIndex = index + direction
  if (index < 0 || targetIndex < 0 || targetIndex >= nextOrder.length) return

  const temp = nextOrder[index]!
  nextOrder[index] = nextOrder[targetIndex]!
  nextOrder[targetIndex] = temp
  localSettings.value.bagSeedPriority = nextOrder
}

function startBagSeedDrag(seedId: number, event: DragEvent) {
  draggingBagSeedId.value = seedId
  if (event.dataTransfer) {
    event.dataTransfer.effectAllowed = 'move'
    event.dataTransfer.setData('text/plain', String(seedId))
  }
}

function dragOverBagSeed(_seedId: number, event: DragEvent) {
  if (draggingBagSeedId.value === null) return
  event.preventDefault()
  if (event.dataTransfer) event.dataTransfer.dropEffect = 'move'
}

function dropBagSeed(seedId: number, event: DragEvent) {
  event.preventDefault()
  const sourceSeedId = draggingBagSeedId.value ?? Number(event.dataTransfer?.getData('text/plain') || '')
  if (!sourceSeedId || sourceSeedId === seedId) {
    draggingBagSeedId.value = null
    return
  }

  const nextOrder = [...(localSettings.value.bagSeedPriority || [])]
  const sourceIndex = nextOrder.indexOf(sourceSeedId)
  const targetIndex = nextOrder.indexOf(seedId)

  if (sourceIndex < 0 && targetIndex < 0) {
    nextOrder.push(sourceSeedId)
  }
  else if (sourceIndex < 0) {
    nextOrder.splice(targetIndex, 0, sourceSeedId)
  }
  else if (targetIndex < 0) {
    // 目标不在列表中，不做处理
  }
  else {
    const temp = nextOrder[sourceIndex]
    nextOrder.splice(sourceIndex, 1)
    const newTargetIndex = sourceIndex < targetIndex ? targetIndex - 1 : targetIndex
    nextOrder.splice(newTargetIndex, 0, temp!)
  }

  localSettings.value.bagSeedPriority = nextOrder
  draggingBagSeedId.value = null
}

// 监听策略变化，加载背包种子
watchEffect(() => {
  if (localSettings.value.plantingStrategy === 'bag_priority' && currentAccountId.value) {
    fetchBagSeeds()
  }
})

watchEffect(async () => {
  let strategy = localSettings.value.plantingStrategy
  if (strategy === 'preferred') {
    strategyPreviewLabel.value = null
    return
  }
  // 背包种子优先策略使用第二优先策略预览
  if (strategy === 'bag_priority') {
    strategy = localSettings.value.bagSeedFallbackStrategy || 'level'
    // 如果第二优先策略是 preferred，显示优先种子预览
    if (strategy === 'preferred') {
      const preferredId = localSettings.value.preferredSeedId
      if (preferredId > 0 && seeds.value) {
        const seed = seeds.value.find(s => s.seedId === preferredId)
        if (seed) {
          strategyPreviewLabel.value = `${seed.requiredLevel}级 ${seed.name}`
        }
        else {
          strategyPreviewLabel.value = '未选择优先种子'
        }
      }
      else {
        strategyPreviewLabel.value = '未选择优先种子'
      }
      return
    }
  }
  if (!seeds.value || seeds.value.length === 0) {
    strategyPreviewLabel.value = null
    return
  }
  const available = seeds.value.filter(s => !s.locked && !s.soldOut)
  if (available.length === 0) {
    strategyPreviewLabel.value = '暂无可用种子'
    return
  }
  if (strategy === 'level') {
    const best = [...available].sort((a, b) => b.requiredLevel - a.requiredLevel)[0]
    strategyPreviewLabel.value = best ? `${best.requiredLevel}级 ${best.name}` : null
    return
  }
  const sortBy = analyticsSortByMap[strategy]
  if (sortBy) {
    try {
      const res = await api.get(`/api/analytics?sort=${sortBy}`)
      const rankings: any[] = res.data.ok ? (res.data.data || []) : []
      const availableIds = new Set(available.map(s => s.seedId))
      const match = rankings.find(r => availableIds.has(Number(r.seedId)))
      if (match) {
        const seed = available.find(s => s.seedId === Number(match.seedId))
        strategyPreviewLabel.value = seed ? `${seed.requiredLevel}级 ${seed.name}` : null
      }
      else {
        strategyPreviewLabel.value = '暂无匹配种子'
      }
    }
    catch {
      strategyPreviewLabel.value = null
    }
  }
})

async function saveAccountSettings() {
  if (!currentAccountId.value)
    return
  saving.value = true
  try {
    const res = await settingStore.saveSettings(currentAccountId.value, localSettings.value)
    if (res.ok) {
      showAlert('账号设置已保存')

      if (localSettings.value.automation?.fertilizer_buy) {
        try {
          const fertilizerType = localSettings.value.fertilizerBuyType || 'organic'
          const fertilizerCount = localSettings.value.fertilizerBuyCount || 0
          await api.post('/api/fertilizer/buy', {
            type: fertilizerType,
            count: fertilizerCount,
          }, {
            headers: { 'x-account-id': currentAccountId.value },
          })
          
          localSettings.value.automation.fertilizer_buy = false
          await settingStore.saveSettings(currentAccountId.value, localSettings.value)
        }
        catch (e) {
          console.error('购买化肥失败', e)
        }
      }
    }
    else {
      showAlert(`保存失败: ${res.error}`, 'danger')
    }
  }
  finally {
    saving.value = false
  }
}

async function applyDefaultSettings() {
  applyingDefaults.value = true
  try {
    const res = await api.get('/api/settings/default')
    if (res.data?.ok && res.data?.data) {
      const defaultConfig = res.data.data
      localSettings.value = JSON.parse(JSON.stringify({
        plantingStrategy: defaultConfig.plantingStrategy || 'max_exp',
        preferredSeedId: defaultConfig.preferredSeedId || 0,
        bagSeedPriority: defaultConfig.bagSeedPriority ?? [],
        bagSeedFallbackStrategy: defaultConfig.bagSeedFallbackStrategy ?? 'level',
        stealDelaySeconds: defaultConfig.stealDelaySeconds ?? 1,
        plantOrderRandom: defaultConfig.plantOrderRandom ?? true,
        plantDelaySeconds: defaultConfig.plantDelaySeconds ?? 2,
        intervals: defaultConfig.intervals || { farmMin: 2, farmMax: 5, helpMin: 10, helpMax: 15, stealMin: 10, stealMax: 15 },
        friendQuietHours: defaultConfig.friendQuietHours || { enabled: false, start: '23:00', end: '07:00' },
        automation: defaultConfig.automation || {},
      }))
      showAlert('已应用推荐设置，请点击保存按钮生效')
    }
    else {
      showAlert(`获取默认配置失败: ${res.data?.error || '未知错误'}`, 'danger')
    }
  }
  catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '请求失败'
    showAlert(`获取默认配置失败: ${msg}`, 'danger')
  }
  finally {
    applyingDefaults.value = false
  }
}

async function handleChangePassword() {
  if (!passwordForm.value.old || !passwordForm.value.new) {
    showAlert('请填写完整', 'danger')
    return
  }
  if (passwordForm.value.new !== passwordForm.value.confirm) {
    showAlert('两次密码输入不一致', 'danger')
    return
  }
  if (passwordForm.value.new.length < 4) {
    showAlert('密码长度至少4位', 'danger')
    return
  }

  passwordSaving.value = true
  try {
    const res = await userStore.changePassword(passwordForm.value.old, passwordForm.value.new)

    if (res.ok) {
      showAlert('密码修改成功')
      passwordForm.value = { old: '', new: '', confirm: '' }
    }
    else {
      showAlert(`修改失败: ${res.error || '未知错误'}`, 'danger')
    }
  }
  finally {
    passwordSaving.value = false
  }
}

async function handleSaveOffline() {
  offlineSaving.value = true
  try {
    const res = await settingStore.saveOfflineConfig(localOffline.value)

    if (res.ok) {
      showAlert('下线提醒设置已保存')
    }
    else {
      showAlert(`保存失败: ${res.error || '未知错误'}`, 'danger')
    }
  }
  finally {
    offlineSaving.value = false
  }
}

async function handleTestOffline() {
  offlineTesting.value = true
  try {
    const { data } = await api.post('/api/settings/offline-reminder/test', localOffline.value)
    if (data?.ok) {
      showAlert('测试消息发送成功')
    }
    else {
      showAlert(`测试失败: ${data?.error || '未知错误'}`, 'danger')
    }
  }
  catch (e: any) {
    const msg = e?.response?.data?.error || e?.message || '请求失败'
    showAlert(`测试失败: ${msg}`, 'danger')
  }
  finally {
    offlineTesting.value = false
  }
}
</script>

<template>
  <div class="settings-page">
    <div v-if="loading" class="py-4 text-center text-gray-500">
      <div class="i-svg-spinners-ring-resize mx-auto mb-2 text-2xl" />
      <p>加载中...</p>
    </div>

    <div v-else class="grid grid-cols-1 mt-12 gap-4 text-sm lg:grid-cols-2">
      <div v-if="currentAccountId" class="card h-full flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
        <div
          class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 cursor-pointer select-none hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
          @click="strategyCollapsed = !strategyCollapsed"
        >
          <h3 class="flex items-center justify-between text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="flex items-center gap-2">
              <div class="i-fas-cogs" />
              策略设置
              <span v-if="currentAccountName" class="ml-2 text-sm text-gray-500 font-normal dark:text-gray-400">
                ({{ currentAccountName }})
              </span>
            </div>
            <div
              class="i-carbon-chevron-down text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-[-90deg]': strategyCollapsed }"
            />
          </h3>
        </div>

        <div v-show="!strategyCollapsed" class="p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseSelect
              v-model="localSettings.plantingStrategy"
              label="种植策略"
              :options="plantingStrategyOptions"
            />
            <BaseSelect
              v-if="localSettings.plantingStrategy === 'preferred'"
              v-model="localSettings.preferredSeedId"
              label="优先种植种子"
              :options="preferredSeedOptions"
            />
            <BaseSelect
              v-else-if="localSettings.plantingStrategy === 'bag_priority' && localSettings.bagSeedFallbackStrategy === 'preferred'"
              v-model="localSettings.preferredSeedId"
              label="优先种植种子"
              :options="preferredSeedOptions"
            />
            <div v-else class="flex flex-col gap-1.5">
              <label class="text-sm text-gray-700 font-medium dark:text-gray-300">
                {{ localSettings.plantingStrategy === 'bag_priority' ? '第二优先策略预览' : '策略选种预览' }}
              </label>
              <div
                class="w-full flex items-center justify-between border border-gray-200 rounded-lg bg-gray-50 px-3 py-2 text-gray-500 dark:border-gray-600 dark:bg-gray-800/50 dark:text-gray-400"
              >
                <span class="truncate">{{ strategyPreviewLabel ?? '加载中...' }}</span>
                <div class="i-carbon-chevron-down shrink-0 text-lg text-gray-400" />
              </div>
            </div>
          </div>

          <!-- 背包种子优先策略配置 -->
          <div v-if="localSettings.plantingStrategy === 'bag_priority'" class="space-y-3">
            <BaseSelect
              v-model="localSettings.bagSeedFallbackStrategy"
              label="第二优先策略"
              :options="BAG_FALLBACK_STRATEGY_OPTIONS"
            />
            <div class="border border-amber-200 rounded-lg bg-amber-50/70 p-3 space-y-3 dark:border-amber-800/50 dark:bg-amber-900/20">
              <div class="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div class="text-sm text-amber-900 font-semibold dark:text-amber-200">
                    背包种子优先顺序
                  </div>
                  <p class="mt-1 text-xs text-amber-700/90 dark:text-amber-300/90">
                    先按下方顺序消耗背包中的 1x1 种子；背包种子不足时，再按"第二优先策略"补种。
                  </p>
                </div>
                <button
                  class="rounded bg-amber-100 px-2 py-1 text-xs text-amber-700 transition hover:bg-amber-200 dark:bg-amber-900/50 dark:text-amber-300 dark:hover:bg-amber-900/70"
                  @click="resetBagSeedPriority"
                >
                  重置顺序
                </button>
              </div>
              <div v-if="bagSeedsLoading" class="py-4 text-center text-sm text-amber-700 dark:text-amber-300">
                加载中...
              </div>
              <div v-else-if="bagSeedsError" class="py-4 text-center text-sm text-red-600 dark:text-red-400">
                {{ bagSeedsError }}
              </div>
              <div v-else-if="bagSeeds.length === 0" class="py-4 text-center text-sm text-amber-700 dark:text-amber-300">
                背包中暂无 1x1 种子
              </div>
              <div v-else class="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div
                  v-for="(seed, index) in sortedBagSeeds"
                  :key="seed.seedId"
                  class="flex items-center gap-2 border border-amber-200 rounded-lg bg-white p-2 dark:border-amber-700/50 dark:bg-gray-800"
                  draggable="true"
                  @dragstart="startBagSeedDrag(seed.seedId, $event)"
                  @dragover.prevent="dragOverBagSeed(seed.seedId, $event)"
                  @drop="dropBagSeed(seed.seedId, $event)"
                >
                  <div class="flex h-8 w-8 shrink-0 items-center justify-center rounded bg-amber-100 text-xs text-amber-700 font-bold dark:bg-amber-900/50 dark:text-amber-300">
                    {{ index + 1 }}
                  </div>
                  <div class="min-w-0 flex-1">
                    <div class="truncate text-sm text-gray-800 font-medium dark:text-gray-200">
                      {{ seed.name }}
                    </div>
                    <div class="text-xs text-gray-500 dark:text-gray-400">
                      数量: {{ seed.count }} | 等级: {{ seed.requiredLevel }}
                    </div>
                  </div>
                  <div class="flex shrink-0 flex-col gap-1">
                    <button
                      class="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                      :disabled="index === 0"
                      @click="moveBagSeed(seed.seedId, -1)"
                    >
                      <div class="i-carbon-arrow-up text-sm" />
                    </button>
                    <button
                      class="rounded p-1 text-gray-400 transition hover:bg-gray-100 hover:text-gray-600 dark:hover:bg-gray-700"
                      :disabled="index === sortedBagSeeds.length - 1"
                      @click="moveBagSeed(seed.seedId, 1)"
                    >
                      <div class="i-carbon-arrow-down text-sm" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div class="grid grid-cols-2 gap-3 md:grid-cols-4">
            <BaseInput
              v-model.number="localSettings.intervals.farmMin"
              label="农场巡查最小 (秒)"
              type="number"
              min="1"
            />
            <BaseInput
              v-model.number="localSettings.intervals.farmMax"
              label="农场巡查最大 (秒)"
              type="number"
              min="1"
            />
          </div>

          <div class="grid grid-cols-2 mt-3 gap-3 md:grid-cols-2">
            <BaseInput
              v-model.number="localSettings.intervals.helpMin"
              label="帮助巡查最小 (秒)"
              type="number"
              min="1"
            />
            <BaseInput
              v-model.number="localSettings.intervals.helpMax"
              label="帮助巡查最大 (秒)"
              type="number"
              min="1"
            />
          </div>

          <div class="grid grid-cols-2 mt-3 gap-3 md:grid-cols-2">
            <BaseInput
              v-model.number="localSettings.intervals.stealMin"
              label="偷菜巡查最小 (秒)"
              type="number"
              min="1"
            />
            <BaseInput
              v-model.number="localSettings.intervals.stealMax"
              label="偷菜巡查最大 (秒)"
              type="number"
              min="1"
            />
          </div>

          <div class="mt-4 flex flex-wrap items-center gap-4 border-t pt-3 dark:border-gray-700">
            <BaseSwitch
              v-model="localSettings.friendQuietHours.enabled"
              label="启用静默时段"
            />
            <div class="flex items-center gap-2">
              <BaseInput
                v-model="localSettings.friendQuietHours.start"
                type="time"
                class="w-24"
                :disabled="!localSettings.friendQuietHours.enabled"
              />
              <span class="text-gray-500">-</span>
              <BaseInput
                v-model="localSettings.friendQuietHours.end"
                type="time"
                class="w-24"
                :disabled="!localSettings.friendQuietHours.enabled"
              />
            </div>
          </div>

          <div class="mt-4 border-t pt-3 space-y-3 dark:border-gray-700">
            <h4 class="text-sm text-gray-700 font-medium dark:text-gray-300">
              种植与偷菜延迟设置
            </h4>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
              <BaseSwitch
                v-model="localSettings.plantOrderRandom"
                label="种植顺序随机"
              />
              <BaseInput
                v-model.number="localSettings.plantDelaySeconds"
                label="种植延迟 (秒)"
                type="number"
                min="0"
              />
              <BaseInput
                v-model.number="localSettings.stealDelaySeconds"
                label="偷菜延迟 (秒)"
                type="number"
                min="0"
              />
            </div>
          </div>
        </div>

        <div
          class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50 cursor-pointer select-none hover:bg-gray-100/50 dark:hover:bg-gray-700/50 transition-colors"
          @click="automationCollapsed = !automationCollapsed"
        >
          <h3 class="flex items-center justify-between text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="flex items-center gap-2">
              <div class="i-fas-toggle-on" />
              自动控制
            </div>
            <div
              class="i-carbon-chevron-down text-gray-400 transition-transform duration-200"
              :class="{ 'rotate-[-90deg]': automationCollapsed }"
            />
          </h3>
        </div>

        <div v-show="!automationCollapsed" class="flex-1 p-4 space-y-4">
          <div class="grid grid-cols-2 gap-3 md:grid-cols-3">
            <BaseSwitch v-model="localSettings.automation.farm" label="自动种植收获" />
            <BaseSwitch v-model="localSettings.automation.task" label="自动做任务" />
            <BaseSwitch v-model="localSettings.automation.sell" label="自动卖果实" />
            <BaseSwitch v-model="localSettings.automation.friend" label="自动好友互动" />
            <BaseSwitch v-model="localSettings.automation.farm_push" label="推送触发巡田" />
            <BaseSwitch v-model="localSettings.automation.land_upgrade" label="自动升级土地" />
            <BaseSwitch v-model="localSettings.automation.fertilizer_gift" label="自动填充化肥" />
            <BaseSwitch v-model="localSettings.automation.fertilizer_buy" label="自动购买化肥" />
            <BaseSwitch v-model="localSettings.automation.skip_own_weed_bug" label="不除自己草虫" />
          </div>

          <div v-if="localSettings.automation.fertilizer_buy" class="flex flex-wrap gap-4 rounded bg-green-50 p-2 text-sm dark:bg-green-900/20">
            <BaseSelect
              v-model="localSettings.fertilizerBuyType"
              label="化肥类型"
              :options="fertilizerBuyTypeOptions"
            />
            <BaseInput
              v-model.number="localSettings.fertilizerBuyCount"
              label="购买数量 (0=不限)"
              type="number"
              min="0"
              max="10000"
            />
          </div>

          <div v-if="localSettings.automation.friend" class="flex flex-wrap gap-4 rounded bg-blue-50 p-2 text-sm dark:bg-blue-900/20">
            <BaseSwitch v-model="localSettings.automation.friend_steal" label="自动偷菜" />
            <BaseSwitch v-model="localSettings.automation.friend_help" label="自动帮忙" />
            <BaseSwitch v-model="localSettings.automation.friend_bad" label="自动捣乱" />
            <BaseSwitch v-model="localSettings.automation.friend_help_exp_limit" label="经验满不帮忙" />
          </div>

<!--          <div>-->
<!--            <BaseSelect-->
<!--              v-model="localSettings.automation.fertilizer"-->
<!--              label="施肥策略"-->
<!--              class="w-full md:w-1/2"-->
<!--              :options="fertilizerOptions"-->
<!--            />-->
          <div class="space-y-3">
            <div class="rounded border border-amber-200 bg-amber-50/60 p-3 dark:border-amber-800/60 dark:bg-amber-900/10">
              <div class="mb-2 text-sm text-amber-800 font-medium dark:text-amber-300">
                施肥范围
              </div>
              <div class="grid grid-cols-2 gap-2 md:grid-cols-4">
                <label
                    v-for="option in fertilizerLandTypeOptions"
                    :key="option.value"
                    class="flex cursor-pointer items-center gap-1.5 rounded bg-white px-2 py-1 text-xs text-gray-700 dark:bg-gray-800 dark:text-gray-300"
                >
                  <input
                      v-model="localSettings.automation.fertilizer_land_types"
                      :value="option.value"
                      type="checkbox"
                      class="h-3.5 w-3.5"
                  >
                  <span>{{ option.label }}</span>
                </label>
              </div>
              <p class="mt-2 text-xs text-gray-500 dark:text-gray-400">
                施肥前会优先按土地类型过滤，仅对命中范围的地块执行施肥策略。
              </p>
            </div>
            <div class="grid grid-cols-1 gap-3 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
              <BaseSelect
                  v-model="localSettings.automation.fertilizer"
                  label="施肥策略"
                  class="w-full"
                  :options="fertilizerOptions"
              />
              <BaseSwitch
                  v-model="localSettings.automation.fertilizer_multi_season"
                  label="多季补肥"
              />
            </div>
            <div v-if="localSettings.automation.fertilizer === 'smart'" class="flex flex-wrap gap-4 rounded bg-amber-50 p-2 text-sm dark:bg-amber-900/20">
              <BaseInput
                  v-model.number="localSettings.automation.fertilizer_smart_seconds"
                  label="快成熟判定秒数"
                  type="number"
                  min="30"
                  max="3600"
                  class="w-40"
              />
              <span class="flex items-end pb-2 text-xs text-gray-500 dark:text-gray-400">
                距离成熟时间 ≤ 此秒数时施有机肥（默认300秒=5分钟）
              </span>
            </div>
          </div>
        </div>

        <div class="mt-auto flex flex-wrap justify-end gap-2 border-t bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <BaseButton
            variant="secondary"
            size="sm"
            :loading="applyingDefaults"
            @click="applyDefaultSettings"
          >
            一键应用推荐设置
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            :loading="saving"
            @click="saveAccountSettings"
          >
            保存策略与自动控制
          </BaseButton>
        </div>
      </div>

      <div v-else class="card flex flex-col items-center justify-center gap-4 rounded-lg bg-white p-12 text-center shadow dark:bg-gray-800">
        <div class="rounded-full bg-gray-50 p-4 dark:bg-gray-700/50">
          <div class="i-carbon-settings-adjust text-4xl text-gray-400 dark:text-gray-500" />
        </div>
        <div class="max-w-xs">
          <h3 class="text-lg text-gray-900 font-medium dark:text-gray-100">
            需要登录账号
          </h3>
          <p class="mt-1 text-sm text-gray-500 dark:text-gray-400">
            请先登录账号以配置策略和自动化选项。
          </p>
        </div>
      </div>

      <div class="card h-full flex flex-col rounded-lg bg-white shadow dark:bg-gray-800">
        <div class="border-b bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-password" />
            修改用户密码
          </h3>
        </div>

        <div class="p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-3">
            <BaseInput
              v-model="passwordForm.old"
              label="当前密码"
              type="password"
              placeholder="当前用户密码"
            />
            <BaseInput
              v-model="passwordForm.new"
              label="新密码"
              type="password"
              placeholder="至少 4 位"
            />
            <BaseInput
              v-model="passwordForm.confirm"
              label="确认新密码"
              type="password"
              placeholder="再次输入新密码"
            />
          </div>

          <div class="flex items-center justify-end pt-1">
            <BaseButton
              variant="primary"
              size="sm"
              :loading="passwordSaving"
              @click="handleChangePassword"
            >
              修改用户密码
            </BaseButton>
          </div>
        </div>

        <div class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-notification" />
            下线提醒
          </h3>
        </div>

        <div class="flex-1 p-4 space-y-3">
          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <div class="flex flex-col gap-1.5">
              <div class="flex items-center justify-between">
                <span class="text-sm text-gray-700 font-medium dark:text-gray-300">推送渠道</span>
                <BaseButton
                  variant="text"
                  size="sm"
                  :disabled="!currentChannelDocUrl"
                  @click="openChannelDocs"
                >
                  官网
                </BaseButton>
              </div>
              <BaseSelect
                v-model="localOffline.channel"
                :options="channelOptions"
              />
            </div>
            <BaseSelect
              v-model="localOffline.reloginUrlMode"
              label="重登录链接"
              :options="reloginUrlModeOptions"
            />
          </div>

          <BaseInput
            v-model="localOffline.endpoint"
            label="接口地址"
            type="text"
            :disabled="localOffline.channel !== 'webhook'"
          />

          <BaseInput
            v-model="localOffline.token"
            label="Token"
            type="text"
            placeholder="接收端 token"
          />

          <div class="grid grid-cols-1 gap-3 md:grid-cols-2">
            <BaseInput
              v-model="localOffline.title"
              label="标题"
              type="text"
              placeholder="提醒标题"
            />
            <BaseInput
              v-model.number="localOffline.offlineDeleteSec"
              label="离线删除账号 (秒)"
              type="number"
              min="0"
              placeholder="0 表示不删除"
            />
          </div>

          <BaseInput
            v-model="localOffline.msg"
            label="内容"
            type="text"
            placeholder="提醒内容"
          />
        </div>

        <div class="mt-auto flex justify-end gap-2 border-t bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-900/50">
          <BaseButton
            variant="secondary"
            size="sm"
            :loading="offlineTesting"
            :disabled="offlineSaving"
            @click="handleTestOffline"
          >
            测试通知
          </BaseButton>
          <BaseButton
            variant="primary"
            size="sm"
            :loading="offlineSaving"
            :disabled="offlineTesting"
            @click="handleSaveOffline"
          >
            保存下线提醒设置
          </BaseButton>
        </div>

        <div class="border-b border-t bg-gray-50/50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/50">
          <h3 class="flex items-center gap-2 text-base text-gray-900 font-bold dark:text-gray-100">
            <div class="i-carbon-network-3" />
            运行连接配置
          </h3>
        </div>

        <div class="flex-1 p-4">
          <ConnectionConfig @alert="showAlert" />
        </div>
      </div>
    </div>

    <ConfirmModal
      :show="modalVisible"
      :title="modalConfig.title"
      :message="modalConfig.message"
      :type="modalConfig.type"
      :is-alert="modalConfig.isAlert"
      confirm-text="知道了"
      @confirm="modalVisible = false"
      @cancel="modalVisible = false"
    />
  </div>
</template>

<style scoped lang="postcss">
</style>
