<template>
  <div class="create-notification-container">
    <div class="main-content">
      <div class="flex items-center gap-2 shrink-0 whitespace-nowrap">
        <!-- Tabs -->
        <div class="flex-1 min-w-0">
          <Tabs v-model="activeLanguage" :tabs="languageTabs" @tab-changed="handleLanguageChanged" />
        </div>

        <!-- Remove after test done -->
        <!-- <div v-if="showApiToggle" class="flex items-center gap-2 shrink-0">
          <span class="text-sm font-medium">Now is API {{ useV2 ? 'V2' : 'V1' }}</span>
          <el-switch v-model="useV2" />
          <span class="text-xs font-medium"> switch to {{ useV2 ? 'V1' : 'V2' }}</span>
        </div> -->
      </div>
      <div class="form-content">
        <div class="form-group">
          <ImageUpload :key="`image-upload-${activeLanguage}-${existingImageIds[activeLanguage] || 'new'}`"
            v-model="currentImageFile" accept-types="image/png,image/jpeg" :max-size="3 * 1024 * 1024"
            format-text="Supported format: PNG, JPG (2:1 W:H or 880:440)" size-text="Maximum size: 3MB"
            :existing-image-url="currentImageUrl || undefined" @file-selected="handleLanguageImageSelected"
            @file-removed="handleLanguageImageRemoved" @error="handleUploadError" />
        </div>
        <div class="form-fields">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Type <span class="required">*</span></label>
              <el-dropdown @command="(command: number) => (formData.categoryTypeId = command)" trigger="click"
                class="custom-dropdown" :disabled="loadingCategoryTypes">
                <span class="dropdown-trigger">
                  {{
                    formatCategoryType(
                      categoryTypes.find((ct: CategoryTypeData) => ct.id === formData.categoryTypeId)?.name ||
                      'Select Category',
                    )
                  }}
                  <el-icon class="dropdown-icon">
                    <ArrowDown />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="category in categoryTypes" :key="category.id" :command="category.id">
                      {{ formatCategoryType(category.name) }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="form-group">
              <label class="form-label">Push to OS Platforms <span class="required">*</span></label>
              <el-dropdown @command="(command: Platform) => (formData.pushToPlatforms = command)" trigger="click"
                class="custom-dropdown" :disabled="isEditingPublished">
                <span class="dropdown-trigger" :class="{ disabled: isEditingPublished }">
                  {{ formatPlatform(formData.pushToPlatforms) }}
                  <el-icon class="dropdown-icon">
                    <ArrowDown />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item v-for="platform in Object.values(Platform)" :key="platform" :command="platform">
                      {{ formatPlatform(platform) }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Title <span class="required">*</span></label>
            <input v-model="currentTitle" type="text" class="form-input-title" :class="{ 'lang-khmer': titleHasKhmer }"
              :data-content-lang="titleHasKhmer ? 'km' : ''" placeholder="Attractive title" @blur="validateTitle()" />
            <span v-if="titleError" style="color: #ef4444; font-size: 12px; margin-top: 2px; display: block">{{
              titleError
            }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Description (Support HTML) <span class="required">*</span></label>
            <textarea v-model="currentDescription" class="form-textarea" :class="{ 'lang-khmer': descriptionHasKhmer }"
              :data-content-lang="descriptionHasKhmer ? 'km' : ''"
              placeholder="Description of the title <bold>input</bold>" rows="4"
              @blur="validateDescription()"></textarea>
            <span v-if="descriptionError" style="color: #ef4444; font-size: 12px; margin-top: 2px; display: block">{{
              descriptionError }}</span>
          </div>
          <div class="form-group">
            <label class="form-label">Bakong Platform <span class="required">*</span></label>
            <el-dropdown @command="(command: BakongApp) => (formData.platform = command)" trigger="click"
              class="custom-dropdown full-width-dropdown" :disabled="isEditingPublished">
              <span class="dropdown-trigger full-width-trigger" :class="{ disabled: isEditingPublished }">
                {{ formatBakongApp(formData.platform) }}
                <el-icon class="dropdown-icon">
                  <ArrowDown />
                </el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item v-for="app in Object.values(BakongApp)" :key="app" :command="app">
                    {{ formatBakongApp(app) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="form-group">
            <label class="form-label">Link to see more (optional)</label>
            <input v-model="currentLinkToSeeMore" type="url" class="form-input-link" placeholder="https://google.com"
              inputmode="url" pattern="https?://.+" @blur="validateLink()" />
            <span v-if="linkError" style="color: #ef4444; font-size: 12px; margin-top: 2px; display: block">{{ linkError
            }}</span>
          </div>
          <div class="schedule-options-container">
            <div class="schedule-options">
              <div class="schedule-options-header">
                <div class="schedule-option-left">
                  <span class="option-title">Posting Schedule</span>
                  <span class="option-description">
                    <template v-if="formData.scheduleEnabled">
                      Notifications will be sent according to schedule.
                    </template>
                    <template v-else> </template>
                  </span>
                </div>
                <div class="schedule-option-right">
                  <span class="option-label">Set time and date</span>
                  <label class="toggle-switch" :class="{ disabled: isEditingPublished }">
                    <input v-model="formData.scheduleEnabled" type="checkbox" :disabled="isEditingPublished" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div v-if="formData.scheduleEnabled" class="schedule-datetime-row">
                <div class="schedule-form-group">
                  <label class="schedule-form-label">Date <span class="required">*</span></label>
                  <el-date-picker v-model="formData.scheduleDate" type="date" :placeholder="datePlaceholder"
                    format="M/D/YYYY" value-format="M/D/YYYY" class="schedule-date-picker"
                    style="width: 277.5px !important; height: 56px !important; border-radius: 16px" :prefix-icon="null"
                    :clear-icon="null" :disabled-date="disabledDate" :disabled="isEditingPublished"
                    @change="(val: string | null) => { formData.scheduleDate = val ?? ''; console.log('Date changed:', val) }" />
                </div>
                <div class="schedule-form-group">
                  <label class="schedule-form-label">Time <span class="required">*</span></label>
                  <el-time-picker v-model="formData.scheduleTime" :placeholder="timePlaceholder" format="HH:mm"
                    value-format="HH:mm" class="schedule-time-picker"
                    style="width: 277.5px !important; height: 56px !important; border-radius: 16px" :prefix-icon="null"
                    :clear-icon="null" :disabled-hours="() => disabledHours(formData.scheduleDate)" :disabled-minutes="(hour: number) => disabledMinutes(hour, formData.scheduleDate)
                      " :disabled="isEditingPublished"
                    @change="(val: string | null) => { formData.scheduleTime = val; console.log('Time changed:', val) }" />
                </div>
              </div>
            </div>
          </div>
          <div class="schedule-options-container" style="display: none">
            <div class="splash-options">
              <div class="schedule-options-header">
                <div class="schedule-option-left">
                  <span class="option-title">Show flash on launch</span>
                  <span class="option-description">
                    <template v-if="formData.splashEnabled">
                      Users will see the flash message on next launch.
                    </template>
                    <template v-else> </template>
                  </span>
                </div>
                <div class="schedule-option-right">
                  <span class="option-label">Set number of showing</span>
                  <label class="toggle-switch">
                    <input v-model="formData.splashEnabled" type="checkbox" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div v-if="formData.splashEnabled" class="schedule-datetime-row">
                <div class="schedule-form-group flash-input-group">
                  <label class="schedule-form-label">Number showing per day: <span class="required">*</span></label>
                  <div class="flash-input-wrapper">
                    <ElInputNumber v-model="formData.showPerDay" :min="1" :max="10" :disabled="true"
                      controls-position="right" class="flash-number-input" />
                    <el-icon class="flash-dropdown-icon">
                      <ArrowDown />
                    </el-icon>
                  </div>
                </div>
                <div class="schedule-form-group flash-input-group">
                  <label class="schedule-form-label">Maximum day showing: <span class="required">*</span></label>
                  <div class="flash-input-wrapper">
                    <ElInputNumber v-model="formData.maxDayShowing" :min="1" :max="30" :disabled="true"
                      controls-position="right" class="flash-number-input" />
                    <el-icon class="flash-dropdown-icon">
                      <ArrowDown />
                    </el-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- <div class="schedule-datetime-row" style="margin-top: 12px">
          <div class="schedule-form-group" style="flex: 1">
            <label class="schedule-form-label">Test AccountId (optional)</label>

            <el-select
              v-model="formData.accountIds"
              multiple
              filterable
              allow-create
              default-first-option
              placeholder="Type accountId and press Enter"
              style="width: 100%"
              :disabled="isEditingPublished"
            />
          </div> -->
          <!-- <div class="schedule-datetime-row" style="margin-top: 12px">
            <div class="splash-options" style="width: 100%">
              <div class="schedule-options-header" style="margin-bottom: 12px">
                <div class="schedule-option-left">
                  <span class="option-title">Test AccountId</span>
                  <span class="option-description">
                    Only those users with the accountId will receive the notification
                  </span>
                </div>

                <div class="schedule-option-right">
                  <label class="toggle-switch" :class="{ disabled: isEditingPublished }">
                    <input
                      v-model="formData.accountIds"
                      type="checkbox"
                      :disabled="isEditingPublished"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div v-if="formData.accountIds.length === 0" class="option-description">
                No accountId added.
              </div>

              <div
                v-for="(accountId, idx) in formData.accountIds"
                :key="`test-account-${idx}`"
                style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px"
              >
                <div style="min-width: 90px">accountId:</div>

                <el-input
                  v-model="formData.accountIds[idx]"
                  placeholder="Enter accountId"
                  clearable
                  style="flex: 1"
                />

                <el-button type="danger" plain @click="removeTestAccountId(idx)">
                  Remove
                </el-button>
                <el-button type="primary" plain @click="addAccountId">
                  Add
                </el-button>
              </div>
            </div>
          </div> -->

          <!-- 
          <div class="schedule-datetime-row" style="margin-top: 12px">
            <div class="splash-options" style="width: 100%">
              <div class="schedule-options-header" style="margin-bottom: 12px">
                <div class="schedule-option-left">
                  <span class="option-title">Test AccountId</span>
                  <span class="option-description">
                    Only those users with the accountId will receive the notification
                  </span>
                </div>

                <div class="schedule-option-right">
                  <label class="toggle-switch" :class="{ disabled: isEditingPublished }">
                    <input v-model="formData.enableaccountIds" type="checkbox" :disabled="isEditingPublished"
                      @change="onToggleTestAccounts(enableTestAccounts)" />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>

              <div v-if="!formData.enableaccountIds" class="option-description">
                Turn on to add test accountId(s).
              </div>

              <div v-else>
                <div v-for="(accountId, idx) in formData.accountIds" :key="`test-account-${idx}`"
                  style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px">
                  <div style="min-width: 90px; color: #6b7280">accountId</div>

                  <el-input class="h-12" v-model="formData.accountIds[idx]" placeholder="Enter accountId" clearable
                    style="flex: 1" />

                  <el-button type="danger" plain @click="removeTestAccountId(idx)"
                    :disabled="isEditingPublished || formData.accountIds.length === 1">
                    Remove
                  </el-button>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 8px">
                  <el-button type="primary" plain @click="addAccountId" :disabled="isEditingPublished">
                    + Add accountId
                  </el-button>
                </div>
              </div>
            </div>
          </div> -->

          <div class="schedule-datetime-row" style="margin-top: 12px">
            <div class="splash-options" style="width: 100%">
              <!-- Header -->
              <div class="schedule-options-header" style="margin-bottom: 12px">
                <div class="schedule-option-left">
                  <span class="option-title">Test AccountId</span>
                  <span class="option-description">
                    Only those users with the accountId will receive the notification
                  </span>
                </div>

                <div class="schedule-option-right">
                  <label class="toggle-switch" :class="{ disabled: isEditingPublished }">
                      <input
                        v-model="formData.enableaccountIds"
                        type="checkbox"
                        :disabled="isEditingPublished"
                        @change="onToggleTestAccounts(formData.enableaccountIds)"
                      />
                      <span class="toggle-slider"></span>
                    </label>
                </div>
              </div>

              <!-- Disabled state -->
              <div v-if="!formData.enableaccountIds" class="option-description">
                Turn on to add test accountId(s).
              </div>

              <!-- Enabled state -->
              <div v-else>
                <div v-for="(accountId, idx) in formData.accountIds" :key="`test-account-${idx}`"
                  style="display: flex; gap: 12px; align-items: center; margin-bottom: 10px">
                  <div style="min-width: 90px; color: #6b7280">accountId</div>

                  <el-input v-model="formData.accountIds[idx]" placeholder="Enter accountId" clearable style="flex: 1"
                    :disabled="isEditingPublished" />

                  <el-button type="danger" plain @click="removeTestAccountId(idx)"
                    :disabled="isEditingPublished || formData.accountIds.length === 1">
                    Remove
                  </el-button>
                </div>

                <div style="display: flex; justify-content: flex-end; margin-top: 8px">
                  <el-button type="primary" plain @click="addAccountId" :disabled="isEditingPublished">
                    + Add accountId
                  </el-button>
                </div>
              </div>
            </div>
          </div>

        </div>

        <div class="action-buttons">
          <Button :text="publishButtonText" variant="primary" size="medium" width="123px" height="56px"
            @click="handlePublishNow" />
          <Button v-if="!isEditingPublished" text="Save draft" variant="secondary" size="medium" width="116px"
            height="56px" @click="handleFinishLater" />
        </div>
      </div>
    </div>
    <div class="preview-container flex justify-center items-center">
      <MobilePreview :title="currentTitle" :description="currentDescription" :image="currentImageUrl || ''"
        :categoryType="categoryTypes.find((ct: CategoryTypeData) => ct.id === formData.categoryTypeId)?.name || ''"
        :title-has-khmer="titleHasKhmer" :description-has-khmer="descriptionHasKhmer" />
    </div>
  </div>
  <!-- <div class="sticky top-24">
    <MobilePreview
      :title="currentTitle"
      :description="currentDescription"
      :image="currentImageUrl || ''"
      :categoryType="categoryTypes.find((ct: CategoryTypeData) => ct.id === formData.categoryTypeId)?.name || ''"
      :title-has-khmer="titleHasKhmer"
      :description-has-khmer="descriptionHasKhmer"
    />
  </div> -->

  <ConfirmationDialog v-model="showConfirmationDialog" title="Save as Draft?"
    message="Do you want to save this notification as a draft or discard your changes?" confirm-text="Save Draft"
    cancel-text="Discard" type="warning" confirm-button-type="primary" @confirm="handleConfirmationDialogConfirm"
    @cancel="handleConfirmationDialogCancel" />
  <ConfirmationDialog v-model="showLeaveDialog" title="Are you sure you want to leave?"
    :message="isEditMode ? 'If you leave now, any changes you made will be updated. If there are no changes, nothing will be updated.' : 'If you leave now, your progress will be saved as a draft. You can resume and complete it anytime.'"
    :confirm-text="isEditMode ? 'Update and leave' : 'Save as draft & leave'" cancel-text="Stay on page" type="warning"
    confirm-button-type="primary" @confirm="handleLeaveDialogConfirm" @cancel="handleLeaveDialogCancel" />
  <ConfirmationDialog v-model="showUpdateConfirmationDialog" title="You want to update?"
    message="Updating will immediately change the announcement for all users." confirm-text="Continue"
    cancel-text="Cancel" type="warning" confirm-button-type="primary" @confirm="handleUpdateConfirmationConfirm"
    @cancel="handleUpdateConfirmationCancel" />
  <ConfirmationDialog v-model="showMissingLanguageDialog" title="Missing Language Content"
    :message="missingLanguagesMessage" :confirm-text="formData.scheduleEnabled ? 'Schedule Anyway' : 'Publish Anyway'"
    cancel-text="Back to edit" type="warning" confirm-button-type="primary" :dangerously-use-h-t-m-l-string="true"
    @confirm="handleMissingLanguageConfirm" @cancel="handleMissingLanguageCancel" />
</template>
<script setup lang="ts">
import { ref, reactive, computed, onMounted, nextTick, watch, watchEffect } from 'vue'
import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router'
import { ElNotification, ElInputNumber, ElMessageBox } from 'element-plus'
import { ArrowDown } from '@element-plus/icons-vue'
import { MobilePreview, Tabs, Button } from '@/components/common'
import ImageUpload from '@/components/common/ImageUpload-v2.vue'
import ConfirmationDialog from '@/components/common/ConfirmationDialog.vue'
import { notificationApi } from '@/services/notificationApi-v2'
import { apiV2 } from '@/services/api-v2'
import { templateApi as templateApiV2 } from '@/services/templateApi-v2'
import {
  NotificationType,
  Platform,
  Language,
  SendType,
  BakongApp,
  formatPlatform,
  formatCategoryType,
  getNotificationMessage,
  containsKhmer,
  getFormattedPlatformName,
} from '@/utils/helpers-v2'
import { useCategoryTypesStore } from '@/stores/categoryTypes-v2'
import type { CategoryTypeV2 as CategoryTypeData } from '@/services/categoryTypeApi-v2'
import { DateUtils } from '@bakong/shared'
import {
  getCurrentTimePlaceholder,
  getCurrentDatePlaceholder,
  disabledDate,
  disabledHours,
  disabledMinutes,
  mapNotificationTypeToFormType,
  mapPlatformToFormPlatform,
  mapTypeToNotificationType,
  mapPlatformToEnum,
  mapLanguageToEnum,
  compressImage,
} from '../utils/helpers-v2'
import type { CreateTemplateRequestV2 } from '@/services/notificationApi-v2'
import { setApiVersion } from '@/stores/apiVersion'
import { getApiPrefix } from '@/services/apiPrefix'
const router = useRouter()
const route = useRoute()

onMounted(() => {
  console.log('route.name =', route.name)
  console.log('route.path =', route.path)
  console.log('isCreatePage =', isCreatePage.value)
})

/** ---------------------------
 *  ✅ Toggle: show only on Create page
 *  --------------------------- */
const API_VERSION_KEY = 'api_version'
const getApiVersion = () => (localStorage.getItem(API_VERSION_KEY) as 'v1' | 'v2') || 'v1'
const setLocalApiVersion = (v: 'v1' | 'v2') => localStorage.setItem(API_VERSION_KEY, v)

const isCreatePage = computed(() => {
  const p = (route.path || '').toLowerCase()
  return /\/(v2\/)?notifications\/create\/?$/.test(p)
})

const showApiToggle = computed(() => isCreatePage.value)

console.log('showApiToggle =', showApiToggle.value) // ✅ safe here (optional)


/** Default OFF unless already saved */
const useV2 = ref(getApiVersion() === 'v2')

/** Prevent unsaved-changes guard when toggle switches route */
const isApiSwitching = ref(false)

const applyApiVersion = (v: 'v1' | 'v2') => {
  setApiVersion(v)
  setLocalApiVersion(v)
}

onMounted(() => {
  // Sync prefix on initial load
  applyApiVersion(useV2.value ? 'v2' : 'v1')
})

watch(useV2, (val) => {
  // Only toggle routes on create page
  if (!isCreatePage.value) return

  const v: 'v1' | 'v2' = val ? 'v2' : 'v1'
  applyApiVersion(v)

  const query = route.fullPath.includes('?')
    ? route.fullPath.slice(route.fullPath.indexOf('?'))
    : ''

  isApiSwitching.value = true
  if (v === 'v2') router.replace(`/v2/notifications/create${query}`)
  else router.replace(`/notifications/create${query}`)

  // release after navigation tick
  setTimeout(() => (isApiSwitching.value = false), 0)
})

/** ---------------------------
 *  ✅ Your existing logic below
 *  (keep your current code, I included only the top pieces that matter)
 *  --------------------------- */

const notificationId = computed(() => route.params.id as string)
const fromTab = computed(() => (route.query.fromTab as string) || '')
const isEditingPublished = ref(false)
const wasScheduled = ref(false)
const originalScheduleISO = ref<string | null>(null)
const isLoadingData = ref(false)
const isSavingDraft = ref(false)

const isEditMode = computed(() => {
  return route.name === 'edit-notification' || route.name === 'edit-notification-v2'
})

const publishButtonText = computed(() => {
  if (isEditingPublished.value) return 'Update now'
  if (formData.scheduleEnabled) return 'Schedule Now'
  return 'Publish now'
})

const languages = [
  { code: Language.KM, name: 'Khmer' },
  { code: Language.EN, name: 'English' },
  { code: Language.JP, name: 'Japan' },
]

const languageTabs = languages.map((lang) => ({
  value: lang.code,
  label: lang.name,
}))
const activeLanguage = ref<Language>(Language.KM)
const handleLanguageChanged = (tab: { value: string; label: string }) => {
  activeLanguage.value = tab.value as Language
  titleError.value = ''
  descriptionError.value = ''
  linkError.value = ''
}
const datePlaceholder = ref(getCurrentDatePlaceholder())
const timePlaceholder = ref(getCurrentTimePlaceholder())
type LanguageFormData = {
  title: string
  description: string
  linkToSeeMore: string
  imageFile?: File | null
  imageUrl?: string | null
}
const languageFormData = reactive<Record<string, LanguageFormData>>({
  [Language.KM]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
  [Language.EN]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
  [Language.JP]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
})
const existingImageIds = reactive<Record<string, string | null>>({
  [Language.KM]: null,
  [Language.EN]: null,
  [Language.JP]: null,
})
const existingTranslationIds = reactive<Record<string, number | null>>({
  [Language.KM]: null,
  [Language.EN]: null,
  [Language.JP]: null,
})
const originalLanguageFormData = reactive<Record<string, LanguageFormData>>({
  [Language.KM]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
  [Language.EN]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
  [Language.JP]: {
    title: '',
    description: '',
    linkToSeeMore: '',
    imageFile: null,
    imageUrl: null,
  },
})
const originalImageIds = reactive<Record<string, string | null>>({
  [Language.KM]: null,
  [Language.EN]: null,
  [Language.JP]: null,
})
const originalFormData = reactive({
  categoryTypeId: null as number | null,
  pushToPlatforms: Platform.ALL,
  platform: BakongApp.BAKONG,
})
const getTodayDateString = (): string => {
  const now = DateUtils.nowInCambodia()
  const month = now.getMonth() + 1
  const day = now.getDate()
  const year = now.getFullYear()
  return `${month}/${day}/${year}`
}
const categoryTypesStore = useCategoryTypesStore()
const categoryTypes = computed(() => categoryTypesStore.categoryTypes)
const loadingCategoryTypes = computed(() => categoryTypesStore.loading)
const formData = reactive({
  notificationType: NotificationType.ANNOUNCEMENT, // Default to ANNOUNCEMENT when flash is off
  categoryTypeId: null as number | null,
  pushToPlatforms: Platform.ALL,
  showPerDay: 1, // Default: 1 time per day (disabled for first version)
  maxDayShowing: 1, // Default: 1 days maximum (disabled for first version)
  platform: BakongApp.BAKONG,
  scheduleEnabled: false,
  scheduleDate: getTodayDateString(),
  scheduleTime: null as string | null,
  splashEnabled: false,
  enableaccountIds: false,
  accountIds: [] as string[],
})

// NEW: toggle state
const enableaccountIds = ref(false)

// init (if editing and has existing ids)
watchEffect(() => {
  if (formData.accountIds.length > 0) {
    formData.enableaccountIds = true
  }
})

const removeTestAccountId = (idx: number) => {
  formData.accountIds.splice(idx, 1)
  if (formData.accountIds.length === 0) {
    formData.enableaccountIds = false
  }
}

const addAccountId = () => {
  formData.accountIds.push('')
}

const sanitizeaccountIds = () => {
  return formData.enableaccountIds
    ? [...new Set(formData.accountIds.map(x => String(x).trim()).filter(Boolean))]
    : []
}

const onToggleTestAccounts = (val: boolean) => {
  if (val) {
    if (!formData.accountIds?.length) formData.accountIds = ['']
  } else {
    // ✅ MUST clear when OFF
    formData.accountIds = []
  }
}

watch(
  () => formData.enableaccountIds,
  (enabled) => {
    if (!enabled) {
      formData.accountIds = [] // ✅ force clear when toggle OFF
    }
  },
)


const initializeCategoryTypes = async () => {
  try {
    await categoryTypesStore.initialize()
    if (categoryTypes.value.length > 0) {
      const newsCategory = categoryTypes.value.find(
        (ct: CategoryTypeData) => ct.name === 'News' || ct.name === 'NEWS',
      )
      const defaultCategoryId = newsCategory?.id || categoryTypes.value[0].id
      if (formData.categoryTypeId === null) {
        formData.categoryTypeId = defaultCategoryId
        if (!isEditMode.value) {
          originalFormData.categoryTypeId = defaultCategoryId
        }
      }
    }
  } catch (error) {
    console.error('Failed to initialize category types:', error)
  }
}
onMounted(() => {
  initializeCategoryTypes()
})
const currentTitle = computed({
  get: () => languageFormData[activeLanguage.value]?.title || '',
  set: (value: string) => {
    if (languageFormData[activeLanguage.value]) {
      languageFormData[activeLanguage.value].title = value
    }
    validateTitle()
  },
})
const currentDescription = computed({
  get: () => languageFormData[activeLanguage.value]?.description || '',
  set: (value: string) => {
    if (languageFormData[activeLanguage.value]) {
      languageFormData[activeLanguage.value].description = value
    }
    validateDescription()
  },
})
const currentLinkToSeeMore = computed({
  get: () => languageFormData[activeLanguage.value]?.linkToSeeMore || '',
  set: (value: string) => {
    if (languageFormData[activeLanguage.value]) {
      languageFormData[activeLanguage.value].linkToSeeMore = value
    }
  },
})
const currentImageFile = computed({
  get: () => languageFormData[activeLanguage.value]?.imageFile || null,
  set: (value: File | null) => {
    if (languageFormData[activeLanguage.value]) {
      languageFormData[activeLanguage.value].imageFile = value
    }
  },
})
const currentImageUrl = computed({
  get: () => languageFormData[activeLanguage.value]?.imageUrl || null,
  set: (value: string | null) => {
    if (languageFormData[activeLanguage.value]) {
      languageFormData[activeLanguage.value].imageUrl = value
    }
  },
})
const titleHasKhmer = computed(() => containsKhmer(currentTitle.value))
const descriptionHasKhmer = computed(() => containsKhmer(currentDescription.value))
const templateCreatedAt = ref<Date | null>(null)
const loadNotificationData = async () => {
  if (!isEditMode.value || !notificationId.value) return
  isLoadingData.value = true
  try {
    const res = await apiV2.get(`${getApiPrefix()}/template/${notificationId.value}`)
    const template = res.data?.data
    if (!template) {
      isLoadingData.value = false
      return
    }
    if (template.createdAt) {
      templateCreatedAt.value = new Date(template.createdAt)
    } else {
      templateCreatedAt.value = null
    }
    isEditingPublished.value = fromTab.value === 'published' || template.isSent === true
    formData.notificationType =
      mapNotificationTypeToFormType(template.notificationType) || NotificationType.NOTIFICATION
    formData.categoryTypeId = template.categoryTypeId || null
    formData.platform = (template.bakongPlatform as BakongApp) || BakongApp.BAKONG
    originalFormData.categoryTypeId = template.categoryTypeId || null
    formData.accountIds = Array.isArray(template.accountIds) ? template.accountIds : []
    originalFormData.platform = (template.bakongPlatform as BakongApp) || BakongApp.BAKONG
    if (template.platforms && Array.isArray(template.platforms) && template.platforms.length > 0) {
      const formPlatform = mapPlatformToFormPlatform(template.platforms)
      formData.pushToPlatforms = formPlatform
      originalFormData.pushToPlatforms = formPlatform
    } else {
      formData.pushToPlatforms = Platform.ALL
      originalFormData.pushToPlatforms = Platform.ALL
    }
    if (template.sendSchedule) {
      formData.scheduleEnabled = true
      wasScheduled.value = true
      originalScheduleISO.value = template.sendSchedule
      try {
        const { date, time } = DateUtils.formatUTCToCambodiaDateTime(template.sendSchedule)
        if (date && time) {
          formData.scheduleDate = date
          formData.scheduleTime = time
          console.log('✅ [Load Data] Set schedule:', { date, time })
        }
      } catch (error) {
        console.error('Error parsing schedule date/time:', error)
      }
    } else if (isEditingPublished.value && template.updatedAt) {
      try {
        const { date, time } = DateUtils.formatUTCToCambodiaDateTime(template.updatedAt)
        if (date && time) {
          formData.scheduleDate = date
          formData.scheduleTime = time
          console.log('✅ [Load Data] Set published time:', { date, time })
        }
      } catch (error) {
        console.error('Error parsing updated date/time:', error)
      }
    }
    formData.splashEnabled = template.notificationType === NotificationType.FLASH_NOTIFICATION
    if (Array.isArray(template.translations)) {
      for (const t of template.translations) {
        const lang = t.language as string as Language
        if (!languageFormData[lang]) continue
        const title = t.title || ''
        const description = t.content || ''
        const linkPreview = t.linkPreview || ''
        const fileId = t.image?.fileId || t.image?.fileID || t.imageId || t.image?.id
        languageFormData[lang].title = title
        languageFormData[lang].description = description
        languageFormData[lang].linkToSeeMore = linkPreview
        languageFormData[lang].imageUrl = fileId ? `/api/v1/image/${fileId}` : null
        languageFormData[lang].imageFile = null
        existingImageIds[lang] = fileId || null
        originalLanguageFormData[lang].title = title
        originalLanguageFormData[lang].description = description
        originalLanguageFormData[lang].linkToSeeMore = linkPreview
        originalLanguageFormData[lang].imageUrl = fileId ? `/api/v1/image/${fileId}` : null
        originalLanguageFormData[lang].imageFile = null
        originalImageIds[lang] = fileId || null
        existingTranslationIds[lang] = t.id || null
      }
      const languagePriority = [Language.KM, Language.EN, Language.JP]
      for (const lang of languagePriority) {
        if (languageFormData[lang]?.title?.trim() || languageFormData[lang]?.description?.trim()) {
          activeLanguage.value = lang
          console.log('📑 [Load Data] Set active tab based on content priority:', lang)
          break
        }
      }
    }
    await nextTick()
  } catch (error) {
    console.error('Error loading notification data:', error)
    ElNotification({
      title: 'Error',
      message: 'Failed to load notification data',
      type: 'error',
      duration: 2000,
    })
  } finally {
    isLoadingData.value = false
  }
}
onMounted(async () => {
  datePlaceholder.value = getCurrentDatePlaceholder()
  timePlaceholder.value = getCurrentTimePlaceholder()
  if (isEditMode.value) {
    await loadNotificationData()
  }
})
const showConfirmationDialog = ref(false)
const showLeaveDialog = ref(false)
const showUpdateConfirmationDialog = ref(false)
const showMissingLanguageDialog = ref(false)
const missingLanguagesMessage = ref('')
let pendingNavigation: (() => void) | null = null
const allowRouteLeave = ref(false)
let isSavingOrPublishing = ref(false) // Flag to prevent blocking during save/publish
const isDiscarding = ref(false) // Flag to allow navigation when discarding changes
watch(
  () => formData.splashEnabled,
  (isEnabled) => {
    if (isEnabled) {
      formData.notificationType = NotificationType.FLASH_NOTIFICATION
    } else {
      formData.notificationType = NotificationType.ANNOUNCEMENT
    }
  },
)
watch(
  () => formData.scheduleEnabled,
  (isEnabled) => {
    if (isEnabled && !isLoadingData.value) {
      formData.scheduleDate = getTodayDateString()
      formData.scheduleTime = getCurrentTimePlaceholder()
      console.log('✅ [Schedule Toggle] Enabled - Set date:', formData.scheduleDate, 'time:', formData.scheduleTime)
    } else if (!isEnabled) {
      formData.scheduleTime = null
      console.log('✅ [Schedule Toggle] Disabled - Cleared time')
    }
  },
)
const titleError = ref('')
const descriptionError = ref('')
const linkError = ref('')
const DB_TITLE_MAX_LENGTH = 1024 // Database VARCHAR(1024) limit - matches DB exactly
const validateTitle = () => {
  const val = currentTitle.value?.trim()
  if (!val) {
    titleError.value = 'Please enter a title'
  } else if (val.length > DB_TITLE_MAX_LENGTH) {
    titleError.value = `Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${val.length}.`
  } else {
    titleError.value = ''
  }
}
const validateDescription = () => {
  const val = currentDescription.value?.trim()
  if (!val) {
    descriptionError.value = 'Please enter a description'
  } else {
    descriptionError.value = ''
  }
}
const isValidUrl = (val: string): boolean => {
  try {
    if (!val) return true
    const u = new URL(val)
    return u.protocol === 'http:' || u.protocol === 'https:'
  } catch {
    return false
  }
}
const validateLink = () => {
  const val = currentLinkToSeeMore.value
  linkError.value = isValidUrl(val)
    ? ''
    : 'Please enter a valid URL starting with http:// or https://'
}
const handleUploadError = (message: string) => {
  ElNotification({
    title: 'Error',
    message: message,
    type: 'error',
    duration: 2000,
  })
}
const handleLanguageImageSelected = (file: File) => {
  const currentLang = activeLanguage.value
  languageFormData[currentLang].imageFile = file
  const reader = new FileReader()
  reader.onload = (e) => {
    languageFormData[currentLang].imageUrl = e.target?.result as string
  }
  reader.readAsDataURL(file)
}
const handleLanguageImageRemoved = () => {
  const currentLang = activeLanguage.value
  languageFormData[currentLang].imageFile = null
  languageFormData[currentLang].imageUrl = null
  existingImageIds[currentLang] = null
}
const isNotificationOld = (): boolean => {
  if (!templateCreatedAt.value) return false
  const now = new Date()
  const daysDiff = (now.getTime() - templateCreatedAt.value.getTime()) / (1000 * 60 * 60 * 24)
  return daysDiff > 1 // More than 1 day old
}
const handlePublishNow = async () => {
  const currentLangHasExistingData = isEditMode.value && existingTranslationIds[activeLanguage.value] !== null
  const currentLangHasUserInput = !!(currentTitle.value?.trim() || currentDescription.value?.trim() || currentImageFile.value)
  if (isEditMode.value && !currentLangHasExistingData && !currentLangHasUserInput) {
    let hasAnyChanges = false
    const globalFieldsChanged =
      formData.platform !== originalFormData.platform ||
      formData.categoryTypeId !== originalFormData.categoryTypeId ||
      formData.pushToPlatforms !== originalFormData.pushToPlatforms
    if (globalFieldsChanged) {
      hasAnyChanges = true
    } else {
      for (const langKey of Object.keys(languageFormData)) {
        const originalData = originalLanguageFormData[langKey]
        const currentData = languageFormData[langKey]
        if (!originalData) continue // Skip if no original data for this language
        const titleChanged = (currentData?.title?.trim() || '') !== (originalData?.title?.trim() || '')
        const descriptionChanged = (currentData?.description?.trim() || '') !== (originalData?.description?.trim() || '')
        const linkChanged = (currentData?.linkToSeeMore?.trim() || '') !== (originalData?.linkToSeeMore?.trim() || '')
        const imageChanged = currentData?.imageFile !== null ||
          (existingImageIds[langKey] !== originalImageIds[langKey])
        if (titleChanged || descriptionChanged || linkChanged || imageChanged) {
          hasAnyChanges = true
          break // Found at least one change, no need to check further
        }
      }
    }
    if (!hasAnyChanges) {
      const redirectTab = fromTab.value || 'published'
      setTimeout(() => {
        window.location.href = `/?tab=${redirectTab}`
      }, 100)
      return
    }
    const token = localStorage.getItem('auth_token')
    if (!token || token.trim() === '') {
      ElNotification({
        title: 'Error',
        message: 'Please login first',
        type: 'error',
        duration: 2000,
      })
      router.push('/login')
      return
    }
    titleError.value = ''
    descriptionError.value = ''
    await handlePublishNowInternal()
    return
  }
  let hasChangesForCurrentLang = false
  const globalFieldsChanged =
    formData.platform !== originalFormData.platform ||
    formData.categoryTypeId !== originalFormData.categoryTypeId ||
    formData.pushToPlatforms !== originalFormData.pushToPlatforms
  if (globalFieldsChanged) {
    hasChangesForCurrentLang = true
  } else if (isEditMode.value && currentLangHasExistingData) {
    const currentLang = activeLanguage.value
    const originalData = originalLanguageFormData[currentLang]
    const titleChanged = (currentTitle.value?.trim() || '') !== (originalData?.title?.trim() || '')
    const descriptionChanged = (currentDescription.value?.trim() || '') !== (originalData?.description?.trim() || '')
    const linkChanged = (currentLinkToSeeMore.value?.trim() || '') !== (originalData?.linkToSeeMore?.trim() || '')
    const imageChanged = currentImageFile.value !== null ||
      (existingImageIds[currentLang] !== originalImageIds[currentLang])
    hasChangesForCurrentLang = titleChanged || descriptionChanged || linkChanged || imageChanged
  }
  if (!hasChangesForCurrentLang) {
    const anyLanguageHasContent = Object.values(languageFormData).some(
      langData => langData.title?.trim() && langData.description?.trim()
    )
    if (!anyLanguageHasContent) {
      validateTitle()
      validateDescription()
      if (
        !currentTitle.value ||
        !currentDescription.value ||
        titleError.value ||
        descriptionError.value
      ) {
        if (!titleError.value) validateTitle()
        if (!descriptionError.value) validateDescription()
        return
      }
    } else {
      titleError.value = ''
      descriptionError.value = ''
    }
  } else {
    titleError.value = ''
    descriptionError.value = ''
  }
  const token = localStorage.getItem('auth_token')
  if (!token || token.trim() === '') {
    ElNotification({
      title: 'Error',
      message: 'Please login first',
      type: 'error',
      duration: 2000,
      dangerouslyUseHTMLString: true,
    })
    router.push('/login')
    return
  }
  const missingLangs: string[] = []
  const langs = [
    { key: 'KM', label: 'Khmer' },
    { key: 'EN', label: 'English' },
    { key: 'JP', label: 'Japanese' }
  ]
  langs.forEach(lang => {
    const data = languageFormData[lang.key]
    const hasTitle = data?.title?.trim() !== ''
    const hasDescription = data?.description?.trim() !== ''
    if (!hasTitle || !hasDescription) {
      missingLangs.push(lang.label)
    }
  })
  if (!isEditingPublished.value && missingLangs.length > 0 && missingLangs.length < 3) {
    const missingText = missingLangs.join(' and ')
    const availableLangs = langs.filter(l => !missingLangs.includes(l.label)).map(l => l.label)
    const availableText = availableLangs.join(' or ')
    missingLanguagesMessage.value = `<strong>${missingText}</strong> content is missing. Users will see the <strong>${availableText}</strong> version instead. Continue?`
    showMissingLanguageDialog.value = true
    return
  }
  if (isEditMode.value && isEditingPublished.value) {
    let hasAnyChanges = false
    const globalFieldsChanged =
      formData.platform !== originalFormData.platform ||
      formData.categoryTypeId !== originalFormData.categoryTypeId ||
      formData.pushToPlatforms !== originalFormData.pushToPlatforms
    if (globalFieldsChanged) {
      hasAnyChanges = true
    } else {
      for (const langKey of Object.keys(languageFormData)) {
        const originalData = originalLanguageFormData[langKey]
        const currentData = languageFormData[langKey]
        if (!originalData) continue // Skip if no original data for this language
        const titleChanged = (currentData?.title?.trim() || '') !== (originalData?.title?.trim() || '')
        const descriptionChanged = (currentData?.description?.trim() || '') !== (originalData?.description?.trim() || '')
        const linkChanged = (currentData?.linkToSeeMore?.trim() || '') !== (originalData?.linkToSeeMore?.trim() || '')
        const imageChanged = currentData?.imageFile !== null ||
          (existingImageIds[langKey] !== originalImageIds[langKey])
        if (titleChanged || descriptionChanged || linkChanged || imageChanged) {
          hasAnyChanges = true
          break // Found at least one change, no need to check further
        }
      }
    }
    if (hasAnyChanges) {
      showUpdateConfirmationDialog.value = true
      return
    } else {
      const redirectTab = fromTab.value || 'published'
      setTimeout(() => {
        window.location.href = `/?tab=${redirectTab}`
      }, 100)
      return
    }
  }
  await handlePublishNowInternal()
}

const normalizeApiEnvelope = (res: any) => {
  const body = res?.data ?? res ?? {}
  return {
    responseCode: body?.responseCode ?? 1,
    errorCode: body?.errorCode ?? 0,
    responseMessage: body?.responseMessage ?? body?.message ?? '',
    data: body?.data ?? {},
  }
}


// CreateNotificationView-v2.vue
// Replace your existing sendNotificationAndNotify(...) with this whole function.

const sendNotificationAndNotify = async (params: {
  templateId: number
  notificationType?: string
  publishNow?: boolean
  accountId?: string | string[]
  formData: any
  goDraft: () => void
  goPublished: () => void
}): Promise<{ ok: boolean; result?: any }> => {
  const {
    templateId,
    notificationType,
    publishNow,
    accountId,
    formData,
    goDraft,
    goPublished,
  } = params

  try {
    // 1) Call API (api returns response.data already)
    const sendResult = await notificationApi.sendNotification(
      Number(templateId),
      notificationType,
      publishNow === true,
      accountId,
    )

    const env = sendResult
    const data = env?.data || {}

    // 2) HARD ERROR ONLY (backend envelope error)
    if (typeof env?.responseCode === 'number' && env.responseCode !== 0) {
      ElNotification({
        title: 'Error',
        message: env?.responseMessage || env?.message || 'Failed to publish notification',
        type: 'error',
        duration: 8000,
      })
      goDraft()
      return { ok: false, result: sendResult }
    }

    // 3) Build platform context for message formatting
    const bakongPlatform =
      data?.bakongPlatform ||
      data?.whatnews?.bakongPlatform ||
      (formData as any)?.bakongPlatform

    const platformName = getFormattedPlatformName({
      platformName: data?.platformName,
      bakongPlatform,
      notification: formData as any,
    })

    const platforms = data?.platforms || (formData as any)?.platforms || []
    let devicePlatform = 'ALL'
    if (Array.isArray(platforms) && platforms.length === 1) {
      devicePlatform = String(platforms[0])
    }
    const devicePlatformFormatted = formatPlatform(devicePlatform)

    // 4) SINGLE SOURCE OF TRUTH for toast content/type
    const messageConfig = getNotificationMessage(
      sendResult, // ✅ IMPORTANT: pass envelope (env), not data
      platformName,
      bakongPlatform,
      devicePlatformFormatted,
    )

    // 5) Always show toast
    ElNotification({
      title: messageConfig.title,
      message: messageConfig.message,
      type: messageConfig.type,
      duration: messageConfig.duration,
      dangerouslyUseHTMLString: messageConfig.dangerouslyUseHTMLString,
    })

    // 6) Decide which tab to go
    // - success OR partial (warning) => published
    // - error OR info (saved as draft / no users) => draft
    if (messageConfig.type === 'error' || messageConfig.type === 'info') {
      goDraft()
      return { ok: false, result: sendResult }
    }

    goPublished()
    return { ok: true, result: sendResult }
  } catch (error: any) {
    // Network / exception
    ElNotification({
      title: 'Error',
      message: error?.message || 'Failed to send notification.',
      type: 'error',
      duration: 8000,
    })
    goDraft()
    return { ok: false }
  }
}

const handlePublishNowInternal = async () => {
  // prevent double click
  if (isSavingOrPublishing.value) return
  isSavingOrPublishing.value = true

  // reset per-language errors
  titleError.value = ''
  descriptionError.value = ''
  linkError.value = ''

  // validate required fields (current language)
  validateTitle()
  validateDescription()
  validateLink()

  if (titleError.value || descriptionError.value || linkError.value) {
    isSavingOrPublishing.value = false
    return
  }

  const token = localStorage.getItem('auth_token')
  if (!token || token.trim() === '') {
    ElNotification({
      title: 'Error',
      message: 'Please login first',
      type: 'error',
      duration: 2000,
    })
    isSavingOrPublishing.value = false
    router.push('/login')
    return
  }

  const loadingNotification = ElNotification({
    title: isEditMode.value ? 'Updating notification...' : 'Creating notification...',
    message: isEditMode.value
      ? 'Please wait while we update your notification'
      : 'Please wait while we create your notification',
    type: 'warning',
    duration: 0,
  })

  try {
    // ---------------------------
    // 1) Decide sendType/isSent
    let sendType = SendType.SEND_NOW
    let isSent = false // ✅ IMPORTANT: do NOT mark as sent here
    let redirectTab

    if (formData.scheduleEnabled) {
      const hasValidDate = !!(formData.scheduleDate && String(formData.scheduleDate).trim() !== '')
      const hasValidTime = !!(formData.scheduleTime && String(formData.scheduleTime).trim() !== '')

      if (!hasValidDate || !hasValidTime) {
      ElNotification({
        title: 'Error',
        message: 'Please select both Date and Time for scheduling',
        type: 'error',
        duration: 2500,
      })
      loadingNotification.close()
      isSavingOrPublishing.value = false
      return
      }

      sendType = SendType.SEND_SCHEDULE
      isSent = false
      redirectTab = 'scheduled'
      } else {
      sendType = SendType.SEND_NOW
      redirectTab = 'published'
      }


    // ---------------------------
    // 2) Prepare translations + images
    // ---------------------------
    const imagesToUpload: { file: File; language: string }[] = []
    const translations: any[] = []

    for (const [langKey, langData] of Object.entries(languageFormData)) {
      const title = (langData.title || '').trim()
      const content = (langData.description || '').trim()
      const link = (langData.linkToSeeMore || '').trim()

      // include only languages having both title & content
      if (!title || !content) continue

      if (link && !isValidUrl(link)) {
        ElNotification({
          title: 'Error',
          message: `Invalid URL for ${langKey}. Must start with http(s)://`,
          type: 'error',
          duration: 2500,
        })
        loadingNotification.close()
        isSavingOrPublishing.value = false
        return
      }

      let imageId: string | undefined

      // new image file selected
      if (langData.imageFile) {
        const { file: compressed, dataUrl } = await compressImage(langData.imageFile, {
          maxBytes: 5 * 1024 * 1024,
          maxWidth: 2000,
        })
        imagesToUpload.push({ file: compressed, language: langKey })

        // show preview immediately
        if (languageFormData[langKey]) {
          languageFormData[langKey].imageUrl = dataUrl
        }
      } else if (isEditMode.value && existingImageIds[langKey] && langData.imageUrl !== null) {
        // keep old image
        imageId = existingImageIds[langKey] || undefined
      }

      translations.push({
        language: mapLanguageToEnum(langKey),
        title,
        content,
        linkPreview: link || undefined,
        image: imageId || '',
      })
    }

    // fallback if no translation objects (should not happen because we validated current language)
    if (translations.length === 0) {
      translations.push({
        language: mapLanguageToEnum(activeLanguage.value),
        title: currentTitle.value.trim(),
        content: currentDescription.value.trim(),
        linkPreview: currentLinkToSeeMore.value?.trim() || undefined,
        image: '',
      })
    }

    // ---------------------------
    // 3) Upload images (batch)
    // ---------------------------
    if (imagesToUpload.length > 0) {
      const items = imagesToUpload.map((it) => ({ file: it.file, language: String(it.language) }))
      const uploadedImages = await notificationApi.uploadImages(items)

      const langToFileId = new Map<string, string>()
      uploadedImages.forEach((u) => {
        if (!u?.language || !u?.fileId) return
        langToFileId.set(String(u.language), u.fileId)

        const langKey = String(u.language)
        existingImageIds[langKey] = u.fileId

        if (languageFormData[langKey]) {
          languageFormData[langKey].imageFile = null
          languageFormData[langKey].imageUrl = `/api/v1/image/${u.fileId}`
        }
      })

      // apply uploaded fileId into translations.image
      for (let i = 0; i < translations.length; i++) {
        const fid = langToFileId.get(String(translations[i].language))
        if (fid) translations[i].image = fid
      }
    }

    // ---------------------------
    // 4) Build template payload (V2)
    // ---------------------------
    const cleanedIds =
      Array.isArray(formData.accountIds) && formData.accountIds.length > 0
        ? formData.accountIds.map((x: string) => String(x || '').trim()).filter(Boolean)
        : []

        const templateData: CreateTemplateRequestV2 = {
          platforms: [mapPlatformToEnum(formData.pushToPlatforms)],
          bakongPlatform: formData.platform,
          sendType,
          isSent,
          translations,
          notificationType: mapTypeToNotificationType(formData.notificationType),
          categoryTypeId: Number(formData.categoryTypeId ?? 1),
          priority: 1,

          // ✅ ALWAYS send accountIds (important for clearing old value on update)
          // - when toggle ON  -> send cleanedIds
          // - when toggle OFF -> send []
          accountIds: formData.enableaccountIds ? cleanedIds : [],
        }



    if (formData.scheduleEnabled) {
      const scheduleDateTime = DateUtils.parseScheduleDateTime(
        String(formData.scheduleDate),
        String(formData.scheduleTime),
      )
      ;(templateData as any).sendSchedule = scheduleDateTime.toISOString()
    }

    // ---------------------------
    // 5) Create / Update FIRST (IMPORTANT)
    // ---------------------------
    const createResult = isEditMode.value
      ? await templateApiV2.updateTemplate(Number(notificationId.value), templateData)
      : await templateApiV2.createTemplate(templateData)

    loadingNotification.close()

    // ---------------------------
    // 6) Send now (only when not scheduled)
    //    ✅ FIX: this block is AFTER createResult (no TS error)
    // ---------------------------
    const shouldSendNow = !formData.scheduleEnabled && !isEditingPublished.value

    if (shouldSendNow) {
      const body = createResult?.data ?? createResult ?? {}
      const templateIdToSend = isEditMode.value
        ? Number(notificationId.value)
        : body?.data?.templateId ?? body?.templateId ?? body?.id

      if (!templateIdToSend) {
        isSavingOrPublishing.value = false
        throw new Error('Template ID is missing after save. Please try again.')
      }

      // ✅ send + show only ONE message (success OR fail), no duplicates
      await sendNotificationAndNotify({
        templateId: Number(templateIdToSend),
        notificationType: mapTypeToNotificationType(formData.notificationType),
        goPublished: () => router.replace('/v2?tab=published'),
        goDraft: () => router.replace('/v2?tab=draft'),
        formData,
      })

      isSavingOrPublishing.value = false
      return
    }

    // ---------------------------
    // 7) Not sending now (scheduled / just save)
    // ---------------------------
    ElNotification({
      title: 'Success',
      message:
        redirectTab === 'scheduled'
          ? 'Notification scheduled successfully!'
          : 'Notification saved successfully!',
      type: 'success',
      duration: 2000,
    })

    isSavingOrPublishing.value = false
    router.replace(`/v2?tab=${redirectTab}`)
  } catch (error: any) {
    loadingNotification.close()
    isSavingOrPublishing.value = false

    const msg =
      error?.response?.data?.responseMessage ||
      error?.response?.data?.message ||
      error?.message ||
      'Something went wrong'

    ElNotification({
      title: 'Error',
      message: String(msg),
      type: 'error',
      duration: 3000,
    })
  }
}


const handleFinishLater = () => {
  showConfirmationDialog.value = true
}
const handleSaveDraft = async (forceDraft: boolean = false) => {
  if (isSavingOrPublishing.value) return
  isSavingOrPublishing.value = true
  const currentLang = activeLanguage.value
  if (languageFormData[currentLang]) {
    languageFormData[currentLang].title = currentTitle.value
    languageFormData[currentLang].description = currentDescription.value
    languageFormData[currentLang].linkToSeeMore = currentLinkToSeeMore.value
  }
  titleError.value = ''
  descriptionError.value = ''
  let hasValidationError = false
  const validationErrors: string[] = []
  for (const [langKey, langData] of Object.entries(languageFormData)) {
    const lang = langKey as Language
    const title = (lang === activeLanguage.value ? currentTitle.value : langData.title)?.trim() || ''
    if (title && title.length > DB_TITLE_MAX_LENGTH) {
      hasValidationError = true
      validationErrors.push(`${langKey.toUpperCase()}: Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${title.length}.`)
    }
  }
  if (hasValidationError) {
    const activeTitle = currentTitle.value?.trim() || ''
    if (activeTitle && activeTitle.length > DB_TITLE_MAX_LENGTH) {
      titleError.value = `Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${activeTitle.length}.`
    }
    ElNotification({
      title: 'Validation Error',
      message: validationErrors.join('<br/>'),
      type: 'error',
      duration: 5000,
      dangerouslyUseHTMLString: true,
    })
    isSavingOrPublishing.value = false
    return
  }
  const token = localStorage.getItem('auth_token')
  if (!token || token.trim() === '') {
    ElNotification({
      title: 'Error',
      message: 'Please login first',
      type: 'error',
      duration: 2000,
    })
    isSavingOrPublishing.value = false
    router.push('/login')
    return
  }
  const loadingNotification = ElNotification({
    title: isEditMode.value ? 'Updating draft...' : 'Saving draft...',
    message: isEditMode.value
      ? 'Please wait while we update your notification'
      : 'Please wait while we save your notification',
    type: 'warning',
    duration: 0,
  })
  try {
    const imagesToUpload: { file: File; language: string }[] = []
    const translations: any[] = []
    for (const [langKey, langData] of Object.entries(languageFormData)) {
      const lang = langKey as Language
      const title = (lang === activeLanguage.value ? currentTitle.value : langData.title)?.trim() || ''
      const content =
        (lang === activeLanguage.value ? currentDescription.value : langData.description)?.trim() ||
        ''
      const linkPreview =
        (lang === activeLanguage.value
          ? currentLinkToSeeMore.value
          : langData.linkToSeeMore
        )?.trim() || ''
      const imageFile = lang === activeLanguage.value ? currentImageFile.value : langData.imageFile
      if (imageFile) {
        try {
          const { file: compressed, dataUrl } = await compressImage(imageFile, {
            maxBytes: 10 * 1024 * 1024,
            maxWidth: 2000,
            targetAspectRatio: 2 / 1,
            correctAspectRatio: true,
          })
          imagesToUpload.push({ file: compressed, language: langKey })
          if (languageFormData[langKey]) {
            languageFormData[langKey].imageUrl = dataUrl
            if (lang === activeLanguage.value) {
              currentImageUrl.value = dataUrl
            }
          }
        } catch (e) {
          console.error('Compression failed for', langKey, e)
          throw new Error(`Failed to prepare image for ${langKey.toUpperCase()}`)
        }
      }
      const translationData: any = {
        language: mapLanguageToEnum(langKey),
        title: title,
        content: content,
        linkPreview: linkPreview || undefined,
        image: existingImageIds[langKey] || '',
      }
      if (existingTranslationIds[langKey]) {
        translationData.id = existingTranslationIds[langKey]
      }
      translations.push(translationData)
    }
    const translationsToSave = translations.filter((t) => {
      const hasTitle = t.title && String(t.title).trim() !== ''
      const hasContent = t.content && String(t.content).trim() !== ''
      const hasImage = (t.image && String(t.image).trim() !== '') || (t.imageId && String(t.imageId).trim() !== '')
      const isExisting = !!t.id
      return hasTitle || hasContent || hasImage || isExisting
    })
    let uploadedImages: {
      language?: string
      fileId: string
      mimeType: string
      originalFileName: string
    }[] = []
    if (imagesToUpload.length > 0) {
      try {
        const uploadItems = imagesToUpload.map((item) => ({
          file: item.file,
          language: String(item.language),
        }))
        uploadedImages = await notificationApi.uploadImages(uploadItems)
        uploadedImages.forEach((u) => {
          if (u.language && u.fileId) {
            const langKey = String(u.language)
            existingImageIds[langKey] = u.fileId
            const transIndex = translationsToSave.findIndex(t => t.language === mapLanguageToEnum(langKey))
            if (transIndex !== -1) {
              translationsToSave[transIndex].image = u.fileId
            }
            if (languageFormData[langKey]) {
              languageFormData[langKey].imageFile = null
              languageFormData[langKey].imageUrl = `/api/v1/image/${u.fileId}`
              if (langKey === activeLanguage.value) {
                currentImageFile.value = null
                currentImageUrl.value = `/api/v1/image/${u.fileId}`
              }
            }
          }
        })
      } catch (error) {
        console.error('Error uploading images during draft save:', error)
        throw new Error('Failed to upload images. Please try again.')
      }
    }
    const useSchedule = formData.scheduleEnabled && formData.scheduleDate && formData.scheduleTime
    const finalSendType = (forceDraft || !useSchedule) ? SendType.SEND_NOW : SendType.SEND_SCHEDULE
    const cleanedAccountIds = (enableaccountIds.value ? formData.accountIds : [])
      .map((x) => String(x).trim())
      .filter(Boolean)
    console.log('🔍 [CLEANED ACCOUNT IDS] cleanedAccountIds:', cleanedAccountIds)

    const templateData: CreateTemplateRequestV2 = {
      platforms: [mapPlatformToEnum(formData.pushToPlatforms)],
      bakongPlatform: formData.platform,
      sendType: finalSendType,
      isSent: false,
      translations,
      notificationType: mapTypeToNotificationType(formData.notificationType),
      categoryTypeId: formData.categoryTypeId ?? 3,
      priority: 1,

      // ✅ THIS is the fix
      accountIds: buildAccountIdsPayload(),
    }
    if (useSchedule) {
      const scheduleDateTime = DateUtils.parseScheduleDateTime(
        String(formData.scheduleDate),
        String(formData.scheduleTime),
      )
        ; (templateData as any).sendSchedule = scheduleDateTime.toISOString()
    } else {
      ; (templateData as any).sendSchedule = null
    }
    let result
    if (isEditMode.value) {
      result = await templateApiV2.updateTemplate(parseInt(notificationId.value), templateData)
    } else {
      result = await templateApiV2.createTemplate(templateData)
    }
    loadingNotification.close()
    ElNotification({
      title: 'Success',
      message: `Notification saved as draft successfully!`,
      type: 'success',
      duration: 2000,
    })
    try {
      localStorage.removeItem('notifications_cache')
      localStorage.removeItem('notifications_cache_timestamp')
    } catch (e) {
      console.warn('Failed to clear cache:', e)
    }
    const redirectTab = (forceDraft || !useSchedule) ? 'draft' : 'scheduled'
    if (isEditMode.value) {
      setTimeout(() => {
        window.location.href = `/?tab=${redirectTab}`
        isSavingOrPublishing.value = false
      }, 500)
    } else {
      router.push(`/?tab=${redirectTab}`).then(() => {
        isSavingOrPublishing.value = false
      })
    }
  } catch (error: any) {
    isSavingOrPublishing.value = false
    loadingNotification.close()
    console.error('Error saving draft:', error)
    let errorMessage =
      error.response?.data?.responseMessage ||
      error.response?.data?.message ||
      error.message ||
      'An unexpected error occurred while saving the draft'
    if (error.response?.data && typeof error.response.data === 'object') {
      const data = error.response.data
      if (data.responseMessage) {
        errorMessage = data.responseMessage
      }
    }
    ElNotification({
      title: 'Error',
      message: errorMessage,
      type: 'error',
      duration: 5000,
    })
  }
}

const buildAccountIdsPayload = (): string[] => {
  const cleaned = (formData.accountIds || [])
    .map((x: any) => String(x).trim())
    .filter(Boolean)

  return formData.enableaccountIds ? cleaned : [] // ✅ OFF => []
}

const handleDiscard = () => {
  isDiscarding.value = true
  pendingNavigation = null
  const defaultTab = isEditingPublished.value ? 'published' : (wasScheduled.value ? 'scheduled' : 'draft')
  const redirectTab = fromTab.value || (isEditMode.value ? defaultTab : 'published')
  router.push(`/?tab=${redirectTab}`).finally(() => {
    setTimeout(() => {
      isDiscarding.value = false
    }, 100)
  })
}
const handleConfirmationDialogConfirm = async () => {
  try {
    isSavingDraft.value = true

    // ✅ save draft first
    await handleSaveDraft(true)

    // ✅ close dialog
    showUpdateConfirmationDialog.value = false

    // ✅ continue navigation
    const nav = pendingNavigation
    pendingNavigation = null

    if (nav) nav()
    else allowRouteLeave.value = true
  } catch (error) {
    console.error('[leave-confirm] save draft failed:', error)
  } finally {
    isSavingDraft.value = false
  }
}

const handleConfirmationDialogCancel = () => {
  showUpdateConfirmationDialog.value = false
  pendingNavigation = null
}

const hasUnsavedChanges = computed(() => {
  const globalFieldsModified =
    formData.platform !== originalFormData.platform ||
    formData.categoryTypeId !== originalFormData.categoryTypeId ||
    formData.pushToPlatforms !== originalFormData.pushToPlatforms
  if (globalFieldsModified) return true
  const hasContent = Object.values(languageFormData).some(
    (langData) => langData.title?.trim() || langData.description?.trim(),
  )
  const hasImage = Object.values(languageFormData).some(
    (langData) => langData.imageFile || langData.imageUrl,
  )
  const hasExistingImage = Object.values(existingImageIds).some((id) => id !== null)
  if (isEditMode.value) {
    for (const langKey of Object.keys(languageFormData)) {
      const originalData = originalLanguageFormData[langKey]
      const currentData = languageFormData[langKey]
      if (!originalData) continue
      const titleChanged = (currentData?.title?.trim() || '') !== (originalData?.title?.trim() || '')
      const descriptionChanged = (currentData?.description?.trim() || '') !== (originalData?.description?.trim() || '')
      const linkChanged = (currentData?.linkToSeeMore?.trim() || '') !== (originalData?.linkToSeeMore?.trim() || '')
      const imageChanged = currentData?.imageFile !== null ||
        (existingImageIds[langKey] !== originalImageIds[langKey])
      if (titleChanged || descriptionChanged || linkChanged || imageChanged) return true
    }
  }
  return hasContent || hasImage || hasExistingImage
})
const initialSnapshot = ref('')

const makeSnapshot = () =>
  JSON.stringify({
    platforms: formData.pushToPlatforms,
    bakongPlatform: formData.platform,
    sendType: formData.scheduleEnabled ? SendType.SEND_SCHEDULE : SendType.SEND_NOW,
    notificationType: formData.notificationType,
  })

const isFormDirty = computed(() => {
  if (!initialSnapshot.value) return false
  return makeSnapshot() !== initialSnapshot.value
})
onBeforeRouteLeave((to, from, next) => {
  // ✅ allow navigation after user confirmed
  if (allowRouteLeave.value) return next()

  if (isFormDirty.value) {
    showUpdateConfirmationDialog.value = true

    pendingNavigation = () => {
      allowRouteLeave.value = true
      next()
    }

    return next(false)
  }

  next()
})

const handleLeaveDialogConfirm = async () => {
  showLeaveDialog.value = false
  pendingNavigation = null
  if (isEditingPublished.value || fromTab.value === 'scheduled' || wasScheduled.value) {
    const missingLangs: string[] = []
    const langs = [
      { key: 'KM', label: 'Khmer' },
      { key: 'EN', label: 'English' },
      { key: 'JP', label: 'Japanese' }
    ]
    langs.forEach(lang => {
      const data = languageFormData[lang.key]
      const hasTitle = data?.title?.trim() !== ''
      const hasDescription = data?.description?.trim() !== ''
      if (!hasTitle || !hasDescription) {
        missingLangs.push(lang.label)
      }
    })
    if (!isEditingPublished.value && missingLangs.length > 0 && missingLangs.length < 3) {
      const missingText = missingLangs.join(' and ')
      const availableLangs = langs.filter(l => !missingLangs.includes(l.label)).map(l => l.label)
      const availableText = availableLangs.join(' or ')
      missingLanguagesMessage.value = `<strong>${missingText}</strong> content is missing. Users will see the <strong>${availableText}</strong> version instead. Continue?`
      showMissingLanguageDialog.value = true
      return
    }
    await handlePublishNowInternal()
  } else {
    await handleSaveDraft(true)
  }
}
const handleLeaveDialogCancel = () => {
  showLeaveDialog.value = false
  pendingNavigation = null
}
const handleUpdateConfirmationConfirm = async () => {
  showUpdateConfirmationDialog.value = false
  await handlePublishNowInternal()
}
const handleUpdateConfirmationCancel = () => {
  showUpdateConfirmationDialog.value = false
  isSavingOrPublishing.value = false
  const defaultTab = isEditingPublished.value ? 'published' : (wasScheduled.value ? 'scheduled' : 'draft')
  const redirectTab = fromTab.value || defaultTab
  if (isEditMode.value) {
    setTimeout(() => {
      window.location.href = `/?tab=${redirectTab}`
    }, 100)
  } else {
    router.push(`/?tab=${redirectTab}`)
  }
}
const handleMissingLanguageConfirm = async () => {
  showMissingLanguageDialog.value = false
  if (isEditMode.value && isEditingPublished.value) {
    let hasAnyChanges = false
    const globalFieldsChanged =
      formData.platform !== originalFormData.platform ||
      formData.categoryTypeId !== originalFormData.categoryTypeId ||
      formData.pushToPlatforms !== originalFormData.pushToPlatforms
    if (globalFieldsChanged) {
      hasAnyChanges = true
    } else {
      for (const langKey of Object.keys(languageFormData)) {
        const originalData = originalLanguageFormData[langKey]
        const currentData = languageFormData[langKey]
        if (!originalData) continue
        const titleChanged = (currentData?.title?.trim() || '') !== (originalData?.title?.trim() || '')
        const descriptionChanged = (currentData?.description?.trim() || '') !== (originalData?.description?.trim() || '')
        const linkChanged = (currentData?.linkToSeeMore?.trim() || '') !== (originalData?.linkToSeeMore?.trim() || '')
        const imageChanged = currentData?.imageFile !== null ||
          (existingImageIds[langKey] !== originalImageIds[langKey])
        if (titleChanged || descriptionChanged || linkChanged || imageChanged) {
          hasAnyChanges = true
          break
        }
      }
    }
    if (hasAnyChanges) {
      showUpdateConfirmationDialog.value = true
    } else {
      const redirectTab = fromTab.value || 'published'
      setTimeout(() => {
        window.location.href = `/?tab=${redirectTab}`
      }, 100)
    }
    return
  }
  await handlePublishNowInternal()
}
const handleMissingLanguageCancel = () => {
  showMissingLanguageDialog.value = false
  isSavingOrPublishing.value = false
}
const formatBakongApp = (app: BakongApp | undefined): string => {
  if (!app) return 'Bakong'
  switch (app) {
    case BakongApp.BAKONG:
      return 'Bakong'
    case BakongApp.BAKONG_TOURIST:
      return 'Bakong Tourist'
    case BakongApp.BAKONG_JUNIOR:
      return 'Bakong Junior'
    default:
      return String(app)
  }
}

// const sendNotificationAndNotify = async (args: {
//   templateId: number
//   notificationType: any
//   goPublished: () => void
//   goDraft: () => void
// }) => {
//   ;(ElNotification as any).closeAll?.()

//   const sendRes = await notificationApi.sendNotification(
//     args.templateId,
//     args.notificationType,
//     true,
//   )

//   const body = (sendRes as any)?.data ?? sendRes ?? {}
//   const responseCode = Number(body?.responseCode ?? -1)
//   const errorCode = Number(body?.errorCode ?? -1)
//   const responseMessage = String(body?.responseMessage || body?.message || '')

//   const payload = body?.data ?? {}
//   const successfulCount = Number(payload?.successfulCount ?? 0)
//   const failedUsers = Array.isArray(payload?.failedUsers)
//     ? payload.failedUsers
//     : Array.isArray(payload?.usersInvalid)
//       ? payload.usersInvalid
//       : []
//   const failedCount = Number(payload?.failedCount ?? failedUsers.length ?? 0)

//   const apiOk = responseCode === 0 && errorCode === 0
//   const allSuccess = apiOk && successfulCount > 0 && failedCount === 0

//   if (allSuccess) {
//     ElNotification({
//       title: 'Success',
//       message: `Sent to ${successfulCount} user${successfulCount > 1 ? 's' : ''} successfully.`,
//       type: 'success',
//       duration: 3000,
//     })
//     args.goPublished()
//     return
//   }

//   const shortFailed =
//     failedUsers.length > 8 ? `${failedUsers.slice(0, 8).join(', ')}...` : failedUsers.join(', ')

//   const msg =
//     failedCount > 0
//       ? `Failed to send to some user(s). Success: ${successfulCount}, Failed: ${failedCount}${
//           shortFailed ? `. Failed users: ${shortFailed}` : ''
//         }`
//       : responseMessage || 'Failed to send notification.'

//   ElNotification({
//     title: 'Error',
//     message: String(msg || 'Failed to send notification.'),
//     type: 'error',
//     duration: 8000,
//   })

//   args.goDraft()
// }

</script>
<style>
html,
body {
  overflow: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
}

html::-webkit-scrollbar,
body::-webkit-scrollbar {
  display: none;
}

.el-date-editor .el-input__suffix,
.el-time-picker .el-input__suffix,
.el-date-editor .el-input__prefix,
.el-time-picker .el-input__prefix {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
}

.el-date-editor .el-input__suffix-inner,
.el-time-picker .el-input__suffix-inner,
.el-date-editor .el-input__prefix-inner,
.el-time-picker .el-input__prefix-inner {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
}

.el-date-editor .el-icon,
.el-time-picker .el-icon,
.el-date-editor svg,
.el-time-picker svg,
.el-date-editor i,
.el-time-picker i {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
}
</style>
<style scoped>
.create-notification-container {
  display: flex;
  height: 100vh;
  align-items: flex-start;
  gap: 80px;
  /* ✅ like v1 spacing between form & preview */
  padding: 0 32px;
  /* ✅ give some breathing space */
  overflow: visible;
}

/* left side form column */
.main-content {
  flex: 1;
  max-width: 720px;
  /* ✅ wider like v1 */
  min-width: 0;
  height: 100vh;
}

/* right side preview column */
.preview-container {
  flex: 0 0 420px;
  /* ✅ fixed preview width like v1 */
  display: flex;
  justify-content: center;
}

.preview-container {
  min-height: calc(100vh - 120px);
  /* adjust if header is bigger/smaller */
}

/* ✅ make left form take available space properly */
.main-content {
  flex: 1;
  min-width: 0;
  max-width: 603px;
  height: 100vh;
}

/* ✅ lock preview width so it always appears */
.preview-panel {
  flex: 0 0 360px;
  /* enough for MobilePreview 322px */
}

.create-notification-container::-webkit-scrollbar {
  display: none;
}


.create-notification-container::-webkit-scrollbar {
  display: none;
}

.main-content {
  flex: 1;
  min-width: 0;
  max-width: 603px;
  padding: 0px;
  flex-direction: column;
  height: 100vh;
}

.form-content {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 17px 0px 0px 0px;
  overflow-y: auto;
  height: calc(100vh - 120px);
  max-height: calc(100vh - 172px);
  scrollbar-width: none;
  -ms-overflow-style: none;
}

.form-content::-webkit-scrollbar {
  display: none;
}

.image-preview {
  position: relative;
  display: inline-block;
}

.image-preview img {
  max-width: 200px;
  max-height: 200px;
  border-radius: 8px;
  object-fit: cover;
}

.remove-image {
  position: absolute;
  top: -8px;
  right: -8px;
  width: 24px;
  height: 24px;
  border-radius: 50%;
  background: #ef4444;
  color: white;
  border: none;
  cursor: pointer;
  font-size: 16px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.form-fields {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  padding: 0px;
  width: 603px;
  flex: none;
  order: 2;
  align-self: stretch;
  flex-grow: 0;
  gap: 20px;
}

.form-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.form-label {
  font-size: 14px;
  font-weight: 600;
  color: #374151;
}

.required {
  color: #ef4444;
}

.form-input,
.form-input-title,
.form-input-number,
.form-input-link,
.form-select,
.form-textarea {
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  background: white;
  transition: border-color 0.2s ease;
  width: 293.5px;
  height: 56px;
}

.form-input:focus,
.form-input-title:focus,
.form-input-number:focus,
.form-input-link:focus,
.form-select:focus,
.form-textarea:focus {
  outline: none;
  border-color: #001346;
  box-shadow: 0 0 0 3px rgba(0, 19, 70, 0.1);
}

.form-textarea {
  resize: vertical;
  min-height: 100px;
  width: 603px;
  height: 161px;
}

.form-input-title {
  width: 603px;
  height: 56px;
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-weight: 400;
  font-size: 14px;
  line-height: 150%;
  color: #001346;
}

.form-input-link {
  width: 603px;
  height: 56px;
}

.custom-dropdown {
  width: 100%;
}

.dropdown-trigger {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 8px;
  font-size: 14px;
  color: #374151;
  background: white;
  transition: border-color 0.2s ease;
  width: 293.5px;
  height: 56px;
  cursor: pointer;
  box-sizing: border-box;
}

.dropdown-trigger:hover {
  border-color: #001346;
}

.dropdown-trigger:focus {
  outline: none;
  border-color: #001346;
  box-shadow: 0 0 0 3px rgba(0, 19, 70, 0.1);
}

.dropdown-icon {
  font-size: 12px;
  color: #6b7280;
  transition: transform 0.2s ease;
}

.custom-dropdown:hover .dropdown-icon {
  transform: rotate(180deg);
}

.full-width-dropdown {
  width: 100%;
}

.full-width-trigger {
  width: 603px !important;
}

.schedule-options {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  width: 603px;
  min-height: 68px;
  background: rgba(0, 19, 70, 0.03);
  border-radius: 8px;
  flex: none;
  order: 3;
  align-self: stretch;
  flex-grow: 0;
}

.schedule-options-header {
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: flex-start;
  gap: 16px;
  width: 100%;
}

.splash-options {
  display: flex;
  flex-direction: column;
  padding: 16px;
  gap: 16px;
  width: 603px;
  min-height: 68px;
  background: rgba(0, 19, 70, 0.03);
  border-radius: 8px;
  flex: none;
  order: 4;
  align-self: stretch;
  flex-grow: 0;
}

.schedule-option-left {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 2px;
  flex: 1;
  min-width: 0;
}

.schedule-option-right {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 12px;
  flex-shrink: 0;
}

.option-label {
  font-size: 14px;
  color: #001346;
  white-space: nowrap;
}

.option-title {
  font-size: 16px;
  font-weight: 600;
  color: #001346;
}

.option-description {
  font-size: 14px;
  font-weight: 400;
  color: #6b7280;
  line-height: 1.4;
  max-width: 100%;
}

.toggle-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.toggle-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.toggle-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #d1d5db;
  transition: 0.3s;
  border-radius: 24px;
}

.toggle-slider:before {
  position: absolute;
  content: '';
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.3s;
  border-radius: 50%;
}

input:checked+.toggle-slider {
  background-color: #0f4aea;
}

input:checked+.toggle-slider:before {
  transform: translateX(20px);
}

.schedule-options-container {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.schedule-datetime-row {
  display: flex;
  flex-direction: row;
  gap: 16px;
  width: 100%;
}

.schedule-form-group {
  display: flex;
  flex-direction: column;
  align-items: flex-start;
  gap: 7px;
  width: 277.5px;
  flex: none;
  order: 0;
  flex-grow: 1;
}

.schedule-form-group:last-child {
  order: 1;
}

.schedule-form-label {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-size: 14px;
  font-weight: 400;
  line-height: 150%;
}

.field-hint {
  font-family: 'IBM Plex Sans';
  font-style: normal;
  font-size: 12px;
  font-weight: 400;
  line-height: 150%;
  color: #10b981;
  margin-top: 4px;
  margin-bottom: 0;
}

.flash-input-group {
  width: 281.5px !important;
  min-width: 281.5px !important;
  max-width: 281.5px !important;
}

.flash-number-input {
  width: 281.5px !important;
  height: 56px !important;
}

.flash-number-input :deep(.el-input__wrapper) {
  width: 281.5px !important;
  height: 56px !important;
  min-width: 281.5px !important;
  max-width: 281.5px !important;
  min-height: 56px !important;
  max-height: 56px !important;
  padding: 16px 52px 16px 12px !important;
  border: 1px solid rgba(0, 19, 70, 0.1) !important;
  border-radius: 8px !important;
  background-color: #f9fafb !important;
  box-shadow: none !important;
  transition: border-color 0.2s ease !important;
}

.flash-number-input :deep(.el-input__wrapper:hover) {
  border-color: rgba(0, 19, 70, 0.2) !important;
}

.flash-number-input :deep(.el-input__wrapper.is-focus) {
  border-color: #001346 !important;
  box-shadow: 0 0 0 3px rgba(0, 19, 70, 0.1) !important;
}

.flash-number-input :deep(.el-input__inner) {
  height: 100% !important;
  line-height: 24px !important;
  font-size: 14px !important;
  font-family: 'IBM Plex Sans' !important;
  color: #6b7280 !important;
  padding: 0 !important;
  text-align: left !important;
}

.flash-number-input :deep(.el-input__inner::placeholder) {
  color: #9ca3af !important;
}

.flash-number-input.is-disabled :deep(.el-input__wrapper) {
  background-color: #f3f4f6 !important;
  border-color: rgba(0, 19, 70, 0.1) !important;
  cursor: not-allowed !important;
}

.flash-number-input.is-disabled :deep(.el-input__inner) {
  color: #9ca3af !important;
  cursor: not-allowed !important;
}

.flash-input-wrapper {
  position: relative;
  width: 281.5px;
  height: 56px;
}

.flash-dropdown-icon {
  position: absolute;
  right: 8px;
  top: 50%;
  transform: translateY(-50%);
  width: 40px;
  height: 40px;
  display: flex;
  align-items: center;
  justify-content: center;
  color: #6b7280;
  pointer-events: none;
  z-index: 10;
  font-size: 16px;
}

.flash-number-input.is-disabled+.flash-dropdown-icon,
.flash-input-wrapper .flash-number-input.is-disabled~.flash-dropdown-icon {
  color: #9ca3af;
}

.flash-number-input :deep(.el-input-number__increase),
.flash-number-input :deep(.el-input-number__decrease) {
  display: none !important;
}

.schedule-date-picker,
.schedule-time-picker {
  width: 277.5px !important;
  height: 45px !important;
  min-width: 277.5px !important;
  max-width: 277.5px !important;
  border-radius: 16px;
}

.schedule-date-picker .el-input,
.schedule-time-picker .el-input {
  width: 277.5px !important;
  height: 45px !important;
  min-width: 277.5px !important;
  max-width: 277.5px !important;
  border-radius: 16px;
}

.schedule-date-picker .el-input__wrapper,
.schedule-time-picker .el-input__wrapper {
  width: 277.5px !important;
  height: 45px !important;
  min-width: 277.5px !important;
  max-width: 277.5px !important;
  min-height: 45px !important;
  max-height: 45px !important;
  padding: 12px 16px;
  border: 1px solid #d1d5db;
  border-radius: 16px;
  font-size: 14px;
  color: #374151;
  background: white;
  transition: border-color 0.2s ease;
  box-shadow: none;
}

.schedule-date-picker .el-input__wrapper:hover,
.schedule-time-picker .el-input__wrapper:hover {
  border-color: #001346;
}

.schedule-date-picker .el-input__wrapper.is-focus,
.schedule-time-picker .el-input__wrapper.is-focus {
  border-color: #001346;
  box-shadow: 0 0 0 3px rgba(0, 19, 70, 0.1);
}

.schedule-date-picker .el-input__inner,
.schedule-time-picker .el-input__inner {
  height: 32px !important;
  line-height: 32px;
  color: #374151;
}

.schedule-date-picker .el-input__suffix,
.schedule-time-picker .el-input__suffix {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  align-items: center;
  justify-content: center;
  width: 40px !important;
  height: 40px !important;
}

.schedule-date-picker .el-input__prefix,
.schedule-time-picker .el-input__prefix {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
}

.schedule-date-picker .el-input__suffix-inner,
.schedule-time-picker .el-input__suffix-inner {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  align-items: center;
  justify-content: center;
  width: 40px !important;
  height: 40px !important;
}

.schedule-date-picker .el-input__prefix-inner,
.schedule-time-picker .el-input__prefix-inner {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
}

.schedule-date-picker .el-input__suffix .el-icon,
.schedule-time-picker .el-input__suffix .el-icon,
.schedule-date-picker .el-input__suffix .el-input__icon,
.schedule-time-picker .el-input__suffix .el-input__icon,
.schedule-date-picker .el-input__suffix [class*='icon'],
.schedule-time-picker .el-input__suffix [class*='icon'],
.schedule-date-picker .el-input__suffix svg,
.schedule-time-picker .el-input__suffix svg,
.schedule-date-picker .el-input__suffix i,
.schedule-time-picker .el-input__suffix i {
  display: inline-block !important;
  visibility: visible !important;
  opacity: 1 !important;
  width: 20px !important;
  height: 20px !important;
  font-size: 16px !important;
  color: #6b7280 !important;
}

.schedule-date-picker .el-icon:not(.el-input__suffix .el-icon),
.schedule-time-picker .el-icon:not(.el-input__suffix .el-icon),
.schedule-date-picker .el-input__icon:not(.el-input__suffix .el-input__icon),
.schedule-time-picker .el-input__icon:not(.el-input__suffix .el-input__icon),
.schedule-date-picker [class*='icon']:not(.el-input__suffix [class*='icon']),
.schedule-time-picker [class*='icon']:not(.el-input__suffix [class*='icon']),
.schedule-date-picker svg:not(.el-input__suffix svg),
.schedule-time-picker svg:not(.el-input__suffix svg),
.schedule-date-picker i:not(.el-input__suffix i),
.schedule-time-picker i:not(.el-input__suffix i) {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  width: 0 !important;
  height: 0 !important;
  font-size: 0 !important;
}

.schedule-date-picker .el-date-editor__trigger,
.schedule-time-picker .el-time-picker__trigger {
  display: none !important;
}

.schedule-date-picker .el-date-editor__trigger-icon,
.schedule-time-picker .el-time-picker__trigger-icon {
  display: none !important;
}

.schedule-date-picker .el-input__wrapper .el-input__suffix,
.schedule-time-picker .el-input__wrapper .el-input__suffix {
  display: flex !important;
  visibility: visible !important;
  opacity: 1 !important;
  align-items: center;
  justify-content: center;
  width: 40px !important;
  height: 40px !important;
}

.schedule-date-picker .el-input__wrapper .el-input__prefix,
.schedule-time-picker .el-input__wrapper .el-input__prefix {
  display: none !important;
  visibility: hidden !important;
  opacity: 0 !important;
  height: 0 !important;
}

.schedule-date-picker.el-date-editor,
.schedule-time-picker.el-time-picker {
  width: 277.5px !important;
  height: 56px !important;
  border-radius: 16px;
}

.schedule-date-picker.el-date-editor .el-input,
.schedule-time-picker.el-time-picker .el-input {
  width: 277.5px !important;
  height: 56px !important;
  border-radius: 16px;
}

.schedule-date-picker.el-date-editor .el-input__wrapper,
.schedule-time-picker.el-time-picker .el-input__wrapper {
  width: 277.5px !important;
  height: 56px !important;
  border-radius: 16px;
}

.action-buttons {
  display: flex;
  flex-direction: row;
  gap: 16px;
  order: 4;
}

.dialog-content {
  gap: 5px !important;
}

@media (max-width: 1024px) {
  .create-notification-container {
    flex-direction: column;
  }
}

.dropdown-trigger.disabled {
  background-color: #f3f4f6;
  border-color: #d1d5db;
  color: rgb(64, 59, 59);
  cursor: not-allowed;
  opacity: 0.6;
  pointer-events: none;
}

.toggle-switch.disabled {
  opacity: 0.6;
  cursor: not-allowed;
}

.toggle-switch.disabled input {
  cursor: not-allowed;
}

.schedule-options-container:has(.toggle-switch.disabled) {
  pointer-events: none;
}

.schedule-date-picker :deep(.el-input__wrapper.is-disabled),
.schedule-time-picker :deep(.el-input__wrapper.is-disabled) {
  background-color: #f3f4f6 !important;
  border-color: #d1d5db !important;
  color: #9ca3af !important;
  cursor: not-allowed !important;
}
</style>
