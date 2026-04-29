"use client"

import { useState, useEffect } from "react"
import { Settings, Eye, EyeOff, Save, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { DEFAULT_API_CONFIG, type APIConfig } from "@/lib/store"

interface APIConfigProps {
  config: APIConfig
  onConfigChange: (config: APIConfig) => void
}

export function APIConfigPanel({ config, onConfigChange }: APIConfigProps) {
  const [showApiKey, setShowApiKey] = useState(false)
  const [localConfig, setLocalConfig] = useState<APIConfig>(config)

  useEffect(() => {
    setLocalConfig(config)
  }, [config])

  const handleSave = () => {
    onConfigChange(localConfig)
    // 保存到 localStorage
    localStorage.setItem('api-config', JSON.stringify(localConfig))
  }

  const handleReset = () => {
    setLocalConfig(DEFAULT_API_CONFIG)
    onConfigChange(DEFAULT_API_CONFIG)
    localStorage.removeItem('api-config')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Settings className="h-5 w-5" />
          API 配置
        </CardTitle>
        <CardDescription>
          配置阶跃星辰 API 连接参数
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-2">
          <Label htmlFor="apiKey">API Key</Label>
          <div className="relative">
            <Input
              id="apiKey"
              type={showApiKey ? "text" : "password"}
              value={localConfig.apiKey}
              onChange={(e) => setLocalConfig({ ...localConfig, apiKey: e.target.value })}
              placeholder="请输入您的 API Key"
              className="pr-10"
            />
            <button
              type="button"
              onClick={() => setShowApiKey(!showApiKey)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              {showApiKey ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        <div className="space-y-2">
          <Label htmlFor="baseUrl">API Base URL</Label>
          <Input
            id="baseUrl"
            value={localConfig.baseUrl}
            onChange={(e) => setLocalConfig({ ...localConfig, baseUrl: e.target.value })}
            placeholder="https://api.stepfun.com/v1"
          />
        </div>

        <div className="grid grid-cols-1 gap-4">
          <div className="space-y-2">
            <Label htmlFor="visionModel">阶段一：视频理解模型</Label>
            <Input
              id="visionModel"
              value={localConfig.visionModel}
              onChange={(e) => setLocalConfig({ ...localConfig, visionModel: e.target.value })}
              placeholder="step-1o-turbo-vision"
            />
            <p className="text-xs text-muted-foreground">用于从视频中提取事件和高光帧</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="reasoningModel">阶段二：多模态推理模型</Label>
            <Input
              id="reasoningModel"
              value={localConfig.reasoningModel}
              onChange={(e) => setLocalConfig({ ...localConfig, reasoningModel: e.target.value })}
              placeholder="step-2-16k"
            />
            <p className="text-xs text-muted-foreground">用于生成日记和九宫格分镜 prompt</p>
          </div>
          <div className="space-y-2">
            <Label htmlFor="imageModel">阶段三：图像生成模型</Label>
            <Input
              id="imageModel"
              value={localConfig.imageModel}
              onChange={(e) => setLocalConfig({ ...localConfig, imageModel: e.target.value })}
              placeholder="step-1x-medium"
            />
            <p className="text-xs text-muted-foreground">用于生成漫画风格九宫格图片</p>
          </div>
        </div>

        <div className="flex gap-2 pt-2">
          <Button onClick={handleSave} className="flex-1">
            <Save className="h-4 w-4 mr-2" />
            保存配置
          </Button>
          <Button variant="outline" onClick={handleReset}>
            <RotateCcw className="h-4 w-4 mr-2" />
            重置
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}
