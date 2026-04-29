import { put } from '@vercel/blob'
import { type NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const file = formData.get('file') as File

    if (!file) {
      return NextResponse.json({ error: '未提供文件' }, { status: 400 })
    }

    // 检查文件类型
    if (!file.type.startsWith('video/')) {
      return NextResponse.json({ error: '只支持视频文件' }, { status: 400 })
    }

    // 检查文件大小 (最大 100MB)
    const maxSize = 100 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json({ error: '文件大小不能超过 100MB' }, { status: 400 })
    }

    console.log('[v0] Uploading video to Blob:', file.name, 'size:', file.size)

    // 上传到 Vercel Blob (公开访问，因为需要传给阶跃星辰 API)
    const blob = await put(`videos/${Date.now()}-${file.name}`, file, {
      access: 'public',
    })

    console.log('[v0] Video uploaded successfully:', blob.url)

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
