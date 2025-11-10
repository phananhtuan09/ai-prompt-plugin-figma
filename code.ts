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
const DEFAULT_MODEL = "gemini-2.5-flash";
const MODELS = [
  {
    value: "gemini-2.5-pro",
    label: "Gemini 2.5 Pro (Tốt nhất - Chất lượng cao nhất, 64K tokens)",
  },
  {
    value: "gemini-2.5-flash",
    label: "Gemini 2.5 Flash (Khuyến nghị - Nhanh & Cân bằng, 64K tokens)",
  },
  {
    value: "gemini-2.5-flash-lite",
    label: "Gemini 2.5 Flash-Lite (Nhẹ hơn, vẫn 64K tokens)",
  },
];

// Lưu cấu hình
async function saveConfig(config: Config): Promise<void> {
  await figma.clientStorage.setAsync("apiKey", config.apiKey);
  await figma.clientStorage.setAsync("model", config.model);
}

// Đọc cấu hình
async function loadConfig(): Promise<Config> {
  const apiKey = (await figma.clientStorage.getAsync("apiKey")) || "";
  const model = (await figma.clientStorage.getAsync("model")) || DEFAULT_MODEL;
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
    locked: node.locked,
  };

  if ("width" in node && "height" in node) {
    result.width = node.width;
    result.height = node.height;
  }

  if ("x" in node && "y" in node) {
    result.x = node.x;
    result.y = node.y;
  }

  if ("fills" in node && isNotMixed(node.fills)) {
    result.fills = node.fills;
  }

  if ("strokes" in node && isNotMixed(node.strokes)) {
    result.strokes = node.strokes;
  }

  if ("cornerRadius" in node && typeof node.cornerRadius === "number") {
    result.cornerRadius = node.cornerRadius;
  }

  if ("opacity" in node && typeof node.opacity === "number") {
    result.opacity = node.opacity;
  }

  // Extract text properties cho TEXT nodes
  if (node.type === "TEXT") {
    const textNode = node as unknown as TextNode;
    if ("characters" in textNode) {
      result.characters = textNode.characters;
    }
    if (typeof textNode.fontSize === "number") {
      result.fontSize = textNode.fontSize;
    }
    try {
      const fontName = textNode.fontName;
      if (fontName && typeof fontName === "object" && "family" in fontName) {
        result.fontFamily = fontName.family || "";
        result.fontWeight = fontName.style || "";
      }
    } catch (e) {
      // fontName là mixed, bỏ qua
    }
  }

  if ("children" in node && node.children) {
    result.children = node.children
      .filter((child) => child.visible)
      .map((child) => extractFrameStructure(child))
      .filter((item) => item !== null);
  }

  return result;
}

// Xuất Frame thành ảnh PNG Base64
async function exportFrameToBase64(node: FrameNode): Promise<string> {
  const MAX_DIMENSION = 2048; // Giới hạn chiều dài tối đa
  const maxDimension = Math.max(node.width, node.height);

  let constraint;
  if (maxDimension > MAX_DIMENSION) {
    // Nếu frame quá lớn, dùng WIDTH constraint để giới hạn chiều rộng
    constraint = { type: "WIDTH" as const, value: MAX_DIMENSION };
  } else {
    // Nếu frame nhỏ hơn, dùng SCALE 2x để có chất lượng tốt
    constraint = { type: "SCALE" as const, value: 2 };
  }

  const bytes = await node.exportAsync({
    format: "PNG",
    constraint: constraint,
  });
  const base64 = figma.base64Encode(bytes);
  return `data:image/png;base64,${base64}`;
}

// Tạo meta-prompt (đa đích ngôn ngữ/stack theo đề xuất UI_SPEC + RENDER_TARGETS)
function createMetaPrompt(
  frameData: FrameData,
  includeResponsive: boolean,
  baseWidth?: string,
  options?: {
    targets?: string[];
    breakpoints?: number[];
    outputLanguage?: string;
    unitSystem?: string;
    namingConvention?: string;
    accessibilityLevel?: string;
    rtlSupport?: boolean;
    density?: string;
    theming?: string;
  }
): string {
  const outputLanguage = options?.outputLanguage || "English";
  const targets =
    options?.targets && options.targets.length > 0
      ? options.targets
      : ["html-css"];
  const unitSystem = options?.unitSystem || "px";
  const namingConvention = options?.namingConvention || "kebab-case";
  const accessibilityLevel = options?.accessibilityLevel || "WCAG 2.1 AA";
  const rtlSupport = options?.rtlSupport ?? false;
  const density = options?.density || "1x, 2x assets";
  const theming = options?.theming || "light only";
  let responsiveBreakpoints = "none";
  if (includeResponsive) {
    if (options?.breakpoints && options.breakpoints.length > 0) {
      const list = options.breakpoints.map((n) => `${n}px`).join(", ");
      responsiveBreakpoints = `breakpoints: ${list}`;
    } else if (baseWidth) {
      const bw = `${String(baseWidth).replace(/[^0-9]/g, "")}px`;
      responsiveBreakpoints = `breakpoints: ${bw}, 1024px, 768px`;
    } else {
      responsiveBreakpoints = `breakpoints: ${frameData.width}px, 1024px, 768px`;
    }
  }
  const responsiveness = includeResponsive ? "true" : "false";

  // --- Bắt đầu phần Prompt được cập nhật ---
  const prompt = `You are a senior UI systems engineer. Convert the provided Figma frame (image + extracted JSON tree) into:\n\n1) A CANONICAL, FRAMEWORK-AGNOSTIC UI SPEC (JSON)\n2) One or more TARGET RENDERINGS (code) according to requested targets.\n\nGLOBAL REQUIREMENTS:\n- Output language: ${outputLanguage}\n- Follow the Output Contract exactly. Do not include extra commentary outside sections.\n- Use deterministic units and values (px for absolute sizes unless ${unitSystem} says otherwise).\n- No hallucinated assets. Only use assets inferred from the frame or explicitly listed.\n- Be consistent in naming: ${namingConvention}.\n- Accessibility: ${accessibilityLevel}. Provide labels/roles and keyboard focus order.\n- Internationalization: support line breaks and language-specific typography; avoid hardcoded copy in code unless required.\n- RTL support: ${rtlSupport}. If true, note mirroring rules.\n- Responsiveness: ${responsiveness} (${responsiveBreakpoints}). If true, provide rules in UI_SPEC and reflect in target code when applicable.\n- Density/Scaling: ${density}.\n- Theming: ${theming}.\n
        STYLE EMISSION POLICY (STRICT)\n
        - In all RENDER targets, DO NOT declare CSS custom properties/variables and DO NOT emit token variables.\n
        - Use literal values directly (px for sizes, rgba(...) for colors, gradient(...) for gradients).\n
        - Derive numeric values from the frame JSON; prefer deterministic px over relative units.\n
        
        CRITICAL: ASSETS AND SVG HANDLING (STRICT)\n
        - The frame image is for visual reference ONLY. DO NOT include base64-encoded images or inline SVG code in the output.\n
        - **Rule for UI_SPEC**: In the 'assets' array within the UI_SPEC JSON, the 'src' property MUST be a local file path placeholder (e.g., "./assets/logo.svg"). This represents the intended final filename.\n
        - **Rule for RENDER_TARGETS**: In the generated code (e.g., HTML), ALL image and icon elements (<img>, etc.) MUST use an external placeholder URL. DO NOT use local paths in the generated code's 'src' attribute.\n

        STRICT MODELING RULES:\n
        - Token references MUST use reference objects, not inline token strings.\n
        - Typography: "text.styleRef" MUST remain a string key. Use "text.overrides" for breakpoint-specific changes.\n
        - Constraints & responsive rules: Only change leaf values using property paths.\n

        SUPERIOR LAYOUT MODELING (CRITICAL):\n
        - THINK LIKE A DEVELOPER. Your goal is to create robust, flexible, and maintainable layouts.\n
        - PRIORITIZE FLEXBOX AND GRID: Instead of absolute positioning for main layout, infer relationships and use 'display: flex' or 'display: grid'.\n
        - USE GRID FOR 2D LAYOUTS: For form layouts, STRONGLY prefer CSS Grid (e.g., 'grid-template-columns: auto 1fr;') over complex 'margin' or 'calc()' calculations.\n
        - AVOID ABSOLUTE POSITIONING: Only use 'position: absolute' for intentionally overlapping elements.\n

INPUTS:\n
- Frame Info: name=${frameData.name}, dimensions=${frameData.width}x${
    frameData.height
  }px\n
- Frame Structure (JSON) will be provided below\n
- Frame Image (PNG base64) is provided as visual reference ONLY.\n

OUTPUT CONTRACT (strict):\n\n
SECTION A: UI_SPEC (JSON fenced)\n
- Provide one JSON block with the specified keys (meta, tokens, components, etc.).\n
- IMPORTANT: In the "assets" array, the 'src' MUST be a local placeholder file path (e.g., "./assets/hero-image.png").\n
\n
SECTION B: RENDER_TARGETS\n
- For each requested target in ${JSON.stringify(
    targets
  )}, provide a separate fenced code block titled exactly: "RENDER: {target_name}"\n
- For ALL images and icons, the 'src' attribute of the rendered element (e.g., <img> tag) MUST be an external placeholder URL. The format is ABSOLUTE:\n
  "https://placeholder.vn/placeholder/{width}x{height}?bg=cccccc&color=666666&text={Label}"\n
  - Replace {width} and {height} with the exact dimensions from the frame element.\n
  - Replace {Label} with a short, URL-encoded description (e.g., "Logo", "User+Avatar").\n
- This rule is absolute. Even if the input JSON contains raw SVG path data for an icon (like scrollbar arrows), you **DO NOT RENDER** it as inline \`<svg>\`. Instead, you **MUST** represent it with an \`<img>\` tag using the specified placeholder URL.\n
- Apply all necessary CSS (width, height, object-fit, etc.) to the placeholder element.\n
- DO NOT emit CSS custom properties/variables; use literal px/rgba values.\n
\n
SECTION C: NOTES\n
- (Optional) List any ambiguities or assumptions made.\n
- (Required) Provide a clear, structured list of all assets that need to be exported from Figma under a heading 'Assets to be Exported'.\n
- For each asset, you MUST specify: file, size, and usedIn.\n
`;

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
  const base64Data = imageBase64.includes(",")
    ? imageBase64.split(",")[1]
    : imageBase64;

  // Gộp text prompt với frame structure
  const fullPrompt = `${metaPrompt}\n\nFrame Structure (JSON):\n${JSON.stringify(
    frameStructure,
    null,
    2
  )}`;

  const payload = {
    contents: [
      {
        parts: [
          {
            text: fullPrompt,
          },
          {
            inline_data: {
              mime_type: "image/png",
              data: base64Data,
            },
          },
        ],
      },
    ],
  };

  const response = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    const error = await response
      .json()
      .catch(() => ({ error: { message: "Unknown error" } }));
    const errorMessage =
      error && error.error && error.error.message
        ? error.error.message
        : `HTTP ${response.status}`;
    throw new Error(errorMessage);
  }

  const data = await response.json();
  const text =
    data &&
    data.candidates &&
    data.candidates[0] &&
    data.candidates[0].content &&
    data.candidates[0].content.parts &&
    data.candidates[0].content.parts[0]
      ? data.candidates[0].content.parts[0].text
      : null;

  if (!text) {
    throw new Error("No response from Gemini API");
  }

  return text;
}

// Xử lý message từ UI
figma.ui.onmessage = async (msg) => {
  try {
    if (msg.type === "get-selection") {
      const selection = figma.currentPage.selection;
      if (selection.length === 0 || selection[0].type !== "FRAME") {
        figma.ui.postMessage({
          type: "selection-updated",
          frameName: null,
          isValid: false,
        });
        return;
      }

      const frame = selection[0] as FrameNode;
      figma.ui.postMessage({
        type: "selection-updated",
        frameName: frame.name,
        isValid: true,
        width: frame.width,
        height: frame.height,
      });
    }

    if (msg.type === "get-config") {
      const config = await loadConfig();
      figma.ui.postMessage({
        type: "config-loaded",
        config: config,
        models: MODELS,
      });
    }

    if (msg.type === "save-config") {
      await saveConfig(msg.config);
      figma.ui.postMessage({
        type: "config-saved",
      });
    }

    if (msg.type === "generate-prompt") {
      const selection = figma.currentPage.selection;
      if (selection.length === 0 || selection[0].type !== "FRAME") {
        figma.ui.postMessage({
          type: "error",
          message: "Vui lòng chọn một Frame trước khi tạo prompt.",
        });
        return;
      }

      const frame = selection[0] as FrameNode;
      const config = await loadConfig();

      if (!config.apiKey) {
        figma.ui.postMessage({
          type: "error",
          message: "Vui lòng cấu hình API Key trong Settings.",
        });
        return;
      }

      // Gửi trạng thái đang xử lý
      figma.ui.postMessage({
        type: "generating",
        message: "Đang trích xuất dữ liệu Frame...",
      });

      // Trích xuất dữ liệu
      const imageBase64 = await exportFrameToBase64(frame);
      const frameStructure = extractFrameStructure(frame);

      figma.ui.postMessage({
        type: "generating",
        message: "Đang gửi yêu cầu đến Gemini AI...",
      });

      // Tạo meta-prompt
      const frameData: FrameData = {
        name: frame.name,
        width: frame.width,
        height: frame.height,
        children: frameStructure.children || [],
      };

      const metaPrompt = createMetaPrompt(
        frameData,
        msg.includeResponsive || false,
        msg.baseWidth,
        {
          targets:
            Array.isArray(msg.targets) && msg.targets.length > 0
              ? msg.targets
              : msg.target
              ? [msg.target]
              : undefined,
          breakpoints: Array.isArray(msg.breakpoints)
            ? msg.breakpoints
            : undefined,
        }
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
        type: "prompt-generated",
        prompt: promptResult,
      });
    }
  } catch (error) {
    figma.ui.postMessage({
      type: "error",
      message:
        error instanceof Error
          ? error.message
          : "Đã xảy ra lỗi không xác định.",
    });
  }
};

// Khởi tạo UI
figma.showUI(__html__, { width: 480, height: 640 });

// Gửi thông tin selection ban đầu
const selection = figma.currentPage.selection;
if (selection.length > 0 && selection[0].type === "FRAME") {
  const frame = selection[0] as FrameNode;
  figma.ui.postMessage({
    type: "selection-updated",
    frameName: frame.name,
    isValid: true,
    width: frame.width,
    height: frame.height,
  });
} else {
  figma.ui.postMessage({
    type: "selection-updated",
    frameName: null,
    isValid: false,
  });
}

// Lắng nghe thay đổi selection
figma.on("selectionchange", () => {
  const selection = figma.currentPage.selection;
  if (selection.length > 0 && selection[0].type === "FRAME") {
    const frame = selection[0] as FrameNode;
    figma.ui.postMessage({
      type: "selection-updated",
      frameName: frame.name,
      isValid: true,
      width: frame.width,
      height: frame.height,
    });
  } else {
    figma.ui.postMessage({
      type: "selection-updated",
      frameName: null,
      isValid: false,
    });
  }
});
