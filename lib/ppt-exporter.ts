import PptxGenJS from "pptxgenjs";

// --- 定义主题接口 ---
export interface PPTTheme {
    name: string;
    colors: {
        background: string;
        title: string;
        text: string;
        accent: string;  // 装饰条颜色
        secondary: string; // 页码条颜色
    };
    fonts: {
        heading: string;
        body: string;
    }
}

// --- 预设主题库 ---
export const PPT_THEMES: Record<string, PPTTheme> = {
    business: {
        name: "商务蓝",
        colors: { background: "FFFFFF", title: "FFFFFF", text: "333333", accent: "0052cc", secondary: "F5F5F5" },
        fonts: { heading: "微软雅黑", body: "微软雅黑" }
    },
    dark: {
        name: "深邃黑",
        colors: { background: "1A1A1A", title: "FFFFFF", text: "E0E0E0", accent: "E11D48", secondary: "262626" },
        fonts: { heading: "黑体", body: "微软雅黑" }
    },
    minimal: {
        name: "极简白",
        colors: { background: "FFFFFF", title: "000000", text: "333333", accent: "000000", secondary: "FAFAFA" },
        fonts: { heading: "Arial", body: "Arial" }
    }
};

// 定义幻灯片的数据结构
interface SlideSection {
  title: string;
  contentLines: string[];
}

export const exportToPPT = async (
    content: string, 
    filename: string = "presentation", 
    themeKey: string = 'business'
) => {
  const pptx = new PptxGenJS();
  const theme = PPT_THEMES[themeKey] || PPT_THEMES['business'];

  // --- 1. 全局样式配置 ---
  pptx.layout = 'LAYOUT_16x9';
  pptx.author = 'Aittco AI';
  pptx.company = 'Aittco Workbench';
  
  // 定义母版
  pptx.defineSlideMaster({
    title: "MASTER_SLIDE",
    background: { color: theme.colors.background },
    objects: [
      // 顶部装饰条
      { rect: { x: 0, y: 0, w: "100%", h: 1.0, fill: { color: theme.colors.accent } } }, 
      // 底部页码条
      { rect: { x: 0, y: 6.9, w: "100%", h: 0.6, fill: { color: theme.colors.secondary } } },
    ],
    slideNumber: { x: "95%", y: "92%", fontSize: 10, color: "888888" }
  });

  // --- 2. 智能解析 Markdown 结构 ---
  const rawLines = content.split('\n');
  const sections: SlideSection[] = [];
  
  let currentSection: SlideSection = { title: "目录 / 概览", contentLines: [] };
  let coverTitle = "";
  let coverSubtitle = `生成时间：${new Date().toLocaleDateString()}`;

  for (let i = 0; i < rawLines.length; i++) {
    const line = rawLines[i].trim();
    if (!line) continue;

    // 识别封面 (H1)
    if (line.startsWith('# ')) {
        coverTitle = line.replace(/^#\s+/, '');
        continue;
    }

    // 识别新页面 (H2)
    if (line.startsWith('## ')) {
        if (currentSection.contentLines.length > 0) {
            sections.push(currentSection);
        }
        currentSection = {
            title: line.replace(/^##\s+/, ''),
            contentLines: []
        };
        continue;
    }

    // 识别普通加粗标题 (###)
    if (line.startsWith('### ')) {
        currentSection.contentLines.push(`**${line.replace(/^###\s+/, '')}**`);
        continue;
    }

    currentSection.contentLines.push(line);
  }
  if (currentSection.contentLines.length > 0) {
      sections.push(currentSection);
  }

  // --- 3. 渲染：封面页 ---
  if (coverTitle || sections.length > 0) {
      const slide = pptx.addSlide();
      slide.background = { color: theme.colors.background }; 
      
      // 封面大标题
      slide.addText(coverTitle || "AI 生成演示文稿", {
          x: 0.5, y: "40%", w: "90%", h: 1.5,
          fontSize: 48, bold: true, align: "center", 
          color: theme.colors.text, 
          fontFace: theme.fonts.heading
      });
      
      // 副标题
      slide.addText(coverSubtitle, {
          x: 0.5, y: "60%", w: "90%", h: 0.5,
          fontSize: 16, align: "center", 
          color: theme.colors.text,
          transparency: 40 // 淡化
      });
  }

  // --- 4. 渲染：内容页 ---
  const MAX_LINES_PER_SLIDE = 9;

  sections.forEach(section => {
      const totalLines = section.contentLines.length;
      
      if (totalLines <= MAX_LINES_PER_SLIDE) {
          renderContentSlide(pptx, section.title, section.contentLines, theme);
      } else {
          let pageIndex = 1;
          for (let i = 0; i < totalLines; i += MAX_LINES_PER_SLIDE) {
              const chunk = section.contentLines.slice(i, i + MAX_LINES_PER_SLIDE);
              const titleSuffix = pageIndex > 1 ? ` (${pageIndex})` : "";
              renderContentSlide(pptx, section.title + titleSuffix, chunk, theme);
              pageIndex++;
          }
      }
  });

  // --- 5. 导出文件 ---
  await pptx.writeFile({ fileName: `${filename}.pptx` });
};

// --- 辅助函数 ---
function renderContentSlide(pptx: PptxGenJS, title: string, lines: string[], theme: PPTTheme) {
    const slide = pptx.addSlide({ masterName: "MASTER_SLIDE" });

    // 1. 顶部标题 (使用 theme.colors.title)
    slide.addText(title, {
        x: 0.5, y: 0.15, w: "90%", h: 0.7,
        fontSize: 28, bold: true, 
        color: theme.colors.title, 
        align: "left", 
        fontFace: theme.fonts.heading
    });

    // 2. 正文内容
    let currentY = 1.3;
    const lineHeight = 0.6;

    lines.forEach(line => {
        const isBullet = line.startsWith('- ') || line.startsWith('* ');
        const cleanText = line.replace(/^[-*]\s+/, '').replace(/\*\*/g, '');
        const isBold = line.includes('**');

        slide.addText(cleanText, {
            x: 0.8, y: currentY, w: "88%", h: lineHeight,
            fontSize: 18,
            color: theme.colors.text,
            bullet: isBullet,
            bold: isBold,
            fontFace: theme.fonts.body
        });

        currentY += lineHeight;
    });
}