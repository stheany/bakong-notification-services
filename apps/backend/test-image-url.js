// Quick diagnostic script to test image URLs
const axios = require('axios')

// TODO: Replace this with the actual imageUrl from your notification payload
const testImageUrl = 'http://192.168.1.100:4003/api/v1/image/YOUR_IMAGE_ID'

console.log('🔍 Testing image URL:', testImageUrl)

axios
  .get(testImageUrl, {
    responseType: 'arraybuffer',
    timeout: 5000,
  })
  .then((response) => {
    console.log('✅ Image URL is accessible!')
    console.log('Status:', response.status)
    console.log('Content-Type:', response.headers['content-type'])
    console.log('Content-Length:', response.headers['content-length'], 'bytes')

    if (response.headers['content-type']?.startsWith('image/')) {
      console.log('✅ Valid image content type')
    } else {
      console.log('❌ WARNING: Not an image content type!')
    }
  })
  .catch((error) => {
    console.log('❌ Image URL is NOT accessible!')
    console.log('Error:', error.message)
    if (error.code === 'ECONNREFUSED') {
      console.log('💡 Backend might not be running or wrong IP/port')
    }
    if (error.code === 'ETIMEDOUT') {
      console.log('💡 Request timed out - check network connection')
    }
  })
