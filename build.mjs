import {readFileSync,writeFileSync} from 'node:fs';
// Un mismo diseño y comportamiento para todas las entradas de GitHub Pages.
const source=readFileSync(new URL('./App.html',import.meta.url),'utf8');
const views={index:'inicio',candidatos:'candidatos',cliente:'cliente',admin:'admin',superadmin:'superadmin'};
for(const [file,view] of Object.entries(views))writeFileSync(new URL(`./${file}.html`,import.meta.url),source.replace(/<\?= initialView \?>/g,view));
