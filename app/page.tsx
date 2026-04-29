"use client"

import { useState, useEffect, useCallback } from "react"
import { Play, BookOpen, Sparkles, Image as ImageIcon, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  uploadImageToBlob 
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

  // 提取高光帧
  const extractHighlightFrames = useCallback(async (eventList: EventUnit[]): Promise<string[]> => {
    const frameUrls: string[] = []
    const newFrames = new Map<number, string>()
    
    for (let i = 0; i < eventList.length; i++) {
      const event = eventList[i]
      if (event.videoUrl) {
        try {
          toast.info(`提取高光帧 ${i + 1}/${eventList.length}...`)
          const timeInSeconds = parseTimeToSeconds(event.highlight_frame || '')
          const frameDataUrl = await extractFrameFromVideo(event.videoUrl, timeInSeconds)
          newFrames.set(i, frameDataUrl)
          
          // 上传到 Blob 获取 URL
          const filename = `frame_${event.videoName || 'video'}_${event.highlight_frame || i}.jpg`
          const uploadedUrl = await uploadImageToBlob(frameDataUrl, filename)
          frameUrls.push(uploadedUrl)
          
          // 更新事件的 extractedFrameUrl
          eventList[i] = { ...event, extractedFrameUrl: uploadedUrl }
        } catch (error) {
          console.error(`提取事件 ${i + 1} 的帧失败:`, error)
        }
      }
    }
    
    setExtractedFrames(newFrames)
    return frameUrls
  }, [])

  // 创建九宫格图片
  const createAndUploadGridImage = useCallback(async (frameUrls: string[]): Promise<string> => {
    toast.info('正在生成九宫格拼接图...')
    const gridDataUrl = await createGridImage(frameUrls)
    const gridUrl = await uploadImageToBlob(gridDataUrl, 'grid_image.jpg')
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
    
    setComicImageUrl(result.comicImageUrl)
    toast.success('阶段三完成，漫画已生成')
    return result.comicImageUrl as string
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
      // 上传视频到 Blob
      toast.info('正在上传视频...')
      const videoData = await Promise.all(
        videos.map(async (video, index) => {
          toast.info(`上传视频 ${index + 1}/${videos.length}: ${video.name}`)
          const videoUrl = await uploadVideoToBlob(video.file)
          return {
            name: video.name,
            timestamp: video.timestamp,
            location: video.location,
            videoUrl,
          }
        })
      )
      
      // 阶段一：提取事件
      const eventList = await runPhase1(videoData)
      
      // 提取高光帧
      toast.info('正在从视频中提取高光帧...')
      const highlightFrameUrls = await extractHighlightFrames(eventList)
      
      // 创建九宫格图片
      const gridUrl = await createAndUploadGridImage(highlightFrameUrls)
      
      // 阶段二：生成日记和分镜
      const p2Result = await runPhase2(eventList, highlightFrameUrls)
      
      // 注意：阶段三需要用户手动触发（因为可能需要调整分镜 prompt）
      toast.success('阶段一和阶段二已完成！可以点击"生成漫画"继续阶段三')
      
      setVideos(videos.map(v => ({ ...v, status: 'completed' as const })))
    } catch (error) {
      console.error('处理失败:', error)
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
      console.error('阶段三失败:', error)
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
            <div className="flex gap-2">
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
              <TabsList className="grid w-full grid-cols-3">
                <TabsTrigger value="upload">
                  <Sparkles className="h-4 w-4 mr-2" />
                  上传视频
                </TabsTrigger>
                <TabsTrigger value="api">API 配置</TabsTrigger>
                <TabsTrigger value="prompts">Prompt</TabsTrigger>
              </TabsList>
              
              <TabsContent value="upload" className="mt-4">
                <VideoUploader 
                  videos={videos} 
                  onVideosChange={setVideos} 
                />
              </TabsContent>
              
              <TabsContent value="api" className="mt-4">
                <APIConfigPanel 
                  config={apiConfig} 
                  onConfigChange={setApiConfig} 
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
