import { cpSync, mkdirSync, watch } from "fs";

const outdir = "dist";

async function build() {
  mkdirSync(outdir, { recursive: true });

  await Bun.build({
    entrypoints: [
      "src/popup/index.html",
      "src/background.ts",
      "src/content.ts",
    ],
    outdir,
    target: "browser",
  });

  cpSync("public", `${outdir}/public`, { recursive: true });
  cpSync("manifest.json", `${outdir}/manifest.json`);

  console.log("Rebuilt →", new Date().toLocaleTimeString());
}

await build();

watch("src", { recursive: true }, build);
watch("manifest.json", build);
watch("public", { recursive: true }, build);

console.log("Watching for changes...");
