<template>
  <div class="relative w-[332.07px] max-w-full">
    <div
      class="relative h-[651.49px] w-[322.07px] rounded-[34px] overflow-hidden p-[30px] bg-white-100"
    >
      <img :src="bg" alt="" class="absolute inset-0 h-full w-full object-top" />
      <section
        class="absolute bottom-[2px] left-[2px] w-[319.00px] h-[521.19px] justify-center items-center bg-white/97 backdrop-blur-[3.01882px] border ring-1 ring-black/5 rounded-t-[18.1129px] rounded-b-[39.2447px] shadow-[0_12px_40px_rgba(0,0,0,0.25)] overflow-hidden"
        role="dialog"
        aria-modal="true"
      >
        <div
          class="absolute top-0 left-0 right-0 w-full h-[159.5px] overflow-hidden rounded-t-[18.1129px]"
          :class="props.image ? 'bg-transparent' : 'bg-[#E2E2E2]'"
        >
          <div
            class="absolute left-1/2 -translate-x-1/2 top-[5px] w-[46px] h-[6px] rounded-full bg-gray-400 z-10"
          ></div>
          <img
            v-if="props.image"
            :src="displayImage"
            alt=""
            class="absolute inset-0 w-full h-full object-cover"
          />
          <img
            v-else
            :src="displayImage"
            alt=""
            class="absolute inset-0 w-full h-full object-cover opacity-40"
          />
          <div
            class="absolute bottom-0 inset-x-0 h-[1px] bg-black/10 z-10"
          ></div>
        </div>
        <div
          class="absolute left-[12.08px] top-[170.5px] bottom-[61px] w-[307.92px] flex flex-col items-start gap-[6.04px] px-[30px] pt-[12px] pb-[20px]"
        >
          <div
            class="title-container"
            :class="[
              { 'lang-khmer': props.titleHasKhmer },
              { 'empty-title': !displayTitle }
            ]"
            :data-content-lang="props.titleHasKhmer ? 'km' : ''"
          >
            {{ displayTitle || 'No title' }}
          </div>
          <div class="flex items-center w-full gap-2 h-[18px]">
            <img
              src="@/assets/image/star.png"
              alt="star"
              class="w-[14px] h-[14px]"
            />
            <div
              v-if="displayCategory"
              :class="['text-[12px] leading-[18px] text-black flex items-center overflow-hidden', props.activeLanguage === 'KM' ? 'category-khmer' : '']"
            >
              {{ formatCategoryType(displayCategory) }}
            </div>
            <div
              v-else
              class="w-[60%] h-[1px] border-b border-dotted border-black"
            ></div>
          </div>
          <div
            :class="['text-[14px] leading-[18px] text-black h-[18px] flex items-center pb-2', props.activeLanguage === 'KM' ? 'date-khmer' : '']"
          >
            {{ currentDate }}
          </div>
          <div
            v-if="displayDescription"
            class="description-container-relative overflow-y-auto overflow-x-hidden"
            style="max-height: 180px; width: 95%;"
            :class="{ 'lang-khmer': props.descriptionHasKhmer }"
            :data-content-lang="props.descriptionHasKhmer ? 'km' : ''"
          >
            <div v-html="displayDescription"></div>
          </div>
          <div v-else class="description-placeholder-relative">
            <div class="border-b border-dotted border-black h-[12px]"></div>
            <div class="border-b border-dotted border-black h-[12px]"></div>
            <div class="border-b border-dotted border-black h-[12px]"></div>
            <div class="border-b border-dotted border-black h-[12px]"></div>
          </div>
        </div>
        <div
          class="absolute left-2 right-2 bottom-[10px] h-[51.15px] px-[10.08px] flex items-center justify-center gap-2"
        >
          <template v-if="props.linkToSeeMore && props.linkToSeeMore.trim()">
            <div
              class="rounded-[12.08px] bg-[#DB1A1A] text-white font-semibold text-[16px] select-none flex items-center justify-center text-center flex-1"
              style="height: 42.15px; min-width: 0; user-select: none; padding-left: 5px; padding-right: 5px;"
              @click.stop.prevent
              disabled
            >
              Close
            </div>
            <div
              :href="props.linkToSeeMore"
              class="rounded-[12.08px] bg-[#DB1A1A] text-white font-semibold text-[16px] select-none flex items-center justify-center text-center flex-1"
              style="height: 42.15px; min-width: 0; user-select: none; padding-left: 5px; padding-right: 5px; text-decoration: none;"
              target="_blank"
              rel="noopener noreferrer"
            >
              Read more
            </div>
          </template>
          <template v-else>
            <div
              class="rounded-[12.08px] p-[12.08px] bg-[#DB1A1A] text-white font-semibold text-[16px] select-none flex items-center justify-center text-center align-center"
              style="width: 307.92px; height: 42.15px; pointer-events: none; cursor: default; user-select: none;"
            >
              Close
            </div>
          </template>
        </div>
      </section>
    </div>
  </div>
</template>
<script setup lang="ts">
  import { computed, ref } from 'vue';
  import bgImage from '@/assets/image/Home-Defualt.png';
  import headerImg from '@/assets/image/empty-image.svg';
  import { formatCategoryType } from '@/utils/helpers';
  import { useAuthStore } from '@/stores/auth';
  const bg = bgImage;
  const authStore = useAuthStore();
  const userAvatar = computed(
    () => authStore.userAvatar || authStore.user?.image || ''
  );
  const avatarLoadError = ref(false);
  const handleAvatarError = () => {
    avatarLoadError.value = true;
  };
  interface CategoryType {
    id: number;
    name: string;
    namekh?: string;
    namejp?: string;
  }
  interface Props {
    title?: string;
    description?: string;
    image?: string;
    type?: string;
    categoryTypeObject?: CategoryType | null;
    activeLanguage?: string;
    titleHasKhmer?: boolean;
    descriptionHasKhmer?: boolean;
    linkToSeeMore?: string;
  }
  const props = withDefaults(defineProps<Props>(), {
    title: '',
    description: '',
    image: '',
    categoryTypeObject: null,
    activeLanguage: 'KM',
    titleHasKhmer: false,
    descriptionHasKhmer: false,
    linkToSeeMore: '',
  });
  const toPreviewUrl = (url: string) => {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('blob:')) return url;
    const [base, qs] = url.split('?');
    const params = new URLSearchParams(qs || '');
    params.set('w', '880');
    params.set('h', '440');
    params.set('fit', 'cover');
    return `${base}?${params.toString()}`;
  };
  const displayImage = computed(() => {
    if (props.image) return toPreviewUrl(props.image);
    return headerImg; // your default header image
  });
  const displayTitle = computed(() => {
    const title = props.title || '';
    const cleanTitle = title.replace(/<[^>]*>/g, '').trim();
    return cleanTitle;
  });
  const displayCategory = computed(() => {
    if (!props.categoryTypeObject) return '';
    if (props.activeLanguage === 'KM' && props.categoryTypeObject.namekh) {
      return props.categoryTypeObject.namekh;
    }
    if (props.activeLanguage === 'JP' && props.categoryTypeObject.namejp) {
      return props.categoryTypeObject.namejp;
    }
    // Default to English or fallback
    return props.categoryTypeObject.name || '';
  });
  const displayDescription = computed(() => {
    const description = props.description || '';
    const cleanDescription = description.trim();
    return cleanDescription;
  });
  const currentDate = computed(() => {
    const now = new Date();
    if (props.activeLanguage === 'KM') {
      // Khmer date format: ៩ កុម្ភៈ ២០២៦
      const khmerMonths = [
        'មករា', 'កុម្ភៈ', 'មីនា', 'មេសា', 'ឧសភា', 'មិថុនា',
        'កក្កដា', 'សីហា', 'កញ្ញា', 'តុលា', 'វិច្ឆិកា', 'ធ្នូ'
      ];
      const day = now.getDate().toString();
      const month = khmerMonths[now.getMonth()];
      const year = now.getFullYear().toString();
      // Convert day and year to Khmer numerals
      const khmerDigits = ['០','១','២','៣','៤','៥','៦','៧','៨','៩'];
      const toKhmerNum = (num: string) => num.split('').map(d => khmerDigits[+d] || d).join('');
      return `${toKhmerNum(day)} ${month} ${toKhmerNum(year)}`;
    } else if (props.activeLanguage === 'JP') {
      // Japanese date format: 2026年2月9日
      const year = now.getFullYear();
      const month = now.getMonth() + 1;
      const day = now.getDate();
      return `${year}年${month}月${day}日`;
    } else {
      // English: Feb 9, 2026
      const month = now.toLocaleDateString('en-US', { month: 'short' });
      const day = now.getDate();
      const year = now.getFullYear();
      return `${month} ${day}, ${year}`;
    }
  });
</script>
<style scoped>
  .title-container {
    width: 85%;
    font-size: 14px;
    font-weight: 600;
    line-height: 18px;
    color: #000000;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
    overflow-wrap: break-word;
    word-break: keep-all;
    white-space: normal;
  }
  
  .title-container.empty-title {
    min-height: 0px;
  }
  
  .title-container.lang-khmer,
  .text-khmer,
  .category-khmer,
  .date-khmer,
  .category-type-khmer,
  .date-type-khmer {
    width: 98%;
    font-family: 'Battambang', 'IBM Plex Sans', sans-serif !important;
    -webkit-line-clamp: 3;
    line-clamp: 3 ;
  }
  .description-container-relative {
    width: 290.92px;
    font-size: 12px;
    line-height: 16px;
    color: #020202;
    overflow-wrap: break-word;
    word-break: keep-all;
    white-space: normal;
    margin-top: 2px;
    padding-bottom: 20px;
  }
  .description-placeholder-relative {
    width: 290.92px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    margin-top: 2px;
    padding-bottom: 20px;
  }
  .description-container {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    width: 290.92px;
    font-size: 12px;
    line-height: 16px;
    color: #000000;
    overflow: hidden;
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    text-overflow: ellipsis;
    overflow-wrap: break-word;
    word-break: keep-all;
    white-space: normal;
    max-height: 64px;
  }
  .description-placeholder {
    position: absolute;
    bottom: 0;
    left: 0;
    right: 0;
    width: 290.92px;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
    .description-container-relative::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
  .description-container-relative {
    -ms-overflow-style: none;  /* IE and Edge */
    scrollbar-width: none;     /* Firefox */
  }
  .line-clamp-2 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .line-clamp-4 {
    display: -webkit-box;
    -webkit-line-clamp: 4;
    line-clamp: 4;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .scrollable-content {
    scrollbar-width: none; /* Firefox */
    -ms-overflow-style: none; /* IE and Edge */
  }
  .scrollable-content::-webkit-scrollbar {
    display: none; /* Chrome, Safari, Opera */
  }
  /* Ensure image container spans full width of section */
  .image-container {
    margin: 0 !important;
    padding: 0 !important;
  }
  /* Ensure image fills container completely - full width, no gaps */
  .image-container img {
    position: absolute !important;
    top: 0 !important;
    left: 0 !important;
    width: 100% !important;
    min-width: 100% !important;
    max-width: 100% !important;
    height: 100% !important;
    object-fit: cover !important;
    display: block !important;
    margin: 0 !important;
    padding: 0 !important;
  }
</style>
