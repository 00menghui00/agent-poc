// 视频帧提取工具函数

/**
 * 解析时间字符串为秒数
 * 支持格式: "00:15", "1:30", "00:01:30", "15秒", "frame_001" 等
 */
export function parseTimeToSeconds(timeStr: string): number {
  if (!timeStr) return 1 // 默认第1秒
  
  // 如果是 frame_xxx 格式，估算为帧号 * 0.033 秒 (假设 30fps)
  const frameMatch = timeStr.match(/frame[_-]?(\d+)/i)
  if (frameMatch) {
    return parseInt(frameMatch[1], 10) * 0.033
  }
  
  // 如果包含 "秒"，提取数字
  const secMatch = timeStr.match(/(\d+(?:\.\d+)?)\s*秒/)
  if (secMatch) {
    return parseFloat(secMatch[1])
  }
  
  // 标准时间格式 HH:MM:SS 或 MM:SS
  const timeParts = timeStr.split(':').map(p => parseFloat(p.trim()) || 0)
  if (timeParts.length === 3) {
    return timeParts[0] * 3600 + timeParts[1] * 60 + timeParts[2]
  } else if (timeParts.length === 2) {
    return timeParts[0] * 60 + timeParts[1]
  } else if (timeParts.length === 1 && !isNaN(timeParts[0])) {
    return timeParts[0]
  }
  
  return 1 // 默认值
}

/**
 * 从视频 URL 提取指定时间的帧
 * @param videoUrl 视频 URL
 * @param timeInSeconds 截取时间（秒）
 * @returns Promise<string> Base64 图片数据
 */
export function extractFrameFromVideo(
  videoUrl: string,
  timeInSeconds: number = 1
): Promise<string> {
  return new Promise((resolve, reject) => {
    // 确保只在客户端运行
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('只能在浏览器环境中提取视频帧'))
      return
    }
    
    const video = document.createElement('video')
    video.crossOrigin = 'anonymous'
    video.preload = 'metadata'
    
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    
    if (!ctx) {
      reject(new Error('无法创建 canvas context'))
      return
    }

    const cleanup = () => {
      video.removeEventListener('loadedmetadata', onMetadataLoaded)
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
      video.src = ''
      video.load()
    }

    const onError = () => {
      cleanup()
      reject(new Error(`无法加载视频: ${videoUrl.substring(0, 100)}...`))
    }

    const onSeeked = () => {
      try {
        canvas.width = video.videoWidth || 640
        canvas.height = video.videoHeight || 360
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
        cleanup()
        resolve(dataUrl)
      } catch (err) {
        cleanup()
        reject(err)
      }
    }

    const onMetadataLoaded = () => {
      // 确保时间在有效范围内
      const duration = video.duration || 10
      const seekTime = Math.min(Math.max(timeInSeconds, 0), duration - 0.1)
      video.currentTime = seekTime
    }

    video.addEventListener('loadedmetadata', onMetadataLoaded)
    video.addEventListener('seeked', onSeeked)
    video.addEventListener('error', onError)
    
    // 设置超时
    const timeout = setTimeout(() => {
      cleanup()
      reject(new Error('视频加载超时'))
    }, 30000)

    video.addEventListener('seeked', () => clearTimeout(timeout), { once: true })
    
    video.src = videoUrl
  })
}

/**
 * 批量提取多个视频帧
 */
export async function extractFramesFromEvents(
  events: Array<{ videoUrl?: string; highlight_frame?: string }>
): Promise<Map<number, string>> {
  const frames = new Map<number, string>()
  
  for (let i = 0; i < events.length; i++) {
    const event = events[i]
    if (event.videoUrl) {
      try {
        const timeInSeconds = parseTimeToSeconds(event.highlight_frame || '')
        const frame = await extractFrameFromVideo(event.videoUrl, timeInSeconds)
        frames.set(i, frame)
      } catch (error) {
        console.error(`提取事件 ${i + 1} 的帧失败:`, error)
      }
    }
  }
  
  return frames
}

/**
 * 下载图片
 */
export function downloadDataUrl(dataUrl: string, filename: string) {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    console.error('只能在浏览器环境中下载')
    return
  }
  
  const link = document.createElement('a')
  link.href = dataUrl
  link.download = filename
  link.click()
}

/**
 * 将多张图片拼接成九宫格
 * @param imageUrls 图片 URL 或 base64 数组（最多9张，不足9张会重复使用）
 * @param cellSize 每个格子的尺寸
 * @returns Promise<string> 九宫格图片的 base64
 */
export function createGridImage(
  imageUrls: string[],
  cellSize: number = 340
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('只能在浏览器环境中创建九宫格'))
      return
    }

    if (imageUrls.length === 0) {
      reject(new Error('没有图片可以拼接'))
      return
    }

    const gridSize = cellSize * 3
    const canvas = document.createElement('canvas')
    canvas.width = gridSize
    canvas.height = gridSize
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建 canvas context'))
      return
    }

    // 填充背景
    ctx.fillStyle = '#f5f5f5'
    ctx.fillRect(0, 0, gridSize, gridSize)

    // 加载所有图片
    const loadImage = (url: string): Promise<HTMLImageElement> => {
      return new Promise((res, rej) => {
        const img = new Image()
        img.crossOrigin = 'anonymous'
        img.onload = () => res(img)
        img.onerror = () => rej(new Error(`无法加载图片: ${url.substring(0, 50)}...`))
        img.src = url
      })
    }

    // 确保有9张图片（不足则循环使用）
    const urls: string[] = []
    for (let i = 0; i < 9; i++) {
      urls.push(imageUrls[i % imageUrls.length])
    }

    Promise.all(urls.map(loadImage))
      .then(images => {
        images.forEach((img, index) => {
          const row = Math.floor(index / 3)
          const col = index % 3
          const x = col * cellSize
          const y = row * cellSize

          // 计算裁剪以保持比例
          const scale = Math.max(cellSize / img.width, cellSize / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const offsetX = (scaledWidth - cellSize) / 2
          const offsetY = (scaledHeight - cellSize) / 2

          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, cellSize, cellSize)
          ctx.clip()
          ctx.drawImage(img, x - offsetX, y - offsetY, scaledWidth, scaledHeight)
          ctx.restore()

          // 添加格子边框
          ctx.strokeStyle = '#ffffff'
          ctx.lineWidth = 2
          ctx.strokeRect(x, y, cellSize, cellSize)
        })

        const dataUrl = canvas.toDataURL('image/jpeg', 0.9)
        resolve(dataUrl)
      })
      .catch(reject)
  })
}

/**
 * 将 base64 dataUrl 转换为 Blob（带正确的 MIME 类型）
 */
function dataUrlToBlob(dataUrl: string): Blob {
  const arr = dataUrl.split(',')
  const mimeMatch = arr[0].match(/:(.*?);/)
  const mime = mimeMatch ? mimeMatch[1] : 'image/jpeg'
  const bstr = atob(arr[1])
  let n = bstr.length
  const u8arr = new Uint8Array(n)
  while (n--) {
    u8arr[n] = bstr.charCodeAt(n)
  }
  return new Blob([u8arr], { type: mime })
}

/**
 * 上传 base64 图片到 Vercel Blob
 */
export async function uploadImageToBlob(dataUrl: string, filename: string): Promise<string> {
  // 将 base64 转换为 Blob（保留正确的 MIME 类型）
  const blob = dataUrlToBlob(dataUrl)
  
  // 创建带有正确文件名和类型的 File 对象
  const file = new File([blob], filename, { type: blob.type })
  
  const formData = new FormData()
  formData.append('file', file)
  
  const uploadResponse = await fetch('/api/upload', {
    method: 'POST',
    body: formData,
  })
  
  if (!uploadResponse.ok) {
    const error = await uploadResponse.json()
    throw new Error(error.error || '图片上传失败')
  }
  
  const result = await uploadResponse.json()
  return result.url
}
