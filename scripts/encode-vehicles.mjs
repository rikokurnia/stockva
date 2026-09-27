// Deployment encoding only; all original and generated PNG masters are retained.
import sharp from 'sharp';
import {readFile,writeFile} from 'node:fs/promises';
const frames=JSON.parse(await readFile('lib/vehicle-frames.json','utf8'));
const urls=[...new Set(Object.values(frames).flatMap(v=>Object.values(v).map(f=>f.src)))];
await Promise.all(urls.map(src=>sharp(`public${src}`).webp({quality:90}).toFile(`public${src.replace('.png','.webp')}`)));
for(const vehicle of Object.values(frames))for(const frame of Object.values(vehicle))frame.src=frame.src.replace('.png','.webp');
await writeFile('lib/vehicle-frames.json',JSON.stringify(frames,null,2)+'\n');
