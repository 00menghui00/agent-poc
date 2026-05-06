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
 * 将多张图片拼接成不规则布局的拼图（固定9张图片）
 * @param imageUrls 图片 URL 或 base64 数组
 * @param canvasWidth 画布宽度
 * @returns Promise<string> 拼图图片的 base64
 */
export function createGridImage(
  imageUrls: string[],
  canvasWidth: number = 1080
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

    // 使用6x6网格，总共9张图片的不规则布局
    const gridUnits = 6
    const unitSize = canvasWidth / gridUnits
    const canvasHeight = canvasWidth // 正方形画布
    
    const canvas = document.createElement('canvas')
    canvas.width = canvasWidth
    canvas.height = canvasHeight
    const ctx = canvas.getContext('2d')

    if (!ctx) {
      reject(new Error('无法创建 canvas context'))
      return
    }

    // 填充背景
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvasWidth, canvasHeight)

    // 9张图片的不规则布局（基于6x6网格，8格高）
    const layout9 = [
      { x: 0, y: 0, w: 4, h: 4 },     // 0: 左上大图（主图，占4x4）
      { x: 4, y: 0, w: 2, h: 2 },     // 1: 右上小图
      { x: 4, y: 2, w: 2, h: 2 },     // 2: 右中小图
      { x: 0, y: 4, w: 2, h: 2 },     // 3: 左下小图
      { x: 2, y: 4, w: 2, h: 2 },     // 4: 中下小图
      { x: 4, y: 4, w: 2, h: 2 },     // 5: 右下小图
      { x: 0, y: 6, w: 2, h: 2 },     // 6: 底左小图（扩展到8格高）
      { x: 2, y: 6, w: 2, h: 2 },     // 7: 底中小图
      { x: 4, y: 6, w: 2, h: 2 },     // 8: 底右小图
    ]
    
    // 使用8格高的画布来容纳9张图
    const actualCanvasHeight = unitSize * 8
    canvas.height = actualCanvasHeight
    ctx.fillRect(0, 0, canvasWidth, actualCanvasHeight)

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

    // 确保有9张图片（不足则循环使用，超出则截取）
    const urls: string[] = []
    for (let i = 0; i < 9; i++) {
      urls.push(imageUrls[i % imageUrls.length])
    }

    Promise.all(urls.map(loadImage))
      .then(images => {
        images.forEach((img, index) => {
          if (index >= layout9.length) return
          
          const cell = layout9[index]
          const x = cell.x * unitSize
          const y = cell.y * unitSize
          const w = cell.w * unitSize
          const h = cell.h * unitSize

          // 计算裁剪以保持比例并居中
          const scale = Math.max(w / img.width, h / img.height)
          const scaledWidth = img.width * scale
          const scaledHeight = img.height * scale
          const offsetX = (scaledWidth - w) / 2
          const offsetY = (scaledHeight - h) / 2

          ctx.save()
          ctx.beginPath()
          ctx.rect(x, y, w, h)
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
 * 气泡文字信息
 */
export interface BubbleInfo {
  panel_id: number
  text: string
  position: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
}

/**
 * 在漫画图片上添加中文气泡文字
 * @param imageUrl 漫画图片 URL
 * @param bubbles 气泡信息数组（9个，对应九宫格）
 * @returns Promise<string> 添加气泡后的图片 base64
 */
export async function addBubblesToComic(
  imageUrl: string,
  bubbles: BubbleInfo[]
): Promise<string> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    throw new Error('只能在浏览器环境中添加气泡')
  }

  // 通过 fetch 下载图片绕过跨域限制
  let blobUrl: string
  try {
    const response = await fetch(imageUrl)
    if (!response.ok) {
      throw new Error(`下载图片失败: ${response.status}`)
    }
    const blob = await response.blob()
    blobUrl = URL.createObjectURL(blob)
  } catch (fetchError) {
    console.error('[v0] 下载漫画图片失败:', fetchError)
    throw new Error(`下载漫画图片失败: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`)
  }

  return new Promise((resolve, reject) => {
    const img = new Image()
    
    img.onload = () => {
      // 释放 blob URL
      URL.revokeObjectURL(blobUrl)
      const canvas = document.createElement('canvas')
      canvas.width = img.width
      canvas.height = img.height
      const ctx = canvas.getContext('2d')
      
      if (!ctx) {
        reject(new Error('无法创建 canvas context'))
        return
      }
      
      // 绘制原图
      ctx.drawImage(img, 0, 0)
      
      // 计算九宫格布局（与 createGridImage 保持一致）
      // 使用6x8网格
      const gridUnits = 6
      const unitWidth = img.width / gridUnits
      const unitHeight = img.height / 8
      
      const layout9 = [
        { x: 0, y: 0, w: 4, h: 4 },     // 0: 左上大图
        { x: 4, y: 0, w: 2, h: 2 },     // 1: 右上小图
        { x: 4, y: 2, w: 2, h: 2 },     // 2: 右中小图
        { x: 0, y: 4, w: 2, h: 2 },     // 3: 左下小图
        { x: 2, y: 4, w: 2, h: 2 },     // 4: 中下小图
        { x: 4, y: 4, w: 2, h: 2 },     // 5: 右下小图
        { x: 0, y: 6, w: 2, h: 2 },     // 6: 底左小图
        { x: 2, y: 6, w: 2, h: 2 },     // 7: 底中小图
        { x: 4, y: 6, w: 2, h: 2 },     // 8: 底右小图
      ]
      
      // 为每个分镜添加气泡
      bubbles.forEach((bubble) => {
        const panelIndex = bubble.panel_id - 1
        if (panelIndex < 0 || panelIndex >= 9 || !bubble.text) return
        
        const cell = layout9[panelIndex]
        const cellX = cell.x * unitWidth
        const cellY = cell.y * unitHeight
        const cellW = cell.w * unitWidth
        const cellH = cell.h * unitHeight
        
        // 根据位置计算气泡坐标
        const padding = 10
        const bubbleMaxWidth = Math.min(cellW * 0.8, 200)
        
        // 计算文字尺寸
        const fontSize = Math.max(12, Math.min(16, cellW / 15))
        ctx.font = `${fontSize}px "PingFang SC", "Microsoft YaHei", sans-serif`
        
        // 文字自动换行
        const words = bubble.text.split('')
        const lines: string[] = []
        let currentLine = ''
        
        for (const char of words) {
          const testLine = currentLine + char
          const metrics = ctx.measureText(testLine)
          if (metrics.width > bubbleMaxWidth - 20) {
            lines.push(currentLine)
            currentLine = char
          } else {
            currentLine = testLine
          }
        }
        if (currentLine) lines.push(currentLine)
        
        const lineHeight = fontSize * 1.4
        const textHeight = lines.length * lineHeight
        const textWidth = Math.max(...lines.map(l => ctx.measureText(l).width))
        
        // 气泡尺寸
        const bubbleWidth = textWidth + 24
        const bubbleHeight = textHeight + 16
        
        // 根据位置计算气泡坐标
        let bubbleX: number, bubbleY: number
        switch (bubble.position) {
          case 'top-left':
            bubbleX = cellX + padding
            bubbleY = cellY + padding
            break
          case 'top-right':
            bubbleX = cellX + cellW - bubbleWidth - padding
            bubbleY = cellY + padding
            break
          case 'bottom-left':
            bubbleX = cellX + padding
            bubbleY = cellY + cellH - bubbleHeight - padding
            break
          case 'bottom-right':
            bubbleX = cellX + cellW - bubbleWidth - padding
            bubbleY = cellY + cellH - bubbleHeight - padding
            break
          case 'center':
          default:
            bubbleX = cellX + (cellW - bubbleWidth) / 2
            bubbleY = cellY + (cellH - bubbleHeight) / 2
            break
        }
        
        // 绘制气泡背景（带尾巴的椭圆形）
        ctx.save()
        ctx.fillStyle = 'rgba(255, 255, 255, 0.95)'
        ctx.strokeStyle = '#333333'
        ctx.lineWidth = 2
        
        // 绘制圆角矩形气泡
        const radius = 10
        ctx.beginPath()
        ctx.moveTo(bubbleX + radius, bubbleY)
        ctx.lineTo(bubbleX + bubbleWidth - radius, bubbleY)
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY, bubbleX + bubbleWidth, bubbleY + radius)
        ctx.lineTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight - radius)
        ctx.quadraticCurveTo(bubbleX + bubbleWidth, bubbleY + bubbleHeight, bubbleX + bubbleWidth - radius, bubbleY + bubbleHeight)
        ctx.lineTo(bubbleX + radius, bubbleY + bubbleHeight)
        ctx.quadraticCurveTo(bubbleX, bubbleY + bubbleHeight, bubbleX, bubbleY + bubbleHeight - radius)
        ctx.lineTo(bubbleX, bubbleY + radius)
        ctx.quadraticCurveTo(bubbleX, bubbleY, bubbleX + radius, bubbleY)
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        
        // 绘制气泡尾巴
        const tailSize = 8
        let tailX: number, tailY: number, tailDir: 'down' | 'up' | 'left' | 'right'
        
        if (bubble.position === 'top-left' || bubble.position === 'top-right') {
          tailX = bubbleX + bubbleWidth / 2
          tailY = bubbleY + bubbleHeight
          tailDir = 'down'
        } else {
          tailX = bubbleX + bubbleWidth / 2
          tailY = bubbleY
          tailDir = 'up'
        }
        
        ctx.beginPath()
        if (tailDir === 'down') {
          ctx.moveTo(tailX - tailSize, tailY - 2)
          ctx.lineTo(tailX, tailY + tailSize)
          ctx.lineTo(tailX + tailSize, tailY - 2)
        } else {
          ctx.moveTo(tailX - tailSize, tailY + 2)
          ctx.lineTo(tailX, tailY - tailSize)
          ctx.lineTo(tailX + tailSize, tailY + 2)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()
        
        ctx.restore()
        
        // 绘制文字
        ctx.fillStyle = '#333333'
        ctx.textAlign = 'center'
        ctx.textBaseline = 'top'
        
        lines.forEach((line, i) => {
          ctx.fillText(line, bubbleX + bubbleWidth / 2, bubbleY + 8 + i * lineHeight)
        })
      })
      
      const dataUrl = canvas.toDataURL('image/jpeg', 0.92)
      resolve(dataUrl)
    }
    
    img.onerror = () => {
      URL.revokeObjectURL(blobUrl)
      reject(new Error('无法加载漫画图片'))
    }
    
    img.src = blobUrl
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
