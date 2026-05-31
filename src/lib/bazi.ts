import { Lunar, Solar, EightChar } from 'lunar-javascript';

// 称骨算命数据 (Yuan Tiangang Bone Weight mapping in "qian/liang")
// 1 liang = 10 qian. We store everything in "qian" (钱) and format later.

const YEAR_WEIGHT: Record<string, number> = {
  '甲子': 12, '乙丑': 9, '丙寅': 6, '丁卯': 7, '戊辰': 12, '己巳': 5, '庚午': 9, '辛未': 8, '壬申': 7, '癸酉': 8,
  '甲戌': 15, '乙亥': 9, '丙子': 16, '丁丑': 8, '戊寅': 8, '己卯': 19, '庚辰': 12, '辛巳': 6, '壬午': 8, '癸未': 7,
  '甲申': 5, '乙酉': 15, '丙戌': 6, '丁亥': 16, '戊子': 15, '己丑': 7, '庚寅': 9, '辛卯': 12, '壬辰': 10, '癸巳': 7,
  '甲午': 15, '乙未': 6, '丙申': 5, '丁酉': 14, '戊戌': 14, '己亥': 9, '庚子': 7, '辛丑': 7, '壬寅': 9, '癸卯': 12,
  '甲辰': 12, '乙巳': 7, '丙午': 13, '丁未': 5, '戊申': 14, '己酉': 5, '庚戌': 9, '辛亥': 16, '壬子': 5, '癸丑': 7,
  '甲寅': 12, '乙卯': 16, '丙辰': 8, '丁巳': 6, '戊午': 19, '己未': 6, '庚申': 8, '辛酉': 16, '壬戌': 14, '癸亥': 7
};

const MONTH_WEIGHT = [0, 6, 7, 18, 9, 5, 16, 9, 15, 18, 8, 9, 5]; // 0 is dummy, use 1-12
const DAY_WEIGHT = [
  0, 5, 10, 8, 15, 16, 15, 8, 16, 8, 16,
  9, 17, 8, 17, 10, 8, 9, 18, 5, 15,
  10, 9, 8, 9, 15, 18, 7, 8, 16, 6
]; // 0 is dummy, use 1-30
const HOUR_WEIGHT: Record<string, number> = {
  '子': 16, '丑': 6, '寅': 7, '卯': 10, '辰': 9, '巳': 16,
  '午': 10, '未': 8, '申': 8, '酉': 9, '戌': 6, '亥': 6
};

// 称骨歌诀
const BONE_WEIGHT_POEMS: Record<number, string> = {
  21: "短命非业谓大空，平生灾难事重重；凶祸频临陷逆境，终世困苦事不成。",
  22: "身寒骨冷苦伶仃，此命推来行乞人；劳劳碌碌无度日，终年打拱过平生。",
  23: "此命推来骨格轻，求谋作事事难成；妻儿兄弟应难许，别处他乡作散人。",
  24: "此命推来福禄无，门庭困苦总难荣；六亲骨肉皆无靠，流浪他乡作老翁。",
  25: "此命推来祖业微，门庭营度似稀奇；六亲骨肉如冰炭，一世勤劳自把持。",
  26: "平生衣禄苦中求，独自营谋事不休；离祖出门宜早计，晚来衣禄自无休。",
  27: "一生作事少商量，难靠祖宗作主张；独马单枪空做去，早年晚岁总无长。",
  28: "一生行事似飘蓬，祖宗产业在梦中；若不过房改名姓，也当移徒二三通。",
  29: "初年运限未曾亨，纵有功名在后成；须过四旬才可立，移居改姓始为良。",
  30: "劳劳碌碌苦中求，东奔西走何日休；若使终身勤与俭，老来稍可免忧愁。",
  31: "忙忙碌碌苦中求，何日云开见日头；难得祖基家可立，中年衣食渐无忧。",
  32: "初年运蹇事难谋，渐有财源如水流；到得中年衣食旺，那时名利一齐收。",
  33: "早年作事事难成，百计徒劳枉费心；半世自如流水去，后来运到得黄金。",
  34: "此命福气果如何，僧道门中衣禄多；离祖出家方为妙，朝晚拜佛念弥陀。",
  35: "生平福量不周全，祖业根基觉少传；营事生涯宜守旧，时来衣食胜从前。",
  36: "不须劳碌过平生，单独成家福不轻；早有福星常照命，任君浩志尽撑霆。",
  37: "此命般般事不成、弟兄少力自孤行；虽然祖业须微有，来得明时去不明。",
  38: "一身骨肉最清高，早入簧门姓名标；待到年将三十六，蓝衫脱去换红袍。",
  39: "此命终身运不通，劳劳作事尽皆空；苦心竭力成家计，到得那时在梦中。",
  40: "平生衣禄是绵长，件件心中自主张；前面风霜多受过，后来必定享安康。",
  41: "此命推来自不同，为人能干异凡庸；中年还有逍遥福：不比前时运来通。",
  42: "得宽怀处且宽怀，何用双眉皱不开；若使中年命运济，那时名利一起来。",
  43: "为人心性最聪明，作事轩昂近贵人；衣禄一生天数定，不须劳碌过平生。",
  44: "万事由天莫苦求，须知福禄命里收；少壮名利难如意，晚景欣然更不忧。",
  45: "名利推来竟若何，前番辛苦后奔波；命中难养男与女，骨肉扶持也不多。",
  46: "东西南北尽皆通，出姓移居更觉隆；衣禄无亏天数定，中年晚景一般同。",
  47: "此命推来旺末年，妻荣子贵自怡然；平生原有滔滔福，财源滚滚似水流。",
  48: "初年运道未曾亨，若是蹉跎再不兴；兄弟六亲皆无靠，一身事业晚年成。",
  49: "此命推来福不轻，自成自立显门庭；从来富贵人钦敬，使婢差奴过一生。",
  50: "为利为名终日劳，中年福禄也多遭；老来是有财星照，胜似前番终日高。",
  51: "一世荣华事事通，不须劳碌自亨通；弟兄叔侄皆如意，家业成时福禄宏。",
  52: "一世亨通事事能，不须劳思自然能；宗族欣然心皆好，家业丰亨自称心。",
  53: "此格推为气量真，兴家发达在其中；一生福禄安排定，却是人间一富翁。",
  54: "此命推来厚且清，诗书满腹看功成；丰衣足食自然稳，正是人间有福人。",
  55: "走马扬鞭争利名，少年作事费筹论；一朝福禄源源至，富贵荣华显六亲。",
  56: "此格推来礼义通，一身福禄用无穷；甜酸苦辣皆尝过，滚滚财源稳且丰。",
  57: "福禄丰盈万事全，一身荣耀乐天年；名扬威震人争羡，此世期门宝座传。",
  58: "平生福禄自然来，名利兼全福寿偕；雁塔题名为贵客，紫袍金带走金阶。",
  59: "细推此格妙且清，必定才高惹人钦；甲第之中应有分，扬鞭走马显威荣。",
  60: "一朝金榜快题名，显祖荣宗立大功；衣禄定然原裕足，田园财帛更丰盈。",
  61: "不论作是不起名，此命定能把名留；只要行善多积德，功名到处总风流。",
  62: "此命生来福不穷，读书必定显亲宗；紫衣金带为卿相，富贵荣华皆可同。",
  63: "命主为官福禄长，得来富贵定非常；名题金塔传金榜，定中高科天下扬。",
  64: "此格威权不可当，紫袍金带坐高堂；荣华富贵谁能及？积玉堆金满画堂。",
  65: "细推此命福非轻，富贵荣华孰与争；定国安邦人极品，威声显赫震寰瀛。",
  66: "此格人间一福人，堆金积玉满堂春；从来富贵由天定，钦赐金官迎至尊。",
  67: "此命生来福自宏，田园家业最高隆；平生衣禄丰盈足，一世荣华万事通。",
  68: "富贵由天莫苦求，万丈家计不须愁；十年不比前番事，祖业根基水上舟。",
  69: "君是人间福禄星，一生富贵众人钦；总然衣禄由天定，安享荣华过一生。",
  70: "此命推来福不轻，何须愁虑苦劳心；荣华富贵已天定，正笏垂绅拜紫宸。",
  71: "此命生成大不同，公侯卿相在其中；一生自有逍遥福，富贵荣华极品隆。"
};


export interface AstrologicalData {
  solarDate: string;
  lunarDate: string;
  bazi: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  baziWuXing: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  baziShiShen: {
    year: string;
    month: string;
    day: string;
    hour: string;
  };
  boneWeight: {
    weightStr: string;
    poem: string;
    totalQian: number;
    details: {
      year: number;
      month: number;
      day: number;
      hour: number;
    }
  };
}

export function calculateAstrology(dateStr: string, gender: "坤造" | "乾造"): AstrologicalData {
  const d = new Date(dateStr);
  const solar = Solar.fromDate(d);
  const lunar = solar.getLunar();
  const baZi = lunar.getEightChar();
  
  // 阳历/农历字符串
  const solarStr = `${solar.getYear()}年${solar.getMonth()}月${solar.getDay()}日 ${solar.getHour()}:${solar.getMinute()}`;
  const lunarStr = `${lunar.getYearInGanZhi()}年 ${lunar.getMonthInChinese()}月 ${lunar.getDayInChinese()} ${baZi.getTimeZhi()}时`;
  
  // 八字
  const bazi = {
    year: baZi.getYear(),
    month: baZi.getMonth(),
    day: baZi.getDay(),
    hour: baZi.getTime()
  };
  
  // 五行
  const baziWuXing = {
    year: baZi.getYearWuXing(),
    month: baZi.getMonthWuXing(),
    day: baZi.getDayWuXing(),
    hour: baZi.getTimeWuXing()
  };
  
  // 十神 
  const baziShiShen = {
    year: baZi.getYearShiShenGan(), // Note: simplification, ten gods are usually derived relative to Day Master. lunar-js does this automatically.
    month: baZi.getMonthShiShenGan(),
    day: baZi.getDayShiShenGan(),
    hour: baZi.getTimeShiShenGan()
  };
  
  // 称骨算命
  const lunarYearGanZhi = lunar.getYearInGanZhi();
  const lunarMonth = Math.abs(lunar.getMonth()); // Math.abs to handle leap months where lunar JS returns negative
  const lunarDay = lunar.getDay();
  const szZhi = baZi.getTimeZhi();
  
  const wYear = YEAR_WEIGHT[lunarYearGanZhi] || 0;
  const wMonth = MONTH_WEIGHT[lunarMonth] || 0;
  const wDay = DAY_WEIGHT[lunarDay] || 0;
  const wHour = HOUR_WEIGHT[szZhi] || 0;
  
  const totalQian = wYear + wMonth + wDay + wHour;
  const liang = Math.floor(totalQian / 10);
  const qian = totalQian % 10;
  const weightStr = `${liang}两${qian}钱`;
  
  // 兜底一首古诗
  const poem = BONE_WEIGHT_POEMS[totalQian] || "此命局奇特，未能尽录于歌诀中，需详推八字方可定夺。";
  
  return {
    solarDate: solarStr,
    lunarDate: lunarStr,
    bazi,
    baziWuXing,
    baziShiShen,
    boneWeight: {
      weightStr,
      poem,
      totalQian,
      details: {
        year: wYear,
        month: wMonth,
        day: wDay,
        hour: wHour
      }
    }
  };
}
