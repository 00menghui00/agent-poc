"use client"

import { useState, useEffect, useCallback } from "react"
import { Play, BookOpen, Sparkles, Image as ImageIcon, Loader2, MessageCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Switch } from "@/components/ui/switch"
import { Label } from "@/components/ui/label"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Toaster } from "@/components/ui/sonner"
import { toast } from "sonner"
import { APIConfigPanel } from "@/components/api-config"
import { PromptEditor } from "@/components/prompt-editor"
import { VideoUploader } from "@/components/video-uploader"
import { ResultDisplay } from "@/components/result-display"
import { 
  DEFAULT_API_CONFIG, 
  DEFAULT_PHASE1_PROMPT, 
  DEFAULT_PHASE2_PROMPT,
  DEFAULT_PHASE3_PROMPT,
  type APIConfig, 
  type VideoFile,
  type EventUnit,
  type Phase2Result,
} from "@/lib/store"
import { 
  extractFrameFromVideo, 
  parseTimeToSeconds, 
  createGridImage,
  uploadImageToBlob,
  addBubblesAtCoordinates,
  type CoordinateBubble
} from "@/lib/video-utils"

export default function Home() {
  const [apiConfig, setApiConfig] = useState<APIConfig>(DEFAULT_API_CONFIG)
  const [phase1Prompt, setPhase1Prompt] = useState(DEFAULT_PHASE1_PROMPT)
  const [phase2Prompt, setPhase2Prompt] = useState(DEFAULT_PHASE2_PROMPT)
  const [phase3Prompt, setPhase3Prompt] = useState(DEFAULT_PHASE3_PROMPT)
  const [videos, setVideos] = useState<VideoFile[]>([])
  
  // 处理状态
  const [isProcessing, setIsProcessing] = useState(false)
  const [currentPhase, setCurrentPhase] = useState<number>(0)
  
  // 阶段一结果
  const [events, setEvents] = useState<EventUnit[]>([])
  const [extractedFrames, setExtractedFrames] = useState<Map<number, string>>(new Map())
  
  // 阶段二结果
  const [phase2Result, setPhase2Result] = useState<Phase2Result | null>(null)
  const [gridImageUrl, setGridImageUrl] = useState<string | null>(null)
  
  // 阶段三结果
  const [comicImageUrl, setComicImageUrl] = useState<string | null>(null)
  
  // 气泡选项
  const [enableBubbles, setEnableBubbles] = useState(true)

  // 从 localStorage 加载配置
  useEffect(() => {
    try {
      const savedConfig = localStorage.getItem('api-config')
      if (savedConfig) {
        setApiConfig(JSON.parse(savedConfig))
      }

      const savedPhase1 = localStorage.getItem('phase1-prompt')
      if (savedPhase1) setPhase1Prompt(savedPhase1)

      const savedPhase2 = localStorage.getItem('phase2-prompt')
      if (savedPhase2) setPhase2Prompt(savedPhase2)

      const savedPhase3 = localStorage.getItem('phase3-prompt')
      if (savedPhase3) setPhase3Prompt(savedPhase3)
    } catch (error) {
      console.error('Failed to load saved config:', error)
    }
  }, [])

  // 上传视频到 Vercel Blob
  const uploadVideoToBlob = async (file: File): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    
    const response = await fetch('/api/upload', {
      method: 'POST',
      body: formData,
    })
    
    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || '视频上传失败')
    }
    
    const result = await response.json()
    return result.url
  }

  // 将时间字符串转换为可排序的格式（支持多种格式）
  const normalizeTimeForSort = (timeStr: string): string => {
    if (!timeStr) return '0000-00-00 00:00:00'
    // 如果已经是 YYYY-MM-DD HH:MM:SS 格式
    if (/^\d{4}-\d{2}-\d{2}/.test(timeStr)) {
      return timeStr
    }
    // 如果是 HH:MM:SS 或 MM:SS 格式
    if (/^\d{1,2}:\d{2}(:\d{2})?$/.test(timeStr)) {
      return `0000-00-00 ${timeStr.padStart(8, '0')}`
    }
    return timeStr
  }

  // 提取高光帧（按视频时间+高光帧时间命名，并收集时间信息用于排序）
  const extractHighlightFrames = useCallback(async (eventList: EventUnit[]): Promise<{ url: string; sortKey: string; eventIndex: number }[]> => {
    const frameData: { url: string; sortKey: string; eventIndex: number }[] = []
    const newFrames = new Map<number, string>()
    
    for (let i = 0; i < eventList.length; i++) {
      const event = eventList[i]
      
      if (event.videoUrl) {
        try {
          toast.info(`提取高光帧 ${i + 1}/${eventList.length}...`)
          const timeInSeconds = parseTimeToSeconds(event.highlight_frame || '00:01')
          
          const frameDataUrl = await extractFrameFromVideo(event.videoUrl, timeInSeconds)
          newFrames.set(i, frameDataUrl)
          
          // 按视频时间+高光帧时间命名
          // 视频时间：事件发生时间 (如 2024-01-15 10:30:00)
          // 高光帧时间：视频内的时间点 (如 00:15)
          const videoTime = event.time || '00:00:00'
          const highlightTime = event.highlight_frame || '00:00'
          // 文件名格式: frame_视频时间_高光帧时间.jpg
          const safeVideoTime = videoTime.replace(/[:/\s]/g, '-')
          const safeHighlightTime = highlightTime.replace(/[:/]/g, '-')
          const filename = `frame_${safeVideoTime}_${safeHighlightTime}.jpg`
          
          const uploadedUrl = await uploadImageToBlob(frameDataUrl, filename)
          
          // 计算排序键：视频时间 + 高光帧时间（用于按时间顺序排列）
          const sortKey = `${normalizeTimeForSort(videoTime)}_${highlightTime.padStart(5, '0')}`
          
          frameData.push({ url: uploadedUrl, sortKey, eventIndex: i })
          
          // 更新事件的 extractedFrameUrl
          eventList[i] = { ...event, extractedFrameUrl: uploadedUrl }
        } catch (error) {
          console.error(`提取事件 ${i + 1} 的帧失败:`, error)
          toast.error(`事件 ${i + 1} 高光帧提取失败: ${error instanceof Error ? error.message : '未知错误'}`)
        }
      } else {
        toast.warning(`事件 ${i + 1} 没有关联视频，跳过高光帧提取`)
      }
    }
    
    setExtractedFrames(newFrames)
    
    // 按时间排序（视频时间 + 高光帧时间）
    frameData.sort((a, b) => a.sortKey.localeCompare(b.sortKey))
    
    return frameData
  }, [])

  // 创建九宫格图片（传入已排序的帧URL列表）
  const createAndUploadGridImage = useCallback(async (sortedFrameUrls: string[]): Promise<string> => {
    toast.info('正在按时间顺序生成九宫格拼接图...')
    const gridDataUrl = await createGridImage(sortedFrameUrls)
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-')
    const gridUrl = await uploadImageToBlob(gridDataUrl, `grid_${timestamp}.jpg`)
    setGridImageUrl(gridUrl)
    return gridUrl
  }, [])

  // 运行阶段一
  const runPhase1 = async (videoData: Array<{ name: string; timestamp: string; location: string; videoUrl: string }>) => {
    setCurrentPhase(1)
    toast.info('阶段一：分析视频，提取事件...')
    
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        visionModel: apiConfig.visionModel,
        reasoningModel: apiConfig.reasoningModel,
        imageModel: apiConfig.imageModel,
        imageApiKey: apiConfig.imageApiKey,
        imageBaseUrl: apiConfig.imageBaseUrl,
        phase1Prompt,
        phase2Prompt,
        phase3Prompt,
        videos: videoData,
        runPhase: 1,
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '阶段一失败')
    
    setEvents(result.events)
    toast.success(`阶段一完成，提取了 ${result.events.length} 个事件`)
    return result.events as EventUnit[]
  }

  // 运行阶段二
  const runPhase2 = async (eventList: EventUnit[], highlightFrameUrls: string[]) => {
    setCurrentPhase(2)
    toast.info('阶段二：生成日记和分镜 prompt...')
    
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        visionModel: apiConfig.visionModel,
        reasoningModel: apiConfig.reasoningModel,
        imageModel: apiConfig.imageModel,
        imageApiKey: apiConfig.imageApiKey,
        imageBaseUrl: apiConfig.imageBaseUrl,
        phase1Prompt,
        phase2Prompt,
        phase3Prompt,
        videos: [],
        existingEvents: eventList,
        highlightFrameUrls,
        runPhase: 2,
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '阶段二失败')
    
    setPhase2Result(result.phase2Result)
    toast.success('阶段二完成，日记和分镜已生成')
    return result.phase2Result as Phase2Result
  }

  // 运行阶段三
  const runPhase3 = async (p2Result: Phase2Result, gridUrl: string) => {
    setCurrentPhase(3)
    toast.info('阶段三：生成漫画九宫格...')
    
    const response = await fetch('/api/process', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        apiKey: apiConfig.apiKey,
        baseUrl: apiConfig.baseUrl,
        visionModel: apiConfig.visionModel,
        reasoningModel: apiConfig.reasoningModel,
        imageModel: apiConfig.imageModel,
        imageApiKey: apiConfig.imageApiKey,
        imageBaseUrl: apiConfig.imageBaseUrl,
        phase1Prompt,
        phase2Prompt,
        phase3Prompt,
        videos: [],
        phase2Result: p2Result,
        gridImageUrl: gridUrl,
        runPhase: 3,
      }),
    })

    const result = await response.json()
    if (!response.ok) throw new Error(result.error || '阶段三失败')
    
    // 获取图像模型生成的漫画（无文字）
    const comicWithoutText = result.comicImageUrl as string
    // 获取模型分析的气泡位置（服务端已调用视觉模型分析）
    const bubblePositions = result.bubblePositions as CoordinateBubble[] || []
    
    // 如果用户选择不添加气泡，直接返回无气泡漫画
    if (!enableBubbles) {
      setComicImageUrl(comicWithoutText)
      toast.success('漫画已生成（无气泡）')
      return comicWithoutText
    }
    
    // 检查是否有气泡数据
    if (!bubblePositions || bubblePositions.length === 0) {
      setComicImageUrl(comicWithoutText)
      toast.success('漫画已生成（无气泡位置数据）')
      return comicWithoutText
    }
    
    toast.info('正在添加气泡文字...')
    
    // 使用 Canvas 根据坐标添加气泡
    try {
      const comicWithBubbles = await addBubblesAtCoordinates(comicWithoutText, bubblePositions)
      // 上传带气泡的漫画
      const finalComicUrl = await uploadImageToBlob(comicWithBubbles, `comic_final_${Date.now()}.jpg`)
      setComicImageUrl(finalComicUrl)
      toast.success(`漫画已生成，包含 ${bubblePositions.length} 个对话气泡`)
      return finalComicUrl
    } catch (bubbleError) {
      console.error('添加气泡失败:', bubbleError)
      // 如果添加气泡失败，仍然返回无气泡的漫画
      setComicImageUrl(comicWithoutText)
      toast.warning('气泡添加失败，返回无气泡漫画')
      return comicWithoutText
    }
  }

  // 完整处理流程
  const handleProcess = async () => {
    if (!apiConfig.apiKey) {
      toast.error('请先配置 API Key')
      return
    }

    if (videos.length === 0) {
      toast.error('请先上传视频')
      return
    }

    setIsProcessing(true)
    setEvents([])
    setPhase2Result(null)
    setGridImageUrl(null)
    setComicImageUrl(null)
    setExtractedFrames(new Map())

    setVideos(videos.map(v => ({ ...v, status: 'processing' as const })))

    try {
      // 上传视频到 Blob（串行上传避免并发问题）
      toast.info('正在上传视频...')
      
      const videoData: Array<{ name: string; timestamp: string; location: string; videoUrl: string }> = []
      for (let index = 0; index < videos.length; index++) {
        const video = videos[index]
        toast.info(`上传视频 ${index + 1}/${videos.length}: ${video.name}`)
        try {
          const videoUrl = await uploadVideoToBlob(video.file)
          videoData.push({
            name: video.name,
            timestamp: video.timestamp,
            location: video.location,
            videoUrl,
          })
        } catch (uploadError) {
          console.error(`视频 ${video.name} 上传失败:`, uploadError)
          toast.error(`视频 ${video.name} 上传失败`)
        }
      }
      
      if (videoData.length === 0) {
        throw new Error('所有视频上传失败')
      }
      
      toast.success(`成功上传 ${videoData.length}/${videos.length} 个视频`)
      
      // 阶段一：提取事件
      const eventList = await runPhase1(videoData)
      
      // 检查事件是否都有 videoUrl
      const eventsWithVideo = eventList.filter(e => e.videoUrl)
      
      if (eventsWithVideo.length === 0) {
        toast.error('阶段一返回的事件没有关联视频URL，无法提取高光帧')
        throw new Error('事件缺少 videoUrl')
      }
      
      // 更新 events 状态（在提取高光帧前先显示）
      setEvents([...eventList])
      
      // 提取高光帧（返回按时间排序的帧数据）
      toast.info(`正在从视频中提取高光帧... (共 ${eventsWithVideo.length} 个事件)`)
      const sortedFrameData = await extractHighlightFrames(eventList)
      
      if (sortedFrameData.length === 0) {
        toast.error('没有成功提取任何高光帧，请检查视频格式是否支持浏览器播放')
        throw new Error('高光帧提取失败')
      }
      
      // 根据排序后的帧数据重排事件列表（确保日记时间顺序正确）
      const sortedEventList = sortedFrameData.map(f => eventList[f.eventIndex])
      
      // 更新 events 状态（按时间排序后的事件）
      setEvents([...sortedEventList])
      
      // 提取已排序的 URL 列表
      const sortedFrameUrls = sortedFrameData.map(f => f.url)
      
      // 阶段二：生成日记和分镜（传入按时间排序的事件和高光帧）
      await runPhase2(sortedEventList, sortedFrameUrls)
      
      // 阶段二完成后，按时间顺序创建九宫格图片（用于阶段三）
      await createAndUploadGridImage(sortedFrameUrls)
      
      // 注意：阶段三需要用户手动触发（因为可能需要调整分镜 prompt）
      toast.success(`阶段一和阶段二已完成！提取了 ${sortedEventList.length} 个事件和 ${sortedFrameData.length} 个高光帧。可以点击"生成漫画"继续阶段三`)
      
      setVideos(videos.map(v => ({ ...v, status: 'completed' as const })))
    } catch (error) {
      console.error('[v0] 处理失败:', error)
      toast.error(error instanceof Error ? error.message : '处理失败，请重试')
      setVideos(videos.map(v => ({ ...v, status: 'error' as const })))
    } finally {
      setIsProcessing(false)
      setCurrentPhase(0)
    }
  }

  // 单独运行阶段三
  const handleRunPhase3 = async () => {
    if (!phase2Result) {
      toast.error('请先完成阶段二')
      return
    }
    if (!gridImageUrl) {
      toast.error('请先生成九宫格图片')
      return
    }

    setIsProcessing(true)
    try {
      await runPhase3(phase2Result, gridImageUrl)
    } catch (error) {
      console.error('阶段三失���:', error)
      toast.error(error instanceof Error ? error.message : '阶段三失败')
    } finally {
      setIsProcessing(false)
      setCurrentPhase(0)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <Toaster position="top-center" />
      
      {/* Header */}
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">AI 日记 + 漫画生成器</h1>
                <p className="text-sm text-muted-foreground">视频 → 事件 → 日记 → 漫画</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              {/* 气泡开关 */}
              <div className="flex items-center gap-2 px-3 py-2 bg-secondary/50 rounded-lg">
                <MessageCircle className="h-4 w-4 text-muted-foreground" />
                <Label htmlFor="bubble-switch" className="text-sm cursor-pointer">
                  添加气泡
                </Label>
                <Switch
                  id="bubble-switch"
                  checked={enableBubbles}
                  onCheckedChange={setEnableBubbles}
                />
              </div>
              
              <Button 
                onClick={handleProcess} 
                disabled={isProcessing || videos.length === 0}
                size="lg"
                className="gap-2"
              >
                {isProcessing && currentPhase <= 2 ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    阶段 {currentPhase} 处理中...
                  </>
                ) : (
                  <>
                    <Play className="h-4 w-4" />
                    开始处理 (阶段1-2)
                  </>
                )}
              </Button>
              {phase2Result && gridImageUrl && (
                <Button 
                  onClick={handleRunPhase3} 
                  disabled={isProcessing}
                  size="lg"
                  variant="secondary"
                  className="gap-2"
                >
                  {isProcessing && currentPhase === 3 ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      生成漫画中...
                    </>
                  ) : (
                    <>
                      <ImageIcon className="h-4 w-4" />
                      生成漫画 (阶段3)
                    </>
                  )}
                </Button>
              )}
              
              {/* API 配置按钮 */}
              <APIConfigPanel 
                config={apiConfig} 
                onConfigChange={setApiConfig} 
              />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Column - Configuration */}
          <div className="space-y-6">
            <Tabs defaultValue="upload" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="upload">
                  <Sparkles className="h-4 w-4 mr-2" />
                  上传视频
                </TabsTrigger>
                <TabsTrigger value="prompts">Prompt 编辑</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-4">
                <VideoUploader 
                  videos={videos} 
                  onVideosChange={setVideos} 
                />
              </TabsContent>
              
              <TabsContent value="prompts" className="mt-4">
                <PromptEditor
                  phase1Prompt={phase1Prompt}
                  phase2Prompt={phase2Prompt}
                  phase3Prompt={phase3Prompt}
                  onPhase1Change={setPhase1Prompt}
                  onPhase2Change={setPhase2Prompt}
                  onPhase3Change={setPhase3Prompt}
                />
              </TabsContent>
            </Tabs>

            {/* 流程说明 */}
            <div className="p-4 bg-secondary/30 rounded-lg">
              <h3 className="font-medium mb-3">处理流程</h3>
              <div className="space-y-2 text-sm">
                <div className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentPhase === 1 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>1</div>
                  <div>
                    <p className="font-medium">阶段一：事件提取</p>
                    <p className="text-muted-foreground">视频理解模型分析视频，提取事件和高光帧定位</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentPhase === 2 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>2</div>
                  <div>
                    <p className="font-medium">阶段二：日记 + 分镜生成</p>
                    <p className="text-muted-foreground">多模态推理模型生成日记和九宫格分镜 prompt</p>
                  </div>
                </div>
                <div className="flex items-start gap-3">
                  <div className={`h-6 w-6 rounded-full flex items-center justify-center text-xs font-bold shrink-0 ${currentPhase === 3 ? 'bg-primary text-primary-foreground' : 'bg-primary/10 text-primary'}`}>3</div>
                  <div>
                    <p className="font-medium">阶段三：漫画生成</p>
                    <p className="text-muted-foreground">图像编辑模型生成漫画风格九宫格图片</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Right Column - Results */}
          <div>
            <ResultDisplay 
              events={events}
              extractedFrames={extractedFrames}
              phase2Result={phase2Result}
              gridImageUrl={gridImageUrl}
              comicImageUrl={comicImageUrl}
              isProcessing={isProcessing}
              currentPhase={currentPhase}
            />
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t mt-12 py-6">
        <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
          <p>漫画、日记功能 POC - 基于阶跃星辰大模型</p>
        </div>
      </footer>
    </div>
  )
}
