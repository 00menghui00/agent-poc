"use client"

import { useState, useEffect } from "react"
import { FileText, Save, RotateCcw, ChevronDown, ChevronUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { DEFAULT_PHASE1_PROMPT, DEFAULT_PHASE2_PROMPT, DEFAULT_PHASE3_PROMPT } from "@/lib/store"

interface PromptEditorProps {
  phase1Prompt: string
  phase2Prompt: string
  phase3Prompt: string
  onPhase1Change: (prompt: string) => void
  onPhase2Change: (prompt: string) => void
  onPhase3Change: (prompt: string) => void
}

export function PromptEditor({ 
  phase1Prompt, 
  phase2Prompt, 
  phase3Prompt,
  onPhase1Change, 
  onPhase2Change,
  onPhase3Change,
}: PromptEditorProps) {
  const [localPhase1, setLocalPhase1] = useState(phase1Prompt)
  const [localPhase2, setLocalPhase2] = useState(phase2Prompt)
  const [localPhase3, setLocalPhase3] = useState(phase3Prompt)
  const [isPhase1Open, setIsPhase1Open] = useState(false)
  const [isPhase2Open, setIsPhase2Open] = useState(false)
  const [isPhase3Open, setIsPhase3Open] = useState(false)

  useEffect(() => {
    setLocalPhase1(phase1Prompt)
    setLocalPhase2(phase2Prompt)
    setLocalPhase3(phase3Prompt)
  }, [phase1Prompt, phase2Prompt, phase3Prompt])

  const handleSavePhase1 = () => {
    onPhase1Change(localPhase1)
    localStorage.setItem('phase1-prompt', localPhase1)
  }

  const handleSavePhase2 = () => {
    onPhase2Change(localPhase2)
    localStorage.setItem('phase2-prompt', localPhase2)
  }

  const handleSavePhase3 = () => {
    onPhase3Change(localPhase3)
    localStorage.setItem('phase3-prompt', localPhase3)
  }

  const handleResetPhase1 = () => {
    setLocalPhase1(DEFAULT_PHASE1_PROMPT)
    onPhase1Change(DEFAULT_PHASE1_PROMPT)
    localStorage.removeItem('phase1-prompt')
  }

  const handleResetPhase2 = () => {
    setLocalPhase2(DEFAULT_PHASE2_PROMPT)
    onPhase2Change(DEFAULT_PHASE2_PROMPT)
    localStorage.removeItem('phase2-prompt')
  }

  const handleResetPhase3 = () => {
    setLocalPhase3(DEFAULT_PHASE3_PROMPT)
    onPhase3Change(DEFAULT_PHASE3_PROMPT)
    localStorage.removeItem('phase3-prompt')
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5" />
          Prompt 配置
        </CardTitle>
        <CardDescription>
          自定义三个阶段的系统提示词
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* 阶段一 Prompt */}
        <Collapsible open={isPhase1Open} onOpenChange={setIsPhase1Open}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-secondary/50">
              <div className="text-left">
                <div className="font-medium">阶段一：事件提取</div>
                <div className="text-sm text-muted-foreground">视频理解模型 System Prompt</div>
              </div>
              {isPhase1Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            <Textarea
              value={localPhase1}
              onChange={(e) => setLocalPhase1(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="输入阶段一的 System Prompt..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSavePhase1} size="sm" className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button variant="outline" onClick={handleResetPhase1} size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                重置默认
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 阶段二 Prompt */}
        <Collapsible open={isPhase2Open} onOpenChange={setIsPhase2Open}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-secondary/50">
              <div className="text-left">
                <div className="font-medium">阶段二：日记 + 分镜生成</div>
                <div className="text-sm text-muted-foreground">多模态推理模型 System Prompt</div>
              </div>
              {isPhase2Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            <Textarea
              value={localPhase2}
              onChange={(e) => setLocalPhase2(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="输入阶段二的 System Prompt..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSavePhase2} size="sm" className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button variant="outline" onClick={handleResetPhase2} size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                重置默认
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>

        {/* 阶段三 Prompt */}
        <Collapsible open={isPhase3Open} onOpenChange={setIsPhase3Open}>
          <CollapsibleTrigger asChild>
            <Button variant="ghost" className="w-full justify-between p-4 h-auto border rounded-lg hover:bg-secondary/50">
              <div className="text-left">
                <div className="font-medium">阶段三：漫画生成</div>
                <div className="text-sm text-muted-foreground">图像编辑模型 Prompt</div>
              </div>
              {isPhase3Open ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
            </Button>
          </CollapsibleTrigger>
          <CollapsibleContent className="pt-4 space-y-3">
            <Textarea
              value={localPhase3}
              onChange={(e) => setLocalPhase3(e.target.value)}
              className="min-h-[200px] font-mono text-sm"
              placeholder="输入阶段三的 System Prompt..."
            />
            <div className="flex gap-2">
              <Button onClick={handleSavePhase3} size="sm" className="flex-1">
                <Save className="h-4 w-4 mr-2" />
                保存
              </Button>
              <Button variant="outline" onClick={handleResetPhase3} size="sm">
                <RotateCcw className="h-4 w-4 mr-2" />
                重置默认
              </Button>
            </div>
          </CollapsibleContent>
        </Collapsible>
      </CardContent>
    </Card>
  )
}
