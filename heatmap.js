{\rtf1\ansi\ansicpg936\cocoartf2639
\cocoatextscaling0\cocoaplatform0{\fonttbl\f0\fnil\fcharset0 HelveticaNeue;\f1\fnil\fcharset134 PingFangSC-Regular;}
{\colortbl;\red255\green255\blue255;\red0\green0\blue0;\red255\green255\blue255;}
{\*\expandedcolortbl;;\cssrgb\c0\c0\c0;\cssrgb\c100000\c100000\c100000;}
\paperw11900\paperh16840\margl1440\margr1440\vieww11520\viewh8400\viewkind0
\deftab720
\pard\pardeftab720\partightenfactor0

\f0\fs28 \cf2 \expnd0\expndtw0\kerning0
\outl0\strokewidth0 \strokec3 // api/heatmap.js\
import \{ NotionAPI \} from 'notion-client';\
import \{ format, subDays, eachDayOfInterval, startOfYear, isSameDay \} from 'date-fns';\
\
const NOTION_TOKEN = process.env.NOTION_TOKEN;\
const DATABASE_ID = process.env.DATABASE_ID;\
const DATE_PROPERTY_NAME = '
\f1 \'d0\'c2\'ce\'c5\'c8\'d5\'c6\'da
\f0 '; // \uc0\u8592 \u8592 \u8592  
\f1 \'b8\'c4\'b3\'c9\'c4\'fa\'ca\'fd\'be\'dd\'bf\'e2\'d6\'d0\'b5\'c4\'c8\'d5\'c6\'da\'c1\'d0\'c3\'fb\'a3\'a1
\f0 \
\
export default async function handler(req, res) \{\
  try \{\
    const notion = new NotionAPI(\{ authToken: NOTION_TOKEN \});\
    \
    // 
\f1 \'bb\'f1\'c8\'a1\'ca\'fd\'be\'dd\'bf\'e2\'cb\'f9\'d3\'d0\'bc\'c7\'c2\'bc
\f0 \
    const records = await notion.queryCollection(\{\
      collectionId: DATABASE_ID,\
      collectionViewId: DATABASE_ID, // 
\f1 \'b6\'d4\'d3\'da\'c6\'d5\'cd\'a8\'ca\'fd\'be\'dd\'bf\'e2\'a3\'ac
\f0 collectionId = viewId\
      loader: \{\
        type: 'table',\
        limit: 1000,\
        searchQuery: '',\
        userLocale: 'en',\
        userTimeZone: 'Asia/Shanghai'\
      \}\
    \});\
\
    // 
\f1 \'cc\'e1\'c8\'a1\'cb\'f9\'d3\'d0\'c8\'d5\'c6\'da
\f0 \
    const dates = 
\f1 []
\f0 ;\
    for (const block of Object.values(records.recordMap.block || \{\})) \{\
      if (block?.value?.type === 'page') \{\
        const props = block.value.properties;\
        if (props && props
\f1 [
\f0 DATE_PROPERTY_NAME
\f1 ]
\f0 ) \{\
          const dateStr = props
\f1 [
\f0 DATE_PROPERTY_NAME
\f1 ][
\f0 0
\f1 ][
\f0 1
\f1 ]
\f0 ?.start_date;\
          if (dateStr) \{\
            dates.push(new Date(dateStr));\
          \}\
        \}\
      \}\
    \}\
\
    // 
\f1 \'cd\'b3\'bc\'c6\'c3\'bf\'c8\'d5\'b4\'ce\'ca\'fd
\f0 \
    const today = new Date();\
    const start = startOfYear(today);\
    const allDays = eachDayOfInterval(\{ start, end: today \});\
    const countMap = new Map();\
    allDays.forEach(d => countMap.set(format(d, 'yyyy-MM-dd'), 0));\
    dates.forEach(d => \{\
      const key = format(d, 'yyyy-MM-dd');\
      if (countMap.has(key)) \{\
        countMap.set(key, countMap.get(key) + 1);\
      \}\
    \});\
\
    // 
\f1 \'c9\'fa\'b3\'c9
\f0  SVG
\f1 \'a3\'a8\'bc\'f2\'bb\'af\'b0\'e6
\f0  53 
\f1 \'d6\'dc
\f0  \'d7 7 
\f1 \'cc\'ec\'a3\'a9
\f0 \
    const cellSize = 16;\
    const spacing = 2;\
    const width = 53 * (cellSize + spacing) + spacing;\
    const height = 8 * (cellSize + spacing) + spacing;\
\
    let svgContent = `<svg width="$\{width\}" height="$\{height\}" xmlns="http://www.w3.org/2000/svg" style="background:#fff">`;\
\
    // 
\f1 \'d1\'d5\'c9\'ab\'cc\'dd\'b6\'c8
\f0 \
    const getColor = (count) => \{\
      if (count === 0) return '#ebedf0';\
      if (count < 3) return '#9be9a8';\
      if (count < 6) return '#40c463';\
      if (count < 10) return '#30a14e';\
      return '#216e39';\
    \};\
\
    let dayIndex = 0;\
    for (let week = 0; week < 53; week++) \{\
      for (let weekday = 0; weekday < 7; weekday++) \{\
        if (dayIndex >= allDays.length) break;\
        const d = allDays
\f1 [
\f0 dayIndex
\f1 ]
\f0 ;\
        const key = format(d, 'yyyy-MM-dd');\
        const count = countMap.get(key) || 0;\
        const x = spacing + week * (cellSize + spacing);\
        const y = spacing + weekday * (cellSize + spacing);\
        const color = getColor(count);\
        svgContent += `<rect x="$\{x\}" y="$\{y\}" width="$\{cellSize\}" height="$\{cellSize\}" fill="$\{color\}" title="$\{key\}: $\{count\} 
\f1 \'cc\'f5
\f0 "></rect>`;\
        dayIndex++;\
      \}\
    \}\
\
    svgContent += `</svg>`;\
\
    // 
\f1 \'c9\'e8\'d6\'c3\'cf\'ec\'d3\'a6\'cd\'b7
\f0 \
    res.setHeader('Content-Type', 'image/svg+xml');\
    res.setHeader('Cache-Control', 's-maxage=3600, stale-while-revalidate'); // 
\f1 \'bb\'ba\'b4\'e6
\f0 1
\f1 \'d0\'a1\'ca\'b1
\f0 \
    res.status(200).send(svgContent);\
\
  \} catch (error) \{\
    console.error('Error:', error);\
    res.status(500).json(\{ error: 'Failed to generate heatmap' \});\
  \}\
\}}