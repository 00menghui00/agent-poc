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
 * 不规则拼接布局定义
 * 每个区块: { x, y, w, h } 表示在画布上的位置和尺寸（基于单位格子）
 */
const IRREGULAR_LAYOUTS = [
  // 布局1: 左上大图 + 右侧小图 + 底部横条
  [
    { x: 0, y: 0, w: 2, h: 2 },     // 0: 左上大图
    { x: 2, y: 0, w: 1, h: 1 },     // 1: 右上小图
    { x: 2, y: 1, w: 1, h: 1 },     // 2: 右中小图
    { x: 0, y: 2, w: 1, h: 1 },     // 3: 左下小图
    { x: 1, y: 2, w: 1, h: 1 },     // 4: 中下小图
    { x: 2, y: 2, w: 1, h: 1 },     // 5: 右下小图
  ],
  // 布局2: 顶部横条 + 中间交错 + 右下大图
  [
    { x: 0, y: 0, w: 1, h: 1 },     // 0: 左上
    { x: 1, y: 0, w: 1, h: 1 },     // 1: 中上
    { x: 2, y: 0, w: 1, h: 2 },     // 2: 右侧竖图
    { x: 0, y: 1, w: 2, h: 1 },     // 3: 左中横图
    { x: 0, y: 2, w: 1, h: 1 },     // 4: 左下
    { x: 1, y: 2, w: 2, h: 1 },     // 5: 右下横图
  ],
  // 布局3: 中心大图 + 四周小图
  [
    { x: 0, y: 0, w: 1, h: 1 },     // 0: 左上
    { x: 1, y: 0, w: 1, h: 1 },     // 1: 中上
    { x: 2, y: 0, w: 1, h: 1 },     // 2: 右上
    { x: 0, y: 1, w: 1, h: 2 },     // 3: 左侧竖图
    { x: 1, y: 1, w: 2, h: 2 },     // 4: 右下大图
  ],
]

/**
 * 将多张图片拼接成不规则布局的拼图
 * @param imageUrls 图片 URL 或 base64 数组
 * @param unitSize 单位格子的尺寸
 * @returns Promise<string> 拼图图片的 base64
 */
export function createGridImage(
  imageUrls: string[],
  unitSize: number = 340
): Promise<string> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined' || typeof document === 'undefined') {
      reject(new Error('只能在浏览器环境中创建拼图'))
      return
    }

    if (imageUrls.length === 0) {
      reject(new Error('没有图片可以拼接'))
      return
    }

    const canvasSize = unitSize * 3
    const canvas = document.createElement('canvas')
    canvas.width = canvasSize
    canvas.height = canvasSize
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建 canvas context'))
      return
    }

    // 填充背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasSize, canvasSize)

    // 根据图片数量选择合适的布局
    const layoutIndex = imageUrls.length <= 5 ? 2 : (imageUrls.length <= 6 ? 0 : 1)
    const layout = IRREGULAR_LAYOUTS[layoutIndex]

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

    // 确保有足够的图片（不足则循环使用）
    const urls: string[] = []
    for (let i = 0; i < layout.length; i++) {
      urls.push(imageUrls[i % imageUrls.length])
    }

    Promise.all(urls.map(loadImage))
      .then(images => {
        const gap = 4 // 图片间隙

        images.forEach((img, index) => {
          const cell = layout[index]
          const x = cell.x * unitSize + gap / 2
          const y = cell.y * unitSize + gap / 2
          const w = cell.w * unitSize - gap
          const h = cell.h * unitSize - gap

          // 计算裁剪以保持比例并居中
          const scale = Math.max(w / img.width, h / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const offsetX = (scaledWidth - w) / 2
          const offsetY = (scaledHeight - h) / 2

          ctx.save()
          
          // 绘制圆角矩形裁剪区域
          const radius = 8
          ctx.beginPath()
          ctx.moveTo(x + radius, y)
          ctx.lineTo(x + w - radius, y)
          ctx.quadraticCurveTo(x + w, y, x + w, y + radius)
          ctx.lineTo(x + w, y + h - radius)
          ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h)
          ctx.lineTo(x + radius, y + h)
          ctx.quadraticCurveTo(x, y + h, x, y + h - radius)
          ctx.lineTo(x, y + radius)
          ctx.quadraticCurveTo(x, y, x + radius, y)
          ctx.closePath()
          ctx.clip()

          ctx.drawImage(img, x - offsetX, y - offsetY, scaledWidth, scaledHeight)
          ctx.restore()
        })

        const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
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
