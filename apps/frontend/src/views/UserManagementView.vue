<template>
  <div class="w-full p-4 md:p-6 lg:p-8">
    <div class="max-w-7xl mx-auto flex flex-col min-h-[350px]">
      <div class="h-auto sm:h-[56px] flex-shrink-0 !mb-4">
        <NotificationTableHeader
          v-model="searchQuery"
          @addNew="addNew"
          @filter="filter"
          @search="handleSearch"
        />
      </div>
      <div class="flex-1 w-full" style="min-height: 434px">
        <UserTableBody
          :users="filteredUsers"
          @view="handleView"
          @edit="handleEdit"
          @delete="handleDelete"
          @status-toggle="handleStatusToggle"
        />
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import NotificationTableHeader from '@/components/common/Type-Feature/NotificationTableHeader.vue'
import UserTableBody, {
  type UserTableItem,
} from '@/components/common/User-Feature/UserTableBody.vue'
import { ref, computed } from 'vue'
import { mockUsers } from '../../Data/mockUsers'

const searchQuery = ref('')

const users = ref<UserTableItem[]>(mockUsers)

const filteredUsers = computed(() => {
  if (!searchQuery.value.trim()) {
    return users.value
  }

  const query = searchQuery.value.toLowerCase()
  return users.value.filter(
    (user) =>
      user.name?.toLowerCase().includes(query) ||
      user.email?.toLowerCase().includes(query) ||
      user.phoneNumber?.toLowerCase().includes(query) ||
      user.role?.toLowerCase().includes(query),
  )
})

const addNew = () => {
  console.log('addNew')
}

const filter = () => {
  console.log('filter')
}

const handleSearch = () => {
  console.log('handleSearch', searchQuery.value)
}

const handleView = (user: UserTableItem) => {
  console.log('View user:', user)
}

const handleEdit = (user: UserTableItem) => {
  console.log('Edit user:', user)
}

const handleDelete = (user: UserTableItem) => {
  console.log('Delete user:', user)
}

const handleStatusToggle = (user: UserTableItem, index: number) => {
  const currentUser = users.value[index]
  if (currentUser) {
    currentUser.status = currentUser.status === 'Active' ? 'Deactivate' : 'Active'
    console.log('Status toggled for user:', currentUser)
  }
}
</script>

<style scoped></style>
