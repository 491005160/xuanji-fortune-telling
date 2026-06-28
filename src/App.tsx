import React, { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "motion/react";
import { Compass, BookOpen, Info, Play, Loader2, Home, SunMoon, Layers, Download } from "lucide-react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { AstrologicalData, calculateAstrology } from "./lib/bazi";
import { generateInterpretation, generateAIStream } from "./services/gemini";
import { cn } from "./lib/utils";
import { Starfield } from "./components/Starfield";
import { toPng } from "html-to-image";

type Page = "home" | "bazi" | "horoscope" | "tarot";

const getShanghaiDate = () =>
  new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Shanghai",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

const normalizeCachePart = (value: string) => value.trim().replace(/\s+/g, "");

const normalizeName = (value: string) => {
  const normalized = normalizeCachePart(value);
  return normalized || "anonymous";
};

const normalizeDateTimeLocal = (value: string) => {
  const normalized = value.trim();
  const match = normalized.match(/^(\d{4}-\d{2}-\d{2})[T\s](\d{2}):(\d{2})/);

  if (match) {
    return `${match[1]}T${match[2]}:${match[3]}`;
  }

  const parsed = new Date(normalized);
  if (!Number.isNaN(parsed.getTime())) {
    const year = parsed.getFullYear();
    const month = String(parsed.getMonth() + 1).padStart(2, "0");
    const day = String(parsed.getDate()).padStart(2, "0");
    const hours = String(parsed.getHours()).padStart(2, "0");
    const minutes = String(parsed.getMinutes()).padStart(2, "0");
    return `${year}-${month}-${day}T${hours}:${minutes}`;
  }

  return normalizeCachePart(normalized);
};

export default function App() {
  const [currentPage, setCurrentPage] = useState<Page>("home");

  const [name, setName] = useState<string>("");
  const [dateStr, setDateStr] = useState<string>("1990-01-01T12:00");
  const [gender, setGender] = useState<"乾造" | "坤造">("乾造");
  const [isCalculating, setIsCalculating] = useState(false);

  const [baziData, setBaziData] = useState<AstrologicalData | null>(null);
  const [reading, setReading] = useState<string>("");

  const [horoscopeSign, setHoroscopeSign] = useState<string>("白羊座");
  const [horoscopeType, setHoroscopeType] = useState<string>("今日运势");
  const [isHoroscopeCalculating, setIsHoroscopeCalculating] = useState(false);
  const [horoscopeReading, setHoroscopeReading] = useState<string>("");

  const [tarotQuestion, setTarotQuestion] = useState<string>("");
  const [tarotSpread, setTarotSpread] = useState<string>("单牌指引");
  const [isTarotCalculating, setIsTarotCalculating] = useState(false);
  const [tarotReading, setTarotReading] = useState<string>("");

  const endOfReadingRef = useRef<HTMLDivElement>(null);
  
  const baziExportRef = useRef<HTMLDivElement>(null);
  const horoscopeExportRef = useRef<HTMLDivElement>(null);
  const tarotExportRef = useRef<HTMLDivElement>(null);

  const [isExporting, setIsExporting] = useState(false);
  const [exportMessage, setExportMessage] = useState("");

  const [exportImage, setExportImage] = useState<string | null>(null);

  const disclaimerText =
    "本系统内容由 AI 结合传统文化文本生成，仅供娱乐与民俗文化体验，不构成现实决策、医疗、法律、投资或人生重大事项建议。";

  const returnToTop = () => {
    window.scrollTo({ top: 0, behavior: "auto" });
    window.requestAnimationFrame(() => {
      window.scrollTo({ top: 0, behavior: "auto" });
    });
  };

  const renderAIReport = (content: string) => (
    <div className="max-w-4xl mx-auto space-y-5 text-[15px] leading-8 tracking-wide text-slate-300">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node, ...props }) => (
            <h1
              className="text-xl md:text-2xl font-bold text-[#d4af37] border-b border-slate-800 pb-3 mb-6 mt-2 tracking-widest text-center"
              {...props}
            />
          ),
          h2: ({ node, ...props }) => (
            <h2
              className="text-base md:text-lg text-[#d4af37] font-semibold border-l-2 border-[#d4af37] pl-3 mt-8 mb-4 tracking-widest"
              {...props}
            />
          ),
          h3: ({ node, ...props }) => (
            <h3
              className="text-sm md:text-base font-bold text-slate-100 mt-6 mb-3 flex items-center gap-2"
              {...props}
            >
              <span className="w-1 h-1 bg-[#d4af37] inline-block rounded-full" />
              {props.children}
            </h3>
          ),
          p: ({ node, ...props }) => (
            <p
              className="text-slate-300/90 leading-8 mb-4 text-justify whitespace-pre-wrap"
              {...props}
            />
          ),
          strong: ({ node, ...props }) => (
            <strong className="text-slate-100 font-bold" {...props} />
          ),
          ul: ({ node, ...props }) => (
            <ul
              className="space-y-2 mb-5 text-slate-300/90 pl-4 border-l border-slate-800"
              {...props}
            />
          ),
          ol: ({ node, ...props }) => (
            <ol
              className="list-decimal space-y-2 mb-5 text-slate-300/90 pl-6"
              {...props}
            />
          ),
          li: ({ node, ...props }) => (
            <li className="pl-1 leading-8" {...props} />
          ),
          blockquote: ({ node, ...props }) => (
            <blockquote
              className="border-l-2 border-[#d4af37]/50 pl-4 py-2 my-6 bg-black/20 italic text-slate-300 text-sm"
              {...props}
            />
          ),
          hr: () => <hr className="my-6 border-slate-800" />,
        }}
      >
        {content}
      </ReactMarkdown>
      <div ref={endOfReadingRef} />
    </div>
  );

  const handleGenerateImage = async (ref: React.RefObject<HTMLDivElement>) => {
    if (!ref.current) return;
    setIsExporting(true);
    setExportMessage("正在渲染长图...");
    try {
      const dataUrl = await toPng(ref.current, {
        pixelRatio: 2,
        backgroundColor: "#141417",
        cacheBust: true,
      });
      setExportImage(dataUrl);
      setExportMessage("");
    } catch (error) {
      console.error("Export Image failed:", error);
      setExportMessage("生成失败，请稍后重试");
    } finally {
      setIsExporting(false);
      setTimeout(() => setExportMessage(""), 4000);
    }
  };

  // Time state for the header
  const [currentTime, setCurrentTime] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  const formatDateString = (date: Date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    
    const weekdays = ["星期日", "星期一", "星期二", "星期三", "星期四", "星期五", "星期六"];
    const weekday = weekdays[date.getDay()];

    const hours = String(date.getHours()).padStart(2, "0");
    const minutes = String(date.getMinutes()).padStart(2, "0");
    const seconds = String(date.getSeconds()).padStart(2, "0");

    return `${year}/${month}/${day} ${weekday} ${hours}:${minutes}:${seconds}`;
  };

  const handleCalculate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!dateStr) return;

    setIsCalculating(true);
    setReading("");
    returnToTop();

    try {
      // 1. Calculate traditional BaZi & Bone Weight
      const data = calculateAstrology(dateStr, gender);
      setBaziData(data);

      const normalizedBirthDateTime = normalizeDateTimeLocal(dateStr);
      const normalizedGender = normalizeCachePart(gender);
      const normalizedName = normalizeName(name);
      const cacheKey = `fortune:${normalizedBirthDateTime}:${normalizedGender}:${normalizedName}`;
      const cached = localStorage.getItem(cacheKey);

      if (cached) {
        console.log("命中传统算命缓存", cacheKey);
        setReading(cached);
        return;
      }

      // 2. Stream interpretation from Gemini
      const stream = await generateInterpretation(data, gender, name);
      let currentText = "";
      for await (const chunk of stream) {
        if (chunk.text) {
          currentText += chunk.text;
          setReading(currentText);
        }
      }

      if (currentText.trim()) {
        localStorage.setItem(cacheKey, currentText);
      }
    } catch (error) {
      console.error(error);
      setReading(
        (prev) =>
          prev + "\n\n**【系统提示】** 天机混沌，推演过程中断，请重试。",
      );
    } finally {
      setIsCalculating(false);
    }
  };

  const renderHome = () => (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {/* Cards Grid */}
      <div className="flex-1 flex items-center justify-center w-full">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-5xl mx-auto w-full px-4 group/list">
        
        {/* Card 1: 传统算命 */}
        <div className="bg-[#141417] border border-[#1a1a1e] rounded-sm p-8 flex flex-col items-center text-center transition-all duration-500 hover:border-[#d4af37]/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.05)] group/card hover:!opacity-100 hover:!grayscale-0 group-hover/list:opacity-50 group-hover/list:grayscale">
          <div className="w-32 h-32 rounded-full border border-[#d4af37]/20 mb-6 flex items-center justify-center relative overflow-hidden group-hover:border-[#d4af37]/50 transition-colors duration-500">
             <div className="absolute inset-0 border-[0.5px] border-dashed border-[#d4af37]/30 rounded-full m-2 animate-[spin_40s_linear_infinite]" />
             <div className="absolute inset-0 border-[0.5px] border-[#d4af37]/10 rounded-full m-4 animate-[spin_20s_linear_infinite_reverse]" />
             <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#d4af37]/80 relative z-10 transition-colors duration-500 group-hover:text-[#d4af37]">
               <circle cx="12" cy="12" r="11" strokeDasharray="3 3" opacity="0.6" />
               <circle cx="12" cy="12" r="9.5" opacity="0.6" strokeWidth="0.5" />
               <circle cx="12" cy="12" r="7" />
               <path d="M12 19a7 7 0 0 1-7-7 7 7 0 0 1 7-7 3.5 3.5 0 0 1 0 7 3.5 3.5 0 0 0 0 7z" fill="currentColor" />
               <circle cx="12" cy="8.5" r="1.2" fill="#141417" stroke="none" />
               <circle cx="12" cy="15.5" r="1.2" fill="currentColor" stroke="none" />
               <g strokeWidth="0.8">
                 <line x1="12" y1="1" x2="12" y2="2.5" />
                 <line x1="12" y1="21.5" x2="12" y2="23" />
                 <line x1="1" y1="12" x2="2.5" y2="12" />
                 <line x1="21.5" y1="12" x2="23" y2="12" />
                 <line x1="4.2" y1="4.2" x2="5.3" y2="5.3" />
                 <line x1="19.8" y1="19.8" x2="18.7" y2="18.7" />
                 <line x1="4.2" y1="19.8" x2="5.3" y2="18.7" />
                 <line x1="19.8" y1="4.2" x2="18.7" y2="5.3" />
               </g>
             </svg>
          </div>
          <h3 className="text-xl text-[#d4af37] font-medium tracking-widest mb-1">传统算命</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest italic mb-6">Traditional Fortune Telling</p>
          <p className="text-xs text-slate-400 mb-8 leading-relaxed px-2 md:px-4">
            基于生辰八字、五行生克、十神格局等传统命理体系，解析人生运势轨迹
          </p>
          <button 
            onClick={() => setCurrentPage("bazi")}
            className="w-full mt-auto py-3 bg-transparent border border-[#1a1a1e] text-[#d4af37]/80 hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-colors flex items-center justify-center gap-2 text-sm tracking-widest"
          >
            进入推演 <Play className="w-3 h-3 fill-current" />
          </button>
        </div>

        {/* Card 2: 星座运势 */}
        <div className="bg-[#141417] border border-[#1a1a1e] rounded-sm p-8 flex flex-col items-center text-center transition-all duration-500 hover:border-[#d4af37]/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.05)] group/card hover:!opacity-100 hover:!grayscale-0 group-hover/list:opacity-50 group-hover/list:grayscale">
          <div className="w-32 h-32 rounded-full border border-[#d4af37]/20 mb-6 flex items-center justify-center relative overflow-hidden group-hover:border-[#d4af37]/50 transition-colors duration-500">
             <div className="absolute inset-0 border-[0.5px] border-dashed border-[#d4af37]/30 rounded-full m-2 animate-[spin_40s_linear_infinite]" />
             <div className="absolute inset-0 border-[0.5px] border-[#d4af37]/10 rounded-full m-4 animate-[spin_20s_linear_infinite_reverse]" />
             <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-[#d4af37]/80 relative z-10 transition-colors duration-500 group-hover:text-[#d4af37]">
               <circle cx="12" cy="12" r="11.5" />
               <circle cx="12" cy="12" r="7.5" />
               <circle cx="12" cy="12" r="4" />
               <g strokeWidth="0.3" opacity="0.7">
                 <line x1="12" y1="0.5" x2="12" y2="7.5" /> <line x1="12" y1="16.5" x2="12" y2="23.5" />
                 <line x1="12" y1="0.5" x2="12" y2="7.5" transform="rotate(30 12 12)" /> <line x1="12" y1="16.5" x2="12" y2="23.5" transform="rotate(30 12 12)" />
                 <line x1="12" y1="0.5" x2="12" y2="7.5" transform="rotate(60 12 12)" /> <line x1="12" y1="16.5" x2="12" y2="23.5" transform="rotate(60 12 12)" />
                 <line x1="12" y1="0.5" x2="12" y2="7.5" transform="rotate(90 12 12)" /> <line x1="12" y1="16.5" x2="12" y2="23.5" transform="rotate(90 12 12)" />
                 <line x1="12" y1="0.5" x2="12" y2="7.5" transform="rotate(120 12 12)" /> <line x1="12" y1="16.5" x2="12" y2="23.5" transform="rotate(120 12 12)" />
                 <line x1="12" y1="0.5" x2="12" y2="7.5" transform="rotate(150 12 12)" /> <line x1="12" y1="16.5" x2="12" y2="23.5" transform="rotate(150 12 12)" />
               </g>
               <g strokeWidth="0.5">
                 <path d="M10.5 5.5 C11 4.5, 13 4.5, 13.5 5.5" /> <line x1="12" y1="5" x2="12" y2="6.5" />
                 <circle cx="18.5" cy="9.5" r="0.8" /> <path d="M17.5 8.5 A 1 1 0 0 1 19.5 8.5" />
                 <path d="M19 14.5 L17.5 14.5 L17.5 13.5" fill="none" />
                 <circle cx="12" cy="18.5" r="0.8" /> <line x1="11" y1="18.5" x2="13" y2="18.5" />
                 <path d="M6.5 14.5 C 5.5 14, 5.5 13, 6.5 12.5" /> <line x1="6" y1="13.5" x2="7" y2="13.5" />
                 <path d="M5.5 8.5 A 1 1 0 0 1 6.5 9.5 A 1 1 0 0 1 5.5 10.5" />
               </g>
               <g strokeWidth="0.4" fill="currentColor">
                 <circle cx="12" cy="2" r="0.4" /> <circle cx="13.5" cy="3" r="0.4" /> <circle cx="11" cy="4" r="0.4" /> <path d="M12 2 L13.5 3 L11 4" fill="none" />
                 <circle cx="18" cy="4" r="0.4" /> <circle cx="19" cy="5.5" r="0.4" /> <circle cx="17.5" cy="6.5" r="0.4" /> <path d="M18 4 L19 5.5 L17.5 6.5 L18 4" fill="none" />
                 <circle cx="21.7" cy="10" r="0.4" /> <circle cx="20.5" cy="12" r="0.4" /> <circle cx="21" cy="14" r="0.4" /> <path d="M21.7 10 L20.5 12 L21 14" fill="none" />
                 <circle cx="18" cy="19" r="0.4" /> <circle cx="16.5" cy="18" r="0.4" /> <circle cx="15.5" cy="20" r="0.4" /> <path d="M18 19 L16.5 18 L15.5 20 M16.5 18 L15.5 20" fill="none" />
                 <circle cx="12" cy="21.5" r="0.4" /> <circle cx="10" cy="20" r="0.4" /> <circle cx="13" cy="19.5" r="0.4" /> <path d="M12 21.5 L10 20 L13 19.5" fill="none" />
                 <circle cx="5.5" cy="19" r="0.4" /> <circle cx="4" cy="17" r="0.4" /> <circle cx="6" cy="16" r="0.4" /> <path d="M5.5 19 L4 17 L6 16" fill="none" />
                 <circle cx="2.3" cy="12" r="0.4" /> <circle cx="3.5" cy="10.5" r="0.4" /> <circle cx="3" cy="13.5" r="0.4" /> <path d="M2.3 12 L3.5 10.5 M2.3 12 L3 13.5" fill="none" />
                 <circle cx="4.5" cy="5" r="0.4" /> <circle cx="7" cy="4.5" r="0.4" /> <circle cx="6.5" cy="6.5" r="0.4" /> <path d="M4.5 5 L7 4.5 M4.5 5 L6.5 6.5" fill="none" />
               </g>
             </svg>
          </div>
          <h3 className="text-xl text-[#d4af37] font-medium tracking-widest mb-1">星座运势</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest italic mb-6">Horoscope</p>
          <p className="text-xs text-slate-400 mb-8 leading-relaxed px-2 md:px-4">
            结合西方占星学，分析每日、每周、每月星座运势，把握宇宙能量指引
          </p>
          <button 
            onClick={() => setCurrentPage("horoscope")}
            className="w-full mt-auto py-3 bg-transparent border border-[#1a1a1e] text-[#d4af37]/80 hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-colors flex items-center justify-center gap-2 text-sm tracking-widest"
          >
            进入推演 <Play className="w-3 h-3 fill-current" />
          </button>
        </div>

        {/* Card 3: 塔罗牌占卜 */}
        <div className="bg-[#141417] border border-[#1a1a1e] rounded-sm p-8 flex flex-col items-center text-center transition-all duration-500 hover:border-[#d4af37]/30 hover:shadow-[0_0_30px_rgba(212,175,55,0.05)] group/card hover:!opacity-100 hover:!grayscale-0 group-hover/list:opacity-50 group-hover/list:grayscale">
          <div className="w-32 h-32 rounded-full border border-[#d4af37]/20 mb-6 flex items-center justify-center relative overflow-hidden group-hover:border-[#d4af37]/50 transition-colors duration-500">
             <div className="absolute inset-0 border-[0.5px] border-dashed border-[#d4af37]/30 rounded-full m-2 animate-[spin_40s_linear_infinite]" />
             <div className="absolute inset-0 border-[0.5px] border-[#d4af37]/10 rounded-full m-4 animate-[spin_20s_linear_infinite_reverse]" />
             <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" className="text-[#d4af37]/80 relative z-10 transition-colors duration-500 group-hover:text-[#d4af37]">
               <rect x="3" y="6" width="10" height="14" rx="1" transform="rotate(-15 8 13)" />
               <rect x="11" y="6" width="10" height="14" rx="1" transform="rotate(15 16 13)" />
               <rect x="7" y="4" width="10" height="16" rx="1" fill="#141417" stroke="currentColor" />
               <circle cx="12" cy="12" r="2" />
               <path d="M12 9 L12 15" />
               <path d="M9 12 L15 12" />
             </svg>
          </div>
          <h3 className="text-xl text-[#d4af37] font-medium tracking-widest mb-1">塔罗牌占卜</h3>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest italic mb-6">Tarot Reading</p>
          <p className="text-xs text-slate-400 mb-8 leading-relaxed px-2 md:px-4">
            通过塔罗牌阵，探索内心潜意识，指引当下困惑，预见未来可能
          </p>
          <button 
            onClick={() => setCurrentPage("tarot")}
            className="w-full mt-auto py-3 bg-transparent border border-[#1a1a1e] text-[#d4af37]/80 hover:text-[#d4af37] hover:border-[#d4af37]/50 transition-colors flex items-center justify-center gap-2 text-sm tracking-widest"
          >
            进入推演 <Play className="w-3 h-3 fill-current" />
          </button>
        </div>

      </div>
      </div>
    </motion.div>
  );

  const handleHoroscopeSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsHoroscopeCalculating(true);
    setHoroscopeReading("");
    returnToTop();

    const date = getShanghaiDate();
    const normalizedSign = normalizeCachePart(horoscopeSign);
    const normalizedType = normalizeCachePart(horoscopeType);
    const cacheKey = `horoscope:${date}:${normalizedSign}:${normalizedType}`;
    const cached = localStorage.getItem(cacheKey);

    if (cached) {
      console.log("命中星座运势缓存", cacheKey);
      setHoroscopeReading(cached);
      setIsHoroscopeCalculating(false);
      return;
    }
    
    const prompt = `请以专业占星师身份，为「${horoscopeSign}」输出一份「${horoscopeType}」报告。

当前日期：${date}

请严格使用简体中文 Markdown，并按以下结构输出：

# ${horoscopeSign} ${horoscopeType}
## 总体概览
用 2-3 句话给出今日/本周期的总基调。
## 星象影响
用一段说明主要能量，不要堆砌术语。
## 爱情与人际
用 2-3 条要点说明。
## 事业与学业
用 2-3 条要点说明。
## 财富与决策
用 2-3 条要点说明。
## 健康与能量
用 2-3 条要点说明。
## 今日箴言
用引用块输出一句短句。

要求：段落清晰，避免大段连续文本；语气神秘但务实；仅供娱乐参考。`;
    
    try {
      const completion = await generateAIStream(prompt);
      
      let currentText = "";
      for await (const chunk of completion) {
        currentText += chunk.text;
        setHoroscopeReading(currentText);
      }

      if (currentText.trim()) {
        localStorage.setItem(cacheKey, currentText);
      }
    } catch (error) {
      console.error(error);
      setHoroscopeReading("解读服务发生异常，请稍后再试。");
    } finally {
      setIsHoroscopeCalculating(false);
    }
  };

  const handleTarotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!tarotQuestion.trim()) return;
    setIsTarotCalculating(true);
    setTarotReading("");
    returnToTop();
    
    const prompt = `请以专业塔罗解读师身份，为用户的问题进行「${tarotSpread}」解读。

用户问题：「${tarotQuestion}」

请严格使用简体中文 Markdown，并按以下结构输出：

# 塔罗牌阵解读
## 问题核心
简要复述问题背后的核心张力。
## 抽取牌面
按牌位列出牌名，并用一句话描述每张牌的象征。
## 牌面互动
说明牌与牌之间的关系。
## 当下建议
用 3 条要点给出可执行建议。
## 需要留意
指出一个风险或盲点。
## 灵性箴言
用引用块输出一句短句。

要求：段落清晰，避免大段连续文本；语气神秘但落地；仅供娱乐参考。`;
    
    try {
      const completion = await generateAIStream(prompt);
      
      let currentText = "";
      for await (const chunk of completion) {
        currentText += chunk.text;
        setTarotReading(currentText);
      }
    } catch (error) {
      console.error(error);
      setTarotReading("灵性连接发生异常，请稍后再试。");
    } finally {
      setIsTarotCalculating(false);
    }
  };

  const renderSecondaryNav = () => (
    <div className="flex flex-col sm:flex-row sm:items-center gap-4 text-sm mb-6 uppercase tracking-widest font-bold border-b border-slate-800 pb-4">
      <div className="flex items-center gap-3">
        <button 
          onClick={() => setCurrentPage("home")}
          className="text-[#d4af37] hover:text-[#f3cd58] flex items-center gap-2 transition-colors"
        >
          <Home className="w-4 h-4 cursor-pointer" /> <span>首页</span>
        </button>
        <span className="text-slate-600 font-normal">/</span>
      </div>
      <div className="flex items-center gap-6 overflow-x-auto whitespace-nowrap">
        <button 
          onClick={() => setCurrentPage("bazi")}
          className={`transition-colors py-1 ${currentPage === "bazi" ? "text-slate-200 border-b border-[#d4af37]" : "text-slate-500 hover:text-slate-300"}`}
        >
          传统算命
        </button>
        <button 
          onClick={() => setCurrentPage("horoscope")}
          className={`transition-colors py-1 ${currentPage === "horoscope" ? "text-slate-200 border-b border-[#d4af37]" : "text-slate-500 hover:text-slate-300"}`}
        >
          星座运势
        </button>
        <button 
          onClick={() => setCurrentPage("tarot")}
          className={`transition-colors py-1 ${currentPage === "tarot" ? "text-slate-200 border-b border-[#d4af37]" : "text-slate-500 hover:text-slate-300"}`}
        >
          塔罗占卜
        </button>
      </div>
    </div>
  );

  const renderBazi = () => (
    <main className="flex-1 flex flex-col">
      {renderSecondaryNav()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Input Section */}
        <motion.div
          initial={{ opacity: 0, x: -20 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.8, delay: 0.2 }}
          className="lg:col-span-4 space-y-6"
        >
        <div className="bg-[#141417] border border-slate-800 p-6 rounded-sm shadow-xl relative overflow-hidden group">
          <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />

          <h2 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest flex items-center gap-2">
            命造录入参数
          </h2>

          <form onSubmit={handleCalculate} className="space-y-5">
            {/* Name Input */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                姓名 <span className="text-slate-600 text-xs">(选填)</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="请输入命主姓名"
                className="w-full bg-transparent border border-slate-800 text-slate-300 p-3 rounded-sm focus:outline-none focus:border-[#d4af37]/50 transition-colors text-sm"
              />
            </div>

            {/* Gender Select */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                性别命属
              </label>
              <div className="flex gap-4">
                <label
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 border cursor-pointer transition-all duration-300 text-sm",
                    gender === "乾造"
                      ? "border-[#d4af37] text-[#d4af37] bg-[#d4af37]/10"
                      : "border-slate-800 text-slate-500 hover:border-slate-600",
                  )}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={gender === "乾造"}
                    onChange={() => setGender("乾造")}
                  />
                  乾造 (男)
                </label>
                <label
                  className={cn(
                    "flex-1 flex items-center justify-center py-2 border cursor-pointer transition-all duration-300 text-sm",
                    gender === "坤造"
                      ? "border-[#d4af37] text-[#d4af37] bg-[#d4af37]/10"
                      : "border-slate-800 text-slate-500 hover:border-slate-600",
                  )}
                >
                  <input
                    type="radio"
                    className="hidden"
                    checked={gender === "坤造"}
                    onChange={() => setGender("坤造")}
                  />
                  坤造 (女)
                </label>
              </div>
            </div>

            {/* Date & Time Select */}
            <div>
              <label className="block text-gray-400 text-sm mb-2">
                真太阳时 (公历)
              </label>
              <input
                type="datetime-local"
                value={dateStr}
                onChange={(e) => setDateStr(e.target.value)}
                className="w-full bg-[#0c0c0e] border border-slate-800 text-slate-300 px-4 py-2 focus:outline-none focus:border-[#d4af37]/50 transition-colors"
                required
              />
              <p className="text-xs text-gray-600 mt-2 flex items-start gap-1">
                <Info className="w-3 h-3 mt-0.5 shrink-0" />
                请尽可能输入出生地的精确时辰，系统将自动换算干支历法。
              </p>
            </div>

            <button
              type="submit"
              disabled={isCalculating}
              className="w-full bg-[#1c1c21] hover:bg-[#1a1a1e] text-[#d4af37] py-3 mt-6 border border-slate-800 hover:border-[#d4af37]/50 shadow-lg shadow-black/20 transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
            >
              {isCalculating ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" /> 推演中...
                </>
              ) : (
                <>
                  启盘卜算{" "}
                  <Play className="w-4 h-4 fill-current opacity-70 group-hover:opacity-100 transition-opacity ml-1" />
                </>
              )}
            </button>
          </form>
        </div>
      </motion.div>

      {/* Result Section */}
      <div className="lg:col-span-8 flex flex-col gap-6 relative">
        {(reading || isCalculating) && (
             <div className="absolute -top-3 right-0 z-20 flex items-center gap-2">
               {exportMessage && <span className="text-xs text-[#d4af37] animate-pulse">{exportMessage}</span>}
               <button 
                 onClick={() => handleGenerateImage(baziExportRef)}
                 disabled={isExporting}
                 className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#d4af37]/70 hover:text-[#d4af37] transition-colors bg-[#0c0c0e]/80 px-3 py-1.5 rounded-sm border border-[#d4af37]/20 backdrop-blur-sm hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isExporting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                 生成长图
               </button>
             </div>
        )}
        <div ref={baziExportRef} className="flex flex-col gap-6 flex-1 w-full relative">
        <AnimatePresence mode="wait">
          {!baziData && !isCalculating && !reading && (
            <motion.div
              key="empty-state"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="hidden lg:flex flex-col items-center justify-center h-full min-h-[500px] border border-slate-800/50 bg-[#141417] rounded-sm relative overflow-hidden"
            >
              <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                <div className="absolute w-[400px] h-[400px] border border-[#d4af37]/30 rounded-full animate-[spin_60s_linear_infinite]" />
                <div className="absolute w-[300px] h-[300px] border-x border-[#d4af37]/40 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
                <div className="absolute w-[200px] h-[200px] border border-dashed border-[#d4af37]/50 rounded-full animate-[spin_20s_linear_infinite]" />
              </div>
              <div className="z-10 flex flex-col items-center opacity-60">
                <Compass className="w-12 h-12 text-slate-500 mb-6" />
                <h3 className="text-xs tracking-[0.3em] text-slate-400 mb-2 uppercase">运筹帷幄 · 待时而动</h3>
                <p className="text-[10px] text-slate-500 tracking-wider">右侧留白，请于左侧面板录入命主干支信息</p>
              </div>
            </motion.div>
          )}

          {baziData && (
            <motion.div
              key="bazi-board"
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              className="bg-[#141417] border border-slate-800 p-6 rounded-sm relative"
            >
              <div className="absolute top-2 right-2 flex gap-1 opacity-20">
                <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
                <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
              </div>

              <h3 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest flex items-center justify-between">
                <span>生辰八字 · 四柱排盘 {name && <span className="text-[#d4af37]/70 ml-2">命主：{name}</span>}</span>
              </h3>

              <div className="grid grid-cols-4 gap-2 md:gap-4 h-full pb-6 border-b border-slate-800/50">
                <div className="flex flex-col items-center justify-center border-r border-slate-800/50">
                  <span className="text-[10px] text-slate-600 mb-2">
                    年柱
                  </span>
                  <span className="text-2xl md:text-4xl text-[#d4af37] font-bold">
                    {baziData.bazi.year}
                  </span>
                  <span className="text-2xl md:text-3xl text-slate-300 font-bold mt-1">
                    {baziData.baziWuXing.year}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-3">
                    {baziData.baziShiShen.year}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center border-r border-slate-800/50">
                  <span className="text-[10px] text-slate-600 mb-2">
                    月柱
                  </span>
                  <span className="text-2xl md:text-4xl text-[#d4af37] font-bold">
                    {baziData.bazi.month}
                  </span>
                  <span className="text-2xl md:text-3xl text-slate-300 font-bold mt-1">
                    {baziData.baziWuXing.month}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-3">
                    {baziData.baziShiShen.month}
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center border-r border-slate-800/50">
                  <span className="text-[10px] text-slate-600 mb-2">
                    日柱
                  </span>
                  <span className="text-2xl md:text-4xl text-[#d4af37] font-bold">
                    {baziData.bazi.day}
                  </span>
                  <span className="text-2xl md:text-3xl text-slate-300 font-bold mt-1">
                    {baziData.baziWuXing.day}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-3">
                    日主
                  </span>
                </div>

                <div className="flex flex-col items-center justify-center">
                  <span className="text-[10px] text-slate-600 mb-2">
                    时柱
                  </span>
                  <span className="text-2xl md:text-4xl text-[#d4af37] font-bold">
                    {baziData.bazi.hour}
                  </span>
                  <span className="text-2xl md:text-3xl text-slate-300 font-bold mt-1">
                    {baziData.baziWuXing.hour}
                  </span>
                  <span className="text-[10px] text-slate-500 mt-3">
                    {baziData.baziShiShen.hour}
                  </span>
                </div>
              </div>

              <div className="mt-6 flex flex-col md:flex-row justify-between text-[11px] text-slate-500 uppercase tracking-widest gap-4">
                <div>
                  <span className="mr-2">农历</span> {baziData.lunarDate}
                </div>
                <div>
                  <span className="mr-2">袁天罡称骨</span>
                  <span className="text-[#d4af37]">
                    {baziData.boneWeight.weightStr}
                  </span>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        <AnimatePresence>
          {(reading || isCalculating) && (
            <motion.div
              key="reading-board"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              className="bg-[#1c1c21] border border-slate-800 p-6 md:p-8 min-h-[400px] leading-10 text-slate-300 relative rounded-sm shadow-xl"
            >
              <div className="absolute top-0 right-0 p-2 text-[8px] text-slate-600 tracking-tighter">
                MYSTIC PIVOT NUMEROLOGY
              </div>

              {!reading && isCalculating && (
                <div className="flex flex-col items-center justify-center h-full opacity-50 py-20">
                  <Compass className="w-12 h-12 animate-spin-slow mb-4 text-[#d4af37]" />
                  <p className="text-xs uppercase tracking-widest text-[#d4af37]">
                    紫微星盘推演中...
                  </p>
                </div>
              )}

              {reading && (
                <div className="markdown-body space-y-6 text-sm leading-relaxed tracking-wide">
                  <ReactMarkdown
                    remarkPlugins={[remarkGfm]}
                    components={{
                      h1: ({ node, ...props }) => (
                        <h1
                          className="text-xl md:text-2xl font-bold text-[#d4af37] border-b border-slate-800 pb-3 mb-6 mt-10 tracking-widest text-center"
                          {...props}
                        />
                      ),
                      h2: ({ node, ...props }) => (
                        <h2
                          className="text-xs text-slate-500 mb-4 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest mt-8"
                          {...props}
                        />
                      ),
                      h3: ({ node, ...props }) => (
                        <h3
                          className="text-sm font-bold text-slate-200 mt-6 mb-3 flex items-center gap-2"
                          {...props}
                        >
                          <span className="w-1 h-1 bg-[#d4af37] inline-block rounded-full"></span>
                          {props.children}
                        </h3>
                      ),
                      p: ({ node, ...props }) => (
                        <p
                          className="leading-relaxed mb-4 text-slate-400 text-justify"
                          {...props}
                        />
                      ),
                      strong: ({ node, ...props }) => (
                        <strong
                          className="text-slate-200 font-bold"
                          {...props}
                        />
                      ),
                      ul: ({ node, ...props }) => (
                        <ul
                          className="list-none space-y-2 mb-4 text-slate-400 pl-4 border-l border-slate-800"
                          {...props}
                        />
                      ),
                      li: ({ node, ...props }) => (
                        <li
                          className="relative pl-4 before:content-[''] before:absolute before:left-0 before:top-2 before:w-1 before:h-1 before:bg-slate-700 before:rounded-full"
                          {...props}
                        />
                      ),
                      blockquote: ({ node, ...props }) => (
                        <blockquote
                          className="border-l-2 border-red-900 pl-4 py-2 my-6 bg-black/20 italic text-slate-400 text-xs"
                          {...props}
                        />
                      ),
                    }}
                  >
                    {reading}
                  </ReactMarkdown>
                  <div ref={endOfReadingRef} />
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
        </div>
      </div>
      </div>
    </main>
  );

  const renderHoroscope = () => (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {renderSecondaryNav()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Input Section */}
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.8, delay: 0.2 }}
           className="lg:col-span-4 space-y-6"
        >
          <div className="bg-[#141417] border border-slate-800 p-6 rounded-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />

            <h2 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest flex items-center gap-2">
              星象参数录入
            </h2>

            <form onSubmit={handleHoroscopeSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  本命星座
                </label>
                <select
                  value={horoscopeSign}
                  onChange={(e) => setHoroscopeSign(e.target.value)}
                  className="w-full bg-[#0c0c0e] border border-slate-800 text-slate-300 p-3 flex rounded-sm focus:outline-none focus:border-[#d4af37]/50 transition-colors text-sm appearance-none"
                >
                  {["白羊座", "金牛座", "双子座", "巨蟹座", "狮子座", "处女座", "天秤座", "天蝎座", "射手座", "摩羯座", "水瓶座", "双鱼座"].map(sign => (
                    <option key={sign} value={sign}>{sign}</option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  预测时限
                </label>
                <div className="flex gap-2">
                  {["今日运势", "本周运势", "本月运势"].map((type) => (
                    <label
                      key={type}
                      className={cn(
                        "flex-1 flex items-center justify-center py-2 border cursor-pointer transition-all duration-300 text-xs",
                        horoscopeType === type
                          ? "border-[#d4af37] text-[#d4af37] bg-[#d4af37]/10"
                          : "border-slate-800 text-slate-500 hover:border-slate-600",
                      )}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        checked={horoscopeType === type}
                        onChange={() => setHoroscopeType(type)}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isHoroscopeCalculating}
                className="w-full bg-[#1c1c21] hover:bg-[#1a1a1e] text-[#d4af37] py-3 mt-6 border border-slate-800 hover:border-[#d4af37]/50 shadow-lg shadow-black/20 transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
              >
                {isHoroscopeCalculating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> 解析中...
                  </>
                ) : (
                  <>
                    洞悉星象 <Play className="w-4 h-4 fill-current opacity-70 group-hover:opacity-100 transition-opacity ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Result Section */}
        <div className="lg:col-span-8 flex flex-col gap-6 relative">
          {(horoscopeReading || isHoroscopeCalculating) && (
             <div className="absolute -top-3 right-0 z-20 flex items-center gap-2">
               {exportMessage && <span className="text-xs text-[#d4af37] animate-pulse">{exportMessage}</span>}
               <button 
                 onClick={() => handleGenerateImage(horoscopeExportRef)}
                 disabled={isExporting}
                 className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#d4af37]/70 hover:text-[#d4af37] transition-colors bg-[#0c0c0e]/80 px-3 py-1.5 rounded-sm border border-[#d4af37]/20 backdrop-blur-sm hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isExporting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                 生成长图
               </button>
             </div>
          )}
          <div ref={horoscopeExportRef} className="flex flex-col gap-6 flex-1 w-full relative">
          <AnimatePresence mode="wait">
            {!horoscopeReading && !isHoroscopeCalculating && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden lg:flex flex-col items-center justify-center h-full min-h-[500px] border border-slate-800/50 bg-[#141417] rounded-sm relative overflow-hidden"
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                  <div className="absolute w-[400px] h-[400px] border border-[#d4af37]/30 rounded-full animate-[spin_60s_linear_infinite]" />
                  <div className="absolute w-[300px] h-[300px] border-x border-[#d4af37]/40 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
                </div>
                <div className="z-10 flex flex-col items-center opacity-60">
                   <SunMoon className="w-12 h-12 text-slate-500 mb-6" />
                   <h3 className="text-xs tracking-[0.3em] text-slate-400 mb-2 uppercase">星象运转 · 洞察天机</h3>
                   <p className="text-[10px] text-slate-500 tracking-wider">请于左侧面板选择本命星座及预测时限</p>
                </div>
              </motion.div>
            )}

            {(isHoroscopeCalculating || horoscopeReading) && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#141417] border border-slate-800 p-6 rounded-sm relative flex-1"
              >
                 <div className="absolute top-2 right-2 flex gap-1 opacity-20">
                   <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
                   <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
                 </div>
                 
                 <h3 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest">
                   运势解析大纲
                 </h3>

                 {isHoroscopeCalculating && !horoscopeReading ? (
                   <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                     <SunMoon className="w-8 h-8 animate-pulse mb-4 text-[#d4af37]/50" />
                     <p className="text-sm tracking-widest animate-pulse">正在连接星盘... 请稍候</p>
                   </div>
                 ) : (
                   renderAIReport(horoscopeReading)
                 )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.main>
  );

  const renderTarot = () => (
    <motion.main 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="flex-1 flex flex-col"
    >
      {renderSecondaryNav()}

      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 relative">
        {/* Input Section */}
        <motion.div
           initial={{ opacity: 0, x: -20 }}
           animate={{ opacity: 1, x: 0 }}
           transition={{ duration: 0.8, delay: 0.2 }}
           className="lg:col-span-4 space-y-6"
        >
          <div className="bg-[#141417] border border-slate-800 p-6 rounded-sm shadow-xl relative overflow-hidden group">
            <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-[#d4af37] to-transparent opacity-30 group-hover:opacity-100 transition-opacity" />

            <h2 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest flex items-center gap-2">
              灵境探索建立
            </h2>

            <form onSubmit={handleTarotSubmit} className="space-y-5">
              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  内心的疑惑 <span className="text-slate-600 text-xs">(必填)</span>
                </label>
                <textarea
                  value={tarotQuestion}
                  onChange={(e) => setTarotQuestion(e.target.value)}
                  placeholder="请输入您当下最想获得指引的问题..."
                  className="w-full bg-[#0c0c0e] border border-slate-800 text-slate-300 p-3 rounded-sm focus:outline-none focus:border-[#d4af37]/50 transition-colors text-sm min-h-[100px] resize-none"
                  required
                />
              </div>

              <div>
                <label className="block text-gray-400 text-sm mb-2">
                  指引牌阵
                </label>
                <div className="flex gap-2">
                  {["单牌指引", "三牌圣域", "十字牌阵"].map((type) => (
                    <label
                      key={type}
                      className={cn(
                        "flex-1 flex items-center justify-center py-2 border cursor-pointer transition-all duration-300 text-xs",
                        tarotSpread === type
                          ? "border-[#d4af37] text-[#d4af37] bg-[#d4af37]/10"
                          : "border-slate-800 text-slate-500 hover:border-slate-600",
                      )}
                    >
                      <input
                        type="radio"
                        className="hidden"
                        checked={tarotSpread === type}
                        onChange={() => setTarotSpread(type)}
                      />
                      {type}
                    </label>
                  ))}
                </div>
              </div>

              <button
                type="submit"
                disabled={isTarotCalculating || !tarotQuestion.trim()}
                className="w-full bg-[#1c1c21] hover:bg-[#1a1a1e] text-[#d4af37] py-3 mt-6 border border-slate-800 hover:border-[#d4af37]/50 shadow-lg shadow-black/20 transition-all duration-300 flex items-center justify-center gap-2 group disabled:opacity-50 disabled:cursor-not-allowed uppercase tracking-widest text-sm"
              >
                {isTarotCalculating ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin" /> 感应中...
                  </>
                ) : (
                  <>
                    祈请指引 <Play className="w-4 h-4 fill-current opacity-70 group-hover:opacity-100 transition-opacity ml-1" />
                  </>
                )}
              </button>
            </form>
          </div>
        </motion.div>

        {/* Result Section */}
        <div className="lg:col-span-8 flex flex-col gap-6 relative">
          {(tarotReading || isTarotCalculating) && (
             <div className="absolute -top-3 right-0 z-20 flex items-center gap-2">
               {exportMessage && <span className="text-xs text-[#d4af37] animate-pulse">{exportMessage}</span>}
               <button 
                 onClick={() => handleGenerateImage(tarotExportRef)}
                 disabled={isExporting}
                 className="flex items-center gap-2 text-[10px] uppercase tracking-widest text-[#d4af37]/70 hover:text-[#d4af37] transition-colors bg-[#0c0c0e]/80 px-3 py-1.5 rounded-sm border border-[#d4af37]/20 backdrop-blur-sm hover:bg-[#d4af37]/10 disabled:opacity-50 disabled:cursor-not-allowed"
               >
                 {isExporting ? <Loader2 className="w-3 h-3 animate-spin"/> : <Download className="w-3 h-3"/>}
                 生成长图
               </button>
             </div>
          )}
          <div ref={tarotExportRef} className="flex flex-col gap-6 flex-1 w-full relative">
          <AnimatePresence mode="wait">
            {!tarotReading && !isTarotCalculating && (
              <motion.div
                key="empty-state"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="hidden lg:flex flex-col items-center justify-center h-full min-h-[500px] border border-slate-800/50 bg-[#141417] rounded-sm relative overflow-hidden"
              >
                <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
                  <div className="absolute w-[400px] h-[400px] border border-[#d4af37]/30 rounded-full animate-[spin_60s_linear_infinite]" />
                  <div className="absolute w-[300px] h-[300px] border-x border-[#d4af37]/40 rounded-full animate-[spin_30s_linear_infinite_reverse]" />
                </div>
                <div className="z-10 flex flex-col items-center opacity-60">
                   <Layers className="w-12 h-12 text-slate-500 mb-6" />
                   <h3 className="text-xs tracking-[0.3em] text-slate-400 mb-2 uppercase">潜意识连结 · 灵魂低语</h3>
                   <p className="text-[10px] text-slate-500 tracking-wider">请于左侧面板写下您内心的疑惑并选择牌阵</p>
                </div>
              </motion.div>
            )}

            {(isTarotCalculating || tarotReading) && (
              <motion.div
                key="reading"
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="bg-[#141417] border border-slate-800 p-6 rounded-sm relative flex-1"
              >
                 <div className="absolute top-2 right-2 flex gap-1 opacity-20">
                   <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
                   <div className="w-2 h-2 rounded-full border border-[#d4af37]" />
                 </div>
                 
                 <h3 className="text-xs text-slate-500 mb-6 border-l-2 border-[#d4af37] pl-2 uppercase tracking-widest">
                   塔罗牌阵解析
                 </h3>

                 {isTarotCalculating && !tarotReading ? (
                   <div className="flex flex-col items-center justify-center py-20 text-slate-500">
                     <Layers className="w-8 h-8 animate-pulse mb-4 text-[#d4af37]/50" />
                     <p className="text-sm tracking-widest animate-pulse">正在连结阿卡西记录... 请稍候</p>
                   </div>
                 ) : (
                   renderAIReport(tarotReading)
                 )}
              </motion.div>
            )}
          </AnimatePresence>
          </div>
        </div>
      </div>
    </motion.main>
  );

  return (
    <div className="min-h-screen bg-[#0c0c0e] text-slate-300 font-serif p-4 md:p-6 lg:p-8 selection:bg-[#d4af37]/30 selection:text-[#d4af37] flex flex-col relative z-0">
      <Starfield />

      <AnimatePresence>
        {exportImage && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] flex flex-col items-center justify-center p-4 bg-black/90 backdrop-blur-sm"
            onClick={() => setExportImage(null)}
          >
            <div className="relative max-h-full max-w-2xl w-full flex flex-col items-center gap-4" onClick={(e) => e.stopPropagation()}>
              <div className="bg-[#1c1c21] border border-[#d4af37]/30 text-[#d4af37] px-4 py-2 rounded-sm text-sm tracking-widest uppercase">
                长按或右键图片另存为
              </div>
              <div className="overflow-auto max-h-[80vh] w-full border border-slate-700/50 rounded-sm shadow-2xl custom-scrollbar relative">
                <img src={exportImage} alt="导出结果" className="w-full h-auto block" />
              </div>
              <button 
                onClick={() => setExportImage(null)}
                className="text-slate-400 hover:text-white transition-colors uppercase tracking-widest text-sm mt-2 px-6 py-2 border border-slate-800 rounded-sm hover:border-slate-500 bg-[#0c0c0e]"
              >
                关闭预览
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="w-full max-w-[1400px] mx-auto border border-[#1a1a1e] md:border-4 md:border-[#1a1a1e] p-4 md:p-6 lg:p-8 bg-[#0c0c0e]/30 shadow-2xl flex-1 flex flex-col relative overflow-hidden z-10 rounded-sm">
        {/* Background glow effects */}
        {currentPage === 'home' && (
          <>
            <div className="absolute top-[-20%] left-[-10%] w-[50%] h-[50%] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />
            <div className="absolute bottom-[-20%] right-[-10%] w-[50%] h-[50%] bg-[#d4af37]/5 rounded-full blur-[120px] pointer-events-none" />
          </>
        )}

        {/* Header */}
        <header className="flex flex-col md:flex-row justify-between items-center md:items-start border-b border-slate-800 pb-4 mb-6 pt-2 z-10">
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.8, ease: "easeOut" }}
            className="flex flex-col text-center md:text-left cursor-pointer"
            onClick={() => setCurrentPage('home')}
          >
            <h1 className="text-3xl font-bold tracking-widest text-[#d4af37] opacity-90 flex flex-col md:flex-row md:items-baseline gap-2">
              玄機樞紐
              <span className="text-xs font-normal text-slate-500 uppercase tracking-widest italic md:ml-2">
                Traditional Numerology Integrated System
              </span>
            </h1>
            <div className="flex justify-center md:justify-start gap-4 mt-2 text-[10px] uppercase tracking-widest text-slate-400">
              <span className="flex items-center gap-1">
                <BookOpen className="w-3 h-3" /> 命理演算核心 v4.2.0
              </span>
            </div>
          </motion.div>
          
          <motion.div 
             initial={{ opacity: 0, y: -20 }}
             animate={{ opacity: 1, y: 0 }}
             transition={{ duration: 0.8, ease: "easeOut", delay: 0.1 }}
             className="flex flex-col text-center md:text-right mt-6 md:mt-0"
          >
            <div className="text-[#aeb2bb] text-sm tracking-widest font-mono mb-2">
               {formatDateString(currentTime)}
            </div>
            <div className="text-slate-500 text-xs tracking-[0.3em]">
               洞察天机 · 趋吉避凶 · 命由我作
            </div>
          </motion.div>
        </header>

        <AnimatePresence mode="wait">
           {currentPage === "home" && renderHome()}
           {currentPage === "bazi" && renderBazi()}
           {currentPage === "horoscope" && renderHoroscope()}
           {currentPage === "tarot" && renderTarot()}
        </AnimatePresence>

        <footer className="mt-auto pt-4 border-t border-slate-800 flex flex-col md:flex-row justify-between items-center text-[10px] text-slate-600 uppercase tracking-[0.2em] gap-2 z-10">
          <span>{disclaimerText}</span>
          <span>© 2026 MYSTIC PIVOT NUMEROLOGY</span>
          <span>北斗星辰核心引擎 载入完成</span>
        </footer>
      </div>
    </div>
  );
}
