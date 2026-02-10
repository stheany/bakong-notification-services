<template>
  <div class="w-full h-full min-h-0">
    <div class="h-full min-h-0 flex flex-col">
      <div class="flex items-center justify-between h-14 flex-shrink-0">
        <div class="flex items-center gap-6">
          <div class="text-[23px] font-semibold leading-none text-slate-900">
            {{ currentMonthYear }}
          </div>

          <div class="inline-flex items-center h-10 gap-4">
            <button
              type="button"
              @click="goToPreviousWeek"
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200"
            >
              <el-icon class="text-[#0B1A46] text-2xl">
                <ArrowLeft />
              </el-icon>
            </button>

            <span class="text-[16px] font-semibold leading-none text-slate-900">
              {{ weekLabel }}
            </span>

            <button
              type="button"
              @click="goToNextWeek"
              class="w-10 h-10 flex items-center justify-center rounded-full hover:bg-slate-100 active:bg-slate-200"
            >
              <el-icon class="text-[#0B1A46] text-2xl">
                <ArrowRight />
              </el-icon>
            </button>
          </div>
        </div>

        <el-select
          v-model="selectedPlatform"
          class="platform-select"
          size="large"
          placeholder="BAKONG"
          popper-class="platform-popper"
        >
          <el-option label="BAKONG" :value="BakongApp.BAKONG" />
          <el-option label="BAKONG TOURIST" :value="BakongApp.BAKONG_TOURIST" />
          <el-option label="BAKONG JUNIOR" :value="BakongApp.BAKONG_JUNIOR" />
        </el-select>
      </div>

      <div class="h-[23px] flex-shrink-0" />

      <div class="flex-1 min-h-0" style="padding-bottom: 20px">
        <div
          class="h-full flex flex-col bg-white border border-[rgba(0,19,70,0.1)]"
        >
          <div v-if="loading" class="flex items-center justify-center h-full">
            <div class="text-slate-500">Loading notifications...</div>
          </div>

          <div
            v-else-if="error"
            class="flex items-center justify-center h-full"
          >
            <div class="text-red-500">Error: {{ error }}</div>
          </div>

          <template v-else>
            <div
              class="grid grid-cols-7 h-16 flex-shrink-0 border-b border-[rgba(0,19,70,0.1)]"
            >
              <div
                v-for="(day, idx) in weekDays"
                :key="day.date.toISOString() + '-h'"
                class="flex items-center justify-center text-[16px] font-normal text-black border-l border-[rgba(0,19,70,0.1)]"
                :class="idx === 0 ? 'border-l-0' : ''"
              >
                {{ day.label }}
              </div>
            </div>

            <div class="flex-1 min-h-0 overflow-hidden">
              <div
                class="calendar-columns grid grid-cols-7 h-full overflow-hidden"
              >
                <div
                  v-for="(day, idx) in weekDays"
                  :key="day.date.toISOString()"
                  class="calendar-column min-w-0 min-h-0 h-full p-2 flex flex-col gap-3 border-l border-[rgba(0,19,70,0.1)] overflow-y-auto overflow-x-hidden"
                  :class="idx === 0 ? 'border-l-0' : ''"
                >
                  <ScheduleNotificationCard
                    :notifications-for-day="getNotificationsForDay(day.date)"
                    :user-role="authStore.user?.role"
                    @send-now="handleSendNow"
                    @approve="handleApproval"
                    @approve-navigate="handleApprovalNavigate"
                  />

                  <div style="padding-bottom: 20px"></div>
                </div>
              </div>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, watch, onMounted } from 'vue';
  import { useRouter } from 'vue-router';
  import { ElNotification } from 'element-plus';
  import { ArrowLeft, ArrowRight } from '@element-plus/icons-vue';
  import type { Notification } from '@/services/notificationApi';
  import { notificationApi } from '@/services/notificationApi';
  import { api } from '@/services/api';
  import ScheduleNotificationCard from '@/components/common/ScheduleNotificationCard.vue';
  import { ErrorCode } from '@bakong/shared';
  import { useAuthStore } from '@/stores/auth';
  import {
    BakongApp,
    SendType,
    Platform,
    getNotificationMessage,
    getFormattedPlatformName,
    getNoUsersAvailableMessage,
  } from '@/utils/helpers';

  const router = useRouter();
  const authStore = useAuthStore();

  const handleSendNow = async (notification: Notification) => {
    const loadingNotification = ElNotification({
      title: 'Sending Notification',
      message:
        'Please wait while we send the notification to all users. This may take a moment if there are many recipients...',
      type: 'info',
      duration: 0,
    });

    try {
      const templateId = notification.templateId || notification.id;
      const notificationId =
        typeof templateId === 'number'
          ? templateId
          : parseInt(String(templateId));

      if (isNaN(notificationId)) {
        throw new Error('Invalid template ID');
      }

      const fullTemplate = await api.get(`/api/v1/template/${notificationId}`);
      const template = fullTemplate.data?.data || fullTemplate.data;

      const isAlreadySent =
        template?.isSent === true || notification.isSent === true;

      if (isAlreadySent) {
        loadingNotification.close();
        ElNotification({
          title: 'Info',
          message: 'This notification has already been sent to users.',
          type: 'info',
          duration: 3000,
        });
        await fetchNotifications();
        return;
      }

      const translations = template?.translations || [];
      let hasValidData = false;

      for (const translation of translations) {
        const hasTitle = translation?.title && translation.title.trim() !== '';
        const hasContent =
          translation?.content && translation.content.trim() !== '';

        if (hasTitle && hasContent) {
          hasValidData = true;
          break;
        }
      }

      if (!hasValidData) {
        loadingNotification.close();
        ElNotification({
          title: 'Error',
          message:
            'This record cannot be sent. Please review the title and content and try again.',
          type: 'error',
          duration: 4000,
        });
        return;
      }

      const updatePayload: any = {
        isSent: true,
        sendType: SendType.SEND_NOW,
        sendSchedule: null,
        platforms: template?.platforms || [],
        bakongPlatform: template?.bakongPlatform,
        notificationType: template?.notificationType,
        categoryTypeId: template?.categoryTypeId,
        translations:
          template?.translations?.map((t: any) => ({
            language: t.language,
            title: t.title,
            content: t.content,
            image: t.image?.fileId || t.imageId || t.image?.id || '',
            linkPreview: t.linkPreview || undefined,
          })) || [],
      };

      const result = await notificationApi.updateTemplate(
        notificationId,
        updatePayload
      );

      loadingNotification.close();

      if (result?.responseCode !== 0 || result?.errorCode !== 0) {
        const errorMessage =
          result?.responseMessage ||
          result?.message ||
          'Failed to publish notification';
        const errorCode = result?.errorCode;

        if (
          errorCode === ErrorCode.NO_PERMISSION &&
          errorMessage.includes('Template must be approved')
        ) {
          const canApprove = authStore.isAdmin || authStore.isApproval;

          ElNotification({
            title: 'Approval Required',
            message: canApprove
              ? `This notification requires approval before sending. You can approve it from the Pending tab.`
              : `This notification requires approval before sending. Please wait for an administrator to approve it.`,
            type: 'warning',
            duration: 5000,
            dangerouslyUseHTMLString: true,
          });

          await fetchNotifications();
          return;
        }

        const platformName = getFormattedPlatformName({
          platformName: result?.data?.platformName,
          bakongPlatform: result?.data?.bakongPlatform,
          notification: notification as any,
        });

        ElNotification({
          title: 'Info',
          message: errorMessage.includes('No users found')
            ? getNoUsersAvailableMessage(platformName)
            : errorMessage,
          type: 'info',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });
        await fetchNotifications();
        return;
      }

      const responseData = result?.data?.data || result?.data || result;
      const successfulCount = responseData?.successfulCount || 0;
      const failedCount = responseData?.failedCount || 0;
      const isSent = responseData?.isSent === true;
      const approvalStatus = responseData?.approvalStatus;

      if (isSent || approvalStatus === 'APPROVED') {
        if (successfulCount > 0) {
          ElNotification({
            title: 'Success',
            message: `<strong>Notification published and sent to ${successfulCount} user(s) immediately.</strong>${failedCount > 0 ? ` (${failedCount} failed)` : ''} please wait for a moment to see the notification on the user's device.`,
            type: 'success',
            duration: 3000,
          });
        } else {
          ElNotification({
            title: 'Success',
            message:
              "<strong>Notification published successfully.</strong> please wait for a moment to see the notification on the user's device.",
            type: 'success',
            duration: 3000,
          });
        }
      } else {
        const verifyTemplate = await api.get(
          `/api/v1/template/${notificationId}`
        );
        const verifiedData = verifyTemplate.data?.data || verifyTemplate.data;

        if (
          verifiedData?.isSent === true ||
          verifiedData?.approvalStatus === 'APPROVED'
        ) {
          ElNotification({
            title: 'Success',
            message: `<strong>Notification published and sent to users immediately.</strong> please wait for a moment to see the notification on the user's device.`,
            type: 'success',
            duration: 3000,
          });
        } else {
          ElNotification({
            title: 'Warning',
            message:
              '<strong>Notification was updated but may not have been sent.</strong>',
            type: 'warning',
            duration: 5000,
          });
        }
      }

      await fetchNotifications();

      currentWeekStart.value = new Date();

      try {
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
      } catch (error) {
        // [console.warn removed]
      }
    } catch (err: any) {
      loadingNotification.close();

      // [console.error removed]
      const errorMsg =
        err.response?.data?.responseMessage ||
        err.response?.data?.message ||
        err.message ||
        'Failed to publish notification';

      ElNotification({
        title: 'Error',
        message: errorMsg,
        type: 'error',
        duration: 5000,
      });

      await fetchNotifications();
    }
  };

  const handleApprovalNavigate = async (notification: Notification) => {
    try {
      const templateId = notification.templateId || notification.id;
      const viewId = templateId;

      if (
        notification.sendType === 'SEND_SCHEDULE' &&
        (notification as any).scheduledTime
      ) {
        try {
          const fullTemplateResponse = await api.get(
            `/api/v1/template/${templateId}`
          );
          const template =
            fullTemplateResponse.data?.data || fullTemplateResponse.data;

          if (template?.sendSchedule) {
            const scheduledTime = new Date(template.sendSchedule);
            const now = new Date();

            const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
            if (scheduledTime < oneMinuteAgo) {
              // [console.warn removed]

              try {
                await notificationApi.approveTemplate(Number(templateId));
              } catch (error: any) {
                const isAutoExpired =
                  error.response?.data?.data?.autoExpired === true;
                const expiredReason =
                  error.response?.data?.responseMessage ||
                  error.response?.data?.data?.expiredReason ||
                  'Scheduled time has passed. Please contact team member to update the schedule first.';

                if (isAutoExpired) {
                  ElNotification({
                    title: 'Notification Expired',
                    message: `<strong>Scheduled time has expired</strong>. Please contact <strong>team member</strong> to update the schedule first.`,
                    type: 'warning',
                    duration: 5000,
                    dangerouslyUseHTMLString: true,
                  });

                  await fetchNotifications();
                  return;
                } else {
                  // [console.error removed]
                  ElNotification({
                    title: 'Error',
                    message:
                      'Failed to process expired notification. Please try again.',
                    type: 'error',
                    duration: 5000,
                  });
                  await fetchNotifications();
                  return;
                }
              }
            } else {
              router.push(`/notifications/view/${viewId}?fromTab=schedule`);
            }
          } else {
            router.push(`/notifications/view/${viewId}?fromTab=schedule`);
          }
        } catch (error) {
          // [console.error removed]
          router.push(`/notifications/view/${viewId}?fromTab=schedule`);
        }
      } else {
        router.push(`/notifications/view/${viewId}?fromTab=schedule`);
      }
    } catch (err: any) {
      // [console.error removed]
      ElNotification({
        title: 'Error',
        message: 'Failed to navigate to approval page. Please try again.',
        type: 'error',
        duration: 5000,
      });
    }
  };

  const handleApproval = async (notification: Notification) => {
    try {
      const notificationId =
        typeof notification.id === 'number'
          ? notification.id
          : parseInt(String(notification.id));
      if (isNaN(notificationId)) {
        throw new Error('Invalid template ID');
      }

      const templateId = notification.templateId || notificationId;

      const loadingNotification = ElNotification({
        title: 'Approving Notification',
        message: 'Please wait while we approve the notification...',
        type: 'info',
        duration: 0,
      });

      try {
        const { notificationApi } = await import('@/services/notificationApi');
        const result = await notificationApi.approveTemplate(
          Number(templateId)
        );

        const { api } = await import('@/services/api');
        const updatedTemplateResponse = await api.get(
          `/api/v1/template/${templateId}`
        );
        const updatedTemplate =
          updatedTemplateResponse.data?.data || updatedTemplateResponse.data;

        const isScheduled =
          (updatedTemplate?.sendType === 'SEND_SCHEDULE' ||
            updatedTemplate?.sendSchedule !== null) &&
          updatedTemplate?.isSent === false;

        const message = isScheduled
          ? '<strong>Notification approved successfully!</strong> It will be sent at the scheduled time and moved to Published tab automatically.'
          : '<strong>Notification approved and published successfully!</strong> Users will receive it shortly.';

        loadingNotification.close();

        ElNotification({
          title: 'Success',
          message: message,
          type: 'success',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });

        await fetchNotifications();

        try {
          localStorage.removeItem('notifications_cache');
          localStorage.removeItem('notifications_cache_timestamp');
        } catch (error) {
          // [console.warn removed]
        }
      } catch (error: any) {
        loadingNotification.close();

        const isAutoExpired = error.response?.data?.data?.autoExpired === true;
        const expiredReason =
          error.response?.data?.responseMessage ||
          error.response?.data?.data?.expiredReason ||
          'Scheduled time has passed. Please contact team member to update the schedule first.';

        if (isAutoExpired) {
          ElNotification({
            title: 'Notification Expired',
            message: `<strong>Scheduled time has expired</strong>. Please contact <strong>team member</strong> to update the schedule first.`,
            type: 'warning',
            duration: 5000,
            dangerouslyUseHTMLString: true,
          });
        } else {
          const errorMsg =
            error.response?.data?.responseMessage ||
            error.response?.data?.message ||
            error.message ||
            'Failed to approve notification';

          ElNotification({
            title: 'Error',
            message: errorMsg,
            type: 'error',
            duration: 5000,
          });
        }

        await fetchNotifications();
      }
    } catch (err: any) {
      // [console.error removed]
      const errorMsg =
        err.response?.data?.responseMessage ||
        err.response?.data?.message ||
        err.message ||
        'Failed to approve notification';

      ElNotification({
        title: 'Error',
        message: errorMsg,
        type: 'error',
        duration: 5000,
      });
    }
  };

  const selectedPlatform = ref<BakongApp>(BakongApp.BAKONG);
  const notifications = ref<Notification[]>([]);
  const loading = ref(false);
  const error = ref<string | null>(null);

  const currentWeekStart = ref<Date>(new Date());

  const weekDays = computed(() => {
    const start = new Date(currentWeekStart.value);
    const monday = new Date(start);
    const day = start.getDay();
    const diff = (day + 6) % 7;
    monday.setDate(start.getDate() - diff);

    return Array.from({ length: 7 }, (_, i) => {
      const date = new Date(monday);
      date.setDate(monday.getDate() + i);
      const dayName = date.toLocaleDateString('en-US', { weekday: 'short' });
      return { date, label: `${dayName} ${date.getDate()}` };
    });
  });

  const currentMonthYear = computed(() => {
    const date = currentWeekStart.value;
    return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' });
  });

  const weekLabel = computed(() => {
    const d = currentWeekStart.value;
    const firstDay = new Date(d.getFullYear(), d.getMonth(), 1);
    const pastDays = Math.floor((d.getTime() - firstDay.getTime()) / 86400000);
    const weekNumber = Math.ceil((pastDays + firstDay.getDay() + 1) / 7);
    return `Week ${weekNumber}`;
  });

  const goToPreviousWeek = () => {
    const newDate = new Date(currentWeekStart.value);
    newDate.setDate(newDate.getDate() - 7);
    currentWeekStart.value = newDate;
  };

  const goToNextWeek = () => {
    const newDate = new Date(currentWeekStart.value);
    newDate.setDate(newDate.getDate() + 7);
    currentWeekStart.value = newDate;
  };

  const formatDateForComparison = (date: Date) => {
    const y = date.getFullYear();
    const m = String(date.getMonth() + 1).padStart(2, '0');
    const d = String(date.getDate()).padStart(2, '0');
    return `${y}-${m}-${d}`;
  };

  const getNotificationsForDay = (date: Date): Notification[] => {
    const dateStr = formatDateForComparison(date);
    return notifications.value.filter((n) => {
      const raw =
        (n as any).sendSchedule ||
        (n as any).templateStartAt ||
        (n as any).date;
      if (!raw) return false;

      try {
        const scheduleDate = new Date(raw);
        if (isNaN(scheduleDate.getTime())) return false;
        const dateMatches = formatDateForComparison(scheduleDate) === dateStr;
        if (!dateMatches) return false;
      } catch (error) {
        return false;
      }

      if (!selectedPlatform.value) return true;

      const notificationPlatform = (n as any).bakongPlatform;
      if (!notificationPlatform) return false;

      const normalizedNotificationPlatform = String(notificationPlatform)
        .toUpperCase()
        .trim();
      const normalizedSelectedPlatform = String(selectedPlatform.value)
        .toUpperCase()
        .trim();

      return normalizedNotificationPlatform === normalizedSelectedPlatform;
    });
  };

  const fetchNotifications = async () => {
    loading.value = true;
    error.value = null;

    try {
      const rawTemplatesResponse = await api.get('/api/v1/template/all');
      const rawTemplatesMap = new Map<number, any>();

      const rawTemplatesData =
        rawTemplatesResponse.data?.data || rawTemplatesResponse.data;
      if (Array.isArray(rawTemplatesData)) {
        rawTemplatesData.forEach((template: any) => {
          const id = template.templateId || template.id;
          rawTemplatesMap.set(id, template);
        });
      }

      const notificationResponse = await notificationApi.getAllNotifications({
        page: 1,
        pageSize: 1000,
        language: 'KM',
      });

      const filteredNotifications = notificationResponse.data.filter((n) => {
        const status = n.status?.toLowerCase();
        const approvalStatus = (n as any).approvalStatus;
        const templateId = Number(n.templateId || n.id);
        const rawTemplate = rawTemplatesMap.get(templateId);

        if (status === 'published' || n.isSent === true) {
          return true;
        }

        if (
          status === 'scheduled' &&
          (approvalStatus === 'APPROVED' || !approvalStatus)
        ) {
          return true;
        }

        if (approvalStatus === 'PENDING') {
          if (rawTemplate?.sendSchedule) {
            return true;
          }
          if (n.createdAt || (n as any).updatedAt) {
            return true;
          }
        }

        return false;
      });

      const mappedNotifications = filteredNotifications.map((n) => {
        let normalizedStatus = n.status?.toUpperCase();
        if (normalizedStatus === 'PUBLISHED') {
          normalizedStatus = 'SENT';
        } else if (normalizedStatus === 'SCHEDULED') {
          normalizedStatus = 'SCHEDULED';
        } else if (normalizedStatus === 'PENDING') {
          normalizedStatus = 'PENDING';
        }

        const templateId = Number(n.templateId || n.id);
        const rawTemplate = rawTemplatesMap.get(templateId);

        let displayDate: string | Date | undefined;

        if (rawTemplate?.sendSchedule) {
          displayDate = rawTemplate.sendSchedule;
        } else if (n.sendSchedule) {
          displayDate = n.sendSchedule;
        } else if (
          normalizedStatus === 'SENT' ||
          n.isSent ||
          normalizedStatus === 'PUBLISHED'
        ) {
          displayDate = (n as any).updatedAt || n.createdAt;
        } else if (normalizedStatus === 'PENDING') {
          displayDate = (n as any).updatedAt || n.createdAt;
        } else if (rawTemplate?.templateStartAt) {
          displayDate = rawTemplate.templateStartAt;
        } else {
          displayDate = n.createdAt;
        }

        const finalDisplayDate =
          displayDate instanceof Date ? displayDate.toISOString() : displayDate;

        const formatTimeFromDate = (
          date: Date | string | null | undefined
        ): string | null => {
          if (!date) return null;
          try {
            const d = date instanceof Date ? date : new Date(date);
            if (isNaN(d.getTime())) return null;
            const hh = String(d.getHours()).padStart(2, '0');
            const mm = String(d.getMinutes()).padStart(2, '0');
            return `${hh}:${mm}`;
          } catch {
            return null;
          }
        };

        return {
          ...n,
          status: normalizedStatus,
          sendSchedule: finalDisplayDate as string,
          templateStartAt:
            rawTemplate?.templateStartAt instanceof Date
              ? rawTemplate.templateStartAt.toISOString()
              : rawTemplate?.templateStartAt,
          templateEndAt:
            rawTemplate?.templateEndAt instanceof Date
              ? rawTemplate.templateEndAt.toISOString()
              : rawTemplate?.templateEndAt,
          scheduledTime:
            (n as any).scheduledTime || formatTimeFromDate(finalDisplayDate),
          description: n.description || n.content || '',
          bakongPlatform:
            (n as any).bakongPlatform ||
            rawTemplate?.bakongPlatform ||
            undefined,
          approvalStatus:
            (n as any).approvalStatus ||
            rawTemplate?.approvalStatus ||
            undefined,
        } as Notification;
      });

      notifications.value = mappedNotifications;
    } catch (err: any) {
      // [console.error removed]
      error.value =
        err.response?.data?.message ||
        err.message ||
        'Failed to load notifications';
      notifications.value = [];
    } finally {
      loading.value = false;
    }
  };

  watch(currentWeekStart, () => {
    fetchNotifications();
  });

  watch(selectedPlatform, () => {});

  onMounted(() => {
    fetchNotifications();
  });
</script>

<style scoped>
  .platform-select {
    width: 202px;
  }

  .platform-select :deep(.el-select__wrapper) {
    height: 56px;
    border-radius: 8px;
    padding: 16px 12px;
    border: 1px solid rgba(0, 19, 70, 0.1);
    box-shadow: none !important;
    background: #fff;
  }

  .platform-select :deep(.el-select__placeholder),
  .platform-select :deep(.el-select__selected-item) {
    font-size: 16px;
    font-weight: 400;
    color: rgba(0, 19, 70, 0.4);
    line-height: 150%;
  }

  .platform-select :deep(.el-select__caret) {
    font-size: 28px;
    color: #0b1a46;
  }

  .platform-popper {
    min-width: 202px !important;
  }

  .calendar-column {
    scrollbar-width: none;
    -ms-overflow-style: none;
  }

  .calendar-column::-webkit-scrollbar {
    display: none;
  }
</style>
