// api/heatmap.svg.js
import { Client } from '@notionhq/client';

const NOTION_TOKEN = process.env.NOTION_TOKEN;
const DATABASE_ID = process.env.DATABASE_ID;
const DATE_PROPERTY_NAME = '新闻日期'; // ← 请根据实际修改

function isLeapYear(year) {
  return (year % 4 === 0 && year % 100 !== 0) || year % 400 === 0;
}

function getColorByCount(count) {
  const colors = ['#ebedf0', '#c6e48b', '#7bc96f', '#239a3b', '#196127'];
  if (count === 0) return colors[0];
  if (count === 1) return colors[1];
  if (count <= 3) return colors[2];
  if (count <= 6) return colors[3];
  return colors[4];
}

function generateHeatmapSVG(counts, year) {
  const cellSize = 14;
  const spacing = 4;
  const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
                  'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const daysInMonth = [31, isLeapYear(year) ? 29 : 28, 31, 30, 31, 30,
                       31, 31, 30, 31, 30, 31];

  const colWidth = cellSize + spacing;
  const rowHeight = cellSize + spacing;

  const leftMargin = 50;
  const topMargin = 20;
  const totalColumns = 12 * 5; // 12个月 × 最多5周
  const svgWidth = leftMargin + totalColumns * colWidth;
  const svgHeight = topMargin + 7 * rowHeight + 20; // +20 用于底部统计

  let svg = `<svg width="${svgWidth}" height="${svgHeight}" xmlns="http://www.w3.org/2000/svg" style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif;">\n`;

  // === 星期标签（左侧）===
  const weekdays = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
  for (let w = 0; w < 7; w++) {
    const y = topMargin + w * rowHeight + cellSize / 2 + 3;
    svg += `  <text x="10" y="${y}" font-size="9" fill="#999" text-anchor="start">${weekdays[w]}</text>\n`;
  }

  // === 月份标签 + 单元格 ===
  let globalColIndex = 0;
  for (let month = 0; month < 12; month++) {
    const firstDayOfWeek = new Date(year, month, 1).getDay(); // 0=Sun
    const totalDays = daysInMonth[month];
    const weeksNeeded = Math.ceil((firstDayOfWeek + totalDays) / 7);
    const actualWeeks = Math.min(weeksNeeded, 5);

    // 月份标签（居中）
    if (actualWeeks > 0) {
      const midCol = globalColIndex + Math.floor(actualWeeks / 2);
      const x = leftMargin + midCol * colWidth + cellSize / 2;
      svg += `  <text x="${x}" y="14" font-size="10" fill="#586069" text-anchor="middle">${months[month]}</text>\n`;
    }

    // 渲染该月的每一周
    for (let week = 0; week < actualWeeks; week++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const dayOfMonth = week * 7 + weekday - firstDayOfWeek + 1;
        const x = leftMargin + globalColIndex * colWidth;
        const y = topMargin + weekday * rowHeight;

        if (dayOfMonth >= 1 && dayOfMonth <= totalDays) {
          const dateStr = `${year}-${String(month + 1).padStart(2, '0')}-${String(dayOfMonth).padStart(2, '0')}`;
          const count = counts[dateStr] || 0;
          const color = getColorByCount(count);
          svg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" rx="2" ry="2" fill="${color}">\n`;
          svg += `    <title>${dateStr}: ${count} 条</title>\n`;
          svg += `  </rect>\n`;
        } else {
          // 空白单元格（透明）
          svg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none"></rect>\n`;
        }
      }
      globalColIndex++;
    }

    // 补齐到5周（空白）
    for (let pad = actualWeeks; pad < 5; pad++) {
      for (let weekday = 0; weekday < 7; weekday++) {
        const x = leftMargin + globalColIndex * colWidth;
        const y = topMargin + weekday * rowHeight;
        svg += `  <rect x="${x}" y="${y}" width="${cellSize}" height="${cellSize}" fill="none"></rect>\n`;
      }
      globalColIndex++;
    }
  }

  // === 底部统计 ===
  const total = Object.values(counts).reduce((a, b) => a + b, 0);
  const statsY = svgHeight - 5;
  svg += `  <text x="${leftMargin}" y="${statsY}" font-size="12" fill="#333">Total: ${total} entries in ${year}</text>\n`;

  svg += '</svg>';
  return svg;
}

// ✅ 新增：分页获取所有记录
async function fetchAllRecords(notion, databaseId, datePropName) {
  let records = [];
  let hasMore = true;
  let nextPageCursor = undefined;

  while (hasMore) {
    const response = await notion.databases.query({
      database_id: databaseId,
      filter: {
        property: datePropName,
        date: { is_not_empty: true }
      },
      sorts: [
        { property: datePropName, direction: 'ascending' }
      ],
      start_cursor: nextPageCursor,
      page_size: 100 // Notion API 最大值
    });

    records.push(...response.results);
    hasMore = response.has_more;
    nextPageCursor = response.next_cursor;
  }

  return records;
}

export default async function handler(req, res) {
  try {
    const notion = new Client({ auth: NOTION_TOKEN });

    // ✅ 使用分页函数获取全部记录
    const allRecords = await fetchAllRecords(notion, DATABASE_ID, DATE_PROPERTY_NAME);

    const counts = {};
    for (const record of allRecords) {
      const dateProp = record.properties?.[DATE_PROPERTY_NAME]?.date;
      if (dateProp && dateProp.start) {
        const dateStr = dateProp.start.split('T')[0];
        counts[dateStr] = (counts[dateStr] || 0) + 1;
      }
    }

    const year = new Date().getFullYear();
    const svg = generateHeatmapSVG(counts, year);

    res.setHeader('Content-Type', 'image/svg+xml');
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate');
    res.status(200).send(svg);

  } catch (error) {
    console.error('Error:', error);
    const errorSvg = `<svg width="400" height="100" xmlns="http://www.w3.org/2000/svg">
      <text x="10" y="20" fill="red" font-family="monospace">Heatmap Error</text>
      <text x="10" y="40" fill="red" font-family="monospace">${error.message}</text>
    </svg>`;
    res.setHeader('Content-Type', 'image/svg+xml');
    res.status(500).send(errorSvg);
  }
}
