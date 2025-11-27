<template>
  <div
    class="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 sm:gap-0 pt-2 pb-0 min-h-14 w-full"
  >
    <div class="flex items-center gap-2 w-full sm:w-auto">
      <label class="text-[#001346] text-[16px] font-medium whitespace-nowrap">Category type</label>
      <input
        type="text"
        placeholder="User input"
        class="flex-1 sm:flex-initial sm:w-[313px] h-[56px] px-4 border border-[#0013461A] rounded-[8px] text-[#001346] text-[14px]"
        style="padding-left: 16px !important"
      />
      <button
        class="flex items-center justify-center gap-2 text-[#001346] text-[16px] font-semibold transition-all duration-200 h-14 w-[140px] px-4 bg-[#0013460D] rounded-[32px] shadow-[0_0_128px_rgba(0,19,70,0.08)] whitespace-nowrap"
        @click="$emit('addNew')"
        aria-label="Add new"
      >
        <span>Add new</span>
        <HugeiconsIcon :icon="AddCircleIcon" :size="20" :color="'#001346'" />
      </button>
    </div>
    <div class="flex items-center gap-4 w-full sm:w-auto justify-end">
      <button
        class="flex items-center justify-center gap-2 text-[#001346] text-[16px] font-semibold transition-all duration-200 h-[56px] w-[110px] px-4 bg-[#0013460D] rounded-[32px] shadow-[0_0_128px_rgba(0,19,70,0.08)]"
        @click="$emit('filter')"
        aria-label="Open filter"
      >
        Filter
        <HugeiconsIcon :icon="FilterIcon" :size="24" color="#001346" :stroke-width="1" />
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { HugeiconsIcon } from '@hugeicons/vue'
import { AddCircleIcon } from '@hugeicons/core-free-icons'
import { FilterIcon } from '@hugeicons/core-free-icons'
</script>
