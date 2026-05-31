import { AstrologicalData } from "../lib/bazi";

export type AITextChunk = {
  text: string;
};

export async function* generateAIStream(
  prompt: string,
  sysInstruction?: string,
): AsyncGenerator<AITextChunk> {
  const response = await fetch("/api/gemini", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt,
      systemInstruction: sysInstruction,
    }),
  });

  if (!response.ok) {
    let message = "AI 服务暂时不可用，请稍后再试。";
    try {
      const data = await response.json();
      if (typeof data?.error === "string") {
        message = data.error;
      }
    } catch {
      const text = await response.text();
      if (text) {
        message = text;
      }
    }
    throw new Error(message);
  }

  if (!response.body) {
    const text = await response.text();
    if (text) {
      yield { text };
    }
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();

  while (true) {
    const { value, done } = await reader.read();
    if (done) {
      break;
    }

    const text = decoder.decode(value, { stream: true });
    if (text) {
      yield { text };
    }
  }

  const tail = decoder.decode();
  if (tail) {
    yield { text: tail };
  }
}

export async function generateInterpretation(data: AstrologicalData, gender: "坤造" | "乾造", name?: string) {
  const prompt = `
你是一位精通中国传统命理的大师，深谙子平八字、紫微斗数与《袁天罡称骨歌》。
请根据以下命主的生辰排盘数据，用**半文半白**、结构严谨的传统命理典籍排版风格（带白话释义），为其输出一份全方位的一站式推演报告。

## 命主基础信息
${name ? `- **姓名**：${name}` : ""}
- **性别**：${gender}
- **公历出生**：${data.solarDate}
- **农历出生**：${data.lunarDate}
- **生辰八字（四柱）**：
  - 年柱：${data.bazi.year} (${data.baziWuXing.year}) - 十神：${data.baziShiShen.year}
  - 月柱：${data.bazi.month} (${data.baziWuXing.month}) - 十神：${data.baziShiShen.month}
  - 日柱：${data.bazi.day} (${data.baziWuXing.day}) - 日主
  - 时柱：${data.bazi.hour} (${data.baziWuXing.hour}) - 十神：${data.baziShiShen.hour}
- **袁天罡称骨**：${data.boneWeight.weightStr} (歌诀：${data.boneWeight.poem})

## 你的推演输出要求
请严格分为以下几个模块，禁止含糊其辞，必须基于以上数据给出【定性结论】：

### 一、 八字命局剖析
说明日主五行旺衰、命局用神喜忌、格局定性。阐述身强还是身弱，五行缺什么，什么五行能为用神。

### 二、 紫微命盘推演（星曜核心十二宫模拟）
简述基于生辰（月份与时辰匹配）形成的紫微斗数命宫、身宫主星布局与格局气象（由于未提供完整星曜表，请你根据生辰八字和斗数排盘原理模拟出最核心的主星定位并解盘）。

### 三、 称骨断语发微
逐句解读称骨歌诀：
"${data.boneWeight.poem}"
给出这几句断语对应的现代白话具体运势定性结论。

### 四、 专项预测定性
1. **财运事业**：适合从事的行业方向、是否有从商之命或食俸禄之命。
2. **六亲姻缘**：正缘出现晚早、夫妻宫吉凶、子息多寡缘分。
3. **健康寿元**：容易犯疾的身体部位（根据五行缺失刑冲）。
4. **大运流年概览**：近期或一生大运起伏的关键节点。

注意排版要极为考究，使用Markdown。以类似批八字命理典籍的排版方式输出内容。
  `;

  return generateAIStream(
    prompt,
    "你是一个严肃、权威、渊博的中国传统命理宗师，语言不卑不亢，用古辞辅以白话，不说车轱辘话，切中肯綮。",
  );
}
