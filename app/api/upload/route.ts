import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 })
    }

    // 检查文件类型 - 支持视频和图片
    const isVideo = file.type.startsWith('video/')
    const isImage = file.type.startsWith('image/')
    
    if (!isVideo && !isImage) {
      return NextResponse.json({ error: '只支持视频或图片文件' }, { status: 400 })
    }

    // 检查文件大小 (视频最大 100MB，图片最大 10MB)
    const maxSize = isVideo ? 100 * 1024 * 1024 : 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ 
        error: `文件大小不能超过 ${isVideo ? '100MB' : '10MB'}` 
      }, { status: 400 })
    }

    // 根据文件类型选择存储目录
    const folder = isVideo ? 'videos' : 'images'
    const filename = file.name || `${Date.now()}.${isImage ? 'jpg' : 'mp4'}`

    // 上传到 Vercel Blob (公开访问，因为需要传给阶跃星辰 API)
    const blob = await put(`${folder}/${Date.now()}-${filename}`, file, {
      access: 'public',
    })

    return NextResponse.json({ 
      url: blob.url,
      pathname: blob.pathname 
    })
  } catch (error) {
    console.error('[v0] Upload error:', error)
    return NextResponse.json({ 
      error: error instanceof Error ? error.message : '上传失败' 
    }, { status: 500 })
  }
}
