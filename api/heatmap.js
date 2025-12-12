// api/heatmap.js
import { Client } from '@notionhq/client';
import { format, eachDayOfInterval, startOfYear } from 'date-fns';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const DATE_PROPERTY_NAME = '新闻日期'; // ← 改成您的实际列名！

export default async function handler(req, res) {
  try {
    const notion = new Client({ auth: NOTION_TOKEN });

    // 查询数据库
    const response = await notion.databases.query({
      database_id: DATABASE_ID,
      filter_property: DATE_PROPERTY_NAME,
      sorts: [
        {
          property: DATE_PROPERTY_NAME,
          direction: 'ascending'
        }
      ]
    });

    // 提取日期
    const dates = [];
    for (const page of response.results) {
      const dateProp = page.properties[DATE_PROPERTY_NAME];
      if (dateProp && dateProp.date && dateProp.date.start) {
        dates.push(new Date(dateProp.date.start));
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
      countMap.set(key, countMap.get(key) + 1);
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
