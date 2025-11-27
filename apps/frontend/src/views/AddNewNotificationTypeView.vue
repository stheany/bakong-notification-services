<template>
  <div class="min-h-screen p-4 md:p-8">
    <!-- Main Content Container with responsive dimensions -->
    <div class="max-w-2xl mx-auto">
      <!-- Notification Type Form -->
      <div class="bg-white rounded-lg p-6 md:p-8 flex flex-col gap-3">
        <!-- File Upload Section -->
        <ImageUpload
          v-model="selectedFile"
          accept-types="image/png"
          :max-size="819200"
          format-text="Supported format: PNG (120x120px)"
          size-text="Maximum size: 800KB"
          @file-selected="handleFileSelected"
          @file-removed="handleFileRemoved"
          @error="handleUploadError"
        />

        <!-- Type Name Input -->
        <div class="w-full flex flex-col gap-[7px] opacity-100" style="transform: rotate(0deg)">
          <label
            class="text-[#011246]"
            style="
              font-family: 'IBM Plex Sans', sans-serif;
              font-weight: 400;
              font-size: 14px;
              line-height: 150%;
              letter-spacing: 0%;
            "
            >Type name <span class="text-red-500">*</span></label
          >
          <input
            v-model="typeName"
            type="text"
            placeholder="Product and feature"
            required
            class="w-full border-gray-300 focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none"
            style="height: 56px; border-radius: 8px; border-width: 1px; padding: 16px"
          />
        </div>

        <!-- Action Buttons -->
        <div
          class="flex flex-col sm:flex-row items-center gap-3 sm:gap-3 opacity-100"
          style="transform: rotate(0deg)"
        >
          <button
            @click="handleCreate"
            :disabled="!typeName.trim() || isLoading"
            class="w-full sm:w-auto bg-blue-600 text-white hover:bg-blue-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-colors flex items-center justify-center gap-2"
            style="height: 56px; border-radius: 32px; padding: 8px 16px; min-width: 117px"
          >
            <LoadingSpinner v-if="isLoading" class="w-4 h-4" />
            {{ isLoading ? 'Creating...' : 'Create now' }}
          </button>
          <button
            @click="handleCancel"
            class="w-full sm:w-auto border border-gray-300 text-gray-700 hover:bg-gray-50 transition-colors"
            style="height: 56px; border-radius: 32px; padding: 8px 16px; min-width: 83px"
          >
            Cancel
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { useRouter } from 'vue-router'
import { LoadingSpinner, ImageUpload } from '@/components/common'

const router = useRouter()

console.log('AddNewNotificationTypeView component loaded')

// Form data
const typeName = ref('')
const selectedFile = ref<File | null>(null)
const isLoading = ref(false)

// File handling
const handleFileSelected = (file: File) => {
  selectedFile.value = file
}

const handleFileRemoved = () => {
  selectedFile.value = null
}

const handleUploadError = (message: string) => {
  alert(message)
}

// Actions
const handleCancel = () => {
  router.back()
}

const handleCreate = async () => {
  if (!typeName.value.trim()) {
    alert('Please enter a type name')
    return
  }

  isLoading.value = true

  try {
    // Here you would typically send the data to your API
    console.log('Creating notification type:', {
      name: typeName.value,
      file: selectedFile.value,
    })

    // Simulate API call
    await new Promise((resolve) => setTimeout(resolve, 1000))

    // Navigate back or to success page
    router.push('/templates')
  } catch (error) {
    console.error('Error creating notification type:', error)
    alert('Failed to create notification type')
  } finally {
    isLoading.value = false
  }
}
</script>

<style scoped>
/* Custom styles for this component */
</style>
