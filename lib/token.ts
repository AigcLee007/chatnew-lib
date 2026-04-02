import { encodingForModel } from 'js-tiktoken';

// 使用 gpt-4o 的编码器 (o200k_base) 作为通用标准，误差极小
const encoder = encodingForModel('gpt-4o');

export const countTokens = (text: string): number => {
  if (!text) return 0;
  try {
    return encoder.encode(text).length;
  } catch (e) {
    console.warn('Token calculation failed, falling back to estimation', e);
    return Math.ceil(text.length * 0.7); // 降级方案
  }
};
