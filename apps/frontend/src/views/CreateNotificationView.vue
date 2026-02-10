<template>
  <div class="create-notification-container">
    <div class="main-content">
      <Tabs
        v-model="activeLanguage"
        :tabs="languageTabs"
        @tab-changed="handleLanguageChanged"
      />

      <div class="form-content">
        <!-- Reject Reason Display: Only show for rejected templates in draft tab -->
        <div
          v-if="
            (isEditMode || isViewMode) &&
            fromTab === 'draft' &&
            rejectReasonText
          "
          class="reject-reason-container"
        >
          <div class="reject-reason-header">
            <el-icon class="reject-reason-icon"><WarningFilled /></el-icon>
            <div class="reject-reason-label">
              Reject Reason:
              <span class="reject-reason-text">{{ rejectReasonText }}</span>
            </div>
          </div>
        </div>
        <!-- Expired Time Display: Only show for expired templates in draft tab -->
        <div
          v-if="
            (isEditMode || isViewMode) &&
            fromTab === 'draft' &&
            expiredScheduleTime &&
            !originalIsSent
          "
          class="reject-reason-container expired-time-container"
        >
          <div class="reject-reason-header">
            <el-icon class="reject-reason-icon"><WarningFilled /></el-icon>
            <div class="reject-reason-label">
              Expired Time:
              <span class="reject-reason-text">
                The request was not approved in time, and the scheduled time
                <strong>{{ expiredScheduleTime }}</strong
                >, has already passed. Please update the schedule and resubmit.
              </span>
            </div>
          </div>
        </div>
        <div class="form-group">
          <ImageUpload
            :key="`image-upload-${activeLanguage}-${existingImageIds[activeLanguage] || 'new'}`"
            v-model="currentImageFile"
            accept-types="image/png,image/jpeg"
            :max-size="3 * 1024 * 1024"
            format-text="Supported format: PNG, JPG (2:1 W:H or 880:440)"
            size-text="Maximum size: 3MB"
            :existing-image-url="currentImageUrl || undefined"
            :disabled="isReadOnly"
            @file-selected="handleLanguageImageSelected"
            @file-removed="handleLanguageImageRemoved"
            @error="handleUploadError"
          />
        </div>
        <div class="form-fields">
          <div class="form-group">
            <label class="form-label"
              >Bakong Platform <span class="required">*</span></label
            >
            <el-dropdown
              @command="
                (command: BakongApp) => {
                  if (
                    (!isEditMode &&
                      !isViewMode &&
                      !isEditingRestrictedFields) ||
                    (isEditMode &&
                      (fromTab === 'draft' ||
                        fromTab === 'pending' ||
                        fromTab === 'scheduled') &&
                      !isEditingRestrictedFields)
                  ) {
                    formData.platform = command;
                    if (command === BakongApp.BAKONG_TOURIST) {
                      activeLanguage = Language.EN as Language;
                    }
                  }
                }
              "
              trigger="click"
              class="custom-dropdown full-width-dropdown"
              :class="{
                'is-disabled':
                  (isEditMode &&
                    fromTab !== 'draft' &&
                    fromTab !== 'pending' &&
                    fromTab !== 'scheduled') ||
                  isViewMode ||
                  isEditingRestrictedFields,
              }"
              :disabled="
                (isEditMode &&
                  fromTab !== 'draft' &&
                  fromTab !== 'pending' &&
                  fromTab !== 'scheduled') ||
                isViewMode ||
                isEditingRestrictedFields
              "
            >
              <span
                class="dropdown-trigger full-width-trigger"
                @click.stop="
                  (e) => {
                    if (isReadOnly || isEditingRestrictedFields) {
                      e.preventDefault();
                      e.stopPropagation();
                    }
                  }
                "
              >
                {{ formatBakongApp(formData.platform) }}
                <el-icon class="dropdown-icon">
                  <ArrowDown />
                </el-icon>
              </span>
              <template #dropdown>
                <el-dropdown-menu>
                  <el-dropdown-item
                    v-for="app in Object.values(BakongApp)"
                    :key="app"
                    :command="app"
                  >
                    {{ formatBakongApp(app) }}
                  </el-dropdown-item>
                </el-dropdown-menu>
              </template>
            </el-dropdown>
          </div>
          <div class="form-group">
            <label class="form-label"
              >Title <span class="required">*</span></label
            >
            <input
              v-model="currentTitle"
              type="text"
              class="form-input-title"
              :class="{ 'lang-khmer': titleHasKhmer }"
              :data-content-lang="titleHasKhmer ? 'km' : ''"
              placeholder="Attractive title"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              @blur="validateTitle()"
            />
            <span
              v-if="titleError"
              style="
                color: #ef4444;
                font-size: 12px;
                margin-top: 2px;
                display: block;
              "
              >{{ titleError }}</span
            >
          </div>
          <div class="form-group">
            <label class="form-label"
              >Description (Support HTML) <span class="required">*</span></label
            >
            <textarea
              v-model="currentDescription"
              class="form-textarea"
              :class="{ 'lang-khmer': descriptionHasKhmer }"
              :data-content-lang="descriptionHasKhmer ? 'km' : ''"
              placeholder="Description of the title <bold>input</bold>"
              rows="4"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              @blur="validateDescription()"
            ></textarea>
            <span
              v-if="descriptionError"
              style="
                color: #ef4444;
                font-size: 12px;
                margin-top: 2px;
                display: block;
              "
              >{{ descriptionError }}</span
            >
          </div>
          <div class="form-row">
            <div class="form-group">
              <label class="form-label"
                >Type <span class="required">*</span></label
              >
              <el-dropdown
                @command="
                  (command: number) => {
                    if (
                      !isReadOnly &&
                      !isEditingRestrictedFields &&
                      !loadingCategoryTypes
                    ) {
                      formData.categoryTypeId = command;
                    }
                  }
                "
                trigger="click"
                class="custom-dropdown"
                :class="{
                  'is-disabled':
                    loadingCategoryTypes ||
                    isReadOnly ||
                    isEditingRestrictedFields,
                }"
                :disabled="
                  loadingCategoryTypes ||
                  isReadOnly ||
                  isEditingRestrictedFields
                "
              >
                <span
                  class="dropdown-trigger"
                  @click.stop="
                    (e) => {
                      if (
                        loadingCategoryTypes ||
                        isReadOnly ||
                        isEditingRestrictedFields
                      ) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }
                  "
                >
                  {{
                    formatCategoryType(
                      categoryTypes.find(
                        (ct: CategoryTypeData) =>
                          ct.id === formData.categoryTypeId
                      )?.name || 'Select Category'
                    )
                  }}
                  <el-icon class="dropdown-icon">
                    <ArrowDown />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="category in categoryTypes"
                      :key="category.id"
                      :command="category.id"
                    >
                      {{ formatCategoryType(category.name) }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
            <div class="form-group">
              <label class="form-label"
                >Push to OS Platforms <span class="required">*</span></label
              >
              <el-dropdown
                @command="
                  (command: Platform) => {
                    if (!isReadOnly && !isEditingRestrictedFields) {
                      formData.pushToPlatforms = command;
                    }
                  }
                "
                trigger="click"
                :disabled="isReadOnly || isEditingRestrictedFields"
                class="custom-dropdown"
                :class="{
                  'is-disabled': isReadOnly || isEditingRestrictedFields,
                }"
              >
                <span
                  class="dropdown-trigger"
                  @click.stop="
                    (e) => {
                      if (isReadOnly || isEditingRestrictedFields) {
                        e.preventDefault();
                        e.stopPropagation();
                      }
                    }
                  "
                >
                  {{ formatPlatform(formData.pushToPlatforms) }}
                  <el-icon class="dropdown-icon">
                    <ArrowDown />
                  </el-icon>
                </span>
                <template #dropdown>
                  <el-dropdown-menu>
                    <el-dropdown-item
                      v-for="platform in Object.values(Platform)"
                      :key="platform"
                      :command="platform"
                    >
                      {{ formatPlatform(platform) }}
                    </el-dropdown-item>
                  </el-dropdown-menu>
                </template>
              </el-dropdown>
            </div>
          </div>
          <div class="form-group">
            <label class="form-label">Link to see more (optional)</label>
            <input
              v-model="currentLinkToSeeMore"
              type="url"
              class="form-input-link"
              placeholder="https://google.com"
              inputmode="url"
              pattern="https?://.+"
              :disabled="isReadOnly"
              :readonly="isReadOnly"
              @blur="validateLink()"
            />
            <span
              v-if="linkError"
              style="
                color: #ef4444;
                font-size: 12px;
                margin-top: 2px;
                display: block;
              "
              >{{ linkError }}</span
            >
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
                  <label class="toggle-switch">
                    <input
                      v-model="formData.scheduleEnabled"
                      type="checkbox"
                      :disabled="isReadOnly || isEditingRestrictedFields"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div
                v-if="formData.scheduleEnabled"
                class="schedule-datetime-row"
              >
                <div class="schedule-form-group">
                  <label class="schedule-form-label"
                    >Date <span class="required">*</span></label
                  >
                  <el-date-picker
                    :key="`date-picker-${notificationId || 'new'}-${formData.scheduleDate || 'empty'}`"
                    v-model="formData.scheduleDate"
                    type="date"
                    :placeholder="datePlaceholder"
                    format="M/D/YYYY"
                    value-format="M/D/YYYY"
                    class="schedule-date-picker"
                    style="
                      width: 277.5px !important;
                      height: 56px !important;
                      border-radius: 16px;
                    "
                    :prefix-icon="null"
                    :clear-icon="null"
                    :disabled-date="customDisabledDate"
                    :disabled="isReadOnly || isEditingRestrictedFields"
                    :default-value="scheduleDateDefaultValue"
                    @change="
                      (val: string | null) => {
                        handleDatePickerChange(val);
                      }
                    "
                  />
                </div>
                <div class="schedule-form-group">
                  <label class="schedule-form-label"
                    >Time <span class="required">*</span></label
                  >
                  <el-time-picker
                    :key="`time-picker-${notificationId || 'new'}-${isLoadingData ? 'loading' : 'ready'}`"
                    v-model="scheduleTimeModel"
                    :placeholder="timePlaceholder"
                    format="HH:mm"
                    value-format="HH:mm"
                    class="schedule-time-picker"
                    style="
                      width: 277.5px !important;
                      height: 56px !important;
                      border-radius: 16px;
                    "
                    :prefix-icon="null"
                    :clear-icon="null"
                    :disabled-hours="() => disabledHours(formData.scheduleDate)"
                    :disabled-minutes="
                      (hour: number) =>
                        disabledMinutes(hour, formData.scheduleDate)
                    "
                    :disabled="
                      isReadOnly ||
                      isEditingRestrictedFields ||
                      isLoadingData ||
                      (isTemplateExpired && isReadOnly)
                    "
                    @change="
                      (val: string | null) => {
                        const hasLoaded = hasLoadedScheduleTime;
                        const isLoading = isLoadingData;
                        const loadedTime = loadedScheduleTime;

                        if (isLoading && hasLoaded && loadedTime) {
                          if (val !== loadedTime) {
                            formData.scheduleTime = loadedTime;
                            return;
                          }
                        }

                        if (val !== formData.scheduleTime) {
                          formData.scheduleTime = val;
                        }
                      }
                    "
                  />
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
                    <input
                      v-model="formData.splashEnabled"
                      type="checkbox"
                      :disabled="isReadOnly"
                    />
                    <span class="toggle-slider"></span>
                  </label>
                </div>
              </div>
              <div v-if="formData.splashEnabled" class="schedule-datetime-row">
                <div class="schedule-form-group flash-input-group">
                  <label class="schedule-form-label"
                    >Number showing per day:
                    <span class="required">*</span></label
                  >
                  <div class="flash-input-wrapper">
                    <ElInputNumber
                      v-model="formData.showPerDay"
                      :min="1"
                      :max="10"
                      :disabled="isReadOnly"
                      controls-position="right"
                      class="flash-number-input"
                    />
                    <el-icon class="flash-dropdown-icon">
                      <ArrowDown />
                    </el-icon>
                  </div>
                </div>
                <div class="schedule-form-group flash-input-group">
                  <label class="schedule-form-label"
                    >Maximum day showing: <span class="required">*</span></label
                  >
                  <div class="flash-input-wrapper">
                    <ElInputNumber
                      v-model="formData.maxDayShowing"
                      :min="1"
                      :max="30"
                      :disabled="isReadOnly"
                      controls-position="right"
                      class="flash-number-input"
                    />
                    <el-icon class="flash-dropdown-icon">
                      <ArrowDown />
                    </el-icon>
                  </div>
                </div>
              </div>
            </div>
          </div>
          <div class="action-buttons">
            <template v-if="!isReadOnly">
              <Button
                :text="publishButtonText"
                variant="primary"
                size="medium"
                height="56px"
                @click="handlePublishNow"
              />
              <Button
                v-if="
                  isEditMode &&
                  (isEditingPublished ||
                    isEditingPending ||
                    isEditingScheduled) &&
                  fromTab !== 'draft'
                "
                text="Cancel now"
                variant="secondary"
                size="medium"
                height="56px"
                @click="handleCancel"
              />
              <Button
                v-if="isEditMode && fromTab === 'draft'"
                text="Update now"
                variant="secondary"
                size="medium"
                height="56px"
                @click="() => handleSaveDraft(false)"
              />
              <Button
                v-if="!isEditMode"
                text="Save draft"
                variant="secondary"
                size="medium"
                height="56px"
                @click="handleFinishLater"
              />
            </template>
            <Button
              v-if="isReadOnly && !isApprovalViewMode"
              text="Cancel now"
              variant="secondary"
              size="medium"
              height="56px"
              @click="handleBack"
            />

            <template v-if="isReadOnly && isApprovalViewMode">
              <Button
                :text="approvalButtonText"
                variant="primary"
                size="medium"
                height="56px"
                @click="handleApprovalFromView"
              />
              <Button
                text="Reject Now"
                variant="danger"
                size="medium"
                height="56px"
                @click="handleRejectFromView"
              />
              <Button
                text="Cancel now"
                variant="secondary"
                size="medium"
                height="56px"
                @click="handleBack"
              />
            </template>
          </div>
        </div>
      </div>
    </div>
    <div class="sticky top-24">
      <MobilePreview
        :title="currentTitle"
        :description="currentDescription"
        :image="
          (typeof languageFormData[activeLanguage]?.imageUrl === 'string' &&
            languageFormData[activeLanguage]?.imageUrl) ||
          undefined
        "
        :categoryTypeObject="categoryTypes.find((ct: CategoryTypeData) => ct.id === formData.categoryTypeId) || null"
        :activeLanguage="activeLanguage"
        :title-has-khmer="titleHasKhmer"
        :description-has-khmer="descriptionHasKhmer"
        :link-to-see-more="currentLinkToSeeMore"
      />
    </div>
  </div>
  <ConfirmationDialog
    v-model="showConfirmationDialog"
    title="Save as Draft?"
    message="Do you want to save this notification as a draft or discard your changes?"
    confirm-text="Save Draft"
    cancel-text="Discard"
    type="warning"
    confirm-button-type="primary"
    @confirm="handleConfirmationDialogConfirm"
    @cancel="handleConfirmationDialogCancel"
  />
  <ConfirmationDialog
    v-model="showLeaveDialog"
    title="Are you sure you want to leave?"
    :message="getLeaveDialogMessage()"
    :confirm-text="getLeaveDialogConfirmText()"
    cancel-text="Stay on page"
    type="warning"
    confirm-button-type="primary"
    @confirm="handleLeaveDialogConfirm"
    @cancel="handleLeaveDialogCancel"
  />
  <ConfirmationDialog
    v-model="showRejectDialog"
    title="Reject Notification?"
    message="Please provide a reason for rejecting this notification. It will be moved back to Draft tab."
    confirm-text="Reject"
    cancel-text="Cancel now"
    type="warning"
    confirm-button-type="danger"
    :show-reason-input="true"
    @confirm="(reason?: string) => handleRejectFromViewConfirm(reason)"
    @cancel="handleRejectFromViewCancel"
  />
  <ConfirmationDialog
    v-model="showUpdateConfirmationDialog"
    title="You want to update?"
    message="Updating will immediately change the announcement for all users."
    confirm-text="Continue"
    cancel-text="Cancel now"
    type="warning"
    confirm-button-type="primary"
    @confirm="handleUpdateConfirmationConfirm"
    @cancel="handleUpdateConfirmationCancel"
  />
</template>

<script setup lang="ts">
  import { ref, reactive, computed, onMounted, nextTick, watch } from 'vue';
  import { useRouter, useRoute, onBeforeRouteLeave } from 'vue-router';
  import { ElNotification, ElInputNumber, ElMessageBox } from 'element-plus';
  import { ArrowDown, WarningFilled } from '@element-plus/icons-vue';
  import {
    MobilePreview,
    ImageUpload,
    Tabs,
    Button,
  } from '@/components/common';
  import ConfirmationDialog from '@/components/common/ConfirmationDialog.vue';
  import {
    notificationApi,
    type CreateTemplateRequest,
  } from '@/services/notificationApi';
  import { api } from '@/services/api';
  import {
    NotificationType,
    Platform,
    Language,
    SendType,
    BakongApp,
    formatNotificationType,
    formatPlatform,
    formatCategoryType,
    getNoUsersAvailableMessage,
    getNotificationMessage,
    containsKhmer,
    formatNoUsersFoundMessage,
    formatNoUsersFoundRejectionMessage,
  } from '@/utils/helpers';
  import { useCategoryTypesStore } from '@/stores/categoryTypes';
  import type { CategoryType as CategoryTypeData } from '@/services/categoryTypeApi';
  import { DateUtils, UserRole, ErrorCode } from '@bakong/shared';
  import { useAuthStore } from '@/stores/auth';
  import {
    getCurrentDateTimeInCambodia,
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
  } from '../utils/helpers';

  const router = useRouter();
  const route = useRoute();
  const authStore = useAuthStore();

  const isEditMode = computed(() => route.name === 'edit-notification');
  const isViewMode = computed(() => route.name === 'view-notification');
  const notificationId = computed(() => route.params.id as string);
  const fromTab = computed(() => (route.query.fromTab as string) || '');
  const isEditingPublished = ref(false);
  const wasScheduled = ref(false);
  const isLoadingData = ref(false);
  const isEditingPending = ref(false);
  const isEditingScheduled = ref(false);
  const isTemplateExpired = ref(false);
  const hasLoadedScheduleTime = ref(false);
  const loadedScheduleTime = ref<string | null>(null);
  const originalIsSent = ref<boolean | null>(null);

  const isApprovalRole = computed(
    () => authStore.user?.role === (UserRole.APPROVAL as any)
  );
  const isReadOnly = computed(() => isViewMode.value || isApprovalRole.value);

  const isEditingRestrictedFields = computed(() => {
    return isEditMode.value && isEditingPublished.value;
  });

  const isRejectedTemplate = computed(() => {
    if (!isEditMode.value && !isViewMode.value) {
      return false;
    }
    const hasReason =
      rejectReasonText.value !== '' &&
      rejectReasonText.value !== null &&
      rejectReasonText.value !== undefined;

    return hasReason;
  });

  const isApprovalViewMode = computed(() => {
    return isReadOnly.value && isApprovalRole.value && isEditingPending.value;
  });

  const customDisabledDate = (time: Date): boolean => {
    const now = DateUtils.nowInCambodia();

    const todayStr = DateUtils.getCurrentDateString(); // e.g., "1/25/2026"
    const [todayMonth, todayDay, todayYear] = todayStr.split('/').map(Number);

    const timeInCambodia = time.toLocaleDateString('en-US', {
      timeZone: 'Asia/Phnom_Penh',
      year: 'numeric',
      month: 'numeric',
      day: 'numeric',
    });
    const [selectedMonth, selectedDay, selectedYear] = timeInCambodia
      .split('/')
      .map(Number);

    if (selectedYear < todayYear) return true;
    if (selectedYear > todayYear) return false;
    if (selectedMonth < todayMonth) return true;
    if (selectedMonth > todayMonth) return false;
    if (selectedDay < todayDay) return true;

    return false;
  };

  const approvalButtonText = computed(() => {
    if (!isApprovalViewMode.value) return 'Approve';
    return formData.scheduleEnabled ? 'Approval Scheduled' : 'Approval Now';
  });

  const publishButtonText = computed(() => {
    if (isEditingScheduled.value) {
      return 'Update now';
    }
    if (isEditingPending.value) {
      return 'Update now';
    }
    if (isEditingPublished.value) {
      return 'Update now';
    }
    if (formData.scheduleEnabled) {
      return 'Submit Now';
    }
    const userRole = authStore.user?.role as any;
    if (userRole === UserRole.EDITOR || userRole === UserRole.ADMINISTRATOR) {
      return 'Submit now';
    }
    return 'Publish now';
  });

  const languages = [
    { code: Language.KM, name: 'Khmer' },
    { code: Language.EN, name: 'English' },
    { code: Language.JP, name: 'Japan' },
  ];

  let activeLanguage = ref<Language>(Language.KM);

  const handleLanguageChanged = (tab: { value: string; label: string }) => {
    activeLanguage.value = tab.value as Language;
    titleError.value = '';
    descriptionError.value = '';
    linkError.value = '';
  };

  const datePlaceholder = ref(getCurrentDatePlaceholder());
  const timePlaceholder = ref(getCurrentTimePlaceholder());

  const scheduleDateDefaultValue = computed(() => {
    if (!isEditMode.value && !isViewMode.value) {
      const todayDate = getTodayDateString();
      const [month, day, year] = todayDate.split('/').map(Number);
      const today = new Date(year, month - 1, day);
      return today;
    }
    return undefined;
  });

  type LanguageFormData = {
    title: string;
    description: string;
    linkToSeeMore: string;
    imageFile?: File | null;
    imageUrl?: string | null;
  };

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
  });
  const existingImageIds = reactive<Record<string, string | null>>({
    [Language.KM]: null,
    [Language.EN]: null,
    [Language.JP]: null,
  });

  const existingTranslationIds = reactive<Record<string, number | null>>({
    [Language.KM]: null,
    [Language.EN]: null,
    [Language.JP]: null,
  });

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
  });

  const originalImageIds = reactive<Record<string, string | null>>({
    [Language.KM]: null,
    [Language.EN]: null,
    [Language.JP]: null,
  });

  const originalFormData = reactive({
    categoryTypeId: null as number | null,
    pushToPlatforms: Platform.ALL,
    platform: BakongApp.BAKONG,
  });

  const getTodayDateString = (): string => {
    return DateUtils.getCurrentDateString();
  };

  const categoryTypesStore = useCategoryTypesStore();
  const categoryTypes = computed(() => categoryTypesStore.categoryTypes);
  const loadingCategoryTypes = computed(() => categoryTypesStore.loading);

  const formData = reactive({
    notificationType: NotificationType.ANNOUNCEMENT,
    categoryTypeId: null as number | null,
    pushToPlatforms: Platform.ALL,
    showPerDay: 1,
    maxDayShowing: 1,
    platform: BakongApp.BAKONG,
    scheduleEnabled: false,
    scheduleDate: getTodayDateString(),
    scheduleTime: getCurrentTimePlaceholder() as string | null,
    splashEnabled: false,
  });

  const languageTabs = computed(() => {
    try {
      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        return languages
          .filter((l) => l.code === Language.EN)
          .map((lang) => ({ value: lang.code, label: lang.name }));
      }
    } catch (e) {}
    return languages.map((lang) => ({ value: lang.code, label: lang.name }));
  });

  watch(
    () => formData.platform,
    (newPlatform, oldPlatform) => {
      if (newPlatform === BakongApp.BAKONG_TOURIST) {
        activeLanguage.value = Language.EN;
        Object.keys(languageFormData).forEach((lang) => {
          if (lang !== Language.EN) {
            delete languageFormData[lang];
          }
        });
      } else {
        const allLangs = [Language.KM, Language.EN, Language.JP];
        allLangs.forEach((lang) => {
          if (!languageFormData[lang]) {
            languageFormData[lang] = {
              title: '',
              description: '',
              linkToSeeMore: '',
              imageFile: null,
              imageUrl: '',
            };
          }
        });
      }
    }
  );

  const initializeCategoryTypes = async () => {
    try {
      await categoryTypesStore.initialize();
      if (categoryTypes.value.length > 0) {
        const newsCategory = categoryTypes.value.find(
          (ct: CategoryTypeData) => ct.name === 'News' || ct.name === 'NEWS'
        );
        const defaultCategoryId = newsCategory?.id || categoryTypes.value[0].id;
        formData.categoryTypeId = defaultCategoryId;

        if (!isEditMode.value) {
          originalFormData.categoryTypeId = defaultCategoryId;
        }
      }
    } catch (error) {
      // [console.error removed]
    }
  };

  onMounted(() => {
    initializeCategoryTypes();
  });

  const currentTitle = computed({
    get: () => languageFormData[activeLanguage.value]?.title || '',
    set: (value: string) => {
      if (languageFormData[activeLanguage.value]) {
        languageFormData[activeLanguage.value].title = value;
      }
      validateTitle();
    },
  });

  const currentDescription = computed({
    get: () => languageFormData[activeLanguage.value]?.description || '',
    set: (value: string) => {
      if (languageFormData[activeLanguage.value]) {
        languageFormData[activeLanguage.value].description = value;
      }
      validateDescription();
    },
  });

  const currentLinkToSeeMore = computed({
    get: () => languageFormData[activeLanguage.value]?.linkToSeeMore || '',
    set: (value: string) => {
      if (languageFormData[activeLanguage.value]) {
        languageFormData[activeLanguage.value].linkToSeeMore = value;
      }
    },
  });

  const currentImageFile = computed({
    get: () => languageFormData[activeLanguage.value]?.imageFile || null,
    set: (value: File | null) => {
      if (languageFormData[activeLanguage.value]) {
        languageFormData[activeLanguage.value].imageFile = value;
      }
    },
  });

  const currentImageUrl = computed({
    get: () => languageFormData[activeLanguage.value]?.imageUrl || null,
    set: (value: string | null) => {
      if (languageFormData[activeLanguage.value]) {
        languageFormData[activeLanguage.value].imageUrl = value;
      }
    },
  });

  const titleHasKhmer = computed(() => containsKhmer(currentTitle.value));
  const descriptionHasKhmer = computed(() =>
    containsKhmer(currentDescription.value)
  );

  const scheduleTimeModel = computed({
    get: () => {
      if (
        isTemplateExpired.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        isReadOnly.value
      ) {
        if (formData.scheduleTime !== loadedScheduleTime.value) {
          nextTick(() => {
            formData.scheduleTime = loadedScheduleTime.value;
          });
          return loadedScheduleTime.value;
        }
        return loadedScheduleTime.value;
      }
      if (
        isLoadingData.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value
      ) {
        return loadedScheduleTime.value;
      }
      if (
        !isLoadingData.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value
      ) {
        if (formData.scheduleTime !== loadedScheduleTime.value) {
          if (isTemplateExpired.value && isReadOnly.value) {
            nextTick(() => {
              formData.scheduleTime = loadedScheduleTime.value;
            });
            return loadedScheduleTime.value;
          }
          if (formData.scheduleTime === timePlaceholder.value) {
            nextTick(() => {
              formData.scheduleTime = loadedScheduleTime.value;
            });
            return loadedScheduleTime.value;
          }
        }
      }
      return formData.scheduleTime;
    },
    set: (value: string | null) => {
      if (
        isTemplateExpired.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        isReadOnly.value
      ) {
        if (value !== loadedScheduleTime.value) {
          return;
        }
      }
      if (
        isLoadingData.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value
      ) {
        if (value !== loadedScheduleTime.value) {
          return;
        }
      }
      if (
        !isLoadingData.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value
      ) {
        if (value !== loadedScheduleTime.value) {
          if (isTemplateExpired.value && isReadOnly.value) {
            return;
          }

          hasLoadedScheduleTime.value = false;
          loadedScheduleTime.value = null;
        }
      }
      formData.scheduleTime = value;
    },
  });

  const templateCreatedAt = ref<Date | null>(null);
  const rejectReasonText = ref<string>('');
  const expiredScheduleTime = ref<string | null>(null);
  const originalSendSchedule = ref<string | null>(null);

  const loadNotificationData = async () => {
    if ((!isEditMode.value && !isViewMode.value) || !notificationId.value)
      return;

    isLoadingData.value = true;
    hasLoadedScheduleTime.value = false; // Reset flag before loading
    loadedScheduleTime.value = null; // Reset loaded time before loading
    isTemplateExpired.value = false; // Reset expired flag before loading
    originalIsSent.value = null; // Reset original isSent before loading
    try {
      const res = await api.get(`/api/v1/template/${notificationId.value}`);
      const template = res.data?.data;

      if (!template) {
        isLoadingData.value = false;
        return;
      }

      if (template.createdAt) {
        templateCreatedAt.value = new Date(template.createdAt);
      } else {
        templateCreatedAt.value = null;
      }

      originalSendSchedule.value = template.sendSchedule || null;

      isEditingPublished.value =
        fromTab.value === 'published' && template.isSent === true;

      isEditingScheduled.value =
        fromTab.value === 'scheduled' &&
        template.approvalStatus === 'APPROVED' &&
        template.sendSchedule !== null;

      isEditingPending.value = template.approvalStatus === 'PENDING';

      isTemplateExpired.value =
        (template.approvalStatus === 'EXPIRED' ||
          template.approvalStatus === 'REJECTED') &&
        template.isSent !== true;

      if (template.approvalStatus === 'REJECTED') {
        rejectReasonText.value = template.reasonForRejection || '';
        expiredScheduleTime.value = null; // Clear expired time for rejected templates
      } else if (template.approvalStatus === 'EXPIRED') {
        rejectReasonText.value = ''; // Clear reject reason for expired templates
        if (template.sendSchedule) {
          try {
            const { date, time } = DateUtils.formatUTCToCambodiaDateTime(
              template.sendSchedule
            );
            if (date && time) {
              expiredScheduleTime.value = `${date} at ${time}`;
            } else {
              expiredScheduleTime.value = null;
            }
          } catch (error) {
            console.error(
              '❌ [Load Data] Error formatting expired schedule time:',
              error
            );
            expiredScheduleTime.value = null;
          }
        } else {
          expiredScheduleTime.value = null;
        }
      } else {
        rejectReasonText.value = '';
        expiredScheduleTime.value = null;
      }

      originalIsSent.value = template.isSent ?? null;

      if (isTemplateExpired.value && template.sendSchedule) {
        if (isReadOnly.value) {
        } else {
        }
      }

      formData.notificationType =
        mapNotificationTypeToFormType(template.notificationType) ||
        NotificationType.NOTIFICATION;
      formData.categoryTypeId = template.categoryTypeId || null;
      formData.platform =
        (template.bakongPlatform as BakongApp) || BakongApp.BAKONG;

      originalFormData.categoryTypeId = template.categoryTypeId || null;
      originalFormData.platform =
        (template.bakongPlatform as BakongApp) || BakongApp.BAKONG;

      if (
        template.platforms &&
        Array.isArray(template.platforms) &&
        template.platforms.length > 0
      ) {
        const formPlatform = mapPlatformToFormPlatform(template.platforms);
        formData.pushToPlatforms = formPlatform;
        originalFormData.pushToPlatforms = formPlatform;
      } else {
        formData.pushToPlatforms = Platform.ALL;
        originalFormData.pushToPlatforms = Platform.ALL;
      }

      if (template.sendSchedule) {
        wasScheduled.value = true;
        try {
          const { date, time } = DateUtils.formatUTCToCambodiaDateTime(
            template.sendSchedule
          );
          if (date && time) {
            console.log('🔵 [Load Data] BEFORE setting schedule:', {
              originalUTC: template.sendSchedule,
              parsedDate: date,
              parsedTime: time,
              currentFormDataScheduleTime: formData.scheduleTime,
              hasLoadedScheduleTime: hasLoadedScheduleTime.value,
              isLoadingData: isLoadingData.value,
            });

            loadedScheduleTime.value = time;
            hasLoadedScheduleTime.value = true;

            formData.scheduleDate = date;
            formData.scheduleTime = time;

            console.log('✅ [Load Data] AFTER setting schedule time:', {
              originalUTC: template.sendSchedule,
              parsedDate: date,
              parsedTime: time,
              formDataScheduleDate: formData.scheduleDate,
              formDataScheduleTime: formData.scheduleTime,
              loadedScheduleTime: loadedScheduleTime.value,
              hasLoadedScheduleTime: hasLoadedScheduleTime.value,
              isLoadingData: isLoadingData.value,
            });

            await nextTick();

            if (formData.scheduleTime !== loadedScheduleTime.value) {
              console.warn(
                '⚠️ [Load Data] Time changed before enabling toggle, restoring:',
                {
                  current: formData.scheduleTime,
                  expected: loadedScheduleTime.value,
                }
              );
              formData.scheduleTime = loadedScheduleTime.value;
            }

            formData.scheduleEnabled = true;

            console.log('✅ [Load Data] AFTER enabling toggle:', {
              formDataScheduleTime: formData.scheduleTime,
              expectedTime: time,
              loadedScheduleTime: loadedScheduleTime.value,
              timeMatches: formData.scheduleTime === time,
              hasLoadedScheduleTime: hasLoadedScheduleTime.value,
              scheduleEnabled: formData.scheduleEnabled,
            });

            await nextTick();

            if (
              formData.scheduleTime !== loadedScheduleTime.value &&
              loadedScheduleTime.value
            ) {
              console.warn(
                '⚠️ [Load Data] Time changed after enabling toggle, restoring:',
                {
                  current: formData.scheduleTime,
                  expected: loadedScheduleTime.value,
                }
              );
              formData.scheduleTime = loadedScheduleTime.value;
            }

            console.log('🔍 [Load Data] Final check after toggle enabled:', {
              formDataScheduleTime: formData.scheduleTime,
              expectedTime: time,
              loadedScheduleTime: loadedScheduleTime.value,
              timeMatches: formData.scheduleTime === time,
              hasLoadedScheduleTime: hasLoadedScheduleTime.value,
            });
          }
        } catch (error) {
          console.error(
            '❌ [Load Data] Error parsing schedule date/time:',
            error
          );
          hasLoadedScheduleTime.value = false;
          loadedScheduleTime.value = null;
        }
      } else {
        hasLoadedScheduleTime.value = false;
        loadedScheduleTime.value = null;
        formData.scheduleEnabled = false;
        wasScheduled.value = false;
        formData.scheduleDate = getTodayDateString();
        formData.scheduleTime = null;
      }

      formData.splashEnabled =
        template.notificationType === NotificationType.FLASH_NOTIFICATION;
      if (Array.isArray(template.translations)) {
        // Clear all language fields first
        Object.keys(languageFormData).forEach((lang) => {
          languageFormData[lang].title = '';
          languageFormData[lang].description = '';
          languageFormData[lang].linkToSeeMore = '';
          languageFormData[lang].imageUrl = null;
          languageFormData[lang].imageFile = null;
          originalLanguageFormData[lang].title = '';
          originalLanguageFormData[lang].description = '';
          originalLanguageFormData[lang].linkToSeeMore = '';
          originalLanguageFormData[lang].imageUrl = null;
          originalLanguageFormData[lang].imageFile = null;
          existingImageIds[lang] = null;
          originalImageIds[lang] = null;
          existingTranslationIds[lang] = null;
        });
        // Populate with backend data
        for (const t of template.translations) {
          const lang = t.language as string as Language;
          if (!languageFormData[lang]) continue;
          const title = t.title || '';
          const description = t.content || '';
          const linkPreview = t.linkPreview || '';
          const fileId =
            t.image?.fileId || t.image?.fileID || t.imageId || t.image?.id;

          existingImageIds[lang] = fileId || null;
          originalImageIds[lang] = fileId || null;

          languageFormData[lang].title = title;
          languageFormData[lang].description = description;
          languageFormData[lang].linkToSeeMore = linkPreview;
          languageFormData[lang].imageUrl = fileId
            ? `/api/v1/image/${fileId}`
            : null;
          languageFormData[lang].imageFile = null;

          originalLanguageFormData[lang].title = title;
          originalLanguageFormData[lang].description = description;
          originalLanguageFormData[lang].linkToSeeMore = linkPreview;
          originalLanguageFormData[lang].imageUrl = fileId
            ? `/api/v1/image/${fileId}`
            : null;
          originalLanguageFormData[lang].imageFile = null;

          existingTranslationIds[lang] = t.id || null;

        }
      }

      // Auto-switch to first available language with data
      let firstLangWithData: Language | null = null;
      for (const lang of [Language.KM, Language.EN, Language.JP]) {
        const data = languageFormData[lang];
        if (
          data &&
          (data.title?.trim() ||
            data.description?.trim() ||
            existingImageIds[lang])
        ) {
          firstLangWithData = lang as Language;
          break;
        }
      }

      if (firstLangWithData && firstLangWithData !== activeLanguage.value) {
        const activeData = languageFormData[activeLanguage.value];
        const activeIsEmpty =
          !activeData ||
          (!activeData.title?.trim() &&
            !activeData.description?.trim() &&
            !existingImageIds[activeLanguage.value]);

        if (activeIsEmpty) {
          console.log(
            '🔄 [Load Data] Auto-switching tab to',
            firstLangWithData,
            'because current tab',
            activeLanguage.value,
            'is empty'
          );
          activeLanguage.value = firstLangWithData;
        }
      }

      await nextTick();

      if (
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        formData.scheduleTime !== loadedScheduleTime.value
      ) {
        console.log(
          '🔒 [Load Data] Final restoration - Time incorrect before finishing load:',
          {
            current: formData.scheduleTime,
            expected: loadedScheduleTime.value,
          }
        );
        formData.scheduleTime = loadedScheduleTime.value;
        await nextTick();
      }
    } catch (error) {
      console.error('Error loading notification data:', error);
      ElNotification({
        title: 'Error',
        message: 'Failed to load notification data',
        type: 'error',
        duration: 2000,
      });
    } finally {
      if (
        isTemplateExpired.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        isReadOnly.value
      ) {
        if (formData.scheduleTime !== loadedScheduleTime.value) {
          console.log(
            '🔒 [Load Data] Final preservation for expired template (view mode):',
            {
              current: formData.scheduleTime,
              original: loadedScheduleTime.value,
            }
          );
          formData.scheduleTime = loadedScheduleTime.value;
          await nextTick();
        }
        console.log(
          '🔒 [Load Data] Expired template (view mode) - keeping hasLoadedScheduleTime=true to preserve original time'
        );
      } else if (
        isTemplateExpired.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        !isReadOnly.value
      ) {
        console.log(
          '✅ [Load Data] Expired template (edit mode) - will allow time editing after load completes'
        );
        nextTick(() => {
          setTimeout(() => {
            console.log(
              '✅ [Load Data] Expired template (edit mode) - clearing preservation flag to allow editing'
            );
            hasLoadedScheduleTime.value = false;
            loadedScheduleTime.value = null;
          }, 200); // Small delay to ensure time picker has initialized with correct value
        });
      }

      isLoadingData.value = false;
      console.log(
        '✅ [Load Data] Loading complete, isLoadingData set to false',
        {
          isTemplateExpired: isTemplateExpired.value,
          hasLoadedScheduleTime: hasLoadedScheduleTime.value,
          loadedScheduleTime: loadedScheduleTime.value,
          formDataScheduleTime: formData.scheduleTime,
          isReadOnly: isReadOnly.value,
          isEditMode: isEditMode.value,
        }
      );
    }
  };

  onMounted(async () => {
    datePlaceholder.value = getCurrentDatePlaceholder();
    timePlaceholder.value = getCurrentTimePlaceholder();

    if (!isEditMode.value && !isViewMode.value) {
      const todayDate = getTodayDateString();
      const currentTime = getCurrentTimePlaceholder();
      await nextTick();
      formData.scheduleDate = todayDate;
      formData.scheduleTime = currentTime;

      await nextTick();
      if (formData.scheduleDate !== todayDate) {
        console.log('⚠️ [Mount] Date was changed, correcting back to today:', {
          expected: todayDate,
          actual: formData.scheduleDate,
        });
        formData.scheduleDate = todayDate;
      }

      if (formData.scheduleEnabled) {
        await nextTick();
        if (formData.scheduleDate !== todayDate) {
          formData.scheduleDate = todayDate;
          console.log(
            '✅ [Mount] Corrected schedule date to today:',
            todayDate
          );
        }
      }
    }

    if (isEditMode.value || isViewMode.value) {
      await loadNotificationData();
      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        activeLanguage.value = Language.EN;
        Object.keys(languageFormData).forEach((lang) => {
          if (lang !== Language.EN) {
            delete languageFormData[lang];
          }
        });
        Object.keys(existingImageIds).forEach((lang) => {
          if (lang !== Language.EN) {
            delete existingImageIds[lang];
          }
        });
        Object.keys(existingTranslationIds).forEach((lang) => {
          if (lang !== Language.EN) {
            delete existingTranslationIds[lang];
          }
        });
      }
    }
  });

  const showConfirmationDialog = ref(false);
  const showLeaveDialog = ref(false);
  const showUpdateConfirmationDialog = ref(false);
  const showRejectDialog = ref(false);
  let pendingNavigation: (() => void) | null = null;
  let isSavingOrPublishing = ref(false); // Flag to prevent blocking during save/publish
  const isDiscarding = ref(false); // Flag to allow navigation when discarding changes

  watch(
    () => formData.splashEnabled,
    (isEnabled) => {
      if (isEnabled) {
        formData.notificationType = NotificationType.FLASH_NOTIFICATION;
      } else {
        formData.notificationType = NotificationType.ANNOUNCEMENT;
      }
    }
  );

  watch(
    () => formData.scheduleTime,
    (newTime, oldTime) => {
      console.log('🟡 [ScheduleTime Watcher] Time changed:', {
        oldTime,
        newTime,
        hasLoadedScheduleTime: hasLoadedScheduleTime.value,
        isLoadingData: isLoadingData.value,
        scheduleEnabled: formData.scheduleEnabled,
        loadedScheduleTime: loadedScheduleTime.value,
        isTemplateExpired: isTemplateExpired.value,
        isReadOnly: isReadOnly.value,
      });

      if (
        isTemplateExpired.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value &&
        isReadOnly.value
      ) {
        if (newTime !== loadedScheduleTime.value) {
          console.log(
            '🔒 [ScheduleTime Watcher] RESTORING - Expired template (view mode) time changed, restoring to original:',
            {
              attemptedTime: newTime,
              restoredTime: loadedScheduleTime.value,
            }
          );
          nextTick(() => {
            formData.scheduleTime = loadedScheduleTime.value;
          });
          return;
        }
      }

      if (
        isLoadingData.value &&
        hasLoadedScheduleTime.value &&
        loadedScheduleTime.value
      ) {
        if (newTime !== loadedScheduleTime.value) {
          console.log(
            '🔒 [ScheduleTime Watcher] RESTORING - Time changed during load, restoring to loaded time:',
            {
              attemptedTime: newTime,
              restoredTime: loadedScheduleTime.value,
            }
          );
          nextTick(() => {
            formData.scheduleTime = loadedScheduleTime.value;
          });
        }
      }
    }
  );

  watch(
    () => formData.scheduleEnabled,
    (isEnabled, wasEnabled) => {
      console.log('🔵 [Schedule Toggle Watcher] FIRED:', {
        isEnabled,
        wasEnabled,
        currentScheduleTime: formData.scheduleTime,
        currentScheduleDate: formData.scheduleDate,
        hasLoadedScheduleTime: hasLoadedScheduleTime.value,
        isLoadingData: isLoadingData.value,
        isEditMode: isEditMode.value,
      });

      if (hasLoadedScheduleTime.value && formData.scheduleTime) {
        console.log(
          '🔒 [Schedule Toggle] BLOCKED - Preserving loaded schedule time:',
          {
            scheduleDate: formData.scheduleDate,
            scheduleTime: formData.scheduleTime,
            wasEnabled,
            isLoadingData: isLoadingData.value,
            hasLoadedScheduleTime: hasLoadedScheduleTime.value,
          }
        );
        return; // Always preserve loaded schedule time, never overwrite
      }

      if (
        isEnabled &&
        !isLoadingData.value &&
        !hasLoadedScheduleTime.value &&
        !isEditMode.value
      ) {
        const todayDate = getTodayDateString();
        const currentTime = getCurrentTimePlaceholder();

        nextTick(() => {
          if (formData.scheduleDate !== todayDate) {
            formData.scheduleDate = todayDate;
            console.log(
              '✅ [Schedule Toggle] Corrected date to today for new notification:',
              {
                oldDate: formData.scheduleDate,
                newDate: todayDate,
              }
            );
          } else {
            formData.scheduleDate = todayDate;
          }
          if (!formData.scheduleTime || formData.scheduleTime === '') {
            formData.scheduleTime = currentTime;
          }
          console.log(
            '✅ [Schedule Toggle] New notification - Set date to today:',
            {
              date: formData.scheduleDate,
              time: formData.scheduleTime,
              wasEnabled,
            }
          );
        });
      } else if (
        isEnabled &&
        !isLoadingData.value &&
        wasEnabled === false &&
        !hasLoadedScheduleTime.value &&
        isEditMode.value
      ) {
        if (!formData.scheduleDate || formData.scheduleDate === '') {
          formData.scheduleDate = getTodayDateString();
        }
        if (!formData.scheduleTime || formData.scheduleTime === '') {
          formData.scheduleTime = getCurrentTimePlaceholder();
        }
      } else if (!isEnabled) {
        if (hasLoadedScheduleTime.value) {
          hasLoadedScheduleTime.value = false;
        }
        formData.scheduleTime = null;
        console.log('✅ [Schedule Toggle] Disabled - Cleared time');
      } else if (isEnabled && formData.scheduleTime) {
        console.log('✅ [Schedule Toggle] Preserving existing schedule time:', {
          scheduleDate: formData.scheduleDate,
          scheduleTime: formData.scheduleTime,
          wasEnabled,
          isLoadingData: isLoadingData.value,
          hasLoadedScheduleTime: hasLoadedScheduleTime.value,
        });
      } else {
        console.log('⚠️ [Schedule Toggle] No action taken:', {
          isEnabled,
          wasEnabled,
          hasScheduleTime: !!formData.scheduleTime,
          hasLoadedScheduleTime: hasLoadedScheduleTime.value,
          isLoadingData: isLoadingData.value,
        });
      }
    }
  );

  watch(
    () => formData.scheduleDate,
    (newDate, oldDate) => {},
    { immediate: false }
  );

  const handleDatePickerChange = (val: string | null) => {
    formData.scheduleDate = val ?? '';
    console.log('Date changed:', val);
  };

  const titleError = ref('');
  const descriptionError = ref('');
  const linkError = ref('');

  const DB_TITLE_MAX_LENGTH = 1024; // Database VARCHAR(1024) limit - matches DB exactly

  const validateTitle = () => {
    const val = currentTitle.value?.trim();
    if (!val) {
      titleError.value = 'Please enter a title';
    } else if (val.length > DB_TITLE_MAX_LENGTH) {
      titleError.value = `Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${val.length}.`;
    } else {
      titleError.value = '';
    }
  };

  const validateDescription = () => {
    const val = currentDescription.value?.trim();
    if (!val) {
      descriptionError.value = 'Please enter a description';
    } else {
      descriptionError.value = '';
    }
  };

  const isValidUrl = (val: string): boolean => {
    try {
      if (!val) return true;
      const u = new URL(val);
      return u.protocol === 'http:' || u.protocol === 'https:';
    } catch {
      return false;
    }
  };

  const validateLink = () => {
    const val = currentLinkToSeeMore.value;
    linkError.value = isValidUrl(val)
      ? ''
      : 'Please enter a valid URL starting with http:// or https://';
  };

  const handleUploadError = (message: string) => {
    ElNotification({
      title: 'Error',
      message: message,
      type: 'error',
      duration: 2000,
    });
  };

  const handleLanguageImageSelected = (file: File) => {
    const currentLang = activeLanguage.value;
    languageFormData[currentLang].imageFile = file;

    const reader = new FileReader();
    reader.onload = (e) => {
      languageFormData[currentLang].imageUrl = e.target?.result as string;
    };
    reader.readAsDataURL(file);
  };

  const handleLanguageImageRemoved = () => {
    const currentLang = activeLanguage.value;
    languageFormData[currentLang].imageFile = null;
    languageFormData[currentLang].imageUrl = null;
    existingImageIds[currentLang] = null;
  };

  const isNotificationOld = (): boolean => {
    if (!templateCreatedAt.value) return false;
    const now = new Date();
    const daysDiff =
      (now.getTime() - templateCreatedAt.value.getTime()) /
      (1000 * 60 * 60 * 24);
    return daysDiff > 1; // More than 1 day old
  };

  const handlePublishNow = async () => {
    isSavingOrPublishing.value = true;

    console.log(
      '🔍 [Expired Check] Validating schedule time before submission:',
      {
        scheduleEnabled: formData.scheduleEnabled,
        scheduleDate: formData.scheduleDate,
        scheduleTime: formData.scheduleTime,
        isEditMode: isEditMode.value,
        notificationId: notificationId.value,
        expiredScheduleTime: expiredScheduleTime.value,
        isTemplateExpired: isTemplateExpired.value,
        originalSendSchedule: originalSendSchedule.value,
      }
    );

    if (
      isEditMode.value &&
      !isEditingPublished.value &&
      formData.scheduleEnabled &&
      formData.scheduleDate &&
      formData.scheduleTime
    ) {
      const dateStr = String(formData.scheduleDate).trim();
      const timeStr = String(formData.scheduleTime).trim();
      const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
      const timePattern = /^\d{2}:\d{2}$/;

      if (datePattern.test(dateStr) && timePattern.test(timeStr)) {
        try {
          const currentScheduleDateTime = DateUtils.parseScheduleDateTime(
            dateStr,
            timeStr
          );
          const nowUTC = new Date();
          if (currentScheduleDateTime.getTime() <= nowUTC.getTime()) {
            const scheduleTimeDisplay =
              expiredScheduleTime.value || `${dateStr} at ${timeStr}`;
            console.error(
              '❌ [Expired Check] BLOCKED - Schedule time is in the past:',
              {
                currentScheduleDateTime: currentScheduleDateTime.toISOString(),
                nowUTC: nowUTC.toISOString(),
                scheduleTimeDisplay,
              }
            );
            ElNotification({
              title: 'Warning',
              message: `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`,
              type: 'warning',
              duration: 5000,
              dangerouslyUseHTMLString: true,
            });
            isSavingOrPublishing.value = false;
            return;
          }
        } catch (error) {
          console.error(
            '❌ [Expired Check] Error parsing schedule time:',
            error
          );
        }
      }
    }

    if (isEditMode.value && originalSendSchedule.value) {
      try {
        const originalScheduleDate = new Date(originalSendSchedule.value);
        const nowUTC = new Date();
        if (originalScheduleDate.getTime() <= nowUTC.getTime() && !isEditingPublished.value) {
          if (
            formData.scheduleEnabled &&
            formData.scheduleDate &&
            formData.scheduleTime
          ) {
            const dateStr = String(formData.scheduleDate).trim();
            const timeStr = String(formData.scheduleTime).trim();
            const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
            const timePattern = /^\d{2}:\d{2}$/;

            if (datePattern.test(dateStr) && timePattern.test(timeStr)) {
              try {
                const currentScheduleDateTime = DateUtils.parseScheduleDateTime(
                  dateStr,
                  timeStr
                );
                if (currentScheduleDateTime.getTime() <= nowUTC.getTime()) {
                  const scheduleTimeDisplay =
                    expiredScheduleTime.value || `${dateStr} at ${timeStr}`;
                  console.error(
                    '❌ [Expired Check] BLOCKED - Schedule time is still in the past (fallback check):',
                    {
                      originalSendSchedule: originalSendSchedule.value,
                      currentScheduleDateTime:
                        currentScheduleDateTime.toISOString(),
                      nowUTC: nowUTC.toISOString(),
                      scheduleTimeDisplay,
                    }
                  );
                  ElNotification({
                    title: 'Warning',
                    message: `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`,
                    type: 'warning',
                    duration: 5000,
                    dangerouslyUseHTMLString: true,
                  });
                  isSavingOrPublishing.value = false;
                  return;
                }
              } catch (error) {
                console.warn(
                  '⚠️ [Expired Check] Could not parse current schedule, continuing with normal validation:',
                  error
                );
              }
            }
          } else if (!formData.scheduleEnabled) {
            const scheduleTimeDisplay =
              expiredScheduleTime.value ||
              DateUtils.formatUTCToCambodiaDateTime(originalSendSchedule.value)
                .time;
            console.error(
              '❌ [Expired Check] BLOCKED - Original schedule is expired and schedule is disabled:',
              {
                originalSendSchedule: originalSendSchedule.value,
                scheduleEnabled: formData.scheduleEnabled,
                scheduleTimeDisplay,
              }
            );
            ElNotification({
              title: 'Warning',
              message: `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`,
              type: 'warning',
              duration: 5000,
              dangerouslyUseHTMLString: true,
            });
            isSavingOrPublishing.value = false;
            return;
          }
        }
      } catch (error) {
        console.warn(
          '⚠️ [Expired Check] Could not parse original sendSchedule, continuing with normal validation:',
          error
        );
      }
    }

    if (formData.scheduleEnabled) {
      if (formData.scheduleDate && formData.scheduleTime) {
        const dateStr = String(formData.scheduleDate).trim();
        const timeStr = String(formData.scheduleTime).trim();
        const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
        const timePattern = /^\d{2}:\d{2}$/;

        console.log('🔍 [Expired Check] Validating date/time format:', {
          dateStr,
          timeStr,
          dateMatches: datePattern.test(dateStr),
          timeMatches: timePattern.test(timeStr),
        });

        if (datePattern.test(dateStr) && timePattern.test(timeStr)) {
          try {
            const scheduleDateTime = DateUtils.parseScheduleDateTime(
              dateStr,
              timeStr
            );
            const nowUTC = new Date();
            const diffMs = scheduleDateTime.getTime() - nowUTC.getTime();

            console.log('🔍 [Expired Check] Schedule time comparison:', {
              scheduleDateTime: scheduleDateTime.toISOString(),
              nowUTC: nowUTC.toISOString(),
              diffMs,
              isPast: diffMs <= 0,
            });

            if (diffMs <= 0 && !isEditingPublished.value) {
              const scheduleTimeDisplay =
                expiredScheduleTime.value || `${dateStr} at ${timeStr}`;
              console.error(
                '❌ [Expired Check] BLOCKED - Schedule time is in the past:',
                {
                  scheduleTimeDisplay,
                  scheduleDateTime: scheduleDateTime.toISOString(),
                  nowUTC: nowUTC.toISOString(),
                }
              );
              ElNotification({
                title: 'Warning',
                message: `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`,
                type: 'warning',
                duration: 5000,
                dangerouslyUseHTMLString: true,
              });
              isSavingOrPublishing.value = false; // Reset flag on expired check failure
              return;
            }
            console.log(
              '✅ [Expired Check] Schedule time is valid (in the future)'
            );
          } catch (error) {
            console.error(
              '❌ [Expired Template Check] Error parsing schedule:',
              error
            );
            isSavingOrPublishing.value = false; // Reset flag on parsing error
            ElNotification({
              title: 'Error',
              message:
                'Invalid date or time format. Please check your schedule time.',
              type: 'error',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            return;
          }
        } else {
          console.error('❌ [Expired Check] Invalid date/time format:', {
            dateStr,
            timeStr,
          });
          ElNotification({
            title: 'Error',
            message: 'Please select both Date and Time for scheduling',
            type: 'error',
            duration: 3000,
            dangerouslyUseHTMLString: true,
          });
          return;
        }
      } else {
        console.error(
          '❌ [Expired Check] Schedule enabled but date/time missing:',
          {
            scheduleDate: formData.scheduleDate,
            scheduleTime: formData.scheduleTime,
          }
        );
        ElNotification({
          title: 'Error',
          message: 'Please select both Date and Time for scheduling',
          type: 'error',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });
        isSavingOrPublishing.value = false;
        return;
      }
    } else {
      console.log(
        '✅ [Expired Check] Schedule is disabled (SEND_NOW) - allowing submission (template is not expired)'
      );
    }

    const currentLangHasExistingData =
      isEditMode.value && existingTranslationIds[activeLanguage.value] !== null;

    const currentLangHasUserInput = !!(
      currentTitle.value?.trim() ||
      currentDescription.value?.trim() ||
      currentImageFile.value
    );

    if (
      isEditMode.value &&
      !currentLangHasExistingData &&
      !currentLangHasUserInput
    ) {
      let hasAnyChanges = false;

      const globalFieldsChanged =
        formData.platform !== originalFormData.platform ||
        formData.categoryTypeId !== originalFormData.categoryTypeId ||
        formData.pushToPlatforms !== originalFormData.pushToPlatforms;

      if (globalFieldsChanged) {
        hasAnyChanges = true;
      } else {
        for (const langKey of Object.keys(languageFormData)) {
          const originalData = originalLanguageFormData[langKey];
          const currentData = languageFormData[langKey];

          if (!originalData) continue; // Skip if no original data for this language

          const titleChanged =
            (currentData?.title?.trim() || '') !==
            (originalData?.title?.trim() || '');
          const descriptionChanged =
            (currentData?.description?.trim() || '') !==
            (originalData?.description?.trim() || '');
          const linkChanged =
            (currentData?.linkToSeeMore?.trim() || '') !==
            (originalData?.linkToSeeMore?.trim() || '');
          const imageChanged =
            currentData?.imageFile !== null ||
            existingImageIds[langKey] !== originalImageIds[langKey];

          if (
            titleChanged ||
            descriptionChanged ||
            linkChanged ||
            imageChanged
          ) {
            hasAnyChanges = true;
            break; // Found at least one change, no need to check further
          }
        }
      }

      if (!hasAnyChanges) {
        const redirectTab = fromTab.value || 'published';
        isSavingOrPublishing.value = false; // Reset flag before navigation
        setTimeout(() => {
          window.location.href = `/?tab=${redirectTab}`;
        }, 100);
        return;
      }

      const token = localStorage.getItem('auth_token');
      if (!token || token.trim() === '') {
        isSavingOrPublishing.value = false; // Reset flag before navigation
        ElNotification({
          title: 'Error',
          message: 'Please login first',
          type: 'error',
          duration: 2000,
        });
        router.push('/login');
        return;
      }

      titleError.value = '';
      descriptionError.value = '';
      await handlePublishNowInternal();
      return;
    }

    let hasChangesForCurrentLang = false;

    const globalFieldsChanged =
      formData.platform !== originalFormData.platform ||
      formData.categoryTypeId !== originalFormData.categoryTypeId ||
      formData.pushToPlatforms !== originalFormData.pushToPlatforms;

    if (globalFieldsChanged) {
      hasChangesForCurrentLang = true;
    } else if (isEditMode.value && currentLangHasExistingData) {
      const currentLang = activeLanguage.value;
      const originalData = originalLanguageFormData[currentLang];

      const titleChanged =
        (currentTitle.value?.trim() || '') !==
        (originalData?.title?.trim() || '');
      const descriptionChanged =
        (currentDescription.value?.trim() || '') !==
        (originalData?.description?.trim() || '');
      const linkChanged =
        (currentLinkToSeeMore.value?.trim() || '') !==
        (originalData?.linkToSeeMore?.trim() || '');
      const imageChanged =
        currentImageFile.value !== null ||
        existingImageIds[currentLang] !== originalImageIds[currentLang];

      hasChangesForCurrentLang =
        titleChanged || descriptionChanged || linkChanged || imageChanged;
    }

    if (!hasChangesForCurrentLang) {
      validateTitle();
      validateDescription();

      if (
        !currentTitle.value ||
        !currentDescription.value ||
        titleError.value ||
        descriptionError.value
      ) {
        if (!titleError.value) validateTitle();
        if (!descriptionError.value) validateDescription();

        isSavingOrPublishing.value = false; // Reset flag on validation error
        return;
      }
    } else {
      titleError.value = '';
      descriptionError.value = '';
    }

    const token = localStorage.getItem('auth_token');
    if (!token || token.trim() === '') {
      isSavingOrPublishing.value = false; // Reset flag before navigation
      ElNotification({
        title: 'Error',
        message: 'Please login first',
        type: 'error',
        duration: 2000,
      });
      router.push('/login');
      return;
    }

    if (isEditMode.value && isEditingPublished.value) {
      let hasAnyChanges = false;

      if (globalFieldsChanged) {
        hasAnyChanges = true;
      } else {
        for (const langKey of Object.keys(languageFormData)) {
          const originalData = originalLanguageFormData[langKey];
          const currentData = languageFormData[langKey];

          if (!originalData) continue; // Skip if no original data for this language

          const titleChanged =
            (currentData?.title?.trim() || '') !==
            (originalData?.title?.trim() || '');
          const descriptionChanged =
            (currentData?.description?.trim() || '') !==
            (originalData?.description?.trim() || '');
          const linkChanged =
            (currentData?.linkToSeeMore?.trim() || '') !==
            (originalData?.linkToSeeMore?.trim() || '');
          const imageChanged =
            currentData?.imageFile !== null ||
            existingImageIds[langKey] !== originalImageIds[langKey];

          if (
            titleChanged ||
            descriptionChanged ||
            linkChanged ||
            imageChanged
          ) {
            hasAnyChanges = true;
            break; // Found at least one change, no need to check further
          }
        }
      }

      if (hasAnyChanges) {
        showUpdateConfirmationDialog.value = true;
        return;
      } else {
        const redirectTab = fromTab.value || 'published';
        isSavingOrPublishing.value = false; // Reset flag before navigation
        setTimeout(() => {
          window.location.href = `/?tab=${redirectTab}`;
        }, 100);
        return;
      }
    }

    await handlePublishNowInternal();
  };

  const handlePublishNowInternal = async () => {
    isSavingOrPublishing.value = true;

    const loadingNotification = ElNotification({
      title: isEditMode.value ? 'Sending Notification' : 'Sending Notification',
      message: isEditMode.value
        ? 'Please wait while we send the notification to <strong>all users</strong>. This may take a moment to complete.'
        : 'Please wait while we send the notification to <strong>all users</strong>. This may take a moment to complete.',
      type: 'info',
      duration: 0,
      dangerouslyUseHTMLString: true,
    });

    await nextTick();

    let redirectTab = 'published';

    try {
      const isEditor = authStore.user?.role === (UserRole.EDITOR as any);
      const isAdmin = authStore.user?.role === (UserRole.ADMINISTRATOR as any);
      const needsApproval = isEditor || isAdmin; // Both Editor and Admin need approval
      let sendType = SendType.SEND_NOW;
      let isSent: boolean | undefined = true;

      const validateSchedule = async (): Promise<boolean> => {
        if (formData.scheduleEnabled) {
          console.log('🔍 [Schedule Validation] Form data:', {
            scheduleEnabled: formData.scheduleEnabled,
            scheduleDate: formData.scheduleDate,
            scheduleTime: formData.scheduleTime,
          });

          const dateValue = formData.scheduleDate;
          const timeValue = formData.scheduleTime;

          const dateStr =
            dateValue != null && dateValue !== ''
              ? String(dateValue).trim()
              : '';
          const timeStr =
            timeValue != null && timeValue !== ''
              ? String(timeValue).trim()
              : '';

          const datePattern = /^\d{1,2}\/\d{1,2}\/\d{4}$/;
          const timePattern = /^\d{2}:\d{2}$/;

          const hasValidDate = dateStr !== '' && datePattern.test(dateStr);
          const hasValidTime = timeStr !== '' && timePattern.test(timeStr);

          if (!hasValidDate || !hasValidTime) {
            ElNotification({
              title: 'Error',
              message: 'Please select both Date and Time for scheduling',
              type: 'error',
              duration: 2000,
            });
            return false;
          }

          try {
            const scheduleDateTime = DateUtils.parseScheduleDateTime(
              dateStr,
              timeStr
            );
            const nowUTC = new Date();
            const diffMs = scheduleDateTime.getTime() - nowUTC.getTime();

            if (diffMs <= 0) {
              ElNotification({
                title: 'Error',
                message:
                  'Scheduled time must be in the future. Please select a future time.',
                type: 'error',
                duration: 3000,
              });
              return false;
            }
            return true;
          } catch (error) {
            console.error('❌ [Schedule Validation] Error:', error);
            ElNotification({
              title: 'Error',
              message:
                'Invalid date or time format. Please check your selection.',
              type: 'error',
              duration: 2000,
            });
            return false;
          }
        }
        if (isEditingPublished.value) {
          console.log(
            '⏭️ [Schedule Validation] Skipping validation for already published notification'
          );
          return true;
        }
        return true;
      };

      if (isEditMode.value) {
        const isEditingFromScheduled = fromTab.value === 'scheduled';
        const isEditingFromPublished = fromTab.value === 'published';
        const isEditingFromPending = fromTab.value === 'pending';

        if (
          isEditingFromScheduled ||
          isEditingFromPublished ||
          isEditingFromPending
        ) {
          console.log(
            `🔄 [Submit] Editing from ${fromTab.value} tab - preserving status and staying in same tab`
          );

          if (isEditingFromScheduled) {
            if (formData.scheduleEnabled) {
              const isValid = await validateSchedule();
              if (!isValid) {
                loadingNotification.close();
                isSavingOrPublishing.value = false;
                return;
              }
              sendType = SendType.SEND_SCHEDULE;
              isSent = originalIsSent.value ?? false;
              redirectTab = 'scheduled';
            } else {
              sendType = SendType.SEND_NOW;
              isSent = true;
              redirectTab = 'scheduled';
            }
          } else if (isEditingFromPublished) {
            sendType = formData.scheduleEnabled
              ? SendType.SEND_SCHEDULE
              : SendType.SEND_NOW;
            isSent = true; // Keep as sent
            redirectTab = 'published';
          } else if (isEditingFromPending) {
            if (formData.scheduleEnabled) {
              const isValid = await validateSchedule();
              if (!isValid) {
                loadingNotification.close();
                isSavingOrPublishing.value = false;
                return;
              }
              sendType = SendType.SEND_SCHEDULE;
              isSent = originalIsSent.value ?? true;
              redirectTab = 'pending';
            } else {
              sendType = SendType.SEND_NOW;
              isSent = originalIsSent.value ?? true;
              redirectTab = 'pending';
            }
          }
        } else if (isTemplateExpired.value) {
          console.log(
            '🔄 [Submit] Template is expired/rejected from Draft - following normal submission flow'
          );
          if (formData.scheduleEnabled) {
            const isValid = await validateSchedule();
            if (!isValid) {
              loadingNotification.close();
              isSavingOrPublishing.value = false;
              return;
            }
            sendType = SendType.SEND_SCHEDULE;
            const needsApprovalForEdit = isEditor || isAdmin;
            isSent = needsApprovalForEdit ? true : false;
            redirectTab = needsApprovalForEdit ? 'pending' : 'scheduled';
          } else {
            sendType = SendType.SEND_NOW;
            isSent = true;
            redirectTab = needsApproval ? 'pending' : 'published';
          }
        } else {
          if (formData.scheduleEnabled) {
            const isValid = await validateSchedule();
            if (!isValid) {
              loadingNotification.close();
              isSavingOrPublishing.value = false;
              return;
            }

            sendType = SendType.SEND_SCHEDULE;
            const needsApprovalForEdit = isEditor || isAdmin;
            isSent = needsApprovalForEdit ? true : false;
            redirectTab = needsApprovalForEdit ? 'pending' : 'scheduled';
          } else {
            sendType = SendType.SEND_NOW;
            isSent = true;
            redirectTab = needsApproval ? 'pending' : 'published';
          }
        }
      } else {
        if (formData.scheduleEnabled) {
          const isValid = await validateSchedule();
          if (!isValid) {
            loadingNotification.close();
            isSavingOrPublishing.value = false;
            return;
          }

          sendType = SendType.SEND_SCHEDULE;
          isSent = needsApproval ? true : false;
          redirectTab = needsApproval ? 'pending' : 'scheduled';
        } else {
          isSent = true;
          redirectTab = needsApproval ? 'pending' : 'published';
        }
      }
      const imagesToUpload: { file: File; language: string }[] = [];
      const translations = [];

      for (const [langKey, langData] of Object.entries(languageFormData)) {
        // LOG: Check language and form data
        console.log('[Translation Filter] langKey:', langKey, 'langData:', langData);
        try {
          if (
            formData.platform === BakongApp.BAKONG_TOURIST &&
            langKey !== Language.EN
          ) {
            continue;
          }
        } catch (e) {}
        const allEmpty =
          (!langData.title || String(langData.title).trim() === '') &&
          (!langData.description || String(langData.description).trim() === '') &&
          (!langData.linkToSeeMore || String(langData.linkToSeeMore).trim() === '') &&
          !langData.imageFile && !langData.imageUrl;

        if (allEmpty) {
          console.log('[Translation Filter] EMPTY:', langKey);
          // If it was an existing translation, we MUST include it (as empty) so the backend can delete it
          if (isEditMode.value && existingTranslationIds[langKey]) {
            console.log('[Translation Filter] Including empty translation for deletion:', langKey);
          } else {
            console.log('[Translation Filter] Skipping new empty translation:', langKey);
            continue;
          }
        }

        const isExisting = isEditMode.value && !!existingTranslationIds[langKey];

        const shouldInclude = !allEmpty || isExisting;

        if (shouldInclude) {
          console.log('[Translation Filter] INCLUDE:', langKey, langData);
          if (langData.linkToSeeMore && !isValidUrl(langData.linkToSeeMore)) {
            ElNotification({
              title: 'Error',
              message: `Please enter a valid URL for <strong>Link to see more</strong> in ${langKey} with correct format <strong>(e.g., https://example.com)</strong>`,
              type: 'error',
              duration: 2000,
              dangerouslyUseHTMLString: true,
            });
            loadingNotification.close();
            isSavingOrPublishing.value = false;
            return;
          }
          let imageId: string | undefined = undefined;

          if (langData.imageFile) {
            try {
              const { file: compressed, dataUrl } = await compressImage(
                langData.imageFile,
                {
                  maxBytes: 2 * 1024 * 1024, // 2MB per image (safer for batch uploads)
                  maxWidth: 2000,
                  targetAspectRatio: 2 / 1, // 2:1 aspect ratio as shown in UI
                  correctAspectRatio: true, // Automatically correct aspect ratio
                  keepOriginalFile: false,
                }
              );
              imagesToUpload.push({ file: compressed, language: langKey });
              if (languageFormData[langKey]) {
                languageFormData[langKey].imageUrl = dataUrl;
              }
            } catch (e) {
              console.error('Compression failed for', langKey, e);
              ElNotification({
                title: 'Error',
                message: `Failed to prepare image for ${langKey}`,
                type: 'error',
                duration: 2000,
              });
              loadingNotification.close();
              isSavingOrPublishing.value = false;
              return;
            }
          } else if (isEditMode.value && existingImageIds[langKey]) {
            imageId = existingImageIds[langKey] || undefined;
            console.log(
              '🖼️ [Update] Preserving existing image for',
              langKey,
              ':',
              imageId
            );
          }

          const translationData: any = {
            language: mapLanguageToEnum(langKey),
            title: langData.title || '', // Always include title (empty string if missing)
            content: langData.description || '', // Always include content (empty string if missing)
            linkPreview: langData.linkToSeeMore || undefined,
            image: imageId || '', // Include imageId if exists, otherwise empty string
          };
          if (isEditMode.value && existingTranslationIds[langKey]) {
            translationData.id = existingTranslationIds[langKey];
          }
          translations.push(translationData);
        }
      }
      let uploadedImages: {
        language?: string;
        fileId: string;
        mimeType: string;
        originalFileName: string;
      }[] = [];
      if (imagesToUpload.length > 0) {
        try {
          const items = imagesToUpload.map((item) => ({
            file: item.file,
            language: String(item.language),
          }));
          const totalSize = items.reduce(
            (sum, item) => sum + item.file.size,
            0
          );
          const totalSizeMB = (totalSize / 1024 / 1024).toFixed(2);

          console.log(
            'Files to upload:',
            items.map((i) => ({
              name: i.file.name,
              size: i.file.size,
              sizeMB: (i.file.size / 1024 / 1024).toFixed(2) + 'MB',
              type: i.file.type,
              language: i.language,
            }))
          );
          console.log(`Total upload size: ${totalSizeMB}MB (limit: 18MB)`);

          uploadedImages = await notificationApi.uploadImages(items);
          console.log('Batch uploaded images:', uploadedImages);
        } catch (error: any) {
          console.error('Error uploading images:', error);
          const errorMessage =
            error?.response?.status === 413
              ? 'Upload size too large. Images have been compressed, but total size still exceeds limit. Please try uploading fewer images or use smaller images.'
              : error?.message ||
                error?.response?.data?.responseMessage ||
                'Failed to upload images. Please ensure total size is under 18MB and try again.';

          ElNotification({
            title: 'Upload Error',
            message: errorMessage,
            type: 'error',
            duration: 5000,
          });
          loadingNotification.close();
          isSavingOrPublishing.value = false;
          return;
        }
      }
      const langToFileId = new Map<string, string>();
      uploadedImages.forEach((u) => {
        if (u.language && u.fileId) {
          langToFileId.set(String(u.language), u.fileId);
          const langKey = String(u.language);
          existingImageIds[langKey] = u.fileId;
          if (languageFormData[langKey]) {
            languageFormData[langKey].imageFile = null;
            languageFormData[langKey].imageUrl = `/api/v1/image/${u.fileId}`;
          }
        }
      });
      for (const [index, trans] of translations.entries()) {
        const fid = langToFileId.get(String(trans.language));
        if (fid) {
          translations[index].image = fid;
          const langKey = Object.keys(languageFormData).find(
            (key) => mapLanguageToEnum(key) === trans.language
          );
          if (langKey) {
            existingImageIds[langKey] = fid;
          }
        }
      }

      if (translations.length === 0) {
        let fallbackImageId: string | undefined;
        if (currentImageFile.value) {
          try {
            fallbackImageId = await notificationApi.uploadImage(
              currentImageFile.value
            );
          } catch (error) {
            console.error('Error uploading fallback image:', error);
            ElNotification({
              title: 'Error',
              message: 'Failed to upload image. Please try again.',
              type: 'error',
              duration: 2000,
            });
            loadingNotification.close();
            isSavingOrPublishing.value = false;
            return;
          }
        }

        if (
          currentLinkToSeeMore.value &&
          !isValidUrl(currentLinkToSeeMore.value)
        ) {
          ElNotification({
            title: 'Error',
            message: 'Invalid URL. Must start with http(s)://',
            type: 'error',
            duration: 2000,
          });
          loadingNotification.close();
          isSavingOrPublishing.value = false;
          return;
        }
        // Only push fallbackTranslationData if at least one field is not empty
        const allEmptyFallback =
          (!currentTitle.value || String(currentTitle.value).trim() === '') &&
          (!currentDescription.value || String(currentDescription.value).trim() === '') &&
          (!currentLinkToSeeMore.value || String(currentLinkToSeeMore.value).trim() === '') &&
          (!currentImageFile.value) &&
          (!fallbackImageId);
        if (!allEmptyFallback) {
          const fallbackTranslationData: any = {
            language: mapLanguageToEnum(activeLanguage.value),
            title: currentTitle.value,
            content: currentDescription.value,
            linkPreview: currentLinkToSeeMore.value || undefined,
            image: fallbackImageId,
          };
          if (isEditMode.value && existingTranslationIds[activeLanguage.value]) {
            fallbackTranslationData.id =
              existingTranslationIds[activeLanguage.value];
          }
          translations.push(fallbackTranslationData);
        }
      }

      let filteredTranslations = translations;
      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        filteredTranslations = translations.filter(
          (t) => t.language === 'EN' || t.language === Language.EN
        );
      }
      const templateData: CreateTemplateRequest = {
        platforms: [mapPlatformToEnum(formData.pushToPlatforms)],
        bakongPlatform: formData.platform,
        sendType: sendType,
        isSent: isSent, // Always include isSent (use original value when preserving status)
        translations: filteredTranslations,
        notificationType: mapTypeToNotificationType(formData.notificationType),
        categoryTypeId: formData.categoryTypeId ?? undefined,
        priority: 1,
      };
      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        (templateData as any).removeOtherTranslations = true;
      }

      if (
        formData.scheduleEnabled
      ) {
        const dateStr = String(formData.scheduleDate);
        const timeStr = String(formData.scheduleTime);

        console.log('🔍 [Submit] BEFORE UPDATE - Schedule Data:', {
          scheduleEnabled: formData.scheduleEnabled,
          formDataScheduleDate: formData.scheduleDate,
          formDataScheduleTime: formData.scheduleTime,
          dateStr,
          timeStr,
          isEditMode: isEditMode.value,
          templateId: notificationId.value,
          hasLoadedScheduleTime: hasLoadedScheduleTime.value,
          isLoadingData: isLoadingData.value,
        });

        const scheduleDateTime = DateUtils.parseScheduleDateTime(
          dateStr,
          timeStr
        );
        const utcISOString = scheduleDateTime.toISOString();
        templateData.sendSchedule = utcISOString;

        const { date: cambodiaDate, time: cambodiaTime } =
          DateUtils.formatUTCToCambodiaDateTime(utcISOString);

        console.log('✅ [Submit] AFTER PARSING - Schedule Conversion:', {
          inputDate: dateStr,
          inputTime: timeStr,
          parsedDateTime: scheduleDateTime,
          utcISOString: utcISOString,
          cambodiaDate,
          cambodiaTime,
          willSendToBackend: templateData.sendSchedule,
          originalFormDataTime: formData.scheduleTime,
          timeMatches: timeStr === formData.scheduleTime,
        });
      } else {
        (templateData as any).sendSchedule = null;
        console.log('✅ [Submit] Clearing schedule (disabled or published):', {
          scheduleEnabled: formData.scheduleEnabled,
          isEditMode: isEditMode.value,
          isEditingPublished: isEditingPublished.value,
          willSendNull: true,
        });
      }

      console.log('📤 [Submit] Sending to backend:', {
        isEditMode: isEditMode.value,
        templateId: isEditMode.value ? notificationId.value : 'NEW',
        templateData: {
          ...templateData,
          sendSchedule: templateData.sendSchedule,
          sendType: templateData.sendType,
          isSent: templateData.isSent,
        },
      });

      let result;
      try {
        for (const t of templateData.translations || []) {
          if (t.linkPreview && !isValidUrl(String(t.linkPreview))) {
            ElNotification({
              title: 'Error',
              message:
                'Please enter a valid URL starting with http:// or https://',
              type: 'error',
              duration: 2000,
            });
            if (loadingNotification) loadingNotification.close();
            isSavingOrPublishing.value = false;
            return;
          }
        }

        if (isEditMode.value) {
          result = await notificationApi.updateTemplate(
            parseInt(notificationId.value),
            templateData
          );
        } else {
          result = await notificationApi.createTemplate(templateData);
        }

        console.log('📥 [Submit] Backend Response:', {
          responseCode: result?.data?.responseCode,
          responseMessage: result?.data?.responseMessage,
          returnedSendSchedule: result?.data?.data?.sendSchedule,
          returnedSendType: result?.data?.data?.sendType,
          returnedIsSent: result?.data?.data?.isSent,
          fullResponse: result?.data?.data,
        });
      } catch (error: any) {
        loadingNotification.close();
        console.log('❌ [Submit] Error caught:', {
          error: error,
          response: error.response,
          responseData: error.response?.data,
          status: error.response?.status,
          statusText: error.response?.statusText,
        });

        const isNoUsersError =
          error.response?.data?.errorCode ===
            ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM ||
          error.response?.data?.responseMessage?.includes(
            'No users found for'
          ) ||
          error.response?.data?.responseMessage?.includes('No users match');

        if (isNoUsersError) {
          console.warn(
            '⚠️ [Submit] Blocking submission due to no matching users for platform. Automatically saving as draft...'
          );
          const errorMessage =
            error.response?.data?.responseMessage ||
            'No users found matching the platform requirements (OS platform or Bakong platform). Please ensure there are registered users for the specified platforms before submitting.';

          ElNotification({
            title: 'Warning',
            message: formatNoUsersFoundMessage(errorMessage),
            type: 'warning',
            duration: 8000,
            dangerouslyUseHTMLString: true,
            showClose: true,
          });

          try {
            await handleSaveDraft(true, true, true, true); // forceDraft=true, suppressNotifications=true, forceRun=true, skipRedirect=true

            localStorage.setItem('notification_active_tab', 'draft');
            localStorage.removeItem('notifications_cache');
            localStorage.removeItem('notifications_cache_timestamp');

            const cacheBuster = Date.now();
            setTimeout(() => {
              router.push(`/?tab=draft&_refresh=${cacheBuster}`);
              setTimeout(() => {
                isSavingOrPublishing.value = false;
              }, 1000);
            }, 500); // Small delay to ensure notification is seen
          } catch (saveError) {
            console.error('❌ [Submit] Failed to save as draft:', saveError);
            const cacheBuster = Date.now();
            setTimeout(() => {
              router.push(`/?tab=draft&_refresh=${cacheBuster}`);
              setTimeout(() => {
                isSavingOrPublishing.value = false;
              }, 1000);
            }, 500);
          }
          return;
        }

        throw error;
      }

      loadingNotification.close();

      if (isEditMode.value && isEditingPublished.value) {
        ElNotification({
          title: 'Success',
          message: `Notification for <strong>${formatBakongApp(formData.platform)}</strong> has been updated successfully!`,
          type: 'success',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });
        redirectTab = 'published';
      } else if (isEditMode.value && redirectTab === 'scheduled') {
        const platformNameForScheduled = formatBakongApp(formData.platform);
        ElNotification({
          title: 'Success',
          message: `Notification for <strong>${platformNameForScheduled}</strong> has been updated successfully!`,
          type: 'success',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });
        redirectTab = 'scheduled';
      } else {
        const platformName = formatBakongApp(formData.platform);
        const bakongPlatform =
          formData.platform || result?.data?.bakongPlatform;
        const successfulCount = result?.data?.successfulCount ?? 0;
        const failedCount = result?.data?.failedCount ?? 0;
        const successfulCountFromResult = result?.data?.successfulCount;
        const failedCountFromResult = result?.data?.failedCount;
        const wasActuallySent =
          successfulCountFromResult !== undefined &&
          successfulCountFromResult !== null &&
          successfulCountFromResult > 0;
        const isPartialSuccess = successfulCount > 0 && failedCount > 0;

        if (redirectTab === 'scheduled') {
          if (wasActuallySent) {
            const userText = successfulCountFromResult === 1 ? 'user' : 'users';
            const platformNameForScheduled = formatBakongApp(formData.platform);
            let message = `Notification for <strong>${platformNameForScheduled}</strong> sent to ${successfulCountFromResult} ${userText} on time`;

            if (failedCountFromResult > 0) {
              message += `. Failed to send to ${failedCountFromResult} user(s)`;
            }

            ElNotification({
              title: 'Success',
              message: message,
              type: 'success',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            redirectTab = 'published';
          } else {
            const platformNameForScheduled = formatBakongApp(formData.platform);
            const isEditor = authStore.user?.role === (UserRole.EDITOR as any);
            const needsApproval =
              result?.data?.approvalStatus === 'PENDING' ||
              (!isEditMode.value && isEditor);

            let message = isEditMode.value
              ? `Notification for <strong>${platformNameForScheduled}</strong> updated and scheduled successfully!`
              : `Notification for <strong>${platformNameForScheduled}</strong> created and scheduled successfully!`;

            if (needsApproval && !isEditMode.value) {
              message = `Notification for <strong>${platformNameForScheduled}</strong> has been submitted for approval and scheduled. It will appear in the Pending tab.`;
              redirectTab = 'pending';
            } else if (!needsApproval && !isEditMode.value) {
              redirectTab = 'scheduled';
            }

            ElNotification({
              title: 'Success',
              message: message,
              type: 'success',
              duration: 2000,
              dangerouslyUseHTMLString: true,
            });
          }
        } else {
          const isEditor = authStore.user?.role === (UserRole.EDITOR as any);
          const isAdmin =
            authStore.user?.role === (UserRole.ADMINISTRATOR as any);
          const needsApproval =
            result?.data?.approvalStatus === 'PENDING' ||
            (!isEditMode.value && (isEditor || isAdmin));

          if (isEditingPending.value && isEditMode.value) {
            const platformNameForUpdate = formatBakongApp(formData.platform);
            ElNotification({
              title: 'Success',
              message: `Notification for <strong>${platformNameForUpdate}</strong> has been updated. It remains in the Pending tab.`,
              type: 'success',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            redirectTab = 'pending';
          } else if (
            isTemplateExpired.value &&
            isEditMode.value &&
            redirectTab === 'pending'
          ) {
            const platformNameForSubmit = formatBakongApp(formData.platform);
            ElNotification({
              title: 'Success',
              message: `Notification for <strong>${platformNameForSubmit}</strong> has been submitted for approval. It will appear in the Pending tab.`,
              type: 'success',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            redirectTab = 'pending';
          } else if (needsApproval && !isEditMode.value) {
            const platformNameForSubmit = formatBakongApp(formData.platform);
            ElNotification({
              title: 'Success',
              message: `Notification for <strong>${platformNameForSubmit}</strong> has been submitted for approval. It will appear in the Pending tab.`,
              type: 'success',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            redirectTab = 'pending';
          } else if (
            needsApproval &&
            isEditMode.value &&
            (redirectTab === 'pending' ||
              result?.data?.approvalStatus === 'PENDING')
          ) {
            const platformNameForSubmit = formatBakongApp(formData.platform);
            ElNotification({
              title: 'Success',
              message: `Notification for <strong>${platformNameForSubmit}</strong> has been submitted for approval. It will appear in the Pending tab.`,
              type: 'success',
              duration: 3000,
              dangerouslyUseHTMLString: true,
            });
            redirectTab = 'pending';
          } else {
            const devicePlatform = formatPlatform(
              String(formData.pushToPlatforms)
            );

            const messageConfig = getNotificationMessage(
              result?.data,
              platformName,
              bakongPlatform,
              devicePlatform
            );

            const failedDueToInvalidTokens =
              result?.data?.failedDueToInvalidTokens === true;
            const allFailed = successfulCount === 0 && failedCount > 0;

            if (messageConfig.type !== 'success' || isPartialSuccess) {
              if (isPartialSuccess) {
                const failedUsers = result?.data?.failedUsers || [];

                ElNotification({
                  title: messageConfig.title,
                  message: messageConfig.message,
                  type: messageConfig.type,
                  duration: messageConfig.duration,
                  dangerouslyUseHTMLString:
                    messageConfig.dangerouslyUseHTMLString,
                });

                if (failedUsers.length > 0) {
                  const failedUsersList =
                    failedUsers.length <= 5
                      ? failedUsers.join(', ')
                      : `${failedUsers.slice(0, 5).join(', ')} and ${failedUsers.length - 5} more`;

                  const failureReason = result?.data?.failedDueToInvalidTokens
                    ? 'invalid or expired FCM tokens. These users need to update their tokens by opening the mobile app.'
                    : 'unknown reasons';

                  const detailedMessageConfig = getNotificationMessage(
                    result?.data,
                    undefined,
                    bakongPlatform,
                    devicePlatform
                  );
                  ElNotification({
                    title: detailedMessageConfig.title,
                    message: detailedMessageConfig.message,
                    type: detailedMessageConfig.type,
                    duration: detailedMessageConfig.duration,
                    dangerouslyUseHTMLString:
                      detailedMessageConfig.dangerouslyUseHTMLString,
                  });
                }

                redirectTab = 'published';
              } else {
                ElNotification({
                  title: messageConfig.title,
                  message: messageConfig.message,
                  type: messageConfig.type,
                  duration: messageConfig.duration,
                  dangerouslyUseHTMLString:
                    messageConfig.dangerouslyUseHTMLString,
                });

                if (
                  messageConfig.type === 'error' ||
                  messageConfig.type === 'warning' ||
                  messageConfig.type === 'info'
                ) {
                  redirectTab = 'draft';
                }
              }
            } else {
              const failedUsers = result?.data?.failedUsers || [];
              const isFlashNotification =
                formData.notificationType ===
                NotificationType.FLASH_NOTIFICATION;

              let message = isFlashNotification
                ? isEditMode.value
                  ? 'Flash notification updated and published successfully, and when user open bakongPlatform it will saw it!'
                  : 'Flash notification created and published successfully, and when user open bakongPlatform it will saw it!'
                : isEditMode.value
                  ? 'Notification updated and published successfully!'
                  : 'Notification created and published successfully!';

              if (
                !isFlashNotification &&
                successfulCountFromResult !== undefined &&
                successfulCountFromResult !== null &&
                successfulCountFromResult > 0
              ) {
                const messageConfig = getNotificationMessage(
                  result?.data,
                  undefined,
                  bakongPlatform,
                  devicePlatform
                );
                message = messageConfig.message;
              }

              if (isFlashNotification) {
                const platformNameForFlash = formatBakongApp(formData.platform);
                message = message.replace(
                  'bakongPlatform',
                  `<strong>${platformNameForFlash}</strong>`
                );
              }

              ElNotification({
                title: 'Success',
                message: message,
                type: 'success',
                duration: 2000,
                dangerouslyUseHTMLString: true,
              });
            }
          }
        }
      }
      try {
        console.log('🗑️ [Submit] Clearing cache before redirect...');
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
        console.log('✅ [Submit] Cache cleared successfully');
      } catch (error) {
        console.warn('⚠️ [Submit] Failed to clear cache:', error);
      }

      showLeaveDialog.value = false;
      showConfirmationDialog.value = false;
      pendingNavigation = null;

      let finalRedirectTab = redirectTab;
      if (isEditMode.value) {
        finalRedirectTab = redirectTab;
      } else {
        finalRedirectTab = redirectTab;
      }

      console.log('🔄 [Submit] Redirect configuration:', {
        isEditMode: isEditMode.value,
        isTemplateExpired: isTemplateExpired.value,
        fromTab: fromTab.value,
        redirectTab,
        finalRedirectTab,
        templateId: notificationId.value,
      });

      try {
        localStorage.setItem('notification_active_tab', finalRedirectTab);
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
      } catch (error) {
        console.warn('Failed to update localStorage:', error);
      }

      if (isEditMode.value) {
        const cacheBuster = Date.now();
        setTimeout(() => {
          console.log(
            '🔄 [Submit] Redirecting to:',
            `/?tab=${finalRedirectTab}&_refresh=${cacheBuster}`
          );
          window.location.href = `/?tab=${finalRedirectTab}&_refresh=${cacheBuster}`;
          isSavingOrPublishing.value = false;
        }, 1000); // Increased delay to ensure backend has committed
      } else {
        const cacheBuster = Date.now();
        router
          .push(`/?tab=${finalRedirectTab}&_refresh=${cacheBuster}`)
          .then(() => {
            isSavingOrPublishing.value = false;
          })
          .catch(() => {
            isSavingOrPublishing.value = false;
          });
      }
    } catch (error: any) {
      isSavingOrPublishing.value = false;
      console.error('Error creating/updating notification:', error);
      console.error('Error details:', {
        message: error.message,
        response: error.response,
        responseData: error.response?.data,
        status: error.response?.status,
      });

      loadingNotification.close();

      console.log(
        '🔄 [Error] Preserving existing image IDs for retry:',
        existingImageIds
      );

      let errorMessage =
        error.response?.data?.responseMessage ||
        error.response?.data?.message ||
        error.message ||
        'An unexpected error occurred while creating the notification';

      const isNoUsersError =
        error.response?.data?.errorCode ===
          ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM ||
        errorMessage.includes('No users found for') ||
        errorMessage.includes('No users match') ||
        errorMessage.includes('no users found');

      if (isNoUsersError) {
        console.warn(
          '⚠️ [Submit] No users found error. Automatically saving as draft...'
        );

        ElNotification({
          title: 'Warning',
          message: formatNoUsersFoundMessage(errorMessage),
          type: 'warning',
          duration: 8000,
          dangerouslyUseHTMLString: true,
          showClose: true,
        });

        try {
          await handleSaveDraft(true, true, true, true); // forceDraft=true, suppressNotifications=true, forceRun=true, skipRedirect=true

          localStorage.setItem('notification_active_tab', 'draft');
          localStorage.removeItem('notifications_cache');
          localStorage.removeItem('notifications_cache_timestamp');

          const cacheBuster = Date.now();
          setTimeout(() => {
            router.push(`/?tab=draft&_refresh=${cacheBuster}`);
            setTimeout(() => {
              isSavingOrPublishing.value = false;
            }, 1000);
          }, 500); // Small delay to ensure notification is seen
        } catch (saveError) {
          console.error('❌ [Submit] Failed to save as draft:', saveError);
          const cacheBuster = Date.now();
          setTimeout(() => {
            router.push(`/?tab=draft&_refresh=${cacheBuster}`);
            setTimeout(() => {
              isSavingOrPublishing.value = false;
            }, 1000);
          }, 500);
        } finally {
          setTimeout(() => {
            isSavingOrPublishing.value = false;
          }, 1000);
        }
        return;
      }

      const isExpiredTemplateError =
        errorMessage.includes('scheduled time was set') ||
        errorMessage.includes('has now passed') ||
        errorMessage.includes('expired') ||
        error.response?.data?.data?.scheduleTimeDisplay;

      let scheduleTimeDisplay = error.response?.data?.data?.scheduleTimeDisplay;
      if (isExpiredTemplateError && scheduleTimeDisplay) {
        errorMessage = `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`;
      }

      if (
        !errorMessage ||
        errorMessage === 'undefined' ||
        errorMessage === 'null'
      ) {
        const status = error.response?.status;
        if (status === 500) {
          errorMessage =
            'Internal server error. Please try again or contact support if the problem persists.';
        } else if (status === 400) {
          errorMessage =
            'Invalid request. Please check your input and try again.';
        } else if (status === 401) {
          errorMessage = 'Authentication failed. Please log in again.';
        } else if (status === 403) {
          errorMessage = 'You do not have permission to perform this action.';
        } else if (status === 404) {
          errorMessage = 'The requested resource was not found.';
        } else {
          errorMessage = `Request failed with status ${status || 'unknown'}. Please try again.`;
        }
      }

      ElNotification({
        title: isExpiredTemplateError ? 'Warning' : 'Error',
        message: errorMessage,
        type: isExpiredTemplateError ? 'warning' : 'error',
        duration: 5000, // Increased from 2000ms to 5000ms for better visibility
        showClose: true, // Allow user to manually close
        dangerouslyUseHTMLString:
          isExpiredTemplateError && errorMessage.includes('<strong>'),
      });
    }
  };

  const handleFinishLater = () => {
    showConfirmationDialog.value = true;
  };

  const handleSaveDraft = async (
    forceDraft: boolean = false,
    suppressNotifications: boolean = false,
    forceRun: boolean = false,
    skipRedirect: boolean = false
  ) => {
    if (!forceRun && isSavingOrPublishing.value) return;
    const wasFlagSet = isSavingOrPublishing.value;
    if (!wasFlagSet) {
      isSavingOrPublishing.value = true;
    }

    const currentLang = activeLanguage.value;
    if (languageFormData[currentLang]) {
      languageFormData[currentLang].title = currentTitle.value;
      languageFormData[currentLang].description = currentDescription.value;
      languageFormData[currentLang].linkToSeeMore = currentLinkToSeeMore.value;
    }

    titleError.value = '';
    descriptionError.value = '';

    let hasValidationError = false;
    const validationErrors: string[] = [];

    for (const [langKey, langData] of Object.entries(languageFormData)) {
      const lang = langKey as Language;
      const title =
        (lang === activeLanguage.value
          ? currentTitle.value
          : langData.title
        )?.trim() || '';

      if (title && title.length > DB_TITLE_MAX_LENGTH) {
        hasValidationError = true;
        validationErrors.push(
          `${langKey.toUpperCase()}: Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${title.length}.`
        );
      }
    }

    if (hasValidationError) {
      const activeTitle = currentTitle.value?.trim() || '';
      if (activeTitle && activeTitle.length > DB_TITLE_MAX_LENGTH) {
        titleError.value = `Title is too long (max ${DB_TITLE_MAX_LENGTH}), current length: ${activeTitle.length}.`;
      }

      ElNotification({
        title: 'Validation Error',
        message: validationErrors.join('<br/>'),
        type: 'error',
        duration: 5000,
        dangerouslyUseHTMLString: true,
      });
      isSavingOrPublishing.value = false;
      return;
    }

    const token = localStorage.getItem('auth_token');
    if (!token || token.trim() === '') {
      ElNotification({
        title: 'Error',
        message: 'Please login first',
        type: 'error',
        duration: 2000,
      });
      isSavingOrPublishing.value = false;
      router.push('/login');
      return;
    }

    const loadingNotification = suppressNotifications
      ? null
      : ElNotification({
          title: isEditMode.value ? 'Updating draft...' : 'Saving draft...',
          message: isEditMode.value
            ? 'Please wait while we update your notification'
            : 'Please wait while we save your notification',
          type: 'warning',
          duration: 0,
        });

    for (const [langKey, langData] of Object.entries(languageFormData)) {
      if (
        langData.linkToSeeMore &&
        !isValidUrl(String(langData.linkToSeeMore))
      ) {
        ElNotification({
          title: 'Error',
          message: `Please enter a valid URL for <strong>Link to see more</strong> in ${langKey} with correct format <strong>(e.g., https://example.com)</strong>`,
          type: 'error',
          duration: 2000,
          dangerouslyUseHTMLString: true,
        });
        if (loadingNotification) loadingNotification.close();
        isSavingOrPublishing.value = false;
        return;
      }
    }

    try {
      const imagesToUpload: { file: File; language: string }[] = [];
      const translations: any[] = [];

      let allowedLanguages = Object.keys(languageFormData);
      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        allowedLanguages = [Language.EN];
        Object.keys(languageFormData).forEach((lang) => {
          if (lang !== Language.EN) {
            delete languageFormData[lang];
          }
        });
        Object.keys(existingImageIds).forEach((lang) => {
          if (lang !== Language.EN) {
            delete existingImageIds[lang];
          }
        });
        Object.keys(existingTranslationIds).forEach((lang) => {
          if (lang !== Language.EN) {
            delete existingTranslationIds[lang];
          }
        });
      }

      for (const langKey of allowedLanguages) {
        const langData = languageFormData[langKey];
        const lang = langKey as Language;
        const title =
          (lang === activeLanguage.value
            ? currentTitle.value
            : langData.title
          )?.trim() || '';
        const content =
          (lang === activeLanguage.value
            ? currentDescription.value
            : langData.description
          )?.trim() || '';
        const linkPreview =
          (lang === activeLanguage.value
            ? currentLinkToSeeMore.value
            : langData.linkToSeeMore
          )?.trim() || '';

        const imageFile =
          lang === activeLanguage.value
            ? currentImageFile.value
            : langData.imageFile;

        if (imageFile) {
          try {
            const { file: compressed, dataUrl } = await compressImage(
              imageFile,
              {
                maxBytes: 10 * 1024 * 1024,
                maxWidth: 2000,
                targetAspectRatio: 2 / 1,
                correctAspectRatio: true,
                keepOriginalFile: true,
              }
            );
            imagesToUpload.push({ file: compressed, language: langKey });
            if (languageFormData[langKey]) {
              languageFormData[langKey].imageUrl = dataUrl;
              if (lang === activeLanguage.value) {
                currentImageUrl.value = dataUrl;
              }
            }
          } catch (e) {
            console.error('Compression failed for', langKey, e);
            throw new Error(
              `Failed to prepare image for ${langKey.toUpperCase()}`
            );
          }
        }

        const hasTitle = title && title.trim() !== '';
        const hasContent = content && content.trim() !== '';
        const hasExistingImage =
          existingImageIds[langKey] && existingImageIds[langKey].trim() !== '';
        const hasNewImage = imageFile !== null;

        const shouldIncludeTranslation =
          hasTitle || hasContent || hasExistingImage || hasNewImage;

        if (!shouldIncludeTranslation) {
          console.log(
            `⏭️ [Save Draft] Skipping empty translation for ${langKey}`
          );
          continue;
        }

        const translationData: any = {
          language: mapLanguageToEnum(langKey),
          title: title,
          content: content,
          linkPreview: linkPreview || undefined,
          image: existingImageIds[langKey] || '',
        };

        if (existingTranslationIds[langKey]) {
          translationData.id = existingTranslationIds[langKey];
        }

        translations.push(translationData);
      }

      if (formData.platform === BakongApp.BAKONG_TOURIST) {
        for (let i = translations.length - 1; i >= 0; i--) {
          if (translations[i].language !== 'EN') {
            translations.splice(i, 1);
          }
        }
      }

      let uploadedImages: {
        language?: string;
        fileId: string;
        mimeType: string;
        originalFileName: string;
      }[] = [];

      if (imagesToUpload.length > 0) {
        try {
          const uploadItems = imagesToUpload.map((item) => ({
            file: item.file,
            language: String(item.language),
          }));

          uploadedImages = await notificationApi.uploadImages(uploadItems);

          uploadedImages.forEach((u) => {
            if (u.language && u.fileId) {
              const langKey = String(u.language);
              existingImageIds[langKey] = u.fileId;

              const transIndex = translations.findIndex(
                (t) => t.language === mapLanguageToEnum(langKey)
              );
              if (transIndex !== -1) {
                translations[transIndex].image = u.fileId;
              }

              if (languageFormData[langKey]) {
                languageFormData[langKey].imageFile = null;
                languageFormData[langKey].imageUrl =
                  `/api/v1/image/${u.fileId}`;
                if (langKey === activeLanguage.value) {
                  currentImageFile.value = null;
                  currentImageUrl.value = `/api/v1/image/${u.fileId}`;
                }
              }
            }
          });
        } catch (error) {
          console.error('Error uploading images during draft save:', error);
          throw new Error('Failed to upload images. Please try again.');
        }
      }

      const useSchedule =
        formData.scheduleEnabled &&
        formData.scheduleDate &&
        formData.scheduleTime;
      const finalSendType = useSchedule
        ? SendType.SEND_SCHEDULE
        : SendType.SEND_NOW;

      const templateData: CreateTemplateRequest = {
        platforms: [mapPlatformToEnum(formData.pushToPlatforms)],
        bakongPlatform: formData.platform,
        sendType: finalSendType,
        isSent: false,
        translations: translations,
        notificationType: mapTypeToNotificationType(formData.notificationType),
        categoryTypeId: formData.categoryTypeId ?? undefined,
        priority: 1,
      };

      if (useSchedule) {
        const scheduleDateTime = DateUtils.parseScheduleDateTime(
          String(formData.scheduleDate),
          String(formData.scheduleTime)
        );
        (templateData as any).sendSchedule = scheduleDateTime.toISOString();
      } else {
        (templateData as any).sendSchedule = null;
      }

      let result;
      for (const t of templateData.translations || []) {
        if (t.linkPreview && !isValidUrl(String(t.linkPreview))) {
          ElNotification({
            title: 'Error',
            message:
              'Please enter a valid URL starting with http:// or https://',
            type: 'error',
            duration: 2000,
          });
          isSavingOrPublishing.value = false;
          return;
        }
      }

      if (isEditMode.value) {
        result = await notificationApi.updateTemplate(
          parseInt(notificationId.value),
          templateData
        );
      } else {
        result = await notificationApi.createTemplate(templateData);
      }

      if (loadingNotification) {
        loadingNotification.close();
      }

      if (!suppressNotifications) {
        ElNotification({
          title: 'Success',
          message: `Notification updated successfully!`,
          type: 'success',
          duration: 3000,
        });
      }

      try {
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
      } catch (e) {
        console.warn('Failed to clear cache:', e);
      }

      let redirectTab: string;
      if (forceDraft) {
        redirectTab = 'draft';
      } else {
        redirectTab = !useSchedule ? 'draft' : 'scheduled';
      }

      if (!suppressNotifications) {
        await new Promise((resolve) => setTimeout(resolve, 500));
      }

      if (isEditMode.value && fromTab.value === 'draft') {
        redirectTab = 'draft';
      }

      if (skipRedirect) {
        return;
      }

      if (isEditMode.value) {
        setTimeout(() => {
          window.location.href = `/?tab=${redirectTab}`;
          isSavingOrPublishing.value = false;
        }, 500);
      } else {
        router.push(`/?tab=${redirectTab}`).then(() => {
          isSavingOrPublishing.value = false;
        });
      }
    } catch (error: any) {
      isSavingOrPublishing.value = false;
      if (loadingNotification) {
        loadingNotification.close();
      }
      console.error('Error saving draft:', error);

      if (!suppressNotifications) {
        ElNotification({
          title: 'Error',
          message:
            error.message ||
            'An unexpected error occurred while saving the draft',
          type: 'error',
          duration: 5000,
        });
      }
    }
  };

  const handleBack = () => {
    const redirectTab = fromTab.value || 'published';
    router.push(`/?tab=${redirectTab}`);
  };

  const handleCancel = () => {
    console.log('🚫 [CANCEL] User clicked Cancel button');
    isDiscarding.value = true;
    const redirectTab = fromTab.value || 'published';
    console.log('🚫 [CANCEL] Redirecting to tab:', redirectTab);
    router.push(`/?tab=${redirectTab}`).finally(() => {
      setTimeout(() => {
        isDiscarding.value = false;
      }, 100);
    });
  };

  const getLeaveDialogMessage = () => {
    if (isReadOnly.value) {
      return 'If you leave now, you will return to the previous page.';
    }
    if (isEditMode.value) {
      return 'If you leave now, any changes you made will be updated. If there are no changes, nothing will be updated.';
    }
    if (hasUnsavedChanges.value) {
      return 'If you leave now, your progress will be saved as a draft. You can resume and complete it anytime.';
    }
    return 'If you leave now, you will return to the previous page.';
  };

  const getLeaveDialogConfirmText = () => {
    if (isReadOnly.value) {
      return 'Leave now';
    }
    if (isEditMode.value) {
      return 'Update and leave';
    }
    if (hasUnsavedChanges.value) {
      return 'Leave and save draft';
    }
    return 'Leave now';
  };

  const handleApprovalFromView = async () => {
    if (!notificationId.value) return;

    try {
      const templateId = parseInt(notificationId.value);

      const fullTemplate = await api.get(`/api/v1/template/${templateId}`);
      const template = fullTemplate.data?.data || fullTemplate.data;

      if (template?.sendSchedule && template?.sendType === 'SEND_SCHEDULE') {
        const scheduledTime = new Date(template.sendSchedule);
        const now = new Date();

        const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

        if (scheduledTime < oneMinuteAgo) {
          console.warn('⏰ [APPROVE] Scheduled time has passed:', {
            scheduledTime: scheduledTime.toISOString(),
            currentTime: now.toISOString(),
            scheduledTimeLocal: scheduledTime.toLocaleString('en-US', {
              timeZone: 'Asia/Phnom_Penh',
            }),
            currentTimeLocal: now.toLocaleString('en-US', {
              timeZone: 'Asia/Phnom_Penh',
            }),
          });
        }
      }

      console.log('📤 [APPROVE] Calling approve API with template:', {
        templateId,
        sendSchedule: template?.sendSchedule,
        sendType: template?.sendType,
        approvalStatus: template?.approvalStatus,
      });

      await notificationApi.approveTemplate(templateId);

      const updatedTemplateResponse = await api.get(
        `/api/v1/template/${templateId}`
      );
      const updatedTemplate =
        updatedTemplateResponse.data?.data || updatedTemplateResponse.data;

      const isScheduled =
        updatedTemplate?.sendType === 'SEND_SCHEDULE' &&
        updatedTemplate?.sendSchedule !== null &&
        updatedTemplate?.sendSchedule !== undefined &&
        updatedTemplate?.isSent === false;

      console.log('🔍 [APPROVE] Determining redirect tab:', {
        sendType: updatedTemplate?.sendType,
        sendSchedule: updatedTemplate?.sendSchedule,
        isSent: updatedTemplate?.isSent,
        isScheduled,
        redirectTab: isScheduled ? 'scheduled' : 'published',
      });

      const redirectTab = isScheduled ? 'scheduled' : 'published';

      const message = isScheduled
        ? '<strong>Notification approved successfully</strong>, It will be sent at the scheduled time and moved to Published tab automatically.'
        : '<strong>Notification approved and published successfully</strong>, Users will receive it shortly.';

      ElNotification({
        title: 'Success',
        message: message,
        type: 'success',
        duration: 3000,
        dangerouslyUseHTMLString: true,
      });

      try {
        localStorage.setItem('notification_active_tab', redirectTab);
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
      } catch (error) {
        console.warn('Failed to update localStorage:', error);
      }

      const cacheBuster = Date.now();
      router.push(`/?tab=${redirectTab}&_refresh=${cacheBuster}`);
    } catch (error: any) {
      console.log('❌ [APPROVE] Error caught in handleApprovalFromView:', {
        error: error,
        response: error.response,
        responseData: error.response?.data,
        status: error.response?.status,
        statusText: error.response?.statusText,
      });

      const errorMessage =
        error.response?.data?.responseMessage || error.message || '';
      const isNoUsersError =
        error.response?.data?.errorCode === 31 || // ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM
        errorMessage.includes('No users found') ||
        errorMessage.includes('no users found') ||
        errorMessage.includes('No users match') ||
        errorMessage.includes('registered users for this platform');

      if (isNoUsersError) {
        ElNotification({
          title: 'Warning',
          message: formatNoUsersFoundRejectionMessage(errorMessage),
          type: 'warning',
          duration: 8000,
          dangerouslyUseHTMLString: true,
        });
        try {
          localStorage.setItem('notification_active_tab', 'draft');
          localStorage.removeItem('notifications_cache');
          localStorage.removeItem('notifications_cache_timestamp');
        } catch (error) {
          console.warn('Failed to update localStorage:', error);
        }
        const cacheBuster = Date.now();
        setTimeout(() => {
          router.push(`/?tab=draft&_refresh=${cacheBuster}`);
        }, 500); // Small delay to ensure notification is seen
        return;
      }

      const isAutoExpired = error.response?.data?.data?.autoExpired === true;
      const isAutoRejected = error.response?.data?.data?.autoRejected === true;
      const expiredReason =
        error.response?.data?.responseMessage ||
        error.response?.data?.data?.expiredReason ||
        'Scheduled time has passed. Please contact team member to update the schedule first.';
      const rejectionReason =
        error.response?.data?.responseMessage ||
        error.response?.data?.data?.rejectionReason ||
        'Failed to approve template';

      console.log('🔍 [APPROVE] Error analysis:', {
        isAutoExpired,
        isAutoRejected,
        expiredReason,
        rejectionReason,
        errorResponseData: error.response?.data,
      });

      if (isAutoExpired) {
        console.log(
          '⏰ [APPROVE] Template auto-expired - redirecting to Draft tab'
        );
        ElNotification({
          title: 'Notification Expired',
          message: `<strong>Scheduled time has expired</strong>. Please contact <strong>team member</strong> to update the schedule first.`,
          type: 'warning',
          duration: 5000,
          dangerouslyUseHTMLString: true,
        });

        try {
          localStorage.setItem('notification_active_tab', 'draft');
          localStorage.removeItem('notifications_cache');
          localStorage.removeItem('notifications_cache_timestamp');
        } catch (error) {
          console.warn('Failed to update localStorage:', error);
        }

        const cacheBuster = Date.now();
        setTimeout(() => {
          console.log(
            '🔄 [APPROVE] Redirecting to Draft tab and refreshing notifications'
          );
          router.push(`/?tab=draft&_refresh=${cacheBuster}`).then(() => {
            window.dispatchEvent(
              new CustomEvent('refresh-notifications', {
                detail: { forceRefresh: true },
              })
            );
          });
        }, 100); // Reduced delay for faster redirect
      } else if (isAutoRejected) {
        ElNotification({
          title: 'Notification Rejected',
          message: rejectionReason,
          type: 'warning',
          duration: 5000,
        });

        try {
          localStorage.setItem('notification_active_tab', 'draft');
          localStorage.removeItem('notifications_cache');
          localStorage.removeItem('notifications_cache_timestamp');
        } catch (error) {
          console.warn('Failed to update localStorage:', error);
        }

        const cacheBuster = Date.now();
        router.push(`/?tab=draft&_refresh=${cacheBuster}`);
      } else {
        ElNotification({
          title: 'Error',
          message: rejectionReason,
          type: 'error',
          duration: 3000,
        });
      }
    }
  };

  const handleRejectFromView = () => {
    showRejectDialog.value = true;
  };

  const handleRejectFromViewConfirm = async (reason?: string) => {
    if (!notificationId.value || !reason) return;

    try {
      const templateId = parseInt(notificationId.value);
      await notificationApi.rejectTemplate(templateId, reason);

      ElNotification({
        title: 'Success',
        message:
          'Template <strong>rejected</strong> successfully and moved to <strong>Draft tab</strong>',
        type: 'success',
        duration: 2000,
        dangerouslyUseHTMLString: true,
      });

      try {
        localStorage.setItem('notification_active_tab', 'draft');
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
      } catch (error) {
        console.warn('Failed to update localStorage:', error);
      }

      const cacheBuster = Date.now();
      router.push(`/?tab=draft&_refresh=${cacheBuster}`);
    } catch (error: any) {
      ElNotification({
        title: 'Error',
        message:
          error.response?.data?.responseMessage || 'Failed to reject template',
        type: 'error',
        duration: 3000,
      });
    }

    showRejectDialog.value = false;
  };

  const handleRejectFromViewCancel = () => {
    showRejectDialog.value = false;
  };

  const handleDiscard = () => {
    isDiscarding.value = true;
    pendingNavigation = null;

    const defaultTab = isEditingPublished.value
      ? 'published'
      : wasScheduled.value
        ? 'scheduled'
        : 'draft';

    const redirectTab =
      fromTab.value || (isEditMode.value ? defaultTab : 'published');

    router.push(`/?tab=${redirectTab}`).finally(() => {
      setTimeout(() => {
        isDiscarding.value = false;
      }, 100);
    });
  };

  const handleConfirmationDialogConfirm = () => {
    showConfirmationDialog.value = false;
    handleSaveDraft(true);
  };

  const handleConfirmationDialogCancel = () => {
    showConfirmationDialog.value = false;
    showLeaveDialog.value = false;
    showUpdateConfirmationDialog.value = false;
    pendingNavigation = null;
    handleDiscard();
  };

  const hasUnsavedChanges = computed(() => {
    const globalFieldsModified =
      formData.platform !== originalFormData.platform ||
      formData.categoryTypeId !== originalFormData.categoryTypeId ||
      formData.pushToPlatforms !== originalFormData.pushToPlatforms;

    if (globalFieldsModified) return true;

    const hasContent = Object.values(languageFormData).some(
      (langData) => langData.title?.trim() || langData.description?.trim()
    );

    const hasImage = Object.values(languageFormData).some(
      (langData) => langData.imageFile || langData.imageUrl
    );

    const hasExistingImage = Object.values(existingImageIds).some(
      (id) => id !== null
    );

    if (isEditMode.value) {
      for (const langKey of Object.keys(languageFormData)) {
        const originalData = originalLanguageFormData[langKey];
        const currentData = languageFormData[langKey];

        if (!originalData) continue;

        const titleChanged =
          (currentData?.title?.trim() || '') !==
          (originalData?.title?.trim() || '');
        const descriptionChanged =
          (currentData?.description?.trim() || '') !==
          (originalData?.description?.trim() || '');
        const linkChanged =
          (currentData?.linkToSeeMore?.trim() || '') !==
          (originalData?.linkToSeeMore?.trim() || '');
        const imageChanged =
          currentData?.imageFile !== null ||
          existingImageIds[langKey] !== originalImageIds[langKey];

        if (titleChanged || descriptionChanged || linkChanged || imageChanged)
          return true;
      }
    }

    return hasContent || hasImage || hasExistingImage;
  });

  onBeforeRouteLeave((to, from, next) => {
    if (isReadOnly.value) {
      next();
      return;
    }

    if (isSavingOrPublishing.value) {
      next();
      return;
    }

    if (isDiscarding.value) {
      next();
      return;
    }

    if (!hasUnsavedChanges.value) {
      next();
      return;
    }

    showLeaveDialog.value = true;
    pendingNavigation = () => next();

    next(false);
  });

  const handleLeaveDialogConfirm = async () => {
    showLeaveDialog.value = false;
    pendingNavigation = null;

    if (
      isEditingPublished.value ||
      fromTab.value === 'scheduled' ||
      wasScheduled.value
    ) {
      await handlePublishNowInternal();
    } else {
      await handleSaveDraft(true);
    }
  };

  const handleLeaveDialogCancel = () => {
    showLeaveDialog.value = false;
    pendingNavigation = null;
  };

  const handleUpdateConfirmationConfirm = async () => {
    showUpdateConfirmationDialog.value = false;
    await handlePublishNowInternal();
  };

  const handleUpdateConfirmationCancel = () => {
    showUpdateConfirmationDialog.value = false;
    isSavingOrPublishing.value = false;

    const defaultTab = isEditingPublished.value
      ? 'published'
      : wasScheduled.value
        ? 'scheduled'
        : 'draft';

    const redirectTab = fromTab.value || defaultTab;
    if (isEditMode.value) {
      setTimeout(() => {
        window.location.href = `/?tab=${redirectTab}`;
      }, 100);
    } else {
      router.push(`/?tab=${redirectTab}`);
    }
  };

  const formatBakongApp = (app: BakongApp | undefined): string => {
    if (!app) return 'Bakong';
    switch (app) {
      case BakongApp.BAKONG:
        return 'Bakong';
      case BakongApp.BAKONG_TOURIST:
        return 'Bakong Tourist';
      case BakongApp.BAKONG_JUNIOR:
        return 'Bakong Junior';
      default:
        return String(app);
    }
  };
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
    gap: 214px;
    padding: 0;
    overflow: hidden;
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .create-notification-container::-webkit-scrollbar {
    display: none;
  }

  .main-content {
    flex: 1;
    max-width: 603px;
    padding: 0px;
    left: 231px;
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
    padding: 16px 12px;
    border: 1px solid var(--surface-main-surface-secondary-bold, #0013461a);
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
    box-shadow: none;
  }

  /* Disabled field styles - gray appearance */
  .form-input:disabled,
  .form-input-title:disabled,
  .form-input-number:disabled,
  .form-input-link:disabled,
  .form-select:disabled,
  .form-textarea:disabled {
    background-color: #f3f4f6 !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
  }

  .form-input[readonly],
  .form-input-title[readonly],
  .form-input-link[readonly],
  .form-textarea[readonly] {
    background-color: #f3f4f6 !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
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

  /* Disabled dropdown styles */
  .custom-dropdown.is-disabled .dropdown-trigger,
  .custom-dropdown:disabled .dropdown-trigger {
    background-color: #f3f4f6 !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    border-color: #d1d5db !important;
  }

  .custom-dropdown.is-disabled .dropdown-trigger:hover,
  .custom-dropdown:disabled .dropdown-trigger:hover {
    border-color: #d1d5db !important;
  }

  .custom-dropdown.is-disabled .dropdown-icon,
  .custom-dropdown:disabled .dropdown-icon {
    color: #9ca3af !important;
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

  input:checked + .toggle-slider {
    background-color: #0f4aea;
  }

  input:checked + .toggle-slider:before {
    transform: translateX(20px);
  }

  /* Disabled toggle switch styles */
  .toggle-switch input:disabled + .toggle-slider {
    background-color: #d1d5db !important;
    cursor: not-allowed !important;
    opacity: 0.6;
  }

  .toggle-switch input:disabled + .toggle-slider:before {
    background-color: #f3f4f6 !important;
  }

  .toggle-switch input:disabled:checked + .toggle-slider {
    background-color: #9ca3af !important;
    opacity: 0.6;
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

  /* Disabled styles for Element Plus date/time pickers */
  .schedule-date-picker.is-disabled :deep(.el-input__wrapper),
  .schedule-time-picker.is-disabled :deep(.el-input__wrapper) {
    background-color: #f3f4f6 !important;
    border-color: #d1d5db !important;
    cursor: not-allowed !important;
    opacity: 0.6;
  }

  .schedule-date-picker.is-disabled :deep(.el-input__inner),
  .schedule-time-picker.is-disabled :deep(.el-input__inner) {
    color: #6b7280 !important;
    cursor: not-allowed !important;
  }

  /* Element Plus disabled state */
  .el-date-editor.is-disabled,
  .el-time-picker.is-disabled {
    opacity: 0.6;
  }

  .el-date-editor.is-disabled :deep(.el-input__wrapper),
  .el-time-picker.is-disabled :deep(.el-input__wrapper) {
    background-color: #f3f4f6 !important;
    border-color: #d1d5db !important;
    cursor: not-allowed !important;
  }

  .el-date-editor.is-disabled :deep(.el-input__inner),
  .el-time-picker.is-disabled :deep(.el-input__inner) {
    color: #6b7280 !important;
    cursor: not-allowed !important;
  }

  .flash-input-wrapper {
    position: relative;
    width: 281.5px;
    height: 56px;
  }

  /* Disabled field styles for restricted fields */
  .custom-dropdown:has(.el-dropdown.is-disabled),
  .custom-dropdown .el-dropdown.is-disabled,
  .custom-dropdown.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
    pointer-events: none !important;
  }

  .custom-dropdown .dropdown-trigger:has([disabled]),
  .custom-dropdown.is-disabled .dropdown-trigger,
  .custom-dropdown[disabled] .dropdown-trigger {
    background-color: #f3f4f6 !important;
    color: #9ca3af !important;
    cursor: not-allowed !important;
    pointer-events: none !important;
  }

  /* Prevent dropdown menu from showing when disabled */
  .el-dropdown.is-disabled,
  .el-dropdown.is-disabled .el-dropdown__caret-button,
  .el-dropdown.is-disabled .dropdown-trigger,
  .custom-dropdown.is-disabled .el-dropdown,
  .custom-dropdown[disabled] .el-dropdown {
    pointer-events: none !important;
    cursor: not-allowed !important;
  }

  /* Additional protection - prevent click events on disabled dropdowns */
  .custom-dropdown.is-disabled *,
  .custom-dropdown[disabled] * {
    pointer-events: none !important;
  }

  .schedule-date-picker.is-disabled,
  .schedule-time-picker.is-disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  .toggle-switch input:disabled + .toggle-slider {
    opacity: 0.5;
    cursor: not-allowed;
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

  .flash-number-input.is-disabled + .flash-dropdown-icon,
  .flash-input-wrapper .flash-number-input.is-disabled ~ .flash-dropdown-icon {
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

  /* .schedule-date-picker .el-input__wrapper,
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
} */

  .schedule-date-picker .el-input__wrapper,
  .schedule-time-picker .el-input__wrapper {
    height: 56px !important;
    padding: 16px 12px !important;
    border-radius: 8px !important;
    border: 1px solid var(--surface-main-surface-secondary-bold, #0013461a) !important;
    box-shadow: none !important;
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

  .reject-reason-container {
    flex-shrink: 0;
    max-height: 200px;
    overflow-y: auto;
  }

  .reject-reason-header {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .reject-reason-icon {
    color: #e42323;
    font-size: 18px;
  }

  .reject-reason-label {
    font-size: 14px;
    font-weight: 600;
    color: #e42323;
  }

  .reject-reason-text {
    font-weight: 600;
    /* color: #333; */
    color: #e42323;
    word-wrap: break-word;
    display: inline;
  }

  .reject-reason-textarea {
    min-height: 50px;
  }

  .reject-reason-textarea :deep(.el-textarea__inner) {
    min-height: 50px;
    resize: vertical;
    cursor: ns-resize;
    font-size: 14px;
    line-height: 1.5;
    color: #333;
    background-color: #fef2f2;
    border: 1px solid #fecaca;
    border-radius: 4px;
    padding: 8px 12px;
  }

  .reject-reason-textarea :deep(.el-textarea__inner):hover {
    border-color: #fca5a5;
  }

  .reject-reason-textarea :deep(.el-textarea__inner):focus {
    border-color: #e42323;
    outline: none;
  }

  .expired-time-container .reject-reason-header {
    gap: 10px;
  }

  .expired-time-container .reject-reason-icon {
    color: #e0ab0e;
    font-size: 18px;
  }

  .expired-time-container .reject-reason-label {
    color: #e0ab0e;
    font-size: 14px;
    font-weight: 600;
    line-height: 1.5;
  }

  .expired-time-container .reject-reason-text {
    font-weight: 600;
    color: #e0ab0e;
    word-wrap: break-word;
    display: inline;
  }

  .expired-time-container .reject-reason-text strong {
    font-weight: 800;
    color: #e0ab0e;
  }
</style>
