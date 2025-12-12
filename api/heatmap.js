// api/heatmap.js
import { Client } from '@notionhq/client';
import { format, eachDayOfInterval, startOfYear, getMonth, getDay } from 'date-fns';
import { enUS } from 'date-fns/locale';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const DATE_PROPERTY_NAME = '新闻日期'; // ← 改成您的实际列名！

export default async function handler(req, res) {
  try {
    const notion = new Client({ auth: NOTION_TOKEN });

    const response = await notion.databases.query({
      database_id: DATABASE_ID,
    });

    const dates = [];
    for (const page of response.results) {
      const dateProp = page.properties[DATE_PROPERTY_NAME];
      if (dateProp?.date?.start) {
        dates.push(new Date(dateProp.date.start));
      }
    }

    const today = new Date();
    const start = startOfYear(today);
    const allDays = eachDayOfInterval({ start, end: today });
    const countMap = new Map();
    allDays.forEach(d => countMap.set(format(d, 'yyyy-MM-dd'), 0));
    dates.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      countMap.set(key, countMap.get(key) + 1);
    });

    // 计算总条数
    const totalEntries = dates.length;

    // SVG 参数
    const cellSize = 16;
    const spacing = 2;
    const labelWidth = 20;   // 左侧星期标签宽度
    const labelHeight = 20;  // 顶部月份标签高度
    const width = labelWidth + 53 * (cellSize + spacing) + spacing;
    const height = labelHeight + 8 * (cellSize + spacing) + spacing + 20; // +20 用于底部统计

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; font-size: 10px;">`;

    // === 左侧：星期标签 ===
    const weekdays = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    for (let i = 0; i < 7; i++) {
      const y = labelHeight + spacing + i * (cellSize + spacing) + cellSize / 2;
      svgContent += `<text x="${labelWidth - 4}" y="${y}" text-anchor="end" dominant-baseline="middle" fill="#666">${weekdays[i]}</text>`;
    }

    // === 顶部：月份标签 ===
    let lastMonth = -1;
    for (let week = 0; week < 53; week++) {
      const dayIndex = week * 7;
      if (dayIndex >= allDays.length) break;
      const d = allDays[dayIndex];
      const month = getMonth(d);
      if (month !== lastMonth) {
        const x = labelWidth + spacing + week * (cellSize + spacing);
        const monthName = format(d, 'MMM', { locale: enUS }); // Jan, Feb...
        svgContent += `<text x="${x}" y="${labelHeight - 4}" fill="#666">${monthName}</text>`;
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
    for (let week = 0; week < 53; week++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        if (dayIndex >= allDays.length) break;
        const d = allDays[dayIndex];
        const key = format(d, 'yyyy-MM-dd');
        const count = countMap.get(key) || 0;
        const x = labelWidth + spacing + week * (cellSize + spacing);
        const y = labelHeight + spacing + weekday * (cellSize + spacing);
        const color = getColor(count);
        svgContent += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" title="${key}: ${count} 条"></rect>`;
        dayIndex++;
      }
    }

    // === 底部：统计信息 ===
    const statsY = height - 5;
    svgContent += `<text x="${labelWidth}" y="${statsY}" fill="#333">Total: ${totalEntries} entries</text>`;

    svgContent += `</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(svgContent);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap' });
  }
}
