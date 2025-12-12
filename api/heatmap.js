// api/heatmap.js
import { NotionAPI } from 'notion-client';
import { format, subDays, eachDayOfInterval, startOfYear, isSameDay } from 'date-fns';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const DATE_PROPERTY_NAME = '新闻日期'; // ←←← 请改成您数据库中的实际日期列名！

export default async function handler(req, res) {
  try {
    const notion = new NotionAPI({ authToken: NOTION_TOKEN });
    
    // 获取数据库所有记录
    const records = await notion.queryCollection({
      collectionId: DATABASE_ID,
      collectionViewId: DATABASE_ID,
      loader: {
        type: 'table',
        limit: 1000,
        searchQuery: '',
        userLocale: 'en',
        userTimeZone: 'Asia/Shanghai'
      }
    });

    // 提取所有日期
    const dates = [];
    for (const block of Object.values(records.recordMap.block || {})) {
      if (block?.value?.type === 'page') {
        const props = block.value.properties;
        if (props && props[DATE_PROPERTY_NAME]) {
          const dateStr = props[DATE_PROPERTY_NAME][0][1]?.start_date;
          if (dateStr) {
            dates.push(new Date(dateStr));
          }
        }
      }
    }

    // 统计每日次数
    const today = new Date();
    const start = startOfYear(today);
    const allDays = eachDayOfInterval({ start, end: today });
    const countMap = new Map();
    allDays.forEach(d => countMap.set(format(d, 'yyyy-MM-dd'), 0));
    dates.forEach(d => {
      const key = format(d, 'yyyy-MM-dd');
      if (countMap.has(key)) {
        countMap.set(key, countMap.get(key) + 1);
      }
    });

    // 生成 SVG
    const cellSize = 16;
    const spacing = 2;
    const width = 53 * (cellSize + spacing) + spacing;
    const height = 8 * (cellSize + spacing) + spacing;

    let svgContent = `<svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg" style="background:#fff">`;

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
        const x = spacing + week * (cellSize + spacing);
        const y = spacing + weekday * (cellSize + spacing);
        const color = getColor(count);
        svgContent += `<rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="${color}" title="${key}: ${count} 条"></rect>`;
        dayIndex++;
      }
    }

    svgContent += `</svg>`;

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(svgContent);

  } catch (error) {
    console.error('Error:', error);
    res.status(500).json({ error: 'Failed to generate heatmap' });
  }
}
