// ============================================================================
// index.js - COM SISTEMA DE PERSISTÊNCIA DE BOTÕES
// ============================================================================

import { Client, GatewayIntentBits, Partials, Collection } from "discord.js";
import dotenv from "dotenv";
import fs from "fs";
import { fileURLToPath } from "url";
import path from "path";

// ⭐ IMPORTAR SISTEMA DE PERSISTÊNCIA
import { restoreCollectors } from "./utils/collectorManager.js";

// Operário
import { 
  handleOperarioButtons, 
  handleSolicitarTelaModal, 
  handleCanalVozSelect 
} from "./systems/operario.js";

// Comandos Admin
import cmdSetapostas from "./commands/admin/setapostas.js";
import cmdSetmed from "./commands/admin/setmed.js";
import cmdSetthumbnail from "./commands/admin/setthumbnail.js";
import cmdAnalista from "./commands/admin/setanalista.js";
import cmdCollectors from "./commands/admin/collectors.js";
import cmdEmbed from "./commands/admin/embed.js";
import cmdApagarWebhooks from "./commands/admin/apagarWebhooks.js";
 
// Comandos Mediator
import cmdControle from "./commands/mediator/controle.js";
import cmdFaturamento from "./commands/mediator/faturamento.js";
import cmdFch from "./commands/mediator/fch.js";
import cmdMediador, { handleMediadorModal } from "./commands/mediator/mediador.js";
import cmdQrcode from "./commands/mediator/qrcode.js";
import cmdTelador, { handleTeladorButtons } from "./commands/mediator/telador.js";
import cmdVt from "./commands/mediator/vt.js";
import cmdVtr from "./commands/mediator/vtr.js";

// Comandos Player
import cmdPix from "./commands/player/pix.js";
import cmdRank from "./commands/player/rank.js";
import cmdFilas from "./commands/player/filas.js";

// Comandos Queues
import cmd1x1mob from "./commands/queues/1x1mob.js";
import cmd2x2mob from "./commands/queues/2x2mob.js";
import cmd3x3mob from "./commands/queues/3x3mob.js";
import cmd4x4mob from "./commands/queues/4x4mob.js";
import cmd1x1emu from "./commands/queues/1x1emu.js";
import cmd2x2emu from "./commands/queues/2x2emu.js";
import cmd3x3emu from "./commands/queues/3x3emu.js";
import cmd4x4emu from "./commands/queues/4x4emu.js";
import cmd2x2misto from "./commands/queues/2x2misto.js";
import cmd3x3misto from "./commands/queues/3x3misto.js";
import cmd4x4misto from "./commands/queues/4x4misto.js";

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ============================================================================
// CLIENTE
// ============================================================================

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.MessageContent,
    GatewayIntentBits.GuildMembers
  ],
  partials: [Partials.Channel, Partials.Message]
});

// ============================================================================
// COMANDOS
// ============================================================================

client.commands = new Collection();

const commands = new Map([
  ["1x1mob", cmd1x1mob],
  ["2x2mob", cmd2x2mob],
  ["3x3mob", cmd3x3mob],
  ["4x4mob", cmd4x4mob],
  ["1x1emu", cmd1x1emu],
  ["2x2emu", cmd2x2emu],
  ["3x3emu", cmd3x3emu],
  ["4x4emu", cmd4x4emu],
  ["2x2misto", cmd2x2misto],
  ["3x3misto", cmd3x3misto],
  ["4x4misto", cmd4x4misto],
  ["analista", cmdAnalista],
  ["collectors", cmdCollectors],
  ["controle", cmdControle],
  ["apagarwebhooks", cmdApagarWebhooks],
  ["faturamento", cmdFaturamento],
  ["fch", cmdFch],
  ["filas", cmdFilas],
  ["mediador", cmdMediador],
  ["pix", cmdPix],
  ["qrcode", cmdQrcode],
  ["rank", cmdRank],
  ["setapostas", cmdSetapostas],
  ["setmed", cmdSetmed],
  ["setthumbnail", cmdSetthumbnail],
  ["telador", cmdTelador],
  ["vt", cmdVt],
  ["vtr", cmdVtr],
  ["e", cmdEmbed]
]);

// Adicionar comandos ao client.commands
for (const [name, command] of commands) {
  client.commands.set(name, command);
}

// ============================================================================
// CARREGAR CONFIGURAÇÕES
// ============================================================================

function loadConfig() {
  try {
    const mediadorConfig = JSON.parse(fs.readFileSync("mediador_config.json", "utf8"));
    client.mediatorRole = mediadorConfig.mediatorRole;
  } catch {}

  try {
    const apostasConfig = JSON.parse(fs.readFileSync("apostas_config.json", "utf8"));
    client.apostasChannel = apostasConfig.apostasChannel;
  } catch {}

  try {
    const analistasConfig = JSON.parse(fs.readFileSync("analistas.json", "utf8"));
    client.analistaMobile = analistasConfig.mobile;
    client.analistaEmulador = analistasConfig.emulador;
    client.canalSolicitacao = analistasConfig.canalSolicitacao;
  } catch {}
}

// ============================================================================
// EVENTO: READY
// ============================================================================

client.once("ready", async () => {
  console.log(`Bot online como ${client.user.tag}`);
  
  if (!client.mediatorQueue) {
    client.mediatorQueue = [];
  }

  loadConfig();

  // ⭐ RESTAURAR TODOS OS COLLECTORS
  console.log("🔄 Restaurando collectors...");
  await restoreCollectors(client);
  console.log("✅ Todos os collectors foram restaurados!");
});

// ============================================================================
// EVENTO: MESSAGE CREATE
// ============================================================================

client.on("messageCreate", async message => {
  if (message.author.bot) return;
  if (!message.content.startsWith("!")) return;

  const args = message.content.slice(1).trim().split(/\s+/);
  const commandName = args.shift().toLowerCase();

  const command = commands.get(commandName);
  if (!command) return;

  try {
    await command.execute(message, args);
  } catch (error) {
    console.error(`Erro ao executar comando ${commandName}:`, error);
    message.reply("Ocorreu um erro ao executar este comando.").catch(() => {});
  }
});

// ============================================================================
// EVENTO: INTERACTION CREATE
// ============================================================================

client.on("interactionCreate", async interaction => {
  try {
    // Modals
    if (interaction.isModalSubmit()) {
      if (interaction.customId === "modal_chave_pix") {
        await handleMediadorModal(interaction);
      }
      if (interaction.customId === "modal_solicitar_tela") {
        await handleSolicitarTelaModal(interaction);
      }
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const customId = interaction.customId;

      // Operário (PIX)
      if (customId.startsWith("pix:")) {
        await handleOperarioButtons(interaction);
        return;
      }

      // Telador (Analistas)
      if (customId.startsWith("telador_")) {
        await handleTeladorButtons(interaction);
        return;
      }

      // Controle de mediadores
      if (customId.startsWith("controle:")) {
        const acao = customId.split(":")[1];
        await cmdControle.handleButton(interaction, acao);
        return;
      }
    }

    // Select Menus
    if (interaction.isStringSelectMenu()) {
      const customId = interaction.customId;

      // Analistas
      if (customId.startsWith("analista_select_")) {
        // Já tratado pelo collector dentro do setanalista.js
        return;
      }

      // Canal de Voz (Solicitar Tela)
      if (customId.startsWith("select_canal_voz_")) {
        await handleCanalVozSelect(interaction);
        return;
      }
    }
  } catch (error) {
    console.error("Erro ao processar interação:", error);
    
    if (!interaction.replied && !interaction.deferred) {
      interaction.reply({
        content: "Ocorreu um erro ao processar esta interação.",
        ephemeral: true
      }).catch(() => {});
    }
  }
});

// ============================================================================
// INICIAR BOT
// ============================================================================

client.login(process.env.TOKEN).catch(err => {
  console.error("Erro ao fazer login:", err);
  process.exit(1);
});