// api/heatmap.svg.js
import { Client } from '@notionhq/client';
import { format, eachDayOfInterval, startOfYear, getMonth } from 'date-fns';
import { enUS } from 'date-fns/locale';

// 从环境变量读取配置
const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const DATE_PROPERTY_NAME = '新闻日期'; // ←←← 请务必修改为您的 Notion 数据库中【日期属性的实际名称】！

export default async function handler(req, res) {
  try {
    // 初始化 Notion 客户端
    const notion = new Client({ auth: NOTION_TOKEN });

    // 查询数据库所有页面
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });

    // 提取有效日期
    const dates = [];
    for (const page of response.results) {
      const dateProp = page.properties[DATE_PROPERTY_NAME];
      if (dateProp?.date?.start) {
        dates.push(new Date(dateProp.date.start));
      }
    }

    const totalEntries = dates.length;

    // 构建全年日期范围（从今年1月1日到今天）
    const today = new Date();
    const start = startOfYear(today);
    const allDays = eachDayOfInterval({ start, end: today });

    // 统计每日记录数
    const countMap = new Map();
    allDays.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      countMap.set(key, 0);
    });
    dates.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      if (countMap.has(key)) {
        countMap.set(key, countMap.get(key) + 1);
      }
    });

    // SVG 布局参数
    const cellSize = 16;
    const spacing = 2;
    const labelWidth = 24;   // 左侧星期标签区域宽度
    const labelHeight = 20;  // 顶部月份标签区域高度
    const statsHeight = 20;  // 底部统计区域高度

    const cols = 53; // 最多53周
    const rows = 7;  // 7天（Sun-Sat）

    const width = labelWidth + cols * (cellSize + spacing) + spacing;
    const height = labelHeight + rows * (cellSize + spacing) + spacing + statsHeight;

    // 开始构建 SVG
    let svg = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: #fff;">\n`;

    // === 左侧：星期标签 ===
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < weekdays.length; i++) {
      const y = labelHeight + spacing + i * (cellSize + spacing) + cellSize / 2;
      svg += `  <text x="${labelWidth - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#666" font-size="10">${weekdays[i]}</text>\n`;
    }

    // === 顶部：月份标签 ===
    let lastMonth = -1;
    for (let week = 0; week < cols; week++) {
      const dayIndex = week * 7;
      if (dayIndex >= allDays.length) break;
      const d = allDays[dayIndex];
      const month = getMonth(d);
      if (month !== lastMonth) {
        const x = labelWidth + spacing + week * (cellSize + spacing);
        const monthAbbr = format(d, 'MMM', { locale: enUS }); // Jan, Feb...
        svg += `  <text x="${x}" y="${labelHeight - 4}" fill="#666" font-size="10">${monthAbbr}</text>\n`;
        lastMonth = month;
      }
    }

    // === 热力图格子 ===
    const getColor = (count) => {
      if (count === 0) return '#ebedf0';
      if (count < 3) return '#9be9a8';
      if (count < 6) return '#40c463';
      if (count < 10) return '#30a14e';
      return '#216e39';
    };

    let dayIndex = 0;
    for (let week = 0; week < cols; week++) {
      for (let weekday = 0; weekday < rows; weekday++) {
        if (dayIndex >= allDays.length) break;
        const d = allDays[dayIndex];
        const key = format(d, 'yyyy-MM-dd');
        const count = countMap.get(key) || 0;
        const x = labelWidth + spacing + week * (cellSize + spacing);
        const y = labelHeight + spacing + weekday * (cellSize + spacing);
        const color = getColor(count);
        svg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" title="${key}: ${count} 条" />\n`;
        dayIndex++;
      }
    }

    // === 底部：统计信息 ===
    const statsY = height - 5;
    svg += `  <text x="${labelWidth}" y="${statsY}" fill="#333" font-size="10">Total: ${totalEntries} entries</text>\n`;

    svg += '</svg>';

    // 设置正确响应头
    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // 缓存1小时
    res.status(200).send(svg);

  } catch (error) {
    console.error('Heatmap generation error:', error);
    // 即使出错，也返回一个简单的 SVG 错误图（避免 Notion 显示破图）
    const errorSvg = `<svg width="300" height="100" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="20" fill="red" font-family="monospace">Error: Failed to load heatmap</text>
      <text x="10" y="40" fill="red" font-family="monospace">Check Vercel logs for details</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(500).send(errorSvg);
  }
}
