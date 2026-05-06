import { NextRequest, NextResponse } from 'next/server'

export const maxDuration = 300 // 5分钟超时

interface EventUnit {
  time: string
  location: string
  scene: string
  event: string
  people: string[]
  emotion: string
  importance: number
  highlight_frame: string
  tags: string[]
  videoUrl?: string
  videoName?: string
  extractedFrameUrl?: string
}

interface ComicPanel {
  panel_id: number
  prompt: string
  bubble_text?: string // 气泡文字内容
  bubble_position?: 'top-left' | 'top-right' | 'bottom-left' | 'bottom-right' | 'center'
  highlight_frame_id?: string
}

interface Phase2Result {
  diary_text: string
  comic_panels: ComicPanel[]
}

interface VideoInput {
  name: string
  timestamp: string
  location: string
  videoUrl: string
}

interface ProcessRequest {
  apiKey: string
  baseUrl: string
  visionModel: string
  reasoningModel: string
  imageModel: string
  imageApiKey?: string // 图像API单独的Key
  imageBaseUrl?: string // 图像API单独的地址
  phase1Prompt: string
  phase2Prompt: string
  phase3Prompt: string
  videos: VideoInput[]
  // 阶段二需要的高光帧图片 URL 列表
  highlightFrameUrls?: string[]
  // 九宫格拼接图 URL（阶段三需要）
  gridImageUrl?: string
  // 指定只运行某个阶段
  runPhase?: 1 | 2 | 3
  // 阶段二输入（如果只运行阶段三）
  phase2Result?: Phase2Result
  // 已提取的事件（如果跳过阶段一）
  existingEvents?: EventUnit[]
}

// 阶段一：视频理解，提取事件
async function processPhase1(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  video: VideoInput
): Promise<EventUnit[]> {
  
  const userMessage = `请分析这个视频：
- 文件名：${video.name}
- 拍摄时间：${video.timestamp}
- 拍摄地点：${video.location || '未知'}

请按照要求输出JSON格式的事件列表，确保 highlight_frame 字段使用 "MM:SS" 格式表示视频中的时间点。`

  // 添加超时控制
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 120000) // 2分钟超时
  
  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              {
                type: 'video_url',
                video_url: {
                  url: video.videoUrl,
                },
              },
            ],
          },
        ],
        max_tokens: 4000,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('视频分析超时，请稍后重试')
    }
    throw fetchError
  }
  
  clearTimeout(timeoutId)

  if (!response.ok) {
    const error = await response.text()
    console.error(`[v0] 阶段一 API错误: ${error}`)
    throw new Error(`阶段一 API 调用失败 (${response.status}): ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // 尝试解析 JSON
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/)
    let events: EventUnit[] = []
    if (jsonMatch) {
      events = JSON.parse(jsonMatch[0])
    } else {
      events = JSON.parse(content)
    }
    // 为每个事件附加视频 URL 和名称
    events = events.map(e => ({
      ...e,
      videoUrl: video.videoUrl,
      videoName: video.name,
    }))
    return events
  } catch {
    // 返回默认事件，确保有 videoUrl
    return [{
      time: video.timestamp,
      location: video.location || '未知位置',
      scene: '未识别',
      event: content || '视频内容分析中...',
      people: ['未知'],
      emotion: '平静',
      importance: 0.5,
      highlight_frame: '00:01',
      tags: ['视频'],
      videoUrl: video.videoUrl,
      videoName: video.name,
    }]
  }
}

// 阶段二：生成日记和分镜 prompt（多模态，带高光帧图片）
async function processPhase2(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  events: EventUnit[],
  highlightFrameUrls: string[]
): Promise<Phase2Result> {
  
  // 构建事件列表文本（按时间顺序，确保日记时间线正确）
  const eventsText = events.map((e, i) => 
    `事件${i + 1}:
- 时间: ${e.time}
- 场景: ${e.scene}
- 描述: ${e.event}
- 人物: ${e.people?.join(', ') || '未知'}
- 情绪: ${e.emotion}
- 重要性: ${e.importance}
- 标签: ${e.tags?.join(', ') || ''}`
  ).join('\n\n')

  const userMessage = `以下是今天发生的事件列表（已按时间顺序排列）：

${eventsText}

同时附上了对应的高光帧图片作为参考（图片顺序与事件顺序一致）。

请根据这些事件和图片：
1. 生成一篇流畅自然的日记（150-300字），请严格按照事件的时间顺序来叙述
2. 生成9个分镜，每个分镜必须包含：
   - prompt: 场景描述、人物动作、表情
   - bubble_text: 对话气泡文字（中文，10-20字，表达人物对话或内心独白）
   - bubble_position: 气泡位置（top-left/top-right/bottom-left/bottom-right/center）

请严格按照 JSON 格式输出：
{
  "diary_text": "日记内容...",
  "comic_panels": [
    {"panel_id": 1, "prompt": "场景描述...", "bubble_text": "气泡文字内容", "bubble_position": "top-right"},
    {"panel_id": 2, "prompt": "场景描述...", "bubble_text": "气泡文字内容", "bubble_position": "top-left"},
    ...共9个分镜
  ]
}`

  // 构建消息内容，包含文本和图片
  const contentParts: Array<{ type: string; text?: string; image_url?: { url: string } }> = [
    { type: 'text', text: userMessage }
  ]
  
  // 添加高光帧图片（按时间顺序）
  for (const frameUrl of highlightFrameUrls) {
    if (frameUrl) {
      contentParts.push({
        type: 'image_url',
        image_url: { url: frameUrl }
      })
    }
  }

  // 添加超时控制
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 3分钟超时
  
  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: contentParts },
        ],
        max_tokens: 8000,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('阶段二处理超时，请稍后重试')
    }
    throw new Error(`阶段二网络错误: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`)
  }
  
  clearTimeout(timeoutId)

  if (!response.ok) {
    const error = await response.text()
    console.error(`[v0] 阶段二 API错误: ${error}`)
    throw new Error(`阶段二 API 调用失败 (${response.status}): ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // 解析 JSON 结果
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      return JSON.parse(jsonMatch[0])
    }
    throw new Error('无法解析 JSON')
  } catch {
    // 返回基础结构
    return {
      diary_text: content,
      comic_panels: Array.from({ length: 9 }, (_, i) => ({
        panel_id: i + 1,
        prompt: `分镜 ${i + 1}：基于事件生成的场景`
      }))
    }
  }
}

// 阶段三：生成漫画九宫格（使用豆包 seedream API，JSON 格式）
// 注意：只生成漫画风格图片，不添加文字，文字由前端 Canvas 添加
async function processPhase3(
  apiKey: string,
  baseUrl: string,
  model: string,
  systemPrompt: string,
  diaryText: string,
  comicPanels: ComicPanel[],
  gridImageUrl: string
): Promise<string> {
  
  // 构建 prompt - 只做漫画风格转换，不添加文字
  const editPrompt = `将这张九宫格照片转换为日系漫画风格,保持原有构图和人物特征,不要添加任何文字或对话气泡`

  // 使用豆包 seedream API（JSON 格式），带超时控制
  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 180000) // 3分钟超时
  
  let response: Response
  try {
    response = await fetch(`${baseUrl}/images/generations`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        prompt: editPrompt,
        image: gridImageUrl, // 九宫格原图作为参考
        sequential_image_generation: 'disabled',
        response_format: 'url',
        size: '2K',
        stream: false,
        watermark: false,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('阶段三图片生成超时，请稍后重试')
    }
    throw new Error(`阶段三网络错误: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`)
  }
  
  clearTimeout(timeoutId)

  if (!response.ok) {
    const error = await response.text()
    console.error(`[v0] 阶段三 API错误: ${error}`)
    throw new Error(`阶段三 API 调用失败 (${response.status}): ${error}`)
  }

  const data = await response.json()
  // 豆包 API 返回格式可能是 data[0].url 或 data[0].b64_json
  const imageUrl = data.data?.[0]?.url || data.data?.[0]?.b64_json
  
  if (!imageUrl) {
    console.error('[v0] 阶段三返回数据:', JSON.stringify(data))
    throw new Error('阶段三未返回图片')
  }
  
  return imageUrl
}

// 气泡位置信息（基于像素坐标）
interface BubblePosition {
  x: number // 气泡左上角 x 坐标（百分比 0-100）
  y: number // 气泡左上角 y 坐标（百分比 0-100）
  text: string // 气泡文字内容
}

// 阶段3.5：分析漫画图片，输出气泡位置和文字
async function analyzeBubblePositions(
  apiKey: string,
  baseUrl: string,
  model: string,
  comicImageUrl: string,
  diaryText: string
): Promise<BubblePosition[]> {
  
  const systemPrompt = `你是一个漫画气泡位置分析专家。分析漫画图片，找出2-4个适合添加对话气泡的位置。

要求：
1. 选择人物头部附近或空白区域放置气泡
2. 避免遮挡重要画面元素
3. 气泡位置使用百分比坐标（0-100），表示气泡左上角在图片中的位置
4. 为每个气泡生成简短的中文对话或内心独白（10-20字）
5. 气泡内容应该与画面场景相符，表达人物情感

输出格式（严格JSON）：
{
  "bubbles": [
    {"x": 10, "y": 15, "text": "今天天气真好啊！"},
    {"x": 60, "y": 40, "text": "我们去散步吧"},
    ...
  ]
}`

  const userMessage = `请分析这张漫画图片，找出2-4个适合放置对话气泡的位置。

日记内容参考：${diaryText.substring(0, 200)}

请输出气泡的位置坐标（百分比）和对应的中文对话内容。`

  const controller = new AbortController()
  const timeoutId = setTimeout(() => controller.abort(), 60000) // 1分钟超时
  
  let response: Response
  try {
    response = await fetch(`${baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: systemPrompt },
          {
            role: 'user',
            content: [
              { type: 'text', text: userMessage },
              { type: 'image_url', image_url: { url: comicImageUrl } },
            ],
          },
        ],
        max_tokens: 1000,
      }),
      signal: controller.signal,
    })
  } catch (fetchError) {
    clearTimeout(timeoutId)
    if (fetchError instanceof Error && fetchError.name === 'AbortError') {
      throw new Error('气泡分析超时')
    }
    throw new Error(`气泡分析网络错误: ${fetchError instanceof Error ? fetchError.message : '未知错误'}`)
  }
  
  clearTimeout(timeoutId)

  if (!response.ok) {
    const error = await response.text()
    console.error(`[v0] 气泡分析 API错误: ${error}`)
    throw new Error(`气泡分析失败 (${response.status}): ${error}`)
  }

  const data = await response.json()
  const content = data.choices?.[0]?.message?.content || ''
  
  // 解析 JSON 结果
  try {
    const jsonMatch = content.match(/\{[\s\S]*\}/)
    if (jsonMatch) {
      const result = JSON.parse(jsonMatch[0])
      return result.bubbles || []
    }
    throw new Error('无法解析气泡位置 JSON')
  } catch {
    // 返回默认气泡位置
    return [
      { x: 10, y: 10, text: '新的一天开始了！' },
      { x: 60, y: 50, text: '今天过得真充实' },
    ]
  }
}

export async function POST(request: NextRequest) {
  try {
    const body: ProcessRequest = await request.json()
    
    const {
      apiKey,
      baseUrl,
      visionModel,
      reasoningModel,
      imageModel,
      imageApiKey,
      imageBaseUrl,
      phase1Prompt,
      phase2Prompt,
      phase3Prompt,
      videos,
      highlightFrameUrls = [],
      gridImageUrl,
      runPhase,
      phase2Result: existingPhase2Result,
      existingEvents,
    } = body
    
    // 图像API使用单独的配置，如果没有则使用默认配置
    const finalImageApiKey = imageApiKey || apiKey
    const finalImageBaseUrl = imageBaseUrl || 'https://ark.cn-beijing.volces.com/api/v3'

    if (!apiKey) {
      return NextResponse.json({ error: '请提供 API Key' }, { status: 400 })
    }

    let allEvents: EventUnit[] = existingEvents || []
    let phase2Result: Phase2Result | null = existingPhase2Result || null
    let comicImageUrl: string | null = null
    const errors: string[] = []

    // 阶段一：处理视频提取事件
    if (!runPhase || runPhase === 1) {
      if (!videos || videos.length === 0) {
        return NextResponse.json({ error: '请上传至少一个视频' }, { status: 400 })
      }

      for (const video of videos) {
        if (!video.videoUrl) {
          return NextResponse.json({ error: `视频 ${video.name} 没有上传成功` }, { status: 400 })
        }
      }

      allEvents = []
      
      for (let videoIndex = 0; videoIndex < videos.length; videoIndex++) {
        const video = videos[videoIndex]
        let success = false
        let lastError = ''
        
        // 重��机制：最多尝试2次
        for (let attempt = 0; attempt < 2 && !success; attempt++) {
          try {
            if (attempt > 0) {
              // 重试前等待2秒
              await new Promise(resolve => setTimeout(resolve, 2000))
            }
            
            const events = await processPhase1(apiKey, baseUrl, visionModel, phase1Prompt, video)
            
            // 验证每个事件都有 videoUrl
            events.forEach((e) => {
              if (!e.videoUrl) {
                e.videoUrl = video.videoUrl
                e.videoName = video.name
              }
            })
            
            allEvents.push(...events)
            success = true
          } catch (error) {
            lastError = error instanceof Error ? error.message : String(error)
            if (attempt === 0 && lastError.includes('500')) {
              // 500错误可能是临时的，尝试重试
              console.log(`[v0] 视频 ${video.name} 处理失败，准备重试...`)
            }
          }
        }
        
        // 如果重试后仍然失败，添加一个默认事件以确保高光帧能提取
        if (!success) {
          errors.push(`${video.name}: ${lastError}`)
          // 为失败的视频添加默认事件，确保仍能提取高光帧
          allEvents.push({
            time: video.timestamp,
            location: video.location || '未知位置',
            scene: '视频片段',
            event: `视频 ${video.name} 的内容`,
            people: ['未知'],
            emotion: '平静',
            importance: 0.5,
            highlight_frame: '00:02',
            tags: ['视频'],
            videoUrl: video.videoUrl,
            videoName: video.name,
          })
        }
      }

      if (allEvents.length === 0 && errors.length > 0) {
        return NextResponse.json({ error: `所有视频处理失败: ${errors.join('; ')}` }, { status: 500 })
      }

      // 如果只运行阶段一，返回事件列表
      if (runPhase === 1) {
        return NextResponse.json({
          success: true,
          phase: 1,
          events: allEvents,
          errors: errors.length > 0 ? errors : undefined,
        })
      }
    }

    // 阶段二：生成日记和分镜
    if (!runPhase || runPhase === 2) {
      if (allEvents.length === 0) {
        return NextResponse.json({ error: '没有事件数据，请先运行阶段一' }, { status: 400 })
      }

      try {
        phase2Result = await processPhase2(
          apiKey,
          baseUrl,
          reasoningModel,
          phase2Prompt,
          allEvents,
          highlightFrameUrls
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[v0] 阶段二失败:', errorMsg)
        errors.push(`阶段二: ${errorMsg}`)
      }

      // 如果只运行阶段二，返回结果
      if (runPhase === 2) {
        return NextResponse.json({
          success: true,
          phase: 2,
          events: allEvents,
          phase2Result,
          errors: errors.length > 0 ? errors : undefined,
        })
      }
    }

    // 阶段三：生成漫画
    if (!runPhase || runPhase === 3) {
      if (!phase2Result) {
        return NextResponse.json({ error: '没有阶段二结果，请先运行阶段二' }, { status: 400 })
      }

      if (!gridImageUrl) {
        return NextResponse.json({ error: '请先生成九宫格拼接图' }, { status: 400 })
      }

      try {
        comicImageUrl = await processPhase3(
          finalImageApiKey,
          finalImageBaseUrl,
          imageModel,
          phase3Prompt,
          phase2Result.diary_text,
          phase2Result.comic_panels,
          gridImageUrl
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[v0] 阶段三失败:', errorMsg)
        errors.push(`阶段三: ${errorMsg}`)
      }
    }
    
    // 阶段3.5：如果成功生成漫画，分析气泡位置
    let bubblePositions: BubblePosition[] = []
    if (comicImageUrl && phase2Result) {
      try {
        bubblePositions = await analyzeBubblePositions(
          apiKey,
          baseUrl,
          visionModel, // 使用视觉模型分析图片
          comicImageUrl,
          phase2Result.diary_text
        )
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : String(error)
        console.error('[v0] 气泡分析失败:', errorMsg)
        // 气泡分析失败不影响主流程，使用默认气泡
        bubblePositions = [
          { x: 10, y: 10, text: '新的一天！' },
          { x: 60, y: 50, text: '真开心' },
        ]
      }
    }
    
    return NextResponse.json({
      success: true,
      events: allEvents,
      phase2Result,
      comicImageUrl,
      bubblePositions, // 返回气泡位置数据
      errors: errors.length > 0 ? errors : undefined,
    })
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error)
    console.error('[v0] 处理失败:', errorMsg)
    return NextResponse.json({ error: errorMsg || '处理失败，请检查配置后重试' }, { status: 500 })
  }
}
