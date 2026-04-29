"use client"

import { BookOpen, Image as ImageIcon, Clock, MapPin, Users, Heart, Star, Download, Copy, Check, Grid3X3, FileText, Palette } from "lucide-react"
import { useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"
import { toast } from "sonner"
import { type EventUnit, type Phase2Result } from "@/lib/store"
import { downloadDataUrl } from "@/lib/video-utils"

interface ResultDisplayProps {
  events: EventUnit[]
  extractedFrames: Map<number, string>
  phase2Result: Phase2Result | null
  gridImageUrl: string | null
  comicImageUrl: string | null
  isProcessing: boolean
  currentPhase: number
}

export function ResultDisplay({ 
  events, 
  extractedFrames,
  phase2Result,
  gridImageUrl,
  comicImageUrl,
  isProcessing,
  currentPhase,
}: ResultDisplayProps) {
  const [copiedDiary, setCopiedDiary] = useState(false)

  const handleCopyDiary = () => {
    if (phase2Result?.diary_text) {
      navigator.clipboard.writeText(phase2Result.diary_text)
      setCopiedDiary(true)
      toast.success('日记已复制到剪贴板')
      setTimeout(() => setCopiedDiary(false), 2000)
    }
  }

  const handleDownloadJSON = () => {
    const data = {
      events,
      phase2Result,
      gridImageUrl,
      comicImageUrl,
      generatedAt: new Date().toISOString(),
    }
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diary-comic-${new Date().toISOString().split('T')[0]}.json`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('JSON 已下载')
  }

  const handleDownloadDiaryText = () => {
    if (!phase2Result?.diary_text) return
    const blob = new Blob([phase2Result.diary_text], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `diary-${new Date().toISOString().split('T')[0]}.txt`
    a.click()
    URL.revokeObjectURL(url)
    toast.success('日记文本已下载')
  }

  const handleDownloadImage = (imageUrl: string, filename: string) => {
    if (imageUrl.startsWith('data:')) {
      downloadDataUrl(imageUrl, filename)
    } else {
      const a = document.createElement('a')
      a.href = imageUrl
      a.download = filename
      a.target = '_blank'
      a.click()
    }
    toast.success('图片已下载')
  }

  const hasResults = events.length > 0 || phase2Result || comicImageUrl

  if (!hasResults && !isProcessing) {
    return (
      <Card className="h-full min-h-[400px] flex items-center justify-center">
        <CardContent className="text-center py-12">
          <div className="h-16 w-16 rounded-full bg-secondary/50 flex items-center justify-center mx-auto mb-4">
            <BookOpen className="h-8 w-8 text-muted-foreground" />
          </div>
          <h3 className="text-lg font-medium mb-2">等待处理</h3>
          <p className="text-muted-foreground max-w-xs mx-auto">
            上传视频后点击"开始处理"，AI 将分析视频内容，生成日记和漫画
          </p>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card className="h-full">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <BookOpen className="h-5 w-5" />
              处理结果
            </CardTitle>
            <CardDescription>
              {isProcessing 
                ? `正在执行阶段 ${currentPhase}...` 
                : `共 ${events.length} 个事件${phase2Result ? '，日记已生成' : ''}${comicImageUrl ? '，漫画已生成' : ''}`
              }
            </CardDescription>
          </div>
          <div className="flex flex-wrap gap-2">
            {phase2Result && (
              <Button variant="outline" size="sm" onClick={handleDownloadDiaryText}>
                <FileText className="h-4 w-4 mr-2" />
                下载日记
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={handleDownloadJSON}>
              <Download className="h-4 w-4 mr-2" />
              导出 JSON
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="events" className="w-full">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="events" className="gap-1">
              <Clock className="h-3 w-3" />
              事件 ({events.length})
            </TabsTrigger>
            <TabsTrigger value="frames" className="gap-1">
              <ImageIcon className="h-3 w-3" />
              高光帧 ({extractedFrames.size})
            </TabsTrigger>
            <TabsTrigger value="diary" className="gap-1" disabled={!phase2Result}>
              <FileText className="h-3 w-3" />
              日记
            </TabsTrigger>
            <TabsTrigger value="comic" className="gap-1" disabled={!gridImageUrl && !comicImageUrl}>
              <Palette className="h-3 w-3" />
              漫画
            </TabsTrigger>
          </TabsList>

          {/* 事件列表 */}
          <TabsContent value="events" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {events.length === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isProcessing ? '正在提取事件...' : '暂无事件'}
                </div>
              ) : (
                <div className="space-y-4">
                  {events.map((event, index) => (
                    <div key={index} className="p-4 border rounded-lg space-y-3">
                      <div className="flex gap-4">
                        {extractedFrames.has(index) && (
                          <div className="relative flex-shrink-0 w-24">
                            <img
                              src={extractedFrames.get(index)}
                              alt={`高光帧: ${event.event || ''}`}
                              className="aspect-video w-full object-cover rounded-lg border"
                            />
                          </div>
                        )}
                        
                        <div className="flex-1 space-y-2">
                          <div className="flex items-start justify-between">
                            <div className="flex items-center gap-2">
                              {event.scene && <Badge variant="outline">{event.scene}</Badge>}
                              {event.time && (
                                <span className="text-sm text-muted-foreground flex items-center gap-1">
                                  <Clock className="h-3 w-3" />
                                  {event.time}
                                </span>
                              )}
                            </div>
                            {typeof event.importance === 'number' && (
                              <div className="flex items-center gap-1">
                                <Star className="h-4 w-4 text-yellow-500" />
                                <span className="text-sm font-medium">
                                  {(event.importance * 100).toFixed(0)}%
                                </span>
                              </div>
                            )}
                          </div>

                          <p className="text-base">{event.event}</p>

                          <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                            {event.location && (
                              <span className="flex items-center gap-1">
                                <MapPin className="h-3 w-3" />
                                {event.location}
                              </span>
                            )}
                            {event.people && event.people.length > 0 && (
                              <span className="flex items-center gap-1">
                                <Users className="h-3 w-3" />
                                {event.people.join(", ")}
                              </span>
                            )}
                            {event.emotion && (
                              <span className="flex items-center gap-1">
                                <Heart className="h-3 w-3" />
                                {event.emotion}
                              </span>
                            )}
                          </div>

                          {event.tags && event.tags.length > 0 && (
                            <div className="flex flex-wrap gap-1 pt-1">
                              {event.tags.map((tag, tagIndex) => (
                                <Badge key={tagIndex} variant="secondary" className="text-xs">
                                  {tag}
                                </Badge>
                              ))}
                            </div>
                          )}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 高光帧 */}
          <TabsContent value="frames" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {extractedFrames.size === 0 ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isProcessing ? '正在提取高光帧...' : '暂无高光帧'}
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                    {Array.from(extractedFrames.entries()).map(([index, frameUrl]) => (
                      <div key={index} className="relative group">
                        <img
                          src={frameUrl}
                          alt={`高光帧 ${index + 1}`}
                          className="aspect-video w-full object-cover rounded-lg border"
                        />
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center">
                          <Button
                            variant="secondary"
                            size="sm"
                            onClick={() => handleDownloadImage(frameUrl, `highlight-${index + 1}.jpg`)}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            下载
                          </Button>
                        </div>
                        <p className="mt-1 text-xs text-muted-foreground text-center">
                          帧 {index + 1} - {events[index]?.highlight_frame || ''}
                        </p>
                      </div>
                    ))}
                  </div>

                  {gridImageUrl && (
                    <>
                      <Separator className="my-4" />
                      <div>
                        <div className="flex items-center justify-between mb-3">
                          <h4 className="font-medium flex items-center gap-2">
                            <Grid3X3 className="h-4 w-4" />
                            九宫格拼接图
                          </h4>
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleDownloadImage(gridImageUrl, 'grid-image.jpg')}
                          >
                            <Download className="h-4 w-4 mr-1" />
                            下载
                          </Button>
                        </div>
                        <img
                          src={gridImageUrl}
                          alt="九宫格拼接图"
                          className="w-full rounded-lg border"
                        />
                      </div>
                    </>
                  )}
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 日记和分镜 */}
          <TabsContent value="diary" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              {!phase2Result ? (
                <div className="text-center py-8 text-muted-foreground">
                  {isProcessing && currentPhase === 2 ? '正在生成日记...' : '暂无日记'}
                </div>
              ) : (
                <div className="space-y-6">
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <FileText className="h-4 w-4" />
                        今日日记
                      </h4>
                      <Button variant="ghost" size="sm" onClick={handleCopyDiary}>
                        {copiedDiary ? (
                          <Check className="h-4 w-4 mr-1" />
                        ) : (
                          <Copy className="h-4 w-4 mr-1" />
                        )}
                        {copiedDiary ? '已复制' : '复制'}
                      </Button>
                    </div>
                    <div className="p-4 bg-secondary/30 rounded-lg">
                      <p className="whitespace-pre-wrap leading-relaxed">
                        {phase2Result.diary_text}
                      </p>
                    </div>
                  </div>

                  <Separator />

                  <div>
                    <h4 className="font-medium flex items-center gap-2 mb-3">
                      <Grid3X3 className="h-4 w-4" />
                      九宫格分镜 Prompt ({phase2Result.comic_panels?.length || 0})
                    </h4>
                    <div className="space-y-3">
                      {phase2Result.comic_panels?.map((panel, index) => (
                        <div key={index} className="p-3 border rounded-lg">
                          <div className="flex items-center gap-2 mb-2">
                            <Badge variant="outline">第 {panel.panel_id} 格</Badge>
                            {panel.highlight_frame_id && (
                              <span className="text-xs text-muted-foreground">
                                参考: {panel.highlight_frame_id}
                              </span>
                            )}
                          </div>
                          <p className="text-sm text-muted-foreground">{panel.prompt}</p>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </ScrollArea>
          </TabsContent>

          {/* 漫画结果 */}
          <TabsContent value="comic" className="mt-4">
            <ScrollArea className="h-[500px] pr-4">
              <div className="space-y-6">
                {gridImageUrl && (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Grid3X3 className="h-4 w-4" />
                        高光帧九宫格（原图）
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadImage(gridImageUrl, 'grid-original.jpg')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        下载
                      </Button>
                    </div>
                    <img
                      src={gridImageUrl}
                      alt="高光帧九宫格"
                      className="w-full rounded-lg border"
                    />
                  </div>
                )}

                {gridImageUrl && comicImageUrl && <Separator />}

                {comicImageUrl ? (
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="font-medium flex items-center gap-2">
                        <Palette className="h-4 w-4" />
                        漫画九宫格（生成）
                      </h4>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleDownloadImage(comicImageUrl, 'comic-result.jpg')}
                      >
                        <Download className="h-4 w-4 mr-1" />
                        下载
                      </Button>
                    </div>
                    <img
                      src={comicImageUrl}
                      alt="漫画九宫格"
                      className="w-full rounded-lg border"
                    />
                  </div>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    {isProcessing && currentPhase === 3 
                      ? '正在生成漫画...' 
                      : gridImageUrl 
                        ? '点击"生成漫画 (阶段3)"按钮生成漫画风格图片'
                        : '请先完成阶段一和阶段二'
                    }
                  </div>
                )}
              </div>
            </ScrollArea>
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  )
}
