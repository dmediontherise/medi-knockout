import { Jimp } from 'jimp';
import fs from 'fs';
import path from 'path';

const INPUT_FILE = 'assets/player_sprites_raw.jpg';
const OUTPUT_DIR = 'assets';
const BACKGROUND_COLOR_THRESHOLD = 240;

function isPixelContent(color) {
    const r = (color >>> 24) & 0xFF;
    const g = (color >>> 16) & 0xFF;
    const b = (color >>> 8) & 0xFF;
    return (r < BACKGROUND_COLOR_THRESHOLD || g < BACKGROUND_COLOR_THRESHOLD || b < BACKGROUND_COLOR_THRESHOLD);
}

async function splitSprites() {
  try {
    console.log(`Reading ${INPUT_FILE}...`);
    const image = await Jimp.read(INPUT_FILE);
    const width = image.bitmap.width;
    const height = image.bitmap.height;
    console.log(`Image dimensions: ${width}x${height}`);

    // 1. Detect Rows (Horizontal segments)
    const rowHasContent = new Array(height).fill(false);
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        if (isPixelContent(image.getPixelColor(x, y))) {
           rowHasContent[y] = true;
           break;
        }
      }
    }

    const rows = [];
    let inRow = false;
    let startY = 0;
    for (let y = 0; y < height; y++) {
      if (rowHasContent[y]) {
        if (!inRow) { inRow = true; startY = y; }
      } else {
        if (inRow) {
          inRow = false;
          if (y - startY > 10) rows.push({ start: startY, end: y });
        }
      }
    }
    if (inRow) rows.push({ start: startY, end: height });

    console.log(`Found ${rows.length} rows.`);

    let charCount = 0;

    // 2. For each Row, detect Columns (Vertical segments)
    for (let r = 0; r < rows.length; r++) {
        const rowConfig = rows[r];
        const rowHeight = rowConfig.end - rowConfig.start;
        const rowImage = image.clone().crop({ x: 0, y: rowConfig.start, w: width, h: rowHeight });

        const colHasContent = new Array(width).fill(false);
        for (let x = 0; x < width; x++) {
            for (let y = 0; y < rowHeight; y++) {
                if (isPixelContent(rowImage.getPixelColor(x, y))) {
                    colHasContent[x] = true;
                    break;
                }
            }
        }

        const cols = [];
        let inCol = false;
        let startX = 0;
        for (let x = 0; x < width; x++) {
            if (colHasContent[x]) {
                if (!inCol) { inCol = true; startX = x; }
            } else {
                if (inCol) {
                    inCol = false;
                    if (x - startX > 10) cols.push({ start: startX, end: x });
                }
            }
        }
        if (inCol) cols.push({ start: startX, end: width });

        console.log(`  Row ${r+1}: Found ${cols.length} columns.`);

        // 3. Save Cells
        for (let c = 0; c < cols.length; c++) {
            const colConfig = cols[c];
            const cellWidth = colConfig.end - colConfig.start;
            
            // Crop the cell from the row image
            const cell = rowImage.clone().crop({ x: colConfig.start, y: 0, w: cellWidth, h: rowHeight });

            // Trim whitespace tightly from the cell
            // Top
            let topY = 0;
            tLoop: for(let y=0; y<rowHeight; y++) {
                for(let x=0; x<cellWidth; x++) {
                    if (isPixelContent(cell.getPixelColor(x, y))) { topY = y; break tLoop; }
                }
            }
            // Bottom
            let bottomY = rowHeight;
            bLoop: for(let y=rowHeight-1; y>=0; y--) {
                for(let x=0; x<cellWidth; x++) {
                    if (isPixelContent(cell.getPixelColor(x, y))) { bottomY = y+1; break bLoop; }
                }
            }
            // Left
            let leftX = 0;
            lLoop: for(let x=0; x<cellWidth; x++) {
                for(let y=0; y<rowHeight; y++) {
                    if (isPixelContent(cell.getPixelColor(x, y))) { leftX = x; break lLoop; }
                }
            }
            // Right
            let rightX = cellWidth;
            rLoop: for(let x=cellWidth-1; x>=0; x--) {
                for(let y=0; y<rowHeight; y++) {
                    if (isPixelContent(cell.getPixelColor(x, y))) { rightX = x+1; break rLoop; }
                }
            }

            if (bottomY > topY && rightX > leftX) {
                cell.crop({ x: leftX, y: topY, w: rightX - leftX, h: bottomY - topY });
                charCount++;
                const outName = `sprite_${charCount}.jpg`;
                await cell.write(path.join(OUTPUT_DIR, outName));
                console.log(`    Saved ${outName}`);
            }
        }
    }
    console.log("Done.");

  } catch (err) {
    console.error("Error:", err);
  }
}

splitSprites();