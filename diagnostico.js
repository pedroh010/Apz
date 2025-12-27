// ============================================================================
// 🔍 SCRIPT DE DIAGNÓSTICO DO BOT
// Execute: node diagnostico.js
// ============================================================================

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

console.log("🔍 Iniciando diagnóstico do bot...\n");

// ============================================================================
// 1. VERIFICAR .ENV
// ============================================================================
console.log("1️⃣ Verificando arquivo .env");
if (fs.existsSync(".env")) {
  const env = fs.readFileSync(".env", "utf8");
  const hasToken = env.includes("TOKEN=") && env.split("TOKEN=")[1]?.trim().length > 20;
  console.log(hasToken ? "✅ Token encontrado" : "❌ Token inválido ou ausente");
} else {
  console.log("❌ Arquivo .env não encontrado");
}
console.log();

// ============================================================================
// 2. VERIFICAR ESTRUTURA DE PASTAS
// ============================================================================
console.log("2️⃣ Verificando estrutura de pastas");

const expectedFolders = [
  { path: "commands", required: true },
  { path: "utils", required: true },
  { path: "systems", required: true },
  { path: "data", required: false },
  { path: "src/commands", required: false },
  { path: "src/utils", required: false },
  { path: "src/systems", required: false }
];

for (const folder of expectedFolders) {
  const exists = fs.existsSync(folder.path);
  if (folder.required) {
    console.log(exists ? `✅ ${folder.path}/` : `❌ ${folder.path}/ (OBRIGATÓRIA)`);
  } else {
    console.log(exists ? `ℹ️ ${folder.path}/ (encontrada)` : `⚪ ${folder.path}/ (não encontrada)`);
  }
}
console.log();

// ============================================================================
// 3. VERIFICAR ARQUIVOS DE COMANDO
// ============================================================================
console.log("3️⃣ Verificando arquivos de comando");

const expectedCommands = [
  "setapostas.js", "setmed.js", "setthumbnail.js",
  "fch.js", "mediador.js", "qrcode.js", "vt.js", "vtr.js",
  "filas.js", "pix.js", "rank.js",
  "1x1mob.js"
];

let foundCommands = 0;
const searchDirs = [".", "commands", "src/commands", "src/commands/admin", "src/commands/mediator", "src/commands/player", "src/commands/queues"];

for (const cmd of expectedCommands) {
  let found = false;
  for (const dir of searchDirs) {
    if (fs.existsSync(path.join(dir, cmd))) {
      console.log(`✅ ${cmd} (em ${dir}/)`);
      found = true;
      foundCommands++;
      break;
    }
  }
  if (!found) {
    console.log(`❌ ${cmd} (não encontrado)`);
  }
}

console.log(`\n📊 Total: ${foundCommands}/${expectedCommands.length} comandos encontrados\n`);

// ============================================================================
// 4. VERIFICAR UTILITÁRIOS
// ============================================================================
console.log("4️⃣ Verificando utilitários");

const expectedUtils = [
  "constants.js",
  "mediatorManager.js",
  "queueState.js",
  "threadHelper.js",
  "webhookManager.js"
];

let foundUtils = 0;
const utilsDirs = ["utils", "src/utils"];

for (const util of expectedUtils) {
  let found = false;
  for (const dir of utilsDirs) {
    if (fs.existsSync(path.join(dir, util))) {
      console.log(`✅ ${util}`);
      found = true;
      foundUtils++;
      break;
    }
  }
  if (!found) {
    console.log(`❌ ${util} ${util === "webhookManager.js" ? "(CRIAR ESTE ARQUIVO)" : ""}`);
  }
}

console.log(`\n📊 Total: ${foundUtils}/${expectedUtils.length} utilitários encontrados\n`);

// ============================================================================
// 5. VERIFICAR SISTEMAS
// ============================================================================
console.log("5️⃣ Verificando sistemas");

const expectedSystems = ["operario.js", "partidas.js"];
let foundSystems = 0;
const systemsDirs = ["systems", "src/systems"];

for (const sys of expectedSystems) {
  let found = false;
  for (const dir of systemsDirs) {
    if (fs.existsSync(path.join(dir, sys))) {
      console.log(`✅ ${sys}`);
      found = true;
      foundSystems++;
      break;
    }
  }
  if (!found) {
    console.log(`❌ ${sys}`);
  }
}

console.log(`\n📊 Total: ${foundSystems}/${expectedSystems.length} sistemas encontrados\n`);

// ============================================================================
// 6. VERIFICAR IMPORTS DO 1x1mob.js
// ============================================================================
console.log("6️⃣ Verificando imports no 1x1mob.js");

const findFile = (filename) => {
  for (const dir of searchDirs) {
    const filepath = path.join(dir, filename);
    if (fs.existsSync(filepath)) return filepath;
  }
  return null;
};

const mob1x1Path = findFile("1x1mob.js");
if (mob1x1Path) {
  const content = fs.readFileSync(mob1x1Path, "utf8");
  
  // Verificar imports
  const imports = [
    { pattern: /from\s+["'].*constants\.js["']/, name: "constants.js" },
    { pattern: /from\s+["'].*queueState\.js["']/, name: "queueState.js" },
    { pattern: /from\s+["'].*mediatorManager\.js["']/, name: "mediatorManager.js" },
    { pattern: /from\s+["'].*webhookManager\.js["']/, name: "webhookManager.js" },
    { pattern: /from\s+["'].*threadHelper\.js["']/, name: "threadHelper.js" },
    { pattern: /from\s+["'].*operario\.js["']/, name: "operario.js" }
  ];

  for (const imp of imports) {
    if (imp.pattern.test(content)) {
      console.log(`✅ Import ${imp.name} encontrado`);
    } else {
      console.log(`❌ Import ${imp.name} ausente ou incorreto`);
    }
  }

  // Verificar se arquivo está completo
  if (content.includes("includes(\",\")")) {
    console.log("✅ Arquivo parece completo");
  } else {
    console.log("⚠️ Arquivo pode estar incompleto (verificar final do arquivo)");
  }
} else {
  console.log("❌ 1x1mob.js não encontrado");
}
console.log();

// ============================================================================
// 7. VERIFICAR ARQUIVOS JSON
// ============================================================================
console.log("7️⃣ Verificando arquivos de dados (JSON)");

const jsonFiles = [
  { file: "apostas_config.json", required: false },
  { file: "mediador_config.json", required: false },
  { file: "mediadores.json", required: true },
  { file: "messages_config.json", required: false },
  { file: "partidas.json", required: false },
  { file: "ranking.json", required: true },
  { file: "thumbnail_config.json", required: false }
];

for (const json of jsonFiles) {
  const exists = fs.existsSync(json.file) || fs.existsSync(`data/${json.file}`);
  if (json.required) {
    console.log(exists ? `✅ ${json.file}` : `❌ ${json.file} (CRIAR ESTE ARQUIVO)`);
  } else {
    console.log(exists ? `✅ ${json.file}` : `ℹ️ ${json.file} (será criado automaticamente)`);
  }
}
console.log();

// ============================================================================
// 8. VERIFICAR DEPENDÊNCIAS
// ============================================================================
console.log("8️⃣ Verificando package.json");

if (fs.existsSync("package.json")) {
  const pkg = JSON.parse(fs.readFileSync("package.json", "utf8"));
  console.log("✅ package.json encontrado");
  
  const requiredDeps = [
    "discord.js",
    "dotenv",
    "qrcode"
  ];

  const deps = { ...pkg.dependencies, ...pkg.devDependencies };
  
  for (const dep of requiredDeps) {
    console.log(deps[dep] ? `✅ ${dep}` : `❌ ${dep} (instalar com: npm install ${dep})`);
  }
} else {
  console.log("❌ package.json não encontrado");
}
console.log();

// ============================================================================
// RESUMO FINAL
// ============================================================================
console.log("=" .repeat(60));
console.log("📋 RESUMO DO DIAGNÓSTICO");
console.log("=" .repeat(60));

const issues = [];

if (!fs.existsSync(".env")) {
  issues.push("❌ Criar arquivo .env com TOKEN do bot");
}

if (foundCommands < expectedCommands.length) {
  issues.push(`❌ ${expectedCommands.length - foundCommands} comandos faltando`);
}

if (foundUtils < expectedUtils.length) {
  issues.push(`❌ ${expectedUtils.length - foundUtils} utilitários faltando (principalmente webhookManager.js)`);
}

if (foundSystems < expectedSystems.length) {
  issues.push(`❌ ${expectedSystems.length - foundSystems} sistemas faltando`);
}

if (!fs.existsSync("mediadores.json") && !fs.existsSync("data/mediadores.json")) {
  issues.push("❌ Criar mediadores.json com: []");
}

if (!fs.existsSync("ranking.json") && !fs.existsSync("data/ranking.json")) {
  issues.push("❌ Criar ranking.json com: {}");
}

if (issues.length === 0) {
  console.log("\n✅ TUDO OK! Seu bot deve funcionar.\n");
  console.log("Execute: node index.js");
} else {
  console.log("\n⚠️ PROBLEMAS ENCONTRADOS:\n");
  issues.forEach((issue, i) => console.log(`${i + 1}. ${issue}`));
  console.log("\n📖 Veja o guia de estrutura de pastas para corrigir.");
}

console.log("\n" + "=".repeat(60));