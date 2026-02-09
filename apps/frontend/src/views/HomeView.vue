<template>
  <div class="home-page">
    <div class="main-content">
      <Tabs
        v-model="activeTab"
        :tabs="filterTabs"
        @tab-changed="handleTabChanged"
      />
      <div class="search-filter-bar">
        <div class="filter-dropdown">
          <el-select
            v-model="selectedFilter"
            placeholder="ALL"
            size="large"
            class="filter-select"
          >
            <el-option
              v-for="option in filterOptions"
              :key="option.value"
              :label="option.label"
              :value="option.value"
            />
          </el-select>
        </div>
        <div class="search-input">
          <el-input
            v-model="searchQuery"
            placeholder="search by title or description"
            class="search-field"
            size="large"
          >
            <template #suffix>
              <el-icon class="search-icon">
                <Search />
              </el-icon>
            </template>
          </el-input>
        </div>
        <div class="date-range">
          <el-date-picker
            v-model="dateRange"
            type="daterange"
            unlink-panels
            :shortcuts="shortcuts"
            :editable="false"
            :clearable="false"
            :teleported="false"
            popper-class="range-popper"
            ref="pickerRef"
            class="date-picker"
          >
            <template #trigger>
              <div class="custom-date-range">
                <span class="date-text">
                  {{ selectedLabel }} ({{ formattedRange }})
                </span>
                <div class="calendar-icon-container">
                  <el-icon>
                    <Calendar />
                  </el-icon>
                </div>
              </div>
            </template>
          </el-date-picker>
        </div>
      </div>
      <div class="notifications-grid">
        <div class="notification-cards-container">
          <div v-if="loading" class="loading-container">
            <div class="loading-spinner">Loading notifications...</div>
          </div>
          <div
            v-else-if="filteredNotifications.length === 0 || fetchError"
            class="empty-state"
          >
            <div class="empty-state-container">
              <img
                :src="emptyStateImage"
                alt="Empty State"
                class="image-empty-state"
              />
              <div class="empty-message text-center text-gray-500 text-sm">
                Jom Reab Sur, it is empty!
              </div>
            </div>
          </div>
          <NotificationCard
            v-else
            :active-tab="activeTab"
            :notifications="filteredNotifications"
            :loading="loading"
            @refresh="
              (forceRefresh) => fetchNotifications(forceRefresh || false)
            "
            @delete="handleDeleteNotification"
            @publish="handlePublishNotification"
            @switch-tab="handleSwitchTab"
            @update-notification="handleUpdateNotification"
          />
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed, onMounted, onUnmounted, watch } from 'vue';
  import { useRoute } from 'vue-router';
  import dayjs from 'dayjs';
  import { Search, Calendar } from '@element-plus/icons-vue';
  import NotificationCard from '@/components/common/NotificationCard.vue';
  import { Tabs } from '@/components/common';
  import { notificationApi } from '@/services/notificationApi';
  import type { Notification } from '@/types/notification';
  import { ElNotification } from 'element-plus';
  import emptyStateImage from '@/assets/image/jomreadsur.png';
  import {
    NotificationType,
    SendType,
    Platform,
    formatNotificationType,
    formatBakongApp,
    getFormattedPlatformName,
    getNoUsersAvailableMessage,
    getNotificationMessage,
    formatPlatform,
  } from '@/utils/helpers';
  import { DateUtils, ErrorCode } from '@bakong/shared';
  import { mapBackendStatusToFrontend } from '../utils/helpers';
  import { api } from '@/services/api';
  import { useAuthStore } from '@/stores/auth';

  const route = useRoute();
  const authStore = useAuthStore();

  const correctNotificationStatus = (
    notification: Notification
  ): Notification => {
    let status = notification.status;

    if (
      notification.isSent === true &&
      notification.approvalStatus !== 'REJECTED' &&
      notification.approvalStatus !== 'EXPIRED'
    ) {
      status = 'published';
    }

    if (
      (notification.approvalStatus === 'REJECTED' ||
        notification.approvalStatus === 'EXPIRED') &&
      (status === 'published' || status === 'scheduled')
    ) {
      status = 'draft';
    }

    if (
      status === 'scheduled' &&
      (notification.approvalStatus === null ||
        notification.approvalStatus === undefined)
    ) {
      status = 'draft';
    }
    return {
      ...notification,
      status: status,
    };
  };

  const getStoredTab = (): 'published' | 'scheduled' | 'draft' | 'pending' => {
    try {
      const stored = localStorage.getItem('notification_active_tab');
      if (
        stored &&
        ['published', 'scheduled', 'draft', 'pending'].includes(stored)
      ) {
        return stored as 'published' | 'scheduled' | 'draft' | 'pending';
      }
    } catch (error) {}
    return 'published';
  };

  const activeTab = ref<'published' | 'scheduled' | 'draft' | 'pending'>(
    getStoredTab()
  );

  watch(
    activeTab,
    (newTab) => {
      try {
        localStorage.setItem('notification_active_tab', newTab);
      } catch (error) {}
    },
    { immediate: false }
  );
  const selectedFilter = ref('ALL');
  const searchQuery = ref('');
  const loading = ref(false);
  const notifications = ref<Notification[]>([]);
  const filteredNotifications = ref<Notification[]>([]);

  const filterTabs = [
    { value: 'published', label: 'Published' },
    { value: 'scheduled', label: 'Scheduled' },
    { value: 'pending', label: 'Pending Approval' },
    { value: 'draft', label: 'Draft' },
  ];

  const handleTabChanged = (tab: { value: string; label: string }) => {};

  const filterOptions = computed(() => {
    const options = [{ label: 'ALL', value: 'ALL' }];

    Object.values(NotificationType).forEach((type) => {
      const label = formatNotificationType(String(type));
      options.push({ label, value: String(type) });
    });
    return options;
  });

  const selectedLabel = ref('Last 30 days');
  const dateRange = ref<[Date, Date]>([
    dayjs().subtract(29, 'day').startOf('day').toDate(),
    dayjs().endOf('day').toDate(),
  ]);

  const mockDateRange = ref<[Date, Date]>([
    dayjs().subtract(29, 'day').startOf('day').toDate(),
    dayjs().endOf('day').toDate(),
  ]);

  const formattedRange = computed(() => {
    const [s, e] = dateRange.value;
    return `${dayjs(s).format('MM/DD/YY')} - ${dayjs(e).format('MM/DD/YY')}`;
  });

  const shortcuts = [
    {
      text: 'Last 30 days',
      value: [
        dayjs().subtract(29, 'day').startOf('day').toDate(),
        dayjs().endOf('day').toDate(),
      ],
    },
    {
      text: 'Last 7 days',
      value: [
        dayjs().subtract(6, 'day').startOf('day').toDate(),
        dayjs().endOf('day').toDate(),
      ],
    },
    {
      text: 'Today',
      value: [dayjs().startOf('day').toDate(), dayjs().endOf('day').toDate()],
    },
    {
      text: 'Yesterday',
      value: [
        dayjs().subtract(1, 'day').startOf('day').toDate(),
        dayjs().subtract(1, 'day').endOf('day').toDate(),
      ],
    },
    {
      text: 'This month',
      value: [
        dayjs().startOf('month').toDate(),
        dayjs().endOf('month').toDate(),
      ],
    },
    {
      text: 'Last month',
      value: [
        dayjs().subtract(1, 'month').startOf('month').toDate(),
        dayjs().subtract(1, 'month').endOf('month').toDate(),
      ],
    },
    {
      text: 'All time',
      value: [
        dayjs().subtract(1, 'year').startOf('day').toDate(),
        dayjs().endOf('day').toDate(),
      ],
    },
  ];

  const USE_MOCK_DATA = true;
  const fetchError = ref(false);
  let fetchNotificationTimeout: ReturnType<typeof setTimeout> | null = null;
  let isFetching = false;
  let lastFetchTime = 0;
  const MIN_FETCH_INTERVAL = 1000;
  const DATA_CACHE_DURATION = 30000;
  const SCHEDULED_TAB_CACHE_DURATION = 270000;
  const PUBLISHED_TAB_CACHE_DURATION = 10000;
  const DUE_NOTIFICATION_CHECK_INTERVAL = 60000;
  const CACHE_STORAGE_KEY = 'notifications_cache';
  const CACHE_TIMESTAMP_KEY = 'notifications_cache_timestamp';
  const loadCacheFromStorage = (): {
    notifications: Notification[] | null;
    timestamp: number;
  } => {
    try {
      const cachedData = localStorage.getItem(CACHE_STORAGE_KEY);
      const cachedTime = localStorage.getItem(CACHE_TIMESTAMP_KEY);

      if (cachedData && cachedTime) {
        const timestamp = parseInt(cachedTime, 10);
        const now = Date.now();
        if (now - timestamp < DATA_CACHE_DURATION) {
          return {
            notifications: JSON.parse(cachedData) as Notification[],
            timestamp,
          };
        } else {
          localStorage.removeItem(CACHE_STORAGE_KEY);
          localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        }
      }
    } catch (error) {
      localStorage.removeItem(CACHE_STORAGE_KEY);
      localStorage.removeItem(CACHE_TIMESTAMP_KEY);
    }
    return { notifications: null, timestamp: 0 };
  };
  const saveCacheToStorage = (
    notifications: Notification[],
    timestamp: number
  ) => {
    try {
      localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(notifications));
      localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
    } catch (error) {
      try {
        localStorage.removeItem(CACHE_STORAGE_KEY);
        localStorage.removeItem(CACHE_TIMESTAMP_KEY);
        localStorage.setItem(CACHE_STORAGE_KEY, JSON.stringify(notifications));
        localStorage.setItem(CACHE_TIMESTAMP_KEY, timestamp.toString());
      } catch (e) {}
    }
  };
  const clearCacheFromStorage = () => {
    localStorage.removeItem(CACHE_STORAGE_KEY);
    localStorage.removeItem(CACHE_TIMESTAMP_KEY);
  };

  let cachedNotifications: Notification[] | null = null;
  let cacheTimestamp = 0;
  const initialCache = loadCacheFromStorage();
  if (initialCache.notifications && initialCache.notifications.length > 0) {
    const correctedNotifications = initialCache.notifications.map(
      correctNotificationStatus
    );
    cachedNotifications = correctedNotifications;
    cacheTimestamp = initialCache.timestamp;
    notifications.value = correctedNotifications;
    let tempFiltered = [...correctedNotifications];
    if (activeTab.value === 'pending') {
      tempFiltered = tempFiltered.filter(
        (notification) => notification.approvalStatus === 'PENDING'
      );
    } else if (activeTab.value === 'published') {
      tempFiltered = tempFiltered.filter(
        (notification) =>
          notification.status === 'published' &&
          (notification.approvalStatus === 'APPROVED' ||
            !notification.approvalStatus)
      );
    } else if (activeTab.value === 'scheduled') {
      tempFiltered = tempFiltered.filter(
        (notification) =>
          notification.status === 'scheduled' &&
          (notification.approvalStatus === 'APPROVED' ||
            !notification.approvalStatus)
      );
    } else if (activeTab.value === 'draft') {
      tempFiltered = tempFiltered.filter(
        (notification) =>
          notification.approvalStatus === null ||
          notification.approvalStatus === undefined ||
          notification.approvalStatus === 'REJECTED' ||
          notification.approvalStatus === 'EXPIRED'
      );
    }
    if (selectedFilter.value !== 'ALL') {
      tempFiltered = tempFiltered.filter(
        (notification) => notification.type === selectedFilter.value
      );
    }
    if (dateRange.value && dateRange.value.length === 2) {
      const [startDate, endDate] = dateRange.value;
      tempFiltered = tempFiltered.filter((notification) => {
        const notificationDate = new Date(
          notification.createdAt || notification.date || ''
        );
        if (isNaN(notificationDate.getTime())) {
          return false;
        }
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);
        return notificationDate >= startOfDay && notificationDate <= endOfDay;
      });
    }
    filteredNotifications.value = tempFiltered;
  }
  let lastDueCheckTime = 0;
  const checkForDueScheduledNotifications = (): boolean => {
    if (activeTab.value !== 'scheduled') {
      return false;
    }

    const now = Date.now();
    if (now - lastDueCheckTime < DUE_NOTIFICATION_CHECK_INTERVAL) {
      return false;
    }
    lastDueCheckTime = now;
    const scheduledNotifications = notifications.value.filter(
      (n) => n.status === 'scheduled'
    );
    if (scheduledNotifications.length === 0) {
      return false;
    }

    const currentDate = new Date();
    const hasDueNotifications = scheduledNotifications.some((notification) => {
      if (!notification.scheduledTime) return false;

      try {
        let scheduledDate: Date | null = null;
        const [datePart, timePart] = notification.scheduledTime
          .split('|')
          .map((s) => s.trim());
        if (datePart && timePart) {
          const dateMatch = datePart.match(/(\d+)\s+(\w+)\s+(\d+)/);
          if (dateMatch) {
            const [, day, monthName, year] = dateMatch;
            const monthNames = [
              'january',
              'february',
              'march',
              'april',
              'may',
              'june',
              'july',
              'august',
              'september',
              'october',
              'november',
              'december',
            ];
            const monthIndex = monthNames.findIndex(
              (m) => m.toLowerCase() === monthName.toLowerCase()
            );
            if (monthIndex !== -1) {
              const [hours, minutes] = timePart.split(':').map(Number);
              if (!isNaN(hours) && !isNaN(minutes)) {
                const dateStr = `${monthIndex + 1}/${parseInt(day)}/${parseInt(year)}`;
                scheduledDate = DateUtils.parseScheduleDateTime(
                  dateStr,
                  timePart
                );
              }
            }
          }
        }

        if (!scheduledDate || isNaN(scheduledDate.getTime())) {
          return false;
        }

        const threeMinutesAgo = new Date(currentDate.getTime() - 3 * 60 * 1000);
        return scheduledDate <= threeMinutesAgo;
      } catch (error) {
        return false;
      }
    });

    return hasDueNotifications;
  };

  const fetchNotifications = async (forceRefresh = false) => {
    if (fetchNotificationTimeout) {
      clearTimeout(fetchNotificationTimeout);
      fetchNotificationTimeout = null;
    }

    if (forceRefresh) {
      cachedNotifications = null;
      cacheTimestamp = 0;
      clearCacheFromStorage();
    }

    if (isFetching) {
      return;
    }
    const now = Date.now();
    const cacheDuration =
      activeTab.value === 'scheduled'
        ? SCHEDULED_TAB_CACHE_DURATION
        : activeTab.value === 'published'
          ? PUBLISHED_TAB_CACHE_DURATION
          : DATA_CACHE_DURATION;

    if (
      !forceRefresh &&
      cachedNotifications &&
      now - cacheTimestamp < cacheDuration
    ) {
      if (checkForDueScheduledNotifications()) {
        forceRefresh = true;
        cachedNotifications = null;
        cacheTimestamp = 0;
        clearCacheFromStorage();
      } else {
        const correctedNotifications = cachedNotifications.map(
          correctNotificationStatus
        );
        notifications.value = correctedNotifications;
        applyFilters();
        return;
      }
    }
    if (!forceRefresh && now - lastFetchTime < MIN_FETCH_INTERVAL) {
      if (cachedNotifications) {
        const correctedNotifications = cachedNotifications.map(
          correctNotificationStatus
        );
        notifications.value = correctedNotifications;
        applyFilters();
      }
      return;
    }

    try {
      isFetching = true;
      lastFetchTime = Date.now();
      loading.value = true;
      fetchError.value = false;
      const token = localStorage.getItem('auth_token');
      if (!token) {
        throw new Error('No authentication token found');
      }
      const response = await notificationApi.getAllNotifications({
        page: 1,
        pageSize: 100,
        language: 'KM',
      });
      const mappedNotifications = response.data.map((notification: any) => {
        let status = mapBackendStatusToFrontend(notification.status);
        if (
          notification.isSent === true &&
          notification.approvalStatus !== 'REJECTED' &&
          notification.approvalStatus !== 'EXPIRED'
        ) {
          status = 'published';
        }
        if (
          notification.approvalStatus === 'REJECTED' ||
          notification.approvalStatus === 'EXPIRED'
        ) {
          status = 'draft';
        }
        const corrected = correctNotificationStatus({
          ...notification,
          id: Number(notification.id),
          status: status,
          author: notification.author,
          description: notification.content || '',
          image: notification.image || '',
          date: notification.date,
          approvalStatus: (notification as any).approvalStatus,
          approvedBy: (notification as any).approvedBy,
          approvedAt: (notification as any).approvedAt,
        });
        return corrected;
      });
      notifications.value = mappedNotifications;
      cachedNotifications = mappedNotifications;
      cacheTimestamp = Date.now();
      saveCacheToStorage(mappedNotifications, cacheTimestamp);
      // [console.log removed]
      applyFilters();
    } catch (error) {
      fetchError.value = true;
      ElNotification({
        title: 'Error',
        message: 'Failed to load notifications',
        type: 'error',
        duration: 2000,
      });
    } finally {
      loading.value = false;
      isFetching = false;
    }
  };
  const debouncedFetchNotifications = () => {
    if (fetchNotificationTimeout) {
      clearTimeout(fetchNotificationTimeout);
    }
    fetchNotificationTimeout = setTimeout(() => {
      fetchNotifications();
    }, 300);
  };

  const applyFilters = () => {
    let filtered = [...notifications.value];

    if (activeTab.value === 'pending') {
      filtered = filtered.filter(
        (notification) => notification.approvalStatus === 'PENDING'
      );
    } else if (activeTab.value === 'published') {
      filtered = filtered.filter(
        (notification) =>
          notification.status === 'published' &&
          (notification.approvalStatus === 'APPROVED' ||
            !notification.approvalStatus)
      );
    } else if (activeTab.value === 'scheduled') {
      filtered = filtered.filter(
        (notification) =>
          notification.status === 'scheduled' &&
          (notification.approvalStatus === 'APPROVED' ||
            !notification.approvalStatus)
      );
    } else if (activeTab.value === 'draft') {
      filtered = filtered.filter(
        (notification) =>
          notification.approvalStatus === null ||
          notification.approvalStatus === undefined ||
          notification.approvalStatus === 'REJECTED' ||
          notification.approvalStatus === 'EXPIRED'
      );
    }

    if (selectedFilter.value !== 'ALL') {
      filtered = filtered.filter(
        (notification) => notification.type === selectedFilter.value
      );
    }

    if (searchQuery.value.trim()) {
      const query = searchQuery.value.toLowerCase();
      filtered = filtered.filter(
        (notification) =>
          notification.title.toLowerCase().includes(query) ||
          (notification.content &&
            notification.content.toLowerCase().includes(query)) ||
          notification.description.toLowerCase().includes(query)
      );
    }

    if (dateRange.value && dateRange.value.length === 2) {
      const [startDate, endDate] = dateRange.value;
      filtered = filtered.filter((notification) => {
        const notificationDate = new Date(
          notification.createdAt || notification.date || ''
        );

        if (isNaN(notificationDate.getTime())) {
          return false;
        }
        const startOfDay = new Date(startDate);
        startOfDay.setHours(0, 0, 0, 0);
        const endOfDay = new Date(endDate);
        endOfDay.setHours(23, 59, 59, 999);

        return notificationDate >= startOfDay && notificationDate <= endOfDay;
      });
    }

    filteredNotifications.value = filtered;
  };

  watch(
    [activeTab, selectedFilter, searchQuery, dateRange],
    () => {
      applyFilters();
    },
    { deep: true }
  );

  const handleDeleteNotification = async (notificationId: number | string) => {
    try {
      if (USE_MOCK_DATA) {
        const index = notifications.value.findIndex(
          (n) => n.id === notificationId
        );
        if (index > -1) {
          notifications.value.splice(index, 1);
          applyFilters();
          ElNotification({
            title: 'Success',
            message: 'Notification deleted successfully',
            type: 'success',
            duration: 2000,
          });
        }
      } else {
        await notificationApi.deleteNotification(Number(notificationId));
        ElNotification({
          title: 'Success',
          message: 'Notification deleted successfully',
          type: 'success',
          duration: 2000,
        });
        cachedNotifications = null;
        cacheTimestamp = 0;
        clearCacheFromStorage();
        await fetchNotifications(true);
      }
    } catch (error: any) {
      if (error.response?.data?.responseMessage) {
        ElNotification({
          title: 'Error',
          message: error.response.data.responseMessage,
          type: 'error',
          duration: 2000,
        });
      } else if (error.message) {
        ElNotification({
          title: 'Error',
          message: error.message,
          type: 'error',
          duration: 2000,
        });
      } else {
        ElNotification({
          title: 'Error',
          message: 'Failed to delete notification',
          type: 'error',
          duration: 2000,
        });
      }
    }
  };

  const publishingNotifications = new Set<number | string>();

  const handleSwitchTab = (
    tab: 'published' | 'scheduled' | 'draft' | 'pending'
  ) => {
    activeTab.value = tab;
    try {
      localStorage.setItem('notification_active_tab', tab);
      localStorage.removeItem('notifications_cache');
      localStorage.removeItem('notifications_cache_timestamp');
      cachedNotifications = null;
      cacheTimestamp = 0;
    } catch (error) {}
    fetchNotifications(true)
      .then(() => {
        applyFilters();
      })
      .catch(() => {
        applyFilters();
      });
  };

  const handleUpdateNotification = (updatedNotification: Notification) => {
    const index = notifications.value.findIndex(
      (n) =>
        (n.templateId || n.id) ===
        (updatedNotification.templateId || updatedNotification.id)
    );

    if (index !== -1) {
      notifications.value[index] = {
        ...notifications.value[index],
        ...updatedNotification,
      };
      applyFilters();
    } else {
      notifications.value.push(updatedNotification);
      applyFilters();
    }
  };

  const handlePublishNotification = async (notification: Notification) => {
    const notificationId = notification.templateId || notification.id;
    const key = Number(notificationId);

    if (publishingNotifications.has(key)) {
      ElNotification({
        title: 'Info',
        message: 'Notification is already being published. Please wait...',
        type: 'info',
        duration: 2000,
      });
      return;
    }

    publishingNotifications.add(key);
    let loadingNotification: any = null;

    try {
      if (USE_MOCK_DATA) {
        const notificationIndex = notifications.value.findIndex(
          (n) => n.id === notification.id
        );
        if (notificationIndex !== -1) {
          notifications.value[notificationIndex].status = 'published';
          notifications.value[notificationIndex].isSent = true;
          activeTab.value = 'published';
          applyFilters();
          ElNotification({
            title: 'Success',
            message: 'Notification published successfully',
            type: 'success',
            duration: 2000,
          });
        }
      } else {
        try {
          const fullTemplate = await api.get(
            `/api/v1/template/${notificationId}`
          );
          const template = fullTemplate.data?.data || fullTemplate.data;

          const isAlreadySent =
            template?.isSent === true || notification.isSent === true;

          if (isAlreadySent) {
            ElNotification({
              title: 'Info',
              message:
                'This notification has already been sent to users. It has been moved to the Published tab.',
              type: 'info',
              duration: 3000,
            });

            const notificationIndex = notifications.value.findIndex(
              (n) => n.id === notification.id
            );
            if (notificationIndex !== -1) {
              notifications.value[notificationIndex].status = 'published';
              notifications.value[notificationIndex].isSent = true;
            }
            activeTab.value = 'published';
            cachedNotifications = null;
            cacheTimestamp = 0;
            clearCacheFromStorage();
            await fetchNotifications(true);
            applyFilters();
            return;
          }
          const translations = template?.translations || [];
          let hasValidData = false;

          for (const translation of translations) {
            const hasTitle =
              translation?.title && translation.title.trim() !== '';
            const hasContent =
              translation?.content && translation.content.trim() !== '';

            if (hasTitle && hasContent) {
              hasValidData = true;
              break;
            }
          }

          if (!hasValidData) {
            publishingNotifications.delete(key);
            ElNotification({
              title: 'Error',
              message:
                'This record cannot be sent. Please review the <strong>title</strong> and <strong>content</strong> and other fields, then try again.',
              type: 'error',
              duration: 4000,
              dangerouslyUseHTMLString: true,
            });
            return;
          }

          loadingNotification = ElNotification({
            title: 'Sending Notification',
            message:
              'Please wait while we send the notification to all users. This may take a moment if there are many recipients...',
            type: 'info',
            duration: 0,
          });

          const updatePayload: any = {
            sendType: SendType.SEND_NOW,
            isSent: true,
            sendSchedule: null,
          };

          if (
            template?.platforms &&
            Array.isArray(template.platforms) &&
            template.platforms.length > 0
          ) {
            updatePayload.platforms = template.platforms;
          } else {
            updatePayload.platforms = [Platform.IOS, Platform.ANDROID];
          }

          if (
            template?.translations &&
            Array.isArray(template.translations) &&
            template.translations.length > 0
          ) {
            updatePayload.translations = template.translations.map(
              (t: any) => ({
                language: t.language,
                title: t.title,
                content: t.content,
                image: t.image?.fileId || t.imageId || t.image?.id || '',
                linkPreview: t.linkPreview || undefined,
              })
            );
          }

          const result = await notificationApi.updateTemplate(
            Number(notificationId),
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
              const templateId = result?.data?.templateId || notificationId;
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

              activeTab.value = 'pending';
              cachedNotifications = null;
              cacheTimestamp = 0;
              clearCacheFromStorage();
              await fetchNotifications(true);
              applyFilters();
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
            activeTab.value = 'draft';
            cachedNotifications = null;
            cacheTimestamp = 0;
            clearCacheFromStorage();
            await fetchNotifications(true);
            applyFilters();
            return;
          }

          const platformName = getFormattedPlatformName({
            platformName: result?.data?.platformName,
            bakongPlatform: result?.data?.bakongPlatform,
            notification: notification as any,
          });

          const bakongPlatform =
            result?.data?.bakongPlatform ||
            (notification as any)?.bakongPlatform;

          const platforms =
            result?.data?.platforms || template?.platforms || [];
          let devicePlatform = 'ALL';
          if (Array.isArray(platforms) && platforms.length > 0) {
            if (platforms.length === 1) {
              devicePlatform = String(platforms[0]);
            } else {
              devicePlatform = 'ALL';
            }
          }

          const devicePlatformFormatted = formatPlatform(devicePlatform);

          const messageConfig = getNotificationMessage(
            result?.data,
            platformName,
            bakongPlatform,
            devicePlatformFormatted
          );
          const successfulCount = result?.data?.successfulCount ?? 0;
          const failedCount = result?.data?.failedCount ?? 0;
          const isPartialSuccess = successfulCount > 0 && failedCount > 0;

          if (messageConfig.type !== 'success' || isPartialSuccess) {
            ElNotification({
              title: messageConfig.title,
              message: messageConfig.message,
              type: messageConfig.type,
              duration: messageConfig.duration,
              dangerouslyUseHTMLString: messageConfig.dangerouslyUseHTMLString,
            });

            if (
              messageConfig.type === 'error' ||
              messageConfig.type === 'warning' ||
              messageConfig.type === 'info'
            ) {
              activeTab.value = 'draft';
              cachedNotifications = null;
              cacheTimestamp = 0;
              clearCacheFromStorage();
              await fetchNotifications(true);
              applyFilters();
              return;
            }

            if (isPartialSuccess) {
              const notificationIndex = notifications.value.findIndex(
                (n) => n.id === notification.id
              );
              if (notificationIndex !== -1 && successfulCount > 0) {
                notifications.value[notificationIndex].status = 'published';
                notifications.value[notificationIndex].isSent = true;
              }
              activeTab.value = 'published';
              return;
            }
          }

          if (
            result?.data?.successfulCount !== undefined &&
            result?.data?.successfulCount > 0
          ) {
            const successfulCount = result?.data?.successfulCount ?? 0;

            const notificationType =
              result?.data?.notificationType ||
              template?.notificationType ||
              notification.type;
            const isFlashNotification =
              notificationType === NotificationType.FLASH_NOTIFICATION;

            let message = '';
            if (isFlashNotification) {
              message =
                'Flash notification published successfully, and when user open bakongPlatform it will saw it!';
              const platformNameForFlash = getFormattedPlatformName({
                platformName: result?.data?.platformName,
                bakongPlatform:
                  result?.data?.bakongPlatform || template?.bakongPlatform,
                notification: notification as any,
              });
              message = message.replace(
                'bakongPlatform',
                `<strong>${platformNameForFlash}</strong>`
              );
            } else {
              const successMessageConfig = getNotificationMessage(
                result?.data,
                platformName,
                bakongPlatform,
                devicePlatformFormatted
              );
              message = successMessageConfig.message;
            }

            ElNotification({
              title: 'Success',
              message: message,
              type: 'success',
              duration: 2000,
              dangerouslyUseHTMLString: true,
            });
            const notificationIndex = notifications.value.findIndex(
              (n) => n.id === notification.id
            );
            if (notificationIndex !== -1) {
              notifications.value[notificationIndex].status = 'published';
              notifications.value[notificationIndex].isSent = true;
            }
            activeTab.value = 'published';
          } else {
            const notificationType =
              result?.data?.notificationType ||
              template?.notificationType ||
              notification.type;
            const isFlashNotification =
              notificationType === NotificationType.FLASH_NOTIFICATION;

            if (isFlashNotification) {
              let message =
                'Flash notification published successfully, and when user open bakongPlatform it will saw it!';
              const platformName = getFormattedPlatformName({
                platformName: result?.data?.platformName,
                bakongPlatform:
                  result?.data?.bakongPlatform || template?.bakongPlatform,
                notification: notification as any,
              });
              message = message.replace(
                'bakongPlatform',
                `<strong>${platformName}</strong>`
              );

              ElNotification({
                title: 'Success',
                message: message,
                type: 'success',
                duration: 2000,
                dangerouslyUseHTMLString: true,
              });

              const notificationIndex = notifications.value.findIndex(
                (n) => n.id === notification.id
              );
              if (notificationIndex !== -1) {
                notifications.value[notificationIndex].status = 'published';
                notifications.value[notificationIndex].isSent = true;
              }
              activeTab.value = 'published';
            } else {
              const isAlreadySent =
                result?.data?.isSent === true || template?.isSent === true;

              if (isAlreadySent) {
                ElNotification({
                  title: 'Info',
                  message:
                    'This notification has already been sent. It has been moved to the Published tab.',
                  type: 'info',
                  duration: 3000,
                });

                const notificationIndex = notifications.value.findIndex(
                  (n) => n.id === notification.id
                );
                if (notificationIndex !== -1) {
                  notifications.value[notificationIndex].status = 'published';
                  notifications.value[notificationIndex].isSent = true;
                }
                activeTab.value = 'published';
              } else {
                const platformName = getFormattedPlatformName({
                  platformName: result?.data?.platformName,
                  bakongPlatform: result?.data?.bakongPlatform,
                  notification: notification as any,
                });

                const bakongPlatform =
                  result?.data?.bakongPlatform ||
                  (notification as any)?.bakongPlatform;
                const messageConfig = getNotificationMessage(
                  result?.data,
                  platformName,
                  bakongPlatform
                );

                ElNotification({
                  title: messageConfig.title,
                  message: messageConfig.message,
                  type: messageConfig.type,
                  duration: messageConfig.duration,
                  dangerouslyUseHTMLString:
                    messageConfig.dangerouslyUseHTMLString,
                });
                activeTab.value = 'draft';
              }
            }
          }
          cachedNotifications = null;
          cacheTimestamp = 0;
          clearCacheFromStorage();
          await fetchNotifications(true);
          applyFilters();
        } catch (updateError: any) {
          if (loadingNotification) {
            loadingNotification.close();
          }
          throw updateError;
        }
      }
    } catch (error: any) {
      try {
        if (typeof loadingNotification !== 'undefined' && loadingNotification) {
          loadingNotification.close();
        }
      } catch (e) {}

      // [console.error removed]
      const errorMessage =
        error?.response?.data?.responseMessage ||
        error?.response?.data?.message ||
        error?.message ||
        'Failed to publish notification';

      const errorData = error?.response?.data?.data || {};
      const failedDueToInvalidTokens =
        errorData.failedDueToInvalidTokens === true;
      const failedCount = errorData.failedCount || 0;

      if (failedDueToInvalidTokens && failedCount > 0) {
        const bakongPlatform =
          errorData.bakongPlatform || (notification as any)?.bakongPlatform;
        const platformName = bakongPlatform
          ? formatBakongApp(bakongPlatform)
          : undefined;
        const messageConfig = getNotificationMessage(
          { failedDueToInvalidTokens: true, failedCount },
          platformName,
          bakongPlatform
        );
        ElNotification({
          title: messageConfig.title,
          message: messageConfig.message,
          type: messageConfig.type,
          duration: messageConfig.duration,
          dangerouslyUseHTMLString: messageConfig.dangerouslyUseHTMLString,
        });
        activeTab.value = 'draft';
        cachedNotifications = null;
        cacheTimestamp = 0;
        clearCacheFromStorage();
        await fetchNotifications(true);
        applyFilters();
      } else if (
        errorMessage.includes('NO_USERS_FOR_BAKONG_PLATFORM') ||
        errorMessage.includes('No users found for')
      ) {
        const bakongPlatform =
          errorData.bakongPlatform || (notification as any)?.bakongPlatform;
        const platformName = getFormattedPlatformName({
          platformName: errorData.platformName,
          bakongPlatform: bakongPlatform,
          notification: notification as any,
        });

        ElNotification({
          title: 'Info',
          message: getNoUsersAvailableMessage(platformName),
          type: 'info',
          duration: 3000,
          dangerouslyUseHTMLString: true,
        });
        activeTab.value = 'draft';
        cachedNotifications = null;
        cacheTimestamp = 0;
        clearCacheFromStorage();
        await fetchNotifications(true);
        applyFilters();
      } else {
        ElNotification({
          title: 'Error',
          message: errorMessage,
          type: 'error',
          duration: 2000,
        });
      }
    } finally {
      publishingNotifications.delete(key);
    }
  };
  let pollingInterval: ReturnType<typeof setInterval> | null = null;
  let pollingSetup = false;
  let isMounted = false;
  onMounted(async () => {
    if (isMounted) {
      // [console.log removed]
      return;
    }
    isMounted = true;

    let tabChanged = false;
    const storedTab = getStoredTab();
    const queryTab =
      route.query?.tab &&
      ['published', 'scheduled', 'draft', 'pending'].includes(
        route.query.tab as string
      )
        ? (route.query.tab as 'published' | 'scheduled' | 'draft' | 'pending')
        : null;
    const hasRefreshQueryParam = route.query?._refresh !== undefined;

    if (hasRefreshQueryParam && queryTab) {
      if (activeTab.value !== queryTab) {
        activeTab.value = queryTab;
        tabChanged = true;
        try {
          localStorage.setItem('notification_active_tab', queryTab);
        } catch (error) {
          console.warn('Failed to save active tab to localStorage:', error);
        }
      }
    } else if (storedTab !== 'published' || !queryTab) {
      if (activeTab.value !== storedTab) {
        activeTab.value = storedTab;
        tabChanged = true;
      }
    } else if (queryTab && storedTab === 'published') {
      if (activeTab.value !== queryTab) {
        activeTab.value = queryTab;
        tabChanged = true;
        try {
          localStorage.setItem('notification_active_tab', queryTab);
        } catch (error) {
          console.warn('Failed to save active tab to localStorage:', error);
        }
      }
    }
    if (
      notifications.value.length > 0 &&
      (tabChanged || filteredNotifications.value.length === 0)
    ) {
      // [console.log removed]
      applyFilters();
    }

    await new Promise((resolve) => setTimeout(resolve, 200));

    const cacheWasCleared = !localStorage.getItem(
      'notifications_cache_timestamp'
    );
    const shouldForceRefresh =
      cacheWasCleared || tabChanged || hasRefreshQueryParam;

    if (hasRefreshQueryParam) {
      // [console.log removed]
      try {
        localStorage.removeItem('notifications_cache');
        localStorage.removeItem('notifications_cache_timestamp');
        cachedNotifications = null;
        cacheTimestamp = 0;
        // [console.log removed]
      } catch (error) {
        // [console.warn removed]
      }
    }

    const cacheDuration =
      activeTab.value === 'scheduled'
        ? SCHEDULED_TAB_CACHE_DURATION
        : activeTab.value === 'published'
          ? PUBLISHED_TAB_CACHE_DURATION
          : DATA_CACHE_DURATION;

    // [console.log removed]

    if (cachedNotifications && cacheTimestamp && !shouldForceRefresh) {
      const now = Date.now();
      if (now - cacheTimestamp < cacheDuration) {
        if (notifications.value.length === 0) {
          const correctedNotifications = cachedNotifications.map(
            correctNotificationStatus
          );
          notifications.value = correctedNotifications;
          applyFilters();
        }
        if (activeTab.value === 'published') {
          fetchNotifications(true).catch((err) => {});
        } else {
        }
      } else {
        await fetchNotifications(true);
      }
    } else {
      await fetchNotifications(true);
    }
    const setupPolling = () => {
      if (pollingSetup && pollingInterval) {
        return;
      }

      if (pollingInterval) {
        clearInterval(pollingInterval);
        pollingInterval = null;
      }
      const pollingIntervalDuration = 900000;
      pollingInterval = setInterval(() => {
        const now = Date.now();
        const cacheAge = now - cacheTimestamp;
        const cacheDuration =
          activeTab.value === 'scheduled'
            ? SCHEDULED_TAB_CACHE_DURATION
            : activeTab.value === 'published'
              ? PUBLISHED_TAB_CACHE_DURATION
              : DATA_CACHE_DURATION;

        // [console.log removed]

        if (
          activeTab.value === 'scheduled' &&
          checkForDueScheduledNotifications()
        ) {
          // [console.log removed]
          fetchNotifications(true);
          return;
        }
        if (
          (activeTab.value === 'scheduled' ||
            activeTab.value === 'published') &&
          cacheAge >= cacheDuration
        ) {
          // [console.log removed]
          fetchNotifications(true);
        } else {
          // [console.log removed]
        }
      }, pollingIntervalDuration);

      pollingSetup = true;
      // [console.log removed]
    };
    setupPolling();
  });

  onUnmounted(() => {
    if (pollingInterval) {
      clearInterval(pollingInterval);
      pollingInterval = null;
    }
    pollingSetup = false;
    isMounted = false;
  });
</script>

<style scoped>
  .home-page {
    width: 100%;
    height: 100%;
    background: #fff;
    font-family:
      -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
    overflow-x: hidden;
  }

  .search-filter-bar {
    display: grid;
    grid-template-columns: 202px 18px 313px 18px 1fr;
    grid-template-areas: 'filter . search . date';
    align-items: center;
    width: 100%;
    padding: 17px 0;
    position: relative;
  }

  .filter-dropdown {
    grid-area: filter;
  }

  .search-input {
    grid-area: search;
  }

  .date-range {
    grid-area: date;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
  }

  .date-picker {
    width: 100%;
    height: 40px;
  }

  .custom-date-range {
    display: flex;
    align-items: center;
    justify-content: space-between;
    width: 100%;
    height: 40px;
    padding: 0 20px;
    background: #fff;
    border: 1px solid rgba(0, 19, 70, 0.15);
    border-radius: 28px;
    cursor: pointer;
    transition:
      border-color 0.2s,
      box-shadow 0.2s;
    box-sizing: border-box;
  }

  .custom-date-range:hover {
    border-color: rgba(0, 19, 70, 0.4);
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05);
  }

  .date-text {
    color: #7a8190;
    font-size: 15px;
    letter-spacing: 0.2px;
  }

  .calendar-icon-container {
    display: flex;
    align-items: center;
    justify-content: center;
    width: 36px;
    height: 36px;
    border-radius: 50%;
    border: 1px solid rgba(0, 19, 70, 0.1);
    background: rgba(0, 19, 70, 0.03);
    color: #001346;
  }

  .date-range .date-picker :deep(.el-date-editor.el-date-editor--daterange) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    height: 40px !important;
    --el-input-height: 40px !important;
    --el-date-editor-width: 100% !important;
    flex: 1 !important;
  }

  .date-range .date-picker :deep(.el-range-editor.el-input__wrapper) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    height: 40px !important;
    border-radius: 28px !important;
    border: 1px solid rgba(0, 19, 70, 0.15) !important;
    background: #fff !important;
    padding: 0 20px !important;
    box-shadow: none !important;
    transition:
      border-color 0.2s,
      box-shadow 0.2s !important;
    --el-input-border-color: rgba(0, 19, 70, 0.15) !important;
    --el-border-color: rgba(0, 19, 70, 0.15) !important;
    flex: 1 !important;
    display: flex !important;
    align-items: center !important;
  }

  .date-range .date-picker :deep(.el-range-editor.el-input__wrapper:hover) {
    border-color: rgba(0, 19, 70, 0.4) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05) !important;
    --el-input-border-color: rgba(0, 19, 70, 0.4) !important;
    --el-border-color: rgba(0, 19, 70, 0.4) !important;
  }

  .date-range .date-picker :deep(.el-range-editor.el-input__wrapper.is-focus) {
    border-color: rgba(0, 19, 70, 0.4) !important;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.05) !important;
    --el-input-border-color: rgba(0, 19, 70, 0.4) !important;
    --el-border-color: rgba(0, 19, 70, 0.4) !important;
  }

  .date-range .date-picker :deep(.el-input__inner) {
    height: 38px !important;
    line-height: 38px !important;
    font-size: 15px !important;
    color: #7a8190 !important;
    padding: 0 !important;
    letter-spacing: 0.2px !important;
  }

  .date-range .date-picker :deep(.el-range-separator) {
    margin: 0 8px !important;
    color: #7a8190 !important;
  }

  .date-range .date-picker :deep(.el-range-input) {
    border: none !important;
    background: transparent !important;
    color: #7a8190 !important;
    font-size: 15px !important;
    letter-spacing: 0.2px !important;
  }

  .date-range .date-picker :deep(.el-input__suffix) {
    display: flex !important;
    align-items: center !important;
    justify-content: center !important;
    width: 36px !important;
    height: 36px !important;
    border-radius: 50% !important;
    border: 1px solid rgba(0, 19, 70, 0.1) !important;
    background: rgba(0, 19, 70, 0.03) !important;
    color: #001346 !important;
  }

  .date-range .date-picker :deep(.el-input__suffix .el-icon) {
    color: #001346 !important;
    font-size: 16px !important;
  }

  .date-range {
    --el-input-height: 40px !important;
    --el-date-editor-width: 100% !important;
    --el-input-border-color: rgba(0, 19, 70, 0.15) !important;
    --el-border-color: rgba(0, 19, 70, 0.15) !important;
    --el-input-border-radius: 28px !important;
    --el-input-bg-color: #fff !important;
    --el-input-text-color: #7a8190 !important;
    --el-input-placeholder-color: #7a8190 !important;
    --el-component-size: 40px !important;
    width: 100% !important;
    min-width: 0 !important;
    max-width: none !important;
    flex: 1 !important;
    display: flex !important;
  }

  .date-range * {
    box-sizing: border-box !important;
  }

  .date-range .date-picker {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    flex: 1 !important;
    display: block !important;
  }

  .date-range :deep(.el-date-editor) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    display: block !important;
  }

  .date-range :deep(.el-input) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    display: block !important;
  }

  .date-range :deep(.el-input__wrapper) {
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    display: flex !important;
  }

  .range-popper .el-picker-panel__sidebar {
    width: 160px;
  }

  .notifications-grid {
    display: flex;
    flex-direction: column;
    position: absolute;
    top: 124px;
    left: 32px;
    right: 32px;
    bottom: 32px;
    overflow-y: auto;
    scrollbar-width: none;
  }

  .notifications-grid .notification-cards-container {
    width: 100%;
    margin-top: 20px;
  }

  .notifications-grid::-webkit-scrollbar {
    display: none;
  }

  .loading-container {
    display: flex;
    justify-content: center;
    align-items: center;
    height: 200px;
    width: 100%;
  }

  .loading-spinner {
    color: #001346;
    font-size: 16px;
    font-weight: 500;
  }

  .empty-state {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    height: 100%;
    min-height: 400px;
    padding-top: 80px;
  }

  .empty-state-container {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: flex-start;
    gap: 24px;
    width: 241px;
    height: 391.87px;
  }

  .image-empty-state {
    width: 191.96px;
    height: 337.87px;
    display: flex;
  }

  .empty-message {
    color: #000000;
    font-size: 20px;
    font-weight: 600;
    font-family: 'IBM Plex Sans';
  }
</style>
