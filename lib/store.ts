// 配置存储和默认prompts

export interface APIConfig {
  apiKey: string
  baseUrl: string
  visionModel: string
  reasoningModel: string
  imageModel: string // 图像生成模型
  imageApiKey?: string // 图像API单独的Key（如果不同）
  imageBaseUrl?: string // 图像API单独的地址（如果不同）
}

export interface VideoFile {
  id: string
  file: File
  name: string
  timestamp: string
  location: string
  status: 'pending' | 'processing' | 'completed' | 'error'
  result?: EventUnit[]
}

export interface EventUnit {
  time: string
  location: string
  scene: string
  event: string // 改名为 event_description 更准确，但保持兼容
  people: string[]
  emotion: string
  importance: number
  highlight_frame: string // 帧标识符或时间戳，如 "00:15"
  tags: string[]
  videoUrl?: string // 视频 URL，用于截取帧
  videoName?: string // 视频文件名
  extractedFrameUrl?: string // 提取后的高光帧图片 URL
}

// 漫画分镜 prompt
export interface ComicPanel {
  panel_id: number
  prompt: string
  highlight_frame_id?: string
}

// 阶段二输出结构
export interface Phase2Result {
  diary_text: string
  comic_panels: ComicPanel[]
}

// 阶段三输出结构
export interface Phase3Result {
  comicImageUrl: string // 生成的漫画九宫格图片 URL
}

// 完整的处理结果
export interface ProcessingResult {
  events: EventUnit[]
  phase2Result: Phase2Result | null
  phase3Result: Phase3Result | null
  gridImageUrl?: string // 九宫格高光帧拼接图
}

export const DEFAULT_PHASE1_PROMPT = `你是一个"生活记录分析助手"。你的任务是从用户提供的视频中提取关键的"事件单元 (Event Units)"，并以指定的 JSON 格式输出，同时标记出代表事件的高光帧。这些事件单元将用于后续的日记生成和漫画创作。

**要求:**
1. **避免逐帧描述:** 不要对视频内容进行逐帧的详细描述，而是聚焦于总结关键事件。
2. **事件数量:** 每个视频应总结为 1 到 3 个核心关键事件。
3. **事件单元结构:** 每个提取的事件单元必须包含以下字段：
   * \`time\`: 事件发生的时间（格式如 "00:15" 表示视频第15秒）。
   * \`scene\`: 事件发生的具体场景（例如：办公、户外、餐厅、通勤等）。
   * \`event\`: 对事件的简洁描述，用一句话概括。
   * \`people\`: 事件中涉及的人物（数组格式）。
   * \`emotion\`: 对事件中人物情绪的推测（例如：平静、专注、放松等）。
   * \`importance\`: 对事件重要性的评分，范围从 0 到 1，0 为不重要，1 为非常重要。
   * \`tags\`: 与事件相关的关键词或标签（数组格式）。
   * \`highlight_frame\`: 最能代表该事件的视频帧时间点（格式如 "00:15"）。
4. **输出格式:** 最终输出必须是严格的 JSON 数组结构。

**输出示例:**
\`\`\`json
[
  {
    "time": "09:30",
    "scene": "办公室",
    "event": "在电脑前专注工作，处理文档",
    "people": ["我"],
    "emotion": "专注",
    "importance": 0.7,
    "tags": ["工作", "办公", "电脑"],
    "highlight_frame": "00:15"
  }
]
\`\`\``

export const DEFAULT_PHASE2_PROMPT = `你是一个"生活日记与漫画分镜助手"。你的任务是根据用户提供的事件单元列表和高光帧图片，创作一篇连贯、自然且富有表现力的日记，并为后续的漫画生成模型提供详细的九宫格分镜 prompt。

**日记生成要求:**
1. **时间顺序组织:** 日记内容必须严格按照事件发生的时间顺序进行叙述。
2. **叙述风格:** 避免逐条罗列事件，而是采用叙述性的语言，使日记读起来像真人所写。
3. **情感与反思:** 可以适当加入对事件的情绪总结、个人感受或反思。
4. **字数控制:** 日记的整体字数应控制在 150 到 300 字之间。
5. **风格自然:** 保持日记的语言风格自然、不夸张。

**漫画分镜 Prompt 生成要求:**
1. **九宫格结构:** 必须生成 9 个独立的分镜 prompt，每个 prompt 对应九宫格漫画中的一个格子：
   * 第1格 (起): 引入时间/地点
   * 第2格 (日常动作): 展现日常活动或场景
   * 第3格 (事件开始): 描述主要事件的开端
   * 第4格 (发展): 展现事件的进一步发展
   * 第5格 (转折): 描述事件中的关键转折点
   * 第6格 (情绪变化): 表现人物情绪的变化
   * 第7格 (高光瞬间): 突出一天中的精彩或重要时刻
   * 第8格 (收尾): 事件的结束或一天的尾声
   * 第9格 (总结): 对一天的总结
2. **Prompt 内容:** 每个分镜 prompt 必须包含：场景描述、人物动作与表情、情绪氛围、风格关键词（如"卡通风格"、"日系漫画"）
3. **人物一致性:** 同一角色在所有分镜中保持外观一致

**输出格式:** JSON 格式，包含 diary_text 和 comic_panels 字段：
\`\`\`json
{
  "diary_text": "今天阳光明媚，我在办公室里处理着手头的工作...",
  "comic_panels": [
    {"panel_id": 1, "prompt": "卡通风格，办公室窗外阳光明媚..."},
    {"panel_id": 2, "prompt": "日系漫画风格，年轻人专注地敲击键盘..."},
    ...
  ]
}
\`\`\``

export const DEFAULT_PHASE3_PROMPT = `你是一个专业漫画生成模型。你的任务是根据用户提供的日记文本、九宫格分镜 prompt 列表和参考图片，生成一张完整的"九宫格漫画图片"。

**整体要求:**
1. **完整九宫格:** 最终输出必须是一张完整的九宫格漫画图片（3x3 布局）。
2. **严格遵循分镜 Prompt:** 必须严格按照每个分镜 prompt 中提供的场景描述、人物动作表情、情绪氛围、风格关键词来生成对应的画面。
3. **统一风格:** 所有漫画画面必须保持统一的风格，例如卡通、日系或轻松生活风。
4. **人物外观一致性:** 同一角色在不同的格子中必须保持外观一致。
5. **清晰表达事件:** 每格画面都需清晰地表达事件的进展和内容。

**重要约束:**
* 最终输出必须且只能是漫画图片文件
* 无额外文本说明
* 高光帧应用：优先使用分镜 prompt 中指定的高光帧作为参考`

export const DEFAULT_API_CONFIG: APIConfig = {
  apiKey: '',
  baseUrl: 'https://api.stepfun.com/v1',
  visionModel: 'step-1o-turbo-vision',
  reasoningModel: 'step-3',
  imageModel: 'doubao-seedream-5-0-260128', // 豆包 seedream 图像生成模型
  imageApiKey: '', // 豆包 API Key（需要单独配置）
  imageBaseUrl: 'https://ark.cn-beijing.volces.com/api/v3', // 豆包 API 地址
}
