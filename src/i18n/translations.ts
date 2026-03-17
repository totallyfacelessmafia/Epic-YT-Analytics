export type Locale = "en" | "zh";

const translations: Record<string, Record<Locale, string>> = {
  // Header
  "header.title": { en: "Epic Channel Insights", zh: "Epic 频道洞察" },
  "header.subtitle": { en: "YouTube Analytics Dashboard", zh: "YouTube 数据分析仪表盘" },
  "header.download": { en: "Download Monthly Report", zh: "下载月度报告" },
  "header.downloading": { en: "Generating Report...", zh: "正在生成报告..." },
  "header.live": { en: "Live", zh: "实时" },

  // Metric Cards
  "metrics.totalViews": { en: "Total Views", zh: "总观看次数" },
  "metrics.watchTime": { en: "Watch Time", zh: "观看时长" },
  "metrics.subscribersGained": { en: "Subscribers Gained", zh: "新增订阅者" },
  "metrics.vsLast30Days": { en: "vs last 30 days", zh: "与过去30天相比" },

  // Performance Chart
  "chart.title": { en: "Performance Over Time", zh: "趋势表现" },
  "chart.daily": { en: "Daily", zh: "每日" },
  "chart.weekly": { en: "Weekly", zh: "每周" },
  "chart.monthly": { en: "Monthly", zh: "每月" },
  "chart.all": { en: "All", zh: "全部" },
  "chart.shorts": { en: "Shorts", zh: "短视频" },
  "chart.longForm": { en: "Long-form", zh: "长视频" },
  "chart.views": { en: "Views", zh: "观看次数" },
  "chart.watchTimeMin": { en: "Watch Time (min)", zh: "观看时长（分钟）" },

  // Subscribers Chart
  "subscribers.title": { en: "Subscribers Gained", zh: "新增订阅者" },
  "subscribers.name": { en: "Subscribers", zh: "订阅者" },

  // Top Videos
  "topVideos.title": { en: "Top Performing Content", zh: "热门内容" },
  "topVideos.video": { en: "Video", zh: "视频" },
  "topVideos.type": { en: "Type", zh: "类型" },
  "topVideos.views": { en: "Views", zh: "观看次数" },
  "topVideos.avgViewDuration": { en: "Avg. View Duration", zh: "平均观看时长" },
  "topVideos.link": { en: "Link", zh: "链接" },
  "topVideos.viewOnYouTube": { en: "View on YouTube", zh: "在YouTube上观看" },
  "topVideos.short": { en: "Short", zh: "短视频" },
  "topVideos.long": { en: "Long", zh: "长视频" },
  "topVideos.empty": { en: "No videos found for this filter.", zh: "未找到符合筛选条件的视频。" },

  // Search Terms
  "search.title": { en: "Top Search Terms", zh: "热门搜索词" },
  "search.subtitle": { en: "Keywords driving traffic (last 30 days)", zh: "驱动流量的关键词（过去30天）" },
  "search.views": { en: "views", zh: "次观看" },

  // Upload Frequency
  "upload.title": { en: "Upload Frequency", zh: "上传频率" },
  "upload.today": { en: "Today", zh: "今天" },
  "upload.thisWeek": { en: "This Week", zh: "本周" },
  "upload.lastWeek": { en: "Last Week", zh: "上周" },
  "upload.last30Days": { en: "Last 30 Days", zh: "过去30天" },

  // Errors
  "error.fetchFailed": { en: "Failed to fetch analytics", zh: "获取分析数据失败" },
  "error.checkCredentials": { en: "Please check your API credentials and try again.", zh: "请检查您的API凭据并重试。" },
  "error.pdfFailed": { en: "Failed to generate PDF report. Please try again.", zh: "生成PDF报告失败，请重试。" },

  // Footer
  "footer.text": { en: "Managed by Revelation Inc. AI", zh: "由 Revelation Inc. AI 管理" },

  // Format
  "format.hrs": { en: "hrs", zh: "小时" },
  "format.min": { en: "min", zh: "分钟" },

  // Navigation
  "nav.analytics": { en: "Analytics", zh: "数据分析" },
  "nav.automation": { en: "Video Automation", zh: "视频自动化" },
  "nav.promptEngine": { en: "Prompt Engine", zh: "提示引擎" },

  // Automation Page
  "auto.title": { en: "Epic Video Automation", zh: "Epic 视频自动化" },
  "auto.subtitle": { en: "Drive to YouTube Pipeline", zh: "从云端硬盘到YouTube的流水线" },
  "auto.folderLabel": { en: "Google Drive Folder ID", zh: "Google Drive 文件夹 ID" },
  "auto.folderPlaceholder": { en: "Paste your Google Drive folder ID here...", zh: "在此粘贴您的Google Drive文件夹ID..." },
  "auto.scanFolder": { en: "Scan Folder", zh: "扫描文件夹" },
  "auto.scanning": { en: "Scanning...", zh: "正在扫描..." },
  "auto.reviewQueue": { en: "Review Queue", zh: "审核队列" },
  "auto.noVideos": { en: "No .mp4 files found in this folder.", zh: "此文件夹中未找到.mp4文件。" },
  "auto.generateSeo": { en: "Generate SEO", zh: "生成SEO" },
  "auto.generating": { en: "Generating...", zh: "正在生成..." },
  "auto.previewMetadata": { en: "Preview Metadata", zh: "预览元数据" },
  "auto.editTitle": { en: "Title", zh: "标题" },
  "auto.editDescription": { en: "Description", zh: "描述" },
  "auto.confirmUpload": { en: "Confirm Upload", zh: "确认上传" },
  "auto.uploading": { en: "Uploading...", zh: "正在上传..." },
  "auto.uploadComplete": { en: "Upload Complete", zh: "上传完成" },
  "auto.statusDownloading": { en: "Downloading from Drive", zh: "从云端硬盘下载" },
  "auto.statusProcessing": { en: "Generating SEO", zh: "正在生成SEO" },
  "auto.statusUploading": { en: "Uploading to YouTube", zh: "正在上传到YouTube" },
  "auto.statusDone": { en: "Done", zh: "完成" },
  "auto.statusError": { en: "Error", zh: "错误" },
  "auto.filename": { en: "Filename", zh: "文件名" },
  "auto.size": { en: "Size", zh: "大小" },
  "auto.status": { en: "Status", zh: "状态" },
  "auto.actions": { en: "Actions", zh: "操作" },
  "auto.ready": { en: "Ready", zh: "就绪" },
  "auto.settings": { en: "Upload Settings", zh: "上传设置" },
  "auto.privacy": { en: "Privacy: Unlisted", zh: "隐私：不公开" },
  "auto.audience": { en: "Audience: Made for Kids", zh: "受众：面向儿童" },
  "auto.category": { en: "Category: Education", zh: "分类：教育" },
  "auto.processAll": { en: "Process All Videos", zh: "批量处理所有视频" },
  "auto.processing": { en: "Processing...", zh: "正在处理..." },
  "auto.summary": { en: "Upload Summary", zh: "上传摘要" },
  "auto.summaryDesc": { en: "All videos have been uploaded successfully.", zh: "所有视频已成功上传。" },
  "auto.copyLink": { en: "Copy Shareable Link", zh: "复制分享链接" },
  "auto.copied": { en: "Copied!", zh: "已复制！" },
  "auto.viewOnYt": { en: "View on YouTube", zh: "在YouTube上观看" },
  "auto.retry": { en: "Retry", zh: "重试" },
  "auto.cancel": { en: "Cancel", zh: "取消" },
  "auto.bulkProgress": { en: "Processing video", zh: "正在处理视频" },
  "auto.of": { en: "of", zh: "/" },

  // SEO Strength Meter
  "seo.title": { en: "SEO Strength", zh: "SEO强度" },
  "seo.excellent": { en: "Excellent", zh: "优秀" },
  "seo.good": { en: "Good", zh: "良好" },
  "seo.fair": { en: "Fair", zh: "一般" },
  "seo.weak": { en: "Weak", zh: "较弱" },
  "seo.keywordFirst40": { en: "Primary keyword in first 40 chars", zh: "主关键词在前40个字符内" },
  "seo.titleLength": { en: "Title under 100 characters", zh: "标题少于100个字符" },
  "seo.emojiPresent": { en: "Emojis in title for CTR boost", zh: "标题包含表情符号提升点击率" },
  "seo.ctaFirst3Lines": { en: "getepic.com CTA in first 3 lines", zh: "前3行包含getepic.com行动号召" },
  "seo.wordOfDay": { en: "Word of the Day section present", zh: "包含「每日一词」板块" },
  "seo.hashtags": { en: "5+ hashtags in description", zh: "描述中包含5个以上话题标签" },
  "seo.tagCount": { en: "15+ tags across 3 clusters", zh: "3个分类中共15个以上标签" },
  "seo.brandTags": { en: "Brand tags (Epic + Kitten Ninja)", zh: "品牌标签（Epic + Kitten Ninja）" },
  "seo.found": { en: "Found", zh: "已找到" },
  "seo.missing": { en: "Missing", zh: "缺失" },
  "seo.hashtagsFound": { en: "found", zh: "个" },
};

export default translations;
