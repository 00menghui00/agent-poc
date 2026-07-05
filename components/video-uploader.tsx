"use client"

import { useState, useCallback } from "react"
import { Upload, X, Video, MapPin, Clock, Trash2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { toast } from "sonner"
import { type VideoFile } from "@/lib/store"

const MAX_FILE_SIZE_MB = 100 // 最大100MB (使用 Vercel Blob 上传)

interface VideoUploaderProps {
  videos: VideoFile[]
  onVideosChange: (videos: VideoFile[]) => void
}

export function VideoUploader({ videos, onVideosChange }: VideoUploaderProps) {
  const [isDragging, setIsDragging] = useState(false)

  const generateId = () => Math.random().toString(36).substring(2, 9)

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files).filter(
      file => file.type.startsWith('video/')
    )
    
    // 检查文件大小
    const validFiles: File[] = []
    const oversizedFiles: string[] = []
    
    for (const file of files) {
      const sizeMB = file.size / (1024 * 1024)
      if (sizeMB > MAX_FILE_SIZE_MB) {
        oversizedFiles.push(`${file.name} (${sizeMB.toFixed(1)}MB)`)
      } else {
        validFiles.push(file)
      }
    }
    
    if (oversizedFiles.length > 0) {
      toast.error(`以下文件超过${MAX_FILE_SIZE_MB}MB限制: ${oversizedFiles.join(', ')}`)
    }
    
    const newVideos: VideoFile[] = validFiles.map(file => ({
      id: generateId(),
      file,
      name: file.name,
      timestamp: new Date().toLocaleString('zh-CN'),
      location: '',
      status: 'pending' as const,
    }))
    
    if (newVideos.length > 0) {
      onVideosChange([...videos, ...newVideos])
    }
  }, [videos, onVideosChange])

  const handleFileSelect = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (!files) return
    
    const videoFiles = Array.from(files).filter(
      file => file.type.startsWith('video/')
    )
    
    // 检查文件大小
    const validFiles: File[] = []
    const oversizedFiles: string[] = []
    
    for (const file of videoFiles) {
      const sizeMB = file.size / (1024 * 1024)
      if (sizeMB > MAX_FILE_SIZE_MB) {
        oversizedFiles.push(`${file.name} (${sizeMB.toFixed(1)}MB)`)
      } else {
        validFiles.push(file)
      }
    }
    
    if (oversizedFiles.length > 0) {
      toast.error(`以下文件超过${MAX_FILE_SIZE_MB}MB限制: ${oversizedFiles.join(', ')}`)
    }
    
    const newVideos: VideoFile[] = validFiles.map(file => ({
      id: generateId(),
      file,
      name: file.name,
      timestamp: new Date().toLocaleString('zh-CN'),
      location: '',
      status: 'pending' as const,
    }))
    
    if (newVideos.length > 0) {
      onVideosChange([...videos, ...newVideos])
    }
    e.target.value = ''
  }, [videos, onVideosChange])

  const handleRemoveVideo = (id: string) => {
    onVideosChange(videos.filter(v => v.id !== id))
  }

  const handleUpdateVideo = (id: string, updates: Partial<VideoFile>) => {
    onVideosChange(videos.map(v => v.id === id ? { ...v, ...updates } : v))
  }

  const handleClearAll = () => {
    onVideosChange([])
  }

  const getStatusBadge = (status: VideoFile['status']) => {
    switch (status) {
      case 'pending':
        return <Badge variant="secondary">待处理</Badge>
      case 'processing':
        return <Badge className="bg-blue-500 text-white">处理中</Badge>
      case 'completed':
        return <Badge className="bg-green-500 text-white">已完成</Badge>
      case 'error':
        return <Badge variant="destructive">错误</Badge>
    }
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <Video className="h-5 w-5" />
              视频上传
            </CardTitle>
            <CardDescription>
              批量上传视频文件，支持拖拽上传
            </CardDescription>
          </div>
          {videos.length > 0 && (
            <Button variant="outline" size="sm" onClick={handleClearAll}>
              <Trash2 className="h-4 w-4 mr-2" />
              清空全部
            </Button>
          )}
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 上传区域 */}
        <div
          className={`border-2 border-dashed rounded-lg p-8 text-center transition-colors ${
            isDragging 
              ? 'border-primary bg-primary/5' 
              : 'border-border hover:border-primary/50'
          }`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
          <p className="text-lg font-medium mb-2">拖拽视频文件到此处</p>
          <p className="text-sm text-muted-foreground mb-4">或点击下方按钮选择文件 (单个文件最大 {MAX_FILE_SIZE_MB}MB)</p>
          <label>
            <Input
              type="file"
              accept="video/*"
              multiple
              className="hidden"
              onChange={handleFileSelect}
            />
            <Button asChild>
              <span>选择视频文件</span>
            </Button>
          </label>
        </div>

        {/* 视频列表 */}
        {videos.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="font-medium">已上传 {videos.length} 个视频</h4>
            </div>
            <ScrollArea className="h-[300px] pr-4">
              <div className="space-y-3">
                {videos.map((video) => (
                  <div
                    key={video.id}
                    className="p-4 border rounded-lg space-y-3 bg-card"
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-center gap-3">
                        <div className="h-10 w-10 rounded bg-secondary flex items-center justify-center">
                          <Video className="h-5 w-5 text-muted-foreground" />
                        </div>
                        <div>
                          <p className="font-medium text-sm truncate max-w-[200px]">
                            {video.name}
                          </p>
                          <p className="text-xs text-muted-foreground">
                            {(video.file.size / (1024 * 1024)).toFixed(2)} MB
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {getStatusBadge(video.status)}
                        <button
                          onClick={() => handleRemoveVideo(video.id)}
                          className="text-muted-foreground hover:text-destructive transition-colors"
                        >
                          <X className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          时间戳
                        </label>
                        <Input
                          value={video.timestamp}
                          onChange={(e) => handleUpdateVideo(video.id, { timestamp: e.target.value })}
                          placeholder="2026年4月27日10:33"
                          className="h-8 text-sm"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-xs text-muted-foreground flex items-center gap-1">
                          <MapPin className="h-3 w-3" />
                          地理位置
                        </label>
                        <Input
                          value={video.location}
                          onChange={(e) => handleUpdateVideo(video.id, { location: e.target.value })}
                          placeholder="北京市海淀区"
                          className="h-8 text-sm"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
