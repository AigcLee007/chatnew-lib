import { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, convertInchesToTwip } from "docx";
import { saveAs } from "file-saver";

// 辅助函数：解析行内样式 (处理 **加粗** 和 *斜体*)
// 返回 docx 的 TextRun 数组
const parseInlineStyle = (text: string): TextRun[] => {
  const children: TextRun[] = [];
  // 正则匹配：匹配 **加粗** 或 *斜体*
  // group 1: 加粗内容, group 2: 斜体内容
  const regex = /(\*\*(.*?)\*\*)|(\*(.*?)\*)/g;
  
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    // 添加匹配前的普通文本
    if (match.index > lastIndex) {
      children.push(new TextRun({ 
        text: text.substring(lastIndex, match.index),
        size: 24 
      }));
    }

    const boldText = match[2];
    const italicText = match[4];

    if (boldText) {
      children.push(new TextRun({ 
        text: boldText, 
        bold: true, 
        size: 24 
      }));
    } else if (italicText) {
      children.push(new TextRun({ 
        text: italicText, 
        italics: true, 
        size: 24 
      }));
    }

    lastIndex = regex.lastIndex;
  }

  // 添加剩余的普通文本
  if (lastIndex < text.length) {
    children.push(new TextRun({ 
      text: text.substring(lastIndex),
      size: 24 
    }));
  }

  return children.length > 0 ? children : [new TextRun({ text: text, size: 24 })];
};

export const exportToWord = async (content: string, filename: string = "document") => {
  // --- 1. 智能提纯：去除 AI 的废话 ---
  // 逻辑：寻找文章的第一个“一级标题”(# )或“二级标题”(## )
  // 如果找到了，就认为真正的文章从这里开始，丢弃前面的所有“好的，这是您的文章...”之类的废话
  let cleanContent = content;
  
  // 匹配行首的 # 或 ## (忽略代码块中的)
  const headerMatch = content.match(/^#{1,2}\s/m);
  
  if (headerMatch && headerMatch.index !== undefined && headerMatch.index > 0) {
      // 只有当标题不是在第一行时，才进行截取
      // 截取从标题开始的内容
      cleanContent = content.substring(headerMatch.index);
  }

  // --- 2. 逐行解析并转换格式 ---
  const lines = cleanContent.split('\n');
  const docChildren: Paragraph[] = [];

  lines.forEach(line => {
    const trimmed = line.trim();

    // H1 (# ) -> 对应 Word 标题 1
    if (trimmed.startsWith('# ')) {
      docChildren.push(new Paragraph({
        text: trimmed.replace('# ', ''),
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 240, after: 120 },
      }));
      return;
    }
    
    // H2 (## ) -> 对应 Word 标题 2
    if (trimmed.startsWith('## ')) {
      docChildren.push(new Paragraph({
        text: trimmed.replace('## ', ''),
        heading: HeadingLevel.HEADING_2,
        spacing: { before: 240, after: 120 },
      }));
      return;
    }

    // H3 (### ) -> 对应 Word 标题 3
    if (trimmed.startsWith('### ')) {
      docChildren.push(new Paragraph({
        text: trimmed.replace('### ', ''),
        heading: HeadingLevel.HEADING_3,
        spacing: { before: 200, after: 100 },
      }));
      return;
    }

    // 无序列表 (- 或 *)
    if (trimmed.startsWith('- ') || trimmed.startsWith('* ')) {
      const listText = trimmed.replace(/^[-*] /, '');
      docChildren.push(new Paragraph({
        children: parseInlineStyle(listText), // 支持列表内的加粗
        bullet: { level: 0 }, // 自动设为列表项
      }));
      return;
    }

    // 普通段落 (空行处理)
    if (!trimmed) {
        docChildren.push(new Paragraph({ text: "" }));
        return;
    }

    // 普通段落 (支持行内加粗)
    docChildren.push(new Paragraph({
      children: parseInlineStyle(line),
      spacing: { after: 120 }, // 段后间距，让排版不拥挤
      alignment: AlignmentType.JUSTIFIED // 两端对齐，更像正式文档
    }));
  });

  // --- 3. 创建文档并下载 ---
  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docChildren,
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `${filename}.docx`);
};