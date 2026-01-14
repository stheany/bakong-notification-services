<template>
  <div class="app-layout">
    <div class="header" :class="{ expanded: isSidebarCollapsed }">
      <div class="header-content">
        <div class="page-title">
          <h1>{{ pageTitle }}</h1>
          <div class="breadcrumb">
            <span class="breadcrumb-text">Notification</span>
            <span class="breadcrumb-separator">></span>
            <span class="breadcrumb-current">{{ breadcrumbCurrent }}</span>
          </div>
        </div>

        <div class="header-actions">
          <el-button
            type="primary"
            class="create-notification-btn"
            @click="handleCreateNotification"
          >
            Create Notification
            <div class="plus-icon">
              <el-icon>
                <CirclePlus />
              </el-icon>
            </div>
          </el-button>

          <div class="user-avatar">
            <img
              :src="avatarImage"
              alt="User Avatar"
              class="user-image"
              @click="handleGoToSettings"
            />
          </div>
        </div>
      </div>
    </div>

    <div class="sidebar">
      <div class="sidebar-header">
        <div class="logo">
          <img :src="nbcLogo" alt="NBC Logo" class="logo-image" />
        </div>
      </div>

      <nav class="sidebar-nav">
        <div class="nav-section">
          <div class="nav-section-title">Notification</div>
          <div class="nav-item" :class="{ active: isHomeActive }" @click="handleHomeClick">
            <img :src="homeIcon" alt="Home" class="nav-icon" />
            <span>Home</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-item" :class="{ active: isScheduleActive }" @click="handleScheduleClick">
            <img :src="calendarIcon" alt="Schedule" class="nav-icon" />
            <span>Schedule</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-item" :class="{ active: isTypeActive }" @click="handleTypeClick">
            <img :src="typeIcon" alt="Type" class="nav-icon" />
            <span>Type</span>
          </div>
        </div>

        <div class="nav-section">
          <div class="nav-section-title">Tools</div>

          <div
            class="nav-item"
            :class="{ active: $route.name === 'insight' }"
            @click="handleInsightClick"
          >
            <img :src="chartIcon" alt="Insight" class="nav-icon" />
            <span>Insight</span>
          </div>

          <div
            class="nav-item"
            :class="{ active: $route.name === 'settings' }"
            @click="handleGoToSettings"
          >
            <img :src="settingsIcon" alt="Setting" class="nav-icon" />
            <span>Setting</span>
          </div>

          <!-- ✅ API Version Switch -->
          <div class="nav-item">
          <div class="api-toggle">
            <span class="api-toggle-label">API</span>
            <el-switch
              v-model="apiSwitch"
              inline-prompt
              active-text="v2"
              inactive-text="v1"
            />
            <span class="api-toggle-version">{{ apiVersion }}</span>
          </div>
          </div>
        </div>
      </nav>

      <div class="sidebar-footer" @click="toggleSidebar">
        <div class="collapse-btn">
          <el-icon class="collapse-icon">
            <ArrowRight v-if="isSidebarCollapsed" />
            <ArrowLeft v-else />
          </el-icon>
        </div>
      </div>
    </div>

    <div class="main-content" :class="{ expanded: isSidebarCollapsed }">
      <router-view />
    </div>

    <ElDialog
      v-model="logoutDialogVisible"
      title="Logout Confirmation"
      width="400px"
      :modal-append-to-body="false"
      :close-on-click-modal="false"
      class="custom-logout-dialog"
    >
      <div class="dialog-content">
        <el-icon style="font-size: 20px; margin-right: 8px">
          <Warning class="red" />
        </el-icon>
        <span style="font-size: 14px">Are you sure you want to logout?</span>
      </div>

      <template #footer>
        <div class="dialog-footer" style="padding: 0">
          <ElButton @click="logoutDialogVisible = false">Cancel</ElButton>
          <ElButton type="primary" @click="confirmLogout">Logout</ElButton>
        </div>
      </template>
    </ElDialog>
  </div>
</template>

<script setup lang="ts">
  import { ref, computed } from 'vue'
  import { useRouter, useRoute } from 'vue-router'
  import { ElNotification, ElDialog } from 'element-plus'
  import { ArrowLeft, ArrowRight, Warning, CirclePlus } from '@element-plus/icons-vue'
  import { useAuthStore } from '@/stores/auth'
  
  // Images
  import nbcLogo from '@/assets/image/NBC-logo.png'
  import homeIcon from '@/assets/image/home.jpg'
  import calendarIcon from '@/assets/image/calendar--heat-map.jpg'
  import typeIcon from '@/assets/image/type-pattern.jpg'
  import chartIcon from '@/assets/image/chart--bar-target.jpg'
  import settingsIcon from '@/assets/image/settings_16.jpg'
  import avatarImage from '@/assets/image/avatar.png'
  
  // ✅ API helpers (single source)
  import { getApiVersion, setApiVersion, type ApiVersion } from '@/services/apiPrefix'
  
  const authStore = useAuthStore()
  const router = useRouter()
  const route = useRoute()
  const logoutDialogVisible = ref(false)
  const isSidebarCollapsed = ref(false)

  const toggleSidebar = () => {
    isSidebarCollapsed.value = !isSidebarCollapsed.value
  }
  
  // ✅ API version state
  const apiVersion = computed(() => getApiVersion())
  
  const apiSwitch = computed({
    get: () => apiVersion.value === 'v2',
    set: (val: boolean) => {
      setApiVersion(val ? 'v2' : 'v1')
      window.location.reload()
    },
  })
  
  // ✅ Menu active states
  const isHomeActive = computed(() => route.name === 'home' || route.name === 'home-v2')
  const isScheduleActive = computed(() => route.name === 'schedule')
  const isTypeActive = computed(() => route.name === 'category-type' || route.name === 'category-type-v2')
  
  // ✅ nav click handlers
  const handleHomeClick = () => router.push('/')
  const handleScheduleClick = () => router.push('/schedule')
  const handleTypeClick = () => router.push('/category-type')
  
  // ✅ Create Notification route depends on selected API version
  const handleCreateNotification = () => {
    const v: ApiVersion = getApiVersion()
    router.push(v === 'v2' ? '/v2/notifications/create' : '/notifications/create')
  }
  
  const handleGoToSettings = () => router.push('/settings')
  
  const handleInsightClick = () => {
    ElNotification({ title: 'Info', type: 'info', message: 'This feature is coming soon!' })
  }
  
  const confirmLogout = () => {
    logoutDialogVisible.value = false
    authStore.logout()
    ElNotification({ title: 'Success', type: 'success', message: 'Logged out successfully' })
    router.push('/login')
  }


    
  // Header texts
  const pageTitle = computed(() => {
    switch (route.name) {
      case 'home':
      case 'home-v2':
        return 'Notification'
      case 'schedule':
        return 'Schedule'
      default:
        return 'Home'
    }
  })
  
  const breadcrumbCurrent = computed(() => {
    switch (route.name) {
      case 'home':
      case 'home-v2':
        return 'Home'
      case 'create-notification':
      case 'create-notification-v2':
        return 'Create notification'
      case 'edit-notification':
      case 'edit-notification-v2':
        return 'Edit notification'
      case 'schedule':
        return 'Schedule'
      default:
        return 'Home'
    }
  })
  </script>
  

<style scoped>
.app-layout {
  position: fixed;
  top: 0;
  left: 0;
  width: 100vw;
  height: 100vh;
  background-color: #fff;
  font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
  overflow: hidden;
}

.header {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  justify-content: space-between;
  align-items: center;
  padding: 0px 32px;
  position: fixed;
  width: calc(100vw - 200px);
  height: 90px;
  left: 200px;
  top: 0;
  border-bottom: 1px solid rgba(0, 19, 70, 0.05);
  background: #fff;
  z-index: 1000;
}

.header-content {
  display: flex;
  justify-content: space-between;
  align-items: center;
  width: 100%;
}

.page-title h1 {
  font-size: 24px;
  font-weight: 700;
  color: #001346;
  margin: 0;
}

.breadcrumb {
  font-size: 14px;
  color: #666;
  margin-top: 4px;
  display: flex;
  align-items: center;
  gap: 4px;
}

.breadcrumb-text {
  color: #666;
}

.breadcrumb-separator {
  font-weight: bold;
  color: #666;
}

.breadcrumb-current {
  font-weight: bold;
  color: #001346;
}

.header-actions {
  display: flex;
  align-items: center;
  gap: 16px;
}

.create-notification-btn {
  display: flex;
  flex-direction: row;
  justify-content: center;
  align-items: center;
  padding: 8px 16px;
  gap: 4px;
  width: 234px;
  height: 56px;
  background: rgba(0, 19, 70, 0.05);
  backdrop-filter: blur(64px);
  border-radius: 32px;
  flex: none;
  flex-grow: 0;
  color: #001346;
  font-family: 'IBM Plex Sans', sans-serif;
  font-weight: 600;
  font-size: 16px;
  line-height: 150%;
  letter-spacing: 0;
  border: none;
  transition: all 0.3s ease;
}

.create-notification-btn:hover {
  background: rgba(0, 19, 70, 0.1);
}

.plus-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 24px;
  height: 24px;
  margin-left: 8px;
}

.plus-icon .el-icon {
  font-size: 24px;
  color: #001346;
}

.user-avatar {
  cursor: pointer;
}

.user-image {
  width: 56px;
  height: 56px;
  border-radius: 50%;
  object-fit: cover;
}

.sidebar {
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  align-items: flex-start;
  padding: 0px;
  position: fixed;
  width: 200px;
  height: 100vh;
  left: 0px;
  top: 0px;
  border-right: 1px solid rgba(0, 19, 70, 0.1);
  background: #fff;
  z-index: 999;
}

.sidebar-header {
  box-sizing: border-box;
  display: flex;
  flex-direction: row;
  align-items: center;
  padding: 0px;
  gap: 8px;
  width: 200px;
  height: 90px;
  border-bottom: 1px solid rgba(0, 19, 70, 0.1);
  flex: none;
  order: 0;
  align-self: stretch;
  flex-grow: 0;
}

.logo {
  position: relative;
  width: 90px;
  height: 90px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex: none;
  order: 0;
  flex-grow: 0;
}

.logo-image {
  position: absolute;
  width: 48.63px;
  height: 52.33px;
  left: calc(50% - 48.63px / 2 - 0.31px);
  top: calc(50% - 52.33px / 2 + 0.11px);
  object-fit: contain;
}

.sidebar-nav {
  flex: 1;
  padding: 0;
  width: 100%;
}

.nav-section {
  margin-bottom: 24px;
}

.nav-section-title {
  font-size: 14px;
  font-weight: 600;
  color: #001346;
  padding: 8px 16px;
  margin-bottom: 8px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  cursor: pointer;
  transition: all 0.3s ease;
  color: #666;
  font-weight: 500;
  font-size: 14px;
  position: relative;
  margin: 4px 0;
}

.nav-item:hover {
  background: rgba(102, 153, 255, 0.05);
  color: #001346;
}

.nav-item.active {
  background: var(--opacity-secondary-opacity-5, #0013460d);
  color: #001346;
  font-weight: 600;
}

.nav-item.active::after {
  content: '';
  position: absolute;
  right: 0;
  top: 0;
  bottom: 0;
  width: 3px;
  opacity: 70%;
  background: #001346;
  border-radius: 2px 0 0 2px;
}

.nav-icon {
  width: 18px;
  height: 18px;
  object-fit: contain;
}

.sidebar-footer {
  padding: 16px;
  display: flex;
  justify-content: flex-end;
  align-items: center;
  cursor: pointer;
  width: 100%;
  min-height: 64px;
  box-sizing: border-box;
  flex-shrink: 0;
}

.sidebar.collapsed .sidebar-footer {
  justify-content: center;
  padding: 16px;
}


.collapse-btn {
  width: 32px;
  height: 32px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  border-radius: 6px;
  transition: all 0.3s ease;
}

.collapse-btn:hover {
  background: rgba(0, 19, 70, 0.1);
}

.collapse-icon {
  font-size: 16px;
  color: #001346;
}

.main-content {
  position: fixed;
  left: 200px;
  top: 89px;
  width: calc(100vw - 200px);
  height: calc(100vh - 90px);
  padding: 25px 25px 0px 32px;
  overflow: hidden;
  background: #fff;
}

/* ✅ Toggle style */
.api-toggle {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 8px 12px;
  border-radius: 16px;
  background: rgba(0, 19, 70, 0.03);
  border: 1px solid rgba(0, 19, 70, 0.06);
}

.api-toggle-label {
  font-weight: 600;
  color: #001346;
  font-size: 14px;
}

.api-toggle-version {
  font-weight: 700;
  color: #001346;
  opacity: 0.7;
  font-size: 13px;
}

.dialog-footer {
  display: flex;
  justify-content: flex-end;
  gap: 12px;
}

.custom-logout-dialog .el-dialog__body {
  padding: 0;
}

.dialog-content {
  display: flex;
  align-items: center;
  font-size: 14px;
  padding: 0;
}

@media (max-width: 768px) {
  .header {
    left: 0;
    width: 100vw;
    padding: 0 16px;
  }

  .sidebar {
    position: fixed;
    left: -200px;
    transition: left 0.3s ease;
  }

  .sidebar.open {
    left: 0;
  }

  .main-content {
    left: 0;
    width: 100vw;
    padding: 16px;
  }
}
</style>
