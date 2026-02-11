<template>
  <div class="notification-container">
    <div class="notification-wrapper">
      <div class="grid-container">
        <div v-if="props.loading" class="loading-state">
          <div class="loading-text">Loading notifications...</div>
        </div>
        <div v-else-if="filteredNotifications.length === 0" class="empty-state">
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
        <div
          v-else
          v-for="notification in filteredNotifications"
          :key="notification.id"
          class="notification-card"
          :class="{
            'no-image': !hasValidImage(notification),
          }"
        >
          <div class="card-content">
            <p class="author-text">
              Posted by {{ notification.author }}
              <span
                v-if="shouldShowBadge(notification)"
                class="approval-badge-tag"
                :class="
                  getApprovalBadgeClass(
                    notification.approvalStatus || 'APPROVED'
                  )
                "
              >
                {{ getBadgeLabel(notification) }}
              </span>
            </p>
            <h3
              class="title-text"
              :class="{ 'lang-khmer': containsKhmer(notification.title) }"
              :data-content-lang="containsKhmer(notification.title) ? 'km' : ''"
            >
              {{ notification.title }}
            </h3>
            <p
              v-if="notification.description && notification.description.trim()"
              class="description-text"
              :class="{ 'lang-khmer': containsKhmer(notification.description) }"
              :data-content-lang="
                containsKhmer(notification.description) ? 'km' : ''
              "
            >
              <span v-html="notification.description"></span>
            </p>
          </div>
          <div v-if="hasValidImage(notification)" class="image-container">
            <img
              :src="notification.image"
              :alt="notification.title"
              class="card-image"
              @error="handleImageError"
              loading="lazy"
            />
          </div>
          <div class="card-footer">
            <p class="date-text">
              {{ formatDateWithScheduledTime(notification) }}
            </p>
            <div class="button-container">
              <button
                v-if="!(isApprover && props.activeTab === 'pending')"
                class="view-button"
                @click="handleViewClick(notification)"
              >
                <span>View</span>
                <img
                  src="@/assets/image/view_16.svg"
                  alt="View"
                  class="button-icon"
                />
              </button>

              <button
                v-if="canShowApprovalNow(notification)"
                class="approval-now-button"
                @click="handleApprovalNowClick(notification)"
              >
                <span>Approval Now</span>
              </button>

              <template
                v-if="
                  isApprover &&
                  props.activeTab === 'pending' &&
                  notification.approvalStatus === 'PENDING' &&
                  !canShowApprovalNow(notification)
                "
              >
                <button
                  class="approve-button"
                  @click="handleApproveClick(notification)"
                >
                  <span>Approve</span>
                </button>
                <button
                  class="reject-button"
                  @click="handleRejectClick(notification)"
                >
                  <span>Reject</span>
                </button>
              </template>

              <button
                v-if="canPublishNow(notification)"
                class="publish-now-button"
                @click="handlePublishNowClick(notification)"
              >
                <span>Publish Now</span>
              </button>

              <button
                v-if="canSubmitNotification(notification)"
                class="submit-button"
                @click="handleSubmitClick(notification)"
              >
                <span>Submit Now</span>
              </button>

              <button
                v-if="canEditNotification(notification)"
                class="edit-button"
                @click="handleEditClick(notification)"
              >
                <span>Edit</span>
                <img :src="editIcon" alt="Edit" class="button-icon" />
              </button>
              <button
                v-if="canDeleteNotification(notification)"
                class="delete-button"
                @click="handleDeleteClick(notification)"
              >
                <span>Delete</span>
                <img :src="deleteIcon" alt="Delete" class="button-icon" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  </div>
  <ConfirmationDialog
    v-model="isVisible"
    :title="options.title"
    :message="options.message"
    :confirm-text="options.confirmText"
    :cancel-text="options.cancelText"
    :type="options.type"
    :show-reason-input="options.showReasonInput"
    @confirm="(reason?: string) => handleConfirm(reason)"
    @cancel="handleCancel"
  />
</template>
<script setup lang="ts">
  import { ref, computed } from 'vue';
  import { useRouter } from 'vue-router';
  import { Search, Calendar, Edit2, Trash2 } from 'lucide-vue-next';
  import type { Notification } from '@/types/notification';
  import ConfirmationDialog from './ConfirmationDialog.vue';
  import { useConfirmationDialog } from '@/composables/useConfirmationDialog';
  import {
    containsKhmer,
    formatNoUsersFoundMessage,
    formatNoUsersFoundRejectionMessage,
  } from '@/utils/helpers';
  import { useAuthStore } from '@/stores/auth';
  import { UserRole, ErrorCode } from '@bakong/shared';
  import { notificationApi } from '@/services/notificationApi';
  import { ElNotification } from 'element-plus';
  import emptyStateImage from '@/assets/image/jomreadsur.png';
  const editIcon = new URL('@/assets/image/edit.png', import.meta.url).href;
  const deleteIcon = new URL('@/assets/image/trash-can.png', import.meta.url)
    .href;
  interface Props {
    activeTab?: 'published' | 'scheduled' | 'draft' | 'pending';
    notifications?: Notification[];
    loading?: boolean;
  }
  const props = withDefaults(defineProps<Props>(), {
    activeTab: 'published',
    notifications: () => [],
    loading: false,
  });
  const emit = defineEmits<{
    (e: 'refresh', forceRefresh?: boolean): void;
    (e: 'delete', id: number | string): void;
    (e: 'publish', notification: Notification): void;
    (
      e: 'switch-tab',
      tab: 'published' | 'scheduled' | 'draft' | 'pending'
    ): void;
    (e: 'update-notification', notification: Notification): void;
  }>();
  const router = useRouter();
  const authStore = useAuthStore();
  const searchQuery = ref('');
  const selectedFilter = ref('ALL');
  const {
    isVisible,
    options,
    handleConfirm,
    handleCancel,
    showDeleteDialog,
    showRejectDialog,
  } = useConfirmationDialog();
  const canApprove = computed(() => {
    const role = authStore.user?.role as any;
    return role === UserRole.APPROVAL || role === UserRole.ADMINISTRATOR;
  });
  const canEdit = computed(() => {
    const role = authStore.user?.role as any;
    return role !== UserRole.APPROVAL && role !== UserRole.VIEW_ONLY;
  });
  const canDelete = computed(() => {
    const role = authStore.user?.role as any;
    return role !== UserRole.APPROVAL && role !== UserRole.VIEW_ONLY;
  });
  const isApprover = computed(() => {
    return (authStore.user?.role as any) === UserRole.APPROVAL;
  });
const canDeleteNotification = (notification: Notification) => {
  const role = authStore.user?.role as any;
  // Viewers: never see delete button
  if (role === UserRole.VIEW_ONLY) {
    return false;
  }
  // Editors: can only delete in 'pending' and 'draft' tabs
  if (role === UserRole.EDITOR) {
    return props.activeTab === 'pending' || props.activeTab === 'draft';
  }
  // Admin: can delete everywhere
  if (role === UserRole.ADMINISTRATOR) {
    return true;
  }
  // Approval: can delete in 'pending' and 'draft' tabs
  if (role === UserRole.APPROVAL) {
    return props.activeTab === 'pending' || props.activeTab === 'draft' || props.activeTab === 'published' || props.activeTab === 'scheduled';
  }
  return false;
};
  const canEditNotification = (notification: Notification) => {
    const role = authStore.user?.role as any;

    if (role === UserRole.APPROVAL) {
      return false;
    }

    if (role === UserRole.VIEW_ONLY) {
      return false;
    }

    return (
      props.activeTab === 'published' ||
      props.activeTab === 'scheduled' ||
      props.activeTab === 'pending' ||
      props.activeTab === 'draft'
    );
  };
  const canSubmitNotification = (notification: Notification) => {
    const role = authStore.user?.role as any;

    if (props.activeTab !== 'draft') return false;
    if (role !== UserRole.ADMINISTRATOR && role !== UserRole.EDITOR)
      return false;
    if (notification.status !== 'draft') return false;
    if (
      notification.approvalStatus === 'PENDING' ||
      notification.approvalStatus === 'APPROVED'
    )
      return false;

    return true;
  };
  const canPublishNow = (notification: Notification) => {
    const role = authStore.user?.role as any;
    if (role !== UserRole.APPROVAL) return false;
    return props.activeTab === 'scheduled' || props.activeTab === 'pending';
  };
  const canShowApprovalNow = (notification: Notification) => {
    const role = authStore.user?.role as any;
    if (role !== UserRole.APPROVAL) return false;
    return (
      props.activeTab === 'pending' && notification.approvalStatus === 'PENDING'
    );
  };
  const isViewOnly = computed(() => {
    return (authStore.user?.role as any) === UserRole.VIEW_ONLY;
  });
  const isAdmin = computed(() => {
    return (authStore.user?.role as any) === UserRole.ADMINISTRATOR;
  });
  const isEditor = computed(() => {
    return (authStore.user?.role as any) === UserRole.EDITOR;
  });
  const canPublish = (notification: Notification) => {
    return (
      notification.approvalStatus === 'APPROVED' || !notification.approvalStatus
    );
  };
  const canSubmit = (notification: Notification) => {
    if (!isEditor.value) return false;
    if (props.activeTab !== 'draft') return false; // Only show Submit in Draft tab
    if (notification.status !== 'draft') return false; // Only for draft status, not scheduled
    if (
      notification.approvalStatus === 'PENDING' ||
      notification.approvalStatus === 'APPROVED'
    )
      return false;
    return true;
  };
  const getApprovalStatusLabel = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'Pending Approval';
      case 'APPROVED':
        return 'Approved';
      case 'REJECTED':
        return 'Rejected';
      case 'EXPIRED':
        return 'Expired Time';
      default:
        return '';
    }
  };
  const formatDateWithScheduledTime = (notification: Notification): string => {
    const baseDate = notification.date || '';

    const isScheduledNotification =
      notification.sendType === 'SEND_SCHEDULE' &&
      notification.isSent === true &&
      props.activeTab === 'published';

    if (isScheduledNotification) {
      return `${baseDate} (scheduled time)`;
    }

    return baseDate;
  };
  const shouldShowBadge = (notification: Notification) => {
    if (props.activeTab === 'published') {
      return false;
    }

    if (props.activeTab === 'scheduled') {
      return (
        notification.approvalStatus === 'APPROVED' ||
        !notification.approvalStatus
      );
    }

    if (props.activeTab === 'pending') {
      return notification.approvalStatus === 'PENDING';
    }

    if (props.activeTab === 'draft') {
      return (
        notification.approvalStatus === 'REJECTED' ||
        notification.approvalStatus === 'EXPIRED'
      );
    }

    return false;
  };
  const getBadgeLabel = (notification: Notification) => {
    if (props.activeTab === 'scheduled') {
      return 'Approved';
    }
    if (props.activeTab === 'pending') {
      return 'Pending Approval';
    }
    if (
      props.activeTab === 'draft' &&
      notification.approvalStatus === 'REJECTED'
    ) {
      return 'Rejected';
    }
    if (
      props.activeTab === 'draft' &&
      notification.approvalStatus === 'EXPIRED'
    ) {
      return 'Expired Time';
    }
    return getApprovalStatusLabel(notification.approvalStatus || '');
  };
  const getApprovalBadgeClass = (status: string) => {
    switch (status) {
      case 'PENDING':
        return 'badge-pending';
      case 'APPROVED':
        return 'badge-approved';
      case 'REJECTED':
        return 'badge-rejected';
      case 'EXPIRED':
        return 'badge-expired';
      default:
        return '';
    }
  };
  const displayNotifications = computed(() => {
    return props.notifications || [];
  });
  const filteredNotifications = computed(() => {
    return displayNotifications.value.filter((n) => {
      let matchesTab = false;
      if (props.activeTab === 'pending') {
        matchesTab = n.approvalStatus === 'PENDING';
      } else {
        matchesTab = n.status === props.activeTab;
      }

      const matchesSearch =
        searchQuery.value === '' ||
        n.title.toLowerCase().includes(searchQuery.value.toLowerCase()) ||
        (n.description &&
          n.description
            .toLowerCase()
            .includes(searchQuery.value.toLowerCase())) ||
        (n.content &&
          n.content.toLowerCase().includes(searchQuery.value.toLowerCase()));
      return matchesTab && matchesSearch;
    });
  });
  const hasValidImage = (notification: Notification) => {
    return (
      notification.image &&
      typeof notification.image === 'string' &&
      notification.image.trim() !== '' &&
      notification.image !== 'null' &&
      notification.image !== 'undefined'
    );
  };
  const handleImageError = (event: Event) => {
    const img = event.target as HTMLImageElement;
    const container = img.closest('.image-container') as HTMLElement;
    if (container) {
      container.style.display = 'none';
    }
  };
  const handleDeleteClick = async (notification: Notification) => {
    const confirmed = await showDeleteDialog('notification');
    if (confirmed) {
      try {
        await notificationApi.deleteNotification(Number(notification.templateId || notification.id));
        ElNotification({
          title: 'Success',
          message: 'Notification deleted successfully',
          type: 'success',
          duration: 2000,
        });
        emit('refresh', true);
      } catch (error: any) {
        ElNotification({
          title: 'Error',
          message: error?.response?.data?.responseMessage || error?.message || 'Failed to delete notification',
          type: 'error',
          duration: 2000,
        });
      }
    }
  };
  const handlePublishClick = (notification: Notification) => {
    emit('publish', notification);
  };
  const handleEditClick = (notification: Notification) => {
    const editId = notification.templateId || notification.id;
    router.push(`/notifications/edit/${editId}?fromTab=${props.activeTab}`);
  };
  const handleViewClick = (notification: Notification) => {
    const viewId = notification.templateId || notification.id;
    router.push(`/notifications/view/${viewId}?fromTab=${props.activeTab}`);
  };
  const handleApprovalNowClick = async (notification: Notification) => {
    const templateId = notification.templateId || notification.id;
    const viewId = templateId;
    // [console.log removed]

    if (
      notification.sendType === 'SEND_SCHEDULE' &&
      notification.scheduledTime
    ) {
      try {
        const { api } = await import('@/services/api');
        const fullTemplateResponse = await api.get(
          `/api/v1/template/${templateId}`
        );
        const template =
          fullTemplateResponse.data?.data || fullTemplateResponse.data;

        // [console.log removed]

        if (template?.sendSchedule) {
          const scheduledTime = new Date(template.sendSchedule);
          const now = new Date();

          const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);

          // [console.log removed]

          if (scheduledTime < oneMinuteAgo) {
    

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
                // [console.log removed]
                ElNotification({
                  title: 'Notification Expired',
                  message: `<strong>Scheduled time has expired</strong>. Please contact <strong>team member</strong> to update the schedule first.`,
                  type: 'warning',
                  duration: 5000,
                  dangerouslyUseHTMLString: true,
                });

                emit('switch-tab', 'draft');
                setTimeout(() => {
                  emit('refresh', true); // Force refresh to show updated status
                }, 500);
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
                emit('switch-tab', 'draft');
                setTimeout(() => {
                  emit('refresh', true);
                }, 500);
                return;
              }
            }
          } else {
            // [console.log removed]
            router.push(
              `/notifications/view/${viewId}?fromTab=${props.activeTab}`
            );
          }
        } else {
          // [console.log removed]
          router.push(
            `/notifications/view/${viewId}?fromTab=${props.activeTab}`
          );
        }
      } catch (error) {
        // [console.error removed]
        router.push(`/notifications/view/${viewId}?fromTab=${props.activeTab}`);
      }
    } else {
      // [console.log removed]
      router.push(`/notifications/view/${viewId}?fromTab=${props.activeTab}`);
    }
  };
  const handleApproveClick = async (notification: Notification) => {
    const templateId = notification.templateId || notification.id;
    // [console.log removed]

    try {
      const { api } = await import('@/services/api');
      const fullTemplate = await api.get(`/api/v1/template/${templateId}`);
      const template = fullTemplate.data?.data || fullTemplate.data;
      // [console.log removed]

      if (props.activeTab === 'draft') {
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
          ElNotification({
            title: 'Error',
            message:
              'Please check data again. This template is missing required fields (title or content).',
            type: 'error',
            duration: 4000,
            dangerouslyUseHTMLString: true,
          });
          return;
        }
      }

      // [console.log removed]
      const result = await notificationApi.approveTemplate(Number(templateId));
      // [console.log removed]

      const updatedTemplateResponse = await api.get(
        `/api/v1/template/${templateId}`
      );
      const updatedTemplate =
        updatedTemplateResponse.data?.data || updatedTemplateResponse.data;

      // [console.log removed]

      const isScheduled =
        (updatedTemplate?.sendType === 'SEND_SCHEDULE' ||
          updatedTemplate?.sendSchedule !== null) &&
        updatedTemplate?.isSent === false;

      const redirectTab = isScheduled ? 'scheduled' : 'published';

      const message = isScheduled
        ? '<strong>Notification approved successfully!</strong> It will be sent at the scheduled time and moved to Published tab automatically.'
        : '<strong>Notification approved and published successfully!</strong> Users will receive it shortly.';

      ElNotification({
        title: 'Success',
        message: message,
        type: 'success',
        duration: 3000,
        dangerouslyUseHTMLString: true,
      });

      emit('switch-tab', redirectTab);
      emit('refresh');
    } catch (error: any) {
      // [console.log removed]

      const errorMessage =
        error.response?.data?.responseMessage || error.message || '';
      const isNoUsersError =
        error.response?.data?.errorCode ===
          ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM ||
        errorMessage.includes('No users found for') ||
        errorMessage.includes('No users match');

      if (isNoUsersError) {

        ElNotification({
          title: 'Warning',
          message: formatNoUsersFoundMessage(errorMessage),
          type: 'warning',
          duration: 8000,
          dangerouslyUseHTMLString: true,
          showClose: true,
        });
        emit('refresh', true);
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

      // [console.log removed]

      if (isAutoExpired) {
        // [console.log removed]
        ElNotification({
          title: 'Notification Expired',
          message: `<strong>Scheduled time has expired</strong>. Please contact <strong>team member</strong> to update the schedule first.`,
          type: 'warning',
          duration: 5000,
          dangerouslyUseHTMLString: true,
        });

        // [console.log removed]
        emit('switch-tab', 'draft');
        setTimeout(() => {
          emit('refresh', true); // Force refresh to show updated status
        }, 500); // Small delay to ensure backend has updated
      } else if (isAutoRejected) {
        ElNotification({
          title: 'Notification Rejected',
          message: rejectionReason,
          type: 'warning',
          duration: 5000,
        });

        emit('switch-tab', 'draft');
        emit('refresh', true); // Force refresh to show updated status
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
  const handleSubmitClick = async (notification: Notification) => {
    try {
      const templateId = notification.templateId || notification.id;

      const { api } = await import('@/services/api');
      const fullTemplate = await api.get(`/api/v1/template/${templateId}`);
      const template = fullTemplate.data?.data || fullTemplate.data;

      const translations = template?.translations || [];
      let hasAllRequiredData = true;
      const missingFields: string[] = [];
      for (const translation of translations) {
        const hasTitle = translation?.title && translation.title.trim() !== '';
        const hasContent =
          translation?.content && translation.content.trim() !== '';
        if (!hasTitle) {
          hasAllRequiredData = false;
          missingFields.push(`Title (${translation.language})`);
        }
        if (!hasContent) {
          hasAllRequiredData = false;
          missingFields.push(`Content (${translation.language})`);
        }
      }
      if (!hasAllRequiredData) {
        ElNotification({
          title: 'Error',
          message: 'Please check data, fill data missing on required field.',
          type: 'error',
          duration: 4000,
        });
        return;
      }

      const response = await notificationApi.submitTemplate(Number(templateId));

      const updatedNotification = {
        ...notification,
        approvalStatus: 'PENDING' as const,
      };

      ElNotification({
        title: 'Success',
        message:
          '<strong>Notification has been submitted for approval</strong>. It will appear in the Pending Approval tab.',
        type: 'success',
        duration: 3000,
        dangerouslyUseHTMLString: true,
      });

      emit('update-notification', updatedNotification);
      emit('switch-tab', 'pending');
      emit('refresh');
    } catch (error: any) {
      const errorMessage =
        error.response?.data?.responseMessage ||
        error.message ||
        'Failed to submit template for approval';

      const isNoUsersError =
        error.response?.data?.errorCode ===
          ErrorCode.NO_USERS_FOR_BAKONG_PLATFORM ||
        errorMessage.includes('No users found for') ||
        errorMessage.includes('No users match');

      if (isNoUsersError) {
        ElNotification({
          title: 'Warning',
          message: formatNoUsersFoundMessage(errorMessage),
          type: 'warning',
          duration: 8000,
          dangerouslyUseHTMLString: true,
          showClose: true,
        });
        emit('refresh', true);
        return;
      }

      const isExpiredTemplateError =
        errorMessage.includes('scheduled time was set') ||
        errorMessage.includes('has now passed') ||
        errorMessage.includes('expired') ||
        error.response?.data?.data?.scheduleTimeDisplay;

      let formattedMessage = errorMessage;
      if (isExpiredTemplateError) {
        const scheduleTimeDisplay =
          error.response?.data?.data?.scheduleTimeDisplay;
        if (scheduleTimeDisplay) {
          formattedMessage = `The request was not approved in time, and the scheduled time <strong>${scheduleTimeDisplay}</strong>, has already passed. Please update the schedule and resubmit.`; // `The scheduled   time was set to <strong>${scheduleTimeDisplay}</strong> and the scheduled time <strong>${scheduleTimeDisplay}</strong> has already passed. Please update the schedule and resubmit.`;
        } else if (errorMessage.includes('scheduled time was set')) {
          formattedMessage = errorMessage.replace(
            /The scheduled time was set to (.+?), and it has now passed/,
            'The scheduled time was set to <strong>$1</strong>, and it has now passed'
          );
        }
      }

      ElNotification({
        title: isExpiredTemplateError ? 'Warning' : 'Error',
        message: formattedMessage,
        type: isExpiredTemplateError ? 'warning' : 'error',
        duration: 5000,
        dangerouslyUseHTMLString:
          isExpiredTemplateError && formattedMessage.includes('<strong>'),
      });
    }
  };
  const handlePublishNowClick = async (notification: Notification) => {
    const loadingNotification = ElNotification({
      title: 'Sending Notification',
      message:
        'Please wait while we send the notification to all users. This may take a moment if there are many recipients...',
      type: 'info',
      duration: 0, // Keep it open until we close it manually
    });
    try {
      const templateId = notification.templateId || notification.id;

      const { api } = await import('@/services/api');
      const fullTemplate = await api.get(`/api/v1/template/${templateId}`);
      const template = fullTemplate.data?.data || fullTemplate.data;

      const updatePayload: any = {
        isSent: true, // Only change this - send immediately
        sendType: template?.sendType || 'SEND_NOW',
        sendSchedule: template?.sendSchedule || null,
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
        Number(templateId),
        updatePayload
      );

      loadingNotification.close();

      // Check for warning response from backend (expired schedule)
      if (result?.responseCode === 2) {
        ElNotification({
          title: 'Warning',
          message: result.responseMessage,
          type: 'warning',
          duration: 8000,
          dangerouslyUseHTMLString: true,
          showClose: true,
        });

        emit('switch-tab', 'draft');
        setTimeout(() => {
          emit('refresh', true);
        }, 500);
        return;
      }

      const responseData = result?.data || result;
      const successfulCount = responseData?.successfulCount || 0;
      const failedCount = responseData?.failedCount || 0;
      const isSent = responseData?.isSent === true;
      const approvalStatus = responseData?.approvalStatus;

      emit('switch-tab', 'published');

      await new Promise((resolve) => setTimeout(resolve, 50));
      emit('refresh', true); // Pass true to force refresh (bypass cache)

      if (isSent || approvalStatus === 'APPROVED') {
        if (successfulCount > 0) {
          ElNotification({
            title: 'Success',
            message: `<strong>Notification published and sent to ${successfulCount} user(s) immediately.</strong>${failedCount > 0 ? ` (${failedCount} failed)` : ''} please wait for a moment to see the notification on the user's device.`,
            type: 'success',
            duration: 3000,
            dangerouslyUseHTMLString: true,
          });
        } else {
          ElNotification({
            title: 'Success',
            message:
              "<strong>Notification published and sent to users immediately.</strong> please wait for a moment to see the notification on the user's device.",
            type: 'success',
            duration: 3000,
            dangerouslyUseHTMLString: true,
          });
        }
      } else {
        const verifyTemplate = await api.get(`/api/v1/template/${templateId}`);
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
    } catch (error: any) {
      loadingNotification.close();

      ElNotification({
        title: 'Error',
        message:
          error.response?.data?.responseMessage ||
          'Failed to publish notification',
        type: 'error',
        duration: 3000,
      });
      emit('refresh', true);
    }
  };
  const handleRejectClick = async (notification: Notification) => {
    const result = await showRejectDialog();
    if (result.confirmed && result.reason) {
      try {
        const templateId = notification.templateId || notification.id;
        await notificationApi.rejectTemplate(Number(templateId), result.reason);

        ElNotification({
          title: 'Success',
          message:
            'Template <strong>rejected<strong> successfully and moved to <strong>Draft tab</strong>',
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

        emit('switch-tab', 'draft');
        emit('refresh', true);
      } catch (error: any) {
        ElNotification({
          title: 'Error',
          message:
            error.response?.data?.responseMessage ||
            'Failed to reject template',
          type: 'error',
          duration: 3000,
        });
      }
    }
  };
</script>
<style scoped>
  .notification-container {
    width: 100%;
  }
  .notification-wrapper {
    width: 100%;
    margin: 0 auto;
  }
  .tab-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .tab-button {
    padding: 0.5rem 1.5rem;
    border-radius: 9999px;
    font-weight: 500;
    font-size: 0.875rem;
    transition: all 0.15s ease-in-out;
    border: none;
    cursor: pointer;
    background-color: #f1f5f9;
    color: #0f172a;
  }
  .tab-button:hover {
    background-color: #e2e8f0;
  }
  .tab-button-active {
    background-color: #0f172a;
    color: white;
  }
  .filter-container {
    display: flex;
    align-items: center;
    gap: 1rem;
    margin-bottom: 2rem;
  }
  .filter-select {
    padding: 0.75rem 1rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
    background-color: white;
  }
  .filter-select:focus {
    border-color: #9ca3af;
  }
  .search-container {
    position: relative;
    flex: 1;
    max-width: 20rem;
  }
  .search-input {
    width: 100%;
    padding: 0.75rem 1rem;
    padding-right: 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
  }
  .search-input:focus {
    border-color: #9ca3af;
  }
  .search-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
  }
  .date-container {
    position: relative;
    flex: 1;
  }
  .date-input {
    width: 100%;
    padding: 0.75rem 1rem;
    padding-right: 2.5rem;
    border: 1px solid #d1d5db;
    border-radius: 0.5rem;
    font-size: 0.875rem;
    outline: none;
  }
  .date-input:focus {
    border-color: #9ca3af;
  }
  .date-icon {
    position: absolute;
    right: 0.75rem;
    top: 50%;
    transform: translateY(-50%);
    width: 1.25rem;
    height: 1.25rem;
    color: #9ca3af;
  }
  .grid-container {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(350px, 1fr));
    gap: 20px;
    width: 100%;
    max-width: 100%;
  }
  .notification-card {
    width: 100%;
    min-height: 254.5px;
    background-color: white;
    border-radius: 0;
    overflow: visible;
    border: none;
    display: flex;
    flex-direction: column;
    gap: 12px;
    flex-shrink: 0;
    box-sizing: border-box;
  }
  .notification-card:has(.image-container) {
    min-height: 472.5px;
  }
  .card-content {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 4px;
    width: 100%;
    max-height: 143.5px;
  }
  .author-text {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 13px;
    line-height: 150%;
    color: #000000;
    margin: 0;
    width: 100%;
    height: 20px;
  }
  .title-text {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 600;
    font-size: 18px;
    line-height: 150%;
    color: #000000;
    margin: 0;
    width: 100%;
    max-height: 54px;
    display: -webkit-box;
    -webkit-line-clamp: 2;
    line-clamp: 2;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .description-text {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 13px;
    line-height: 150%;
    color: #000000;
    margin: 0;
    width: 100%;
    height: 55.5px;
    display: -webkit-box;
    -webkit-line-clamp: 3;
    line-clamp: 3;
    -webkit-box-orient: vertical;
    overflow: hidden;
  }
  .image-container {
    width: 100%;
    height: 218px;
    overflow: hidden;
    display: flex;
    align-items: center;
    justify-content: center;
    background-color: transparent;
    position: relative;
  }
  .card-image {
    width: 100%;
    height: 100%;
    object-fit: contain;
    object-position: center;
    border: none;
    display: block;
  }
  .card-footer {
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 12px;
    width: 100%;
    min-width: 0;
    overflow: visible;
    border: none;
    background-color: transparent;
  }
  .date-text {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 13px;
    line-height: 150%;
    color: #000000;
    margin: 0;
    width: 100%;
    height: 20px;
  }
  .scheduled-text {
    font-family: 'IBM Plex Sans';
    font-style: normal;
    font-weight: 400;
    font-size: 13px;
    line-height: 150%;
    color: #000000;
    margin: 0;
    width: 100%;
    height: 20px;
  }
  .button-container {
    display: flex;
    flex-direction: row;
    align-items: center;
    gap: 8px;
    width: 100%;
    min-height: 56px;
    min-width: 0;
    overflow: visible;
    flex-wrap: wrap;
  }
  .publish-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 123px;
    height: 56px;
    flex: 0 0 auto;
    background: #0f4aea;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    order: 0;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .publish-button:hover {
    background: #0d3bc7;
  }
  .submit-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 123px;
    height: 56px;
    flex: 0 0 auto;
    background: #0f4aea;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    order: 0;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .submit-button:hover {
    background: #0d3bc7;
  }
  .edit-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 93px;
    height: 56px;
    flex: 0 0 auto;
    background: rgba(0, 19, 70, 0.05);
    backdrop-filter: blur(64px);
    border-radius: 32px;
    border: none;
    cursor: pointer;
    order: 1;
    color: #001346;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .edit-button:hover {
    background: rgba(0, 19, 70, 0.1);
  }
  .delete-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 113px;
    height: 56px;
    flex: 0 0 auto;
    background: #f24444;
    backdrop-filter: blur(64px);
    border-radius: 32px;
    border: none;
    cursor: pointer;
    order: 2;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .delete-button:hover:not(:disabled) {
    background: #e03e3e;
  }
  .delete-button.disabled,
  .delete-button:disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    opacity: 0.6;
    cursor: not-allowed !important;
    pointer-events: none;
  }
  .delete-button.disabled:hover,
  .delete-button:disabled:hover {
    background: #9ca3af !important;
    opacity: 0.6;
  }
  .approval-badge {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 12px;
    font-size: 12px;
    font-weight: 500;
    height: 24px;
  }
  .approval-badge-tag {
    display: inline-flex;
    align-items: center;
    padding: 4px 12px;
    border-radius: 16px;
    font-size: 12px;
    font-weight: 500;
    margin-left: 8px;
    height: 24px;
    white-space: nowrap;
  }
  .approval-badge-tag.badge-pending {
    background-color: #fef3c7;
    color: #92400e;
  }
  .approval-badge-tag.badge-approved {
    background-color: #d1fae5;
    color: #065f46;
  }
  .approval-badge-tag.badge-rejected {
    background-color: #fee2e2;
    color: #991b1b;
  }
  .approval-badge-tag.badge-expired {
    background-color: #fef3c7;
    color: #92400e;
  }
  .view-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 93px;
    height: 56px;
    flex: 0 0 auto;
    background: rgba(0, 19, 70, 0.05);
    backdrop-filter: blur(64px);
    border-radius: 32px;
    border: none;
    cursor: pointer;
    color: #001346;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .view-button:hover:not(:disabled) {
    background: rgba(0, 19, 70, 0.1);
  }
  .view-button:disabled,
  .view-button.disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: none;
  }
  .view-button:disabled:hover,
  .view-button.disabled:hover {
    background: #9ca3af !important;
    color: #6b7280 !important;
  }
  .approval-now-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 130px;
    height: 56px;
    flex: 0 0 auto;
    background: #10b981;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .approval-now-button:hover:not(:disabled) {
    background: #059669;
  }
  .approval-now-button:disabled,
  .approval-now-button.disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: none;
  }
  .approval-now-button:disabled:hover,
  .approval-now-button.disabled:hover {
    background: #9ca3af !important;
  }
  .publish-now-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 130px;
    height: 56px;
    flex: 0 0 auto;
    background: #0f4aea;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .publish-now-button:hover:not(:disabled) {
    background: #0d3bc7;
  }
  .publish-now-button:disabled,
  .publish-now-button.disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: none;
  }
  .publish-now-button:disabled:hover,
  .publish-now-button.disabled:hover {
    background: #9ca3af !important;
  }
  .approve-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 100px;
    height: 56px;
    flex: 0 0 auto;
    background: #10b981;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .approve-button:hover:not(:disabled) {
    background: #059669;
  }
  .approve-button:disabled,
  .approve-button.disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: none;
  }
  .approve-button:disabled:hover,
  .approve-button.disabled:hover {
    background: #9ca3af !important;
  }
  .reject-button {
    display: flex;
    flex-direction: row;
    justify-content: center;
    align-items: center;
    padding: 8px 12px;
    gap: 6px;
    min-width: 100px;
    height: 56px;
    flex: 0 0 auto;
    background: #ef4444;
    border-radius: 32px;
    border: none;
    cursor: pointer;
    color: white;
    font-size: 16px;
    font-weight: 500;
    transition: background-color 0.15s ease-in-out;
  }
  .reject-button:hover:not(:disabled) {
    background: #dc2626;
  }
  .reject-button:disabled,
  .reject-button.disabled {
    background: #9ca3af !important;
    color: #6b7280 !important;
    cursor: not-allowed !important;
    opacity: 0.6;
    pointer-events: none;
  }
  .reject-button:disabled:hover,
  .reject-button.disabled:hover {
    background: #9ca3af !important;
  }
  .button-icon {
    width: 24px;
    height: 24px;
  }
  .empty-state {
    display: flex;
    justify-content: center;
    align-items: flex-start;
    width: 100%;
    height: 100%;
    min-height: 400px;
    grid-column: 1 / -1;
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
  @media (max-width: 1400px) {
    .grid-container {
      gap: 20px;
    }
  }
  @media (max-width: 1200px) {
    .grid-container {
      gap: 16px;
      grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
    }
    .button-container {
      gap: 6px;
    }
    .publish-button,
    .submit-button,
    .edit-button,
    .delete-button {
      min-width: 0;
      flex: 1;
      padding: 8px 4px;
      font-size: 14px;
    }
  }
  @media (max-width: 768px) {
    .grid-container {
      grid-template-columns: 1fr;
      gap: 16px;
    }
    .button-container {
      flex-wrap: nowrap;
    }
    .publish-button,
    .submit-button,
    .edit-button,
    .delete-button {
      flex: 1;
      min-width: 0;
    }
  }
  .loading-state {
    display: flex;
    justify-content: center;
    align-items: center;
    width: 100%;
    height: 200px;
    grid-column: 1 / -1;
  }
  .loading-text {
    color: #7a8190;
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
    grid-column: 1 / -1;
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
</style>
