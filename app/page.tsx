"use client"

import { useMemo, useState } from "react"
import { BookOpen, Download, FileText, Image as ImageIcon, Play, Sparkles } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import { ScrollArea } from "@/components/ui/scroll-area"
import { Separator } from "@/components/ui/separator"

const demoDiary = `今天的节奏不算快，但很充实。上午我整理了手头的事项，把一堆零散的想法归了类，心里也跟着清爽了不少。午后阳光很好，我短暂地离开屏幕，去外面走了一圈，风吹过来的时候，感觉整个人都轻松了。傍晚回到桌前继续收尾，虽然有些疲惫，但看着事情一件件完成，还是有种踏实的满足感。`

const demoPanels = [
  "卡通风格，清晨的房间里阳光洒进窗边，人物刚刚开始一天的工作，氛围安静而明亮。",
  "日系漫画风格，桌面上摆着咖啡、笔记本和电脑，人物认真整理待办事项。",
  "轻松生活感，人物对着屏幕思考，表情专注，周围有几张散开的纸张。",
  "办公室或书桌场景，人物快速记录灵感，画面表现出效率和节奏感。",
  "午后转折，人物起身离开座位，准备出去透气，窗外有明亮的阳光。",
  "户外散步场景，微风吹动头发，人物表情放松，氛围清新自然。",
  "回到桌前，人物继续完成收尾工作，画面突出专注与克服疲惫的状态。",
  "傍晚时分，桌面灯光亮起，人物正在完成最后几项任务。",
  "总结镜头，人物露出轻松满足的表情，背景渐暗，整体传达一天结束的安稳感。",
]

const demoFrames = Array.from({ length: 9 }, (_, i) => `https://placehold.co/600x400/png?text=Frame+${i + 1}`)

export default function Home() {
  const [title, setTitle] = useState("AI 日记 + 漫画生成器（静态演示版）")
  const [description, setDescription] = useState(
    "这是一个可直接部署到 GitHub Pages 的纯前端示例页。它保留了原项目的视觉结构，但不再依赖后端接口。"
  )

  const panels = useMemo(
    () =>
      demoPanels.map((prompt, index) => ({
        id: index + 1,
        prompt,
        frame: demoFrames[index],
      })),
    []
  )

  const downloadText = (text: string, filename: string) => {
    const blob = new Blob([text], { type: "text/plain;charset=utf-8" })
    const url = URL.createObjectURL(blob)
    const a = document.createElement("a")
    a.href = url
    a.download = filename
    a.click()
    URL.revokeObjectURL(url)
  }

  const downloadJSON = () => {
    const data = {
      title,
      description,
      diary_text: demoDiary,
      comic_panels: panels,
      generatedAt: new Date().toISOString(),
    }
    downloadText(JSON.stringify(data, null, 2), "demo-result.json")
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="border-b bg-card/50 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between gap-4 flex-wrap">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-lg bg-primary flex items-center justify-center">
                <BookOpen className="h-5 w-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-xl font-bold">{title}</h1>
                <p className="text-sm text-muted-foreground">纯静态演示页，可直接部署到 GitHub Pages</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Button variant="secondary" onClick={() => downloadText(demoDiary, "demo-diary.txt")}>
                <FileText className="h-4 w-4 mr-2" />
                下载日记
              </Button>
              <Button onClick={downloadJSON}>
                <Download className="h-4 w-4 mr-2" />
                导出 JSON
              </Button>
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <div className="grid grid-cols-1 xl:grid-cols-[360px_1fr] gap-6">
          <div className="space-y-6">
            <Card>
              <CardHeader>
                <CardTitle>静态站点说明</CardTitle>
                <CardDescription>这个版本已经去掉了后端 API，仅保留前端展示和下载能力。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="rounded-lg border p-4 bg-secondary/20">
                  <p className="text-sm text-muted-foreground">{description}</p>
                </div>
                <Button variant="outline" className="w-full" onClick={() => downloadText(description, "readme.txt")}>
                  <Sparkles className="h-4 w-4 mr-2" />
                  下载简介
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle>可编辑文案</CardTitle>
                <CardDescription>你可以在发布前调整首页标题和说明。</CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="space-y-2">
                  <label className="text-sm font-medium">标题</label>
                  <Textarea value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <label className="text-sm font-medium">说明</label>
                  <Textarea value={description} onChange={(e) => setDescription(e.target.value)} className="min-h-[120px]" />
                </div>
              </CardContent>
            </Card>
          </div>

          <Card className="min-h-[720px]">
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between gap-3 flex-wrap">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Play className="h-5 w-5" />
                    Demo 处理结果
                  </CardTitle>
                  <CardDescription>展示原项目的日记、分镜与九宫格结果结构。</CardDescription>
                </div>
                <Badge variant="secondary">Static Pages Ready</Badge>
              </div>
            </CardHeader>
            <CardContent>
              <Tabs defaultValue="events" className="w-full">
                <TabsList className="grid w-full grid-cols-3">
                  <TabsTrigger value="events">日记</TabsTrigger>
                  <TabsTrigger value="frames">九宫格</TabsTrigger>
                  <TabsTrigger value="comic">分镜</TabsTrigger>
                </TabsList>

                <TabsContent value="events" className="mt-4">
                  <ScrollArea className="h-[580px] pr-4">
                    <div className="space-y-4">
                      <div className="p-4 border rounded-lg bg-secondary/20">
                        <h3 className="font-medium mb-2">今日日记</h3>
                        <p className="whitespace-pre-wrap leading-relaxed text-sm">{demoDiary}</p>
                      </div>
                      <Separator />
                      <div className="space-y-3">
                        {panels.map((panel) => (
                          <div key={panel.id} className="p-3 border rounded-lg">
                            <div className="flex items-center gap-2 mb-2">
                              <Badge variant="outline">第 {panel.id} 格</Badge>
                            </div>
                            <p className="text-sm text-muted-foreground">{panel.prompt}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="frames" className="mt-4">
                  <ScrollArea className="h-[580px] pr-4">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                      {panels.map((panel) => (
                        <div key={panel.id} className="border rounded-lg overflow-hidden">
                          <img src={panel.frame} alt={`Frame ${panel.id}`} className="w-full aspect-video object-cover" />
                          <div className="p-3">
                            <div className="flex items-center justify-between">
                              <span className="text-sm font-medium">九宫格第 {panel.id} 格</span>
                              <Badge variant="secondary">静态图</Badge>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                </TabsContent>

                <TabsContent value="comic" className="mt-4">
                  <ScrollArea className="h-[580px] pr-4">
                    <div className="space-y-4">
                      <div className="rounded-lg border overflow-hidden">
                        <img
                          src="https://placehold.co/1200x1200/png?text=Comic+Grid"
                          alt="静态漫画九宫格"
                          className="w-full"
                        />
                      </div>
                      <div className="p-4 border rounded-lg bg-secondary/20">
                        <h3 className="font-medium mb-2 flex items-center gap-2">
                          <ImageIcon className="h-4 w-4" />
                          分镜说明
                        </h3>
                        <div className="space-y-2">
                          {panels.map((panel) => (
                            <div key={panel.id} className="text-sm">
                              <span className="font-medium">第 {panel.id} 格：</span>
                              <span className="text-muted-foreground">{panel.prompt}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    </div>
                  </ScrollArea>
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </main>
    </div>
  )
}
