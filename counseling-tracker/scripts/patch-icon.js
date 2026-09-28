// exe 아이콘 교체 스크립트 (resedit 3.x, 순수 JS)
const fs = require("fs");
const ResEdit = require("resedit");

const [exePath, icoPath, outPath] = process.argv.slice(2);
const exe = ResEdit.NtExecutable.from(fs.readFileSync(exePath));
const res = ResEdit.NtExecutableResource.from(exe);
const groups = ResEdit.Resource.IconGroupEntry.fromEntries(res.entries);
if (!groups.length) { console.error("no icon group"); process.exit(1); }
const g = groups[0];
const ico = ResEdit.Data.IconFile.from(fs.readFileSync(icoPath));
ResEdit.Resource.IconGroupEntry.replaceIconsForResource(
  res.entries, g.id, g.lang, ico.icons.map((i) => i.data)
);
res.outputResource(exe);
fs.writeFileSync(outPath, Buffer.from(exe.generate()));
console.log("OK", outPath, fs.statSync(outPath).size);
