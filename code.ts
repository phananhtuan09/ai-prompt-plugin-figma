// Plugin code - chạy trong Figma sandbox

interface Config {
  apiKey: string;
  model: string;
}

interface FrameData {
  name: string;
  width: number;
  height: number;
  children: any[];
}

// Top 3 models tốt nhất từ API key của bạn
const DEFAULT_MODEL = 'gemini-2.5-flash';
const MODELS = [
  { 
    value: 'gemini-2.5-pro', 
    label: 'Gemini 2.5 Pro (Tốt nhất - Chất lượng cao nhất, 64K tokens)' 
  },
  { 
    value: 'gemini-2.5-flash', 
    label: 'Gemini 2.5 Flash (Khuyến nghị - Nhanh & Cân bằng, 64K tokens)' 
  },
  { 
    value: 'gemini-2.5-flash-lite', 
    label: 'Gemini 2.5 Flash-Lite (Nhẹ hơn, vẫn 64K tokens)' 
  }
];

// Lưu cấu hình
async function saveConfig(config: Config): Promise<void> {
  await figma.clientStorage.setAsync('apiKey', config.apiKey);
  await figma.clientStorage.setAsync('model', config.model);
}

// Đọc cấu hình
async function loadConfig(): Promise<Config> {
  const apiKey = await figma.clientStorage.getAsync('apiKey') || '';
  const model = await figma.clientStorage.getAsync('model') || DEFAULT_MODEL;
  return { apiKey, model };
}

// Helper function để kiểm tra mixed
function isNotMixed(value: any): boolean {
  return value !== figma.mixed;
}

// Trích xuất cấu trúc Frame thành JSON
function extractFrameStructure(node: SceneNode): any {
  const result: any = {
    type: node.type,
    name: node.name,
    visible: node.visible,
    locked: node.locked
  };

  if ('width' in node && 'height' in node) {
    result.width = node.width;
    result.height = node.height;
  }

  if ('x' in node && 'y' in node) {
    result.x = node.x;
    result.y = node.y;
  }

  if ('fills' in node && isNotMixed(node.fills)) {
    result.fills = node.fills;
  }

  if ('strokes' in node && isNotMixed(node.strokes)) {
    result.strokes = node.strokes;
  }

  if ('cornerRadius' in node && typeof node.cornerRadius === 'number') {
    result.cornerRadius = node.cornerRadius;
  }

  if ('opacity' in node && typeof node.opacity === 'number') {
    result.opacity = node.opacity;
  }

  // Extract text properties cho TEXT nodes
  if (node.type === 'TEXT') {
    const textNode = node as unknown as TextNode;
    if ('characters' in textNode) {
      result.characters = textNode.characters;
    }
    if (typeof textNode.fontSize === 'number') {
      result.fontSize = textNode.fontSize;
    }
    try {
      const fontName = textNode.fontName;
      if (fontName && typeof fontName === 'object' && 'family' in fontName) {
        result.fontFamily = fontName.family || '';
        result.fontWeight = fontName.style || '';
      }
    } catch (e) {
      // fontName là mixed, bỏ qua
    }
  }

  if ('children' in node && node.children) {
    result.children = node.children
      .filter(child => child.visible)
      .map(child => extractFrameStructure(child))
      .filter(item => item !== null);
  }

  return result;
}

// Xuất Frame thành ảnh PNG Base64
async function exportFrameToBase64(node: FrameNode): Promise<string> {
  const bytes = await node.exportAsync({ format: 'PNG', constraint: { type: 'SCALE', value: 2 } });
  const base64 = figma.base64Encode(bytes);
  return `data:image/png;base64,${base64}`;
}

// Tạo meta-prompt
function createMetaPrompt(frameData: FrameData, includeResponsive: boolean, baseWidth?: string): string {
  let prompt = `You are a technical documentation expert. Analyze the provided Figma frame design and create a detailed technical description in English.

CRITICAL REQUIREMENTS:
1. Output MUST be in English
2. Use Markdown format with proper code blocks
3. Describe the semantic HTML structure with VALID, error-free HTML syntax
4. Provide CSS properties with exact values (colors in hex/rgb, dimensions in pixels, etc.)
5. Be framework-agnostic (no React, Vue, Angular, etc. - use pure HTML/CSS)
6. Include layout information (flexbox, grid, positioning)
7. Describe typography, spacing, colors, and visual effects comprehensively
8. Ensure ALL HTML syntax is valid - double-check attribute formats (e.g., src="..." not src="path="...")
9. Include accessibility attributes where appropriate (alt text for images, semantic HTML)
10. Mention any hover states, transitions, or interactive effects if visible in the design

OUTPUT STRUCTURE:
- Start with overall page structure
- Provide complete semantic HTML code block
- List CSS properties organized by component/section
- Include spacing and measurements summary
- Include typography summary
- Include colors summary
- Include visual effects summary
${includeResponsive && baseWidth ? '- Include responsive design suggestions with specific breakpoints' : ''}

Frame Information:
- Name: ${frameData.name}
- Dimensions: ${frameData.width}px × ${frameData.height}px
`;

  if (includeResponsive && baseWidth) {
    prompt += `\nIMPORTANT: This design is for a ${baseWidth} screen. Provide responsive suggestions for smaller screens (tablet, mobile) with specific breakpoints (e.g., @media queries) and adjustments.`;
  }

  prompt += `\n\nAnalyze the frame structure and image carefully. Generate a comprehensive, accurate technical prompt in English Markdown format. Double-check all HTML syntax and CSS values for correctness.`;

  return prompt;
}

// Gửi request đến Gemini API
async function callGeminiAPI(
  apiKey: string,
  model: string,
  imageBase64: string,
  frameStructure: any,
  metaPrompt: string
): Promise<string> {
  // Sử dụng API v1
  // Lưu ý: model name đã đúng format từ MODELS array (không cần thay đổi)
  // Các model như 'gemini-pro-latest' sẽ được dùng trực tiếp
  const url = `https://generativelanguage.googleapis.com/v1/models/${model}:generateContent?key=${apiKey}`;

  // Tách base64 data (bỏ prefix data:image/png;base64,)
  const base64Data = imageBase64.includes(',') 
    ? imageBase64.split(',')[1] 
    : imageBase64;

  // Gộp text prompt với frame structure
  const fullPrompt = `${metaPrompt}\n\nFrame Structure (JSON):\n${JSON.stringify(frameStructure, null, 2)}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: fullPrompt
          },
          {
            inline_data: {
              mime_type: 'image/png',
              data: base64Data
            }
          }
        ]
      }
    ]
  };

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json'
    },
    body: JSON.stringify(payload)
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ error: { message: 'Unknown error' } }));
    const errorMessage = (error && error.error && error.error.message) 
      ? error.error.message 
      : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const text = (data && 
                data.candidates && 
                data.candidates[0] && 
                data.candidates[0].content && 
                data.candidates[0].content.parts && 
                data.candidates[0].content.parts[0]) 
    ? data.candidates[0].content.parts[0].text 
    : null;

  if (!text) {
    throw new Error('No response from Gemini API');
  }

  return text;
}

// Xử lý message từ UI
figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === 'get-selection') {
      const selection = figma.currentPage.selection;
      if (selection.length === 0 || selection[0].type !== 'FRAME') {
        figma.ui.postMessage({
          type: 'selection-updated',
          frameName: null,
          isValid: false
        });
        return;
      }

      const frame = selection[0] as FrameNode;
      figma.ui.postMessage({
        type: 'selection-updated',
        frameName: frame.name,
        isValid: true,
        width: frame.width,
        height: frame.height
      });
    }

    if (msg.type === 'get-config') {
      const config = await loadConfig();
      figma.ui.postMessage({
        type: 'config-loaded',
        config: config,
        models: MODELS
      });
    }

    if (msg.type === 'save-config') {
      await saveConfig(msg.config);
      figma.ui.postMessage({
        type: 'config-saved'
      });
    }

    if (msg.type === 'generate-prompt') {
      const selection = figma.currentPage.selection;
      if (selection.length === 0 || selection[0].type !== 'FRAME') {
        figma.ui.postMessage({
          type: 'error',
          message: 'Vui lòng chọn một Frame trước khi tạo prompt.'
        });
        return;
      }

      const frame = selection[0] as FrameNode;
      const config = await loadConfig();

      if (!config.apiKey) {
        figma.ui.postMessage({
          type: 'error',
          message: 'Vui lòng cấu hình API Key trong Settings.'
        });
        return;
      }

      // Gửi trạng thái đang xử lý
      figma.ui.postMessage({
        type: 'generating',
        message: 'Đang trích xuất dữ liệu Frame...'
      });

      // Trích xuất dữ liệu
      const imageBase64 = await exportFrameToBase64(frame);
      const frameStructure = extractFrameStructure(frame);

      figma.ui.postMessage({
        type: 'generating',
        message: 'Đang gửi yêu cầu đến Gemini AI...'
      });

      // Tạo meta-prompt
      const frameData: FrameData = {
        name: frame.name,
        width: frame.width,
        height: frame.height,
        children: frameStructure.children || []
      };

      const metaPrompt = createMetaPrompt(
        frameData,
        msg.includeResponsive || false,
        msg.baseWidth
      );

      // Gọi Gemini API
      const promptResult = await callGeminiAPI(
        config.apiKey,
        config.model,
        imageBase64,
        frameStructure,
        metaPrompt
      );

      // Gửi kết quả
      figma.ui.postMessage({
        type: 'prompt-generated',
        prompt: promptResult
      });
    }

  } catch (error) {
    figma.ui.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : 'Đã xảy ra lỗi không xác định.'
    });
  }
};

// Khởi tạo UI
figma.showUI(__html__, { width: 480, height: 640 });

// Gửi thông tin selection ban đầu
const selection = figma.currentPage.selection;
if (selection.length > 0 && selection[0].type === 'FRAME') {
  const frame = selection[0] as FrameNode;
  figma.ui.postMessage({
    type: 'selection-updated',
    frameName: frame.name,
    isValid: true,
    width: frame.width,
    height: frame.height
  });
} else {
  figma.ui.postMessage({
    type: 'selection-updated',
    frameName: null,
    isValid: false
  });
}

// Lắng nghe thay đổi selection
figma.on('selectionchange', () => {
  const selection = figma.currentPage.selection;
  if (selection.length > 0 && selection[0].type === 'FRAME') {
    const frame = selection[0] as FrameNode;
    figma.ui.postMessage({
      type: 'selection-updated',
      frameName: frame.name,
      isValid: true,
      width: frame.width,
      height: frame.height
    });
  } else {
    figma.ui.postMessage({
      type: 'selection-updated',
      frameName: null,
      isValid: false
    });
  }
});

