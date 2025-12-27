// ============================================================================
// commands/admin/collectors.js
// Comando de debug para ver e gerenciar collectors ativos
// ============================================================================

import fs from "fs";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

const COLLECTORS_FILE = "active_collectors.json";

export default {
  name: "collectors",
  description: "Ver e gerenciar collectors ativos",

  async execute(message, args) {
    // Verificar se é admin
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ Apenas administradores podem usar este comando.");
    }

    const subcomando = args[0]?.toLowerCase();

    // !collectors listar
    if (!subcomando || subcomando === "listar" || subcomando === "list") {
      await listarCollectors(message);
      return;
    }

    // !collectors limpar
    if (subcomando === "limpar" || subcomando === "clear") {
      await limparCollectors(message);
      return;
    }

    // !collectors stats
    if (subcomando === "stats") {
      await mostrarStats(message);
      return;
    }

    // !collectors remover <messageId>
    if (subcomando === "remover" || subcomando === "remove") {
      const messageId = args[1];
      if (!messageId) {
        return message.reply("❌ Uso: `!collectors remover <messageId>`");
      }
      await removerCollector(message, messageId);
      return;
    }

    message.reply(
      "❌ **Comandos disponíveis:**\n" +
      "`!collectors listar` - Lista todos os collectors\n" +
      "`!collectors stats` - Mostra estatísticas\n" +
      "`!collectors limpar` - Remove collectors antigos\n" +
      "`!collectors remover <id>` - Remove collector específico"
    );
  }
};

// ============================================================================
// LISTAR COLLECTORS
// ============================================================================

async function listarCollectors(message) {
  try {
    if (!fs.existsSync(COLLECTORS_FILE)) {
      return message.reply("✅ Nenhum collector ativo no momento.");
    }

    const collectors = JSON.parse(fs.readFileSync(COLLECTORS_FILE, "utf8"));

    if (collectors.length === 0) {
      return message.reply("✅ Nenhum collector ativo no momento.");
    }

    // Agrupar por tipo
    const porTipo = {};
    collectors.forEach(c => {
      if (!porTipo[c.type]) porTipo[c.type] = [];
      porTipo[c.type].push(c);
    });

    let descricao = "";
    
    for (const [tipo, lista] of Object.entries(porTipo)) {
      descricao += `\n**${tipo}** (${lista.length})\n`;
      
      lista.slice(0, 5).forEach(c => {
        const idade = Math.floor((Date.now() - c.timestamp) / 1000 / 60);
        descricao += `\`${c.messageId.slice(0, 8)}...\` - ${idade}min atrás\n`;
      });

      if (lista.length > 5) {
        descricao += `...e mais ${lista.length - 5}\n`;
      }
    }

    const embed = new EmbedBuilder()
      .setTitle("📊 Collectors Ativos")
      .setDescription(descricao || "Nenhum collector ativo.")
      .setColor(0x5865F2)
      .setFooter({ text: `Total: ${collectors.length} collectors` });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("collectors_refresh")
        .setLabel("Atualizar")
        .setStyle(ButtonStyle.Primary),
      new ButtonBuilder()
        .setCustomId("collectors_cleanup")
        .setLabel("Limpar Antigos")
        .setStyle(ButtonStyle.Secondary)
    );

    const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

    // Collector para os botões
    const collector = sentMsg.createMessageComponentCollector({ 
      time: 60000,
      filter: i => i.user.id === message.author.id
    });

    collector.on("collect", async i => {
      if (i.customId === "collectors_refresh") {
        await i.deferUpdate();
        await listarCollectors(message);
        await sentMsg.delete().catch(() => {});
      }

      if (i.customId === "collectors_cleanup") {
        await i.deferUpdate();
        await limparCollectors(message);
        await sentMsg.delete().catch(() => {});
      }
    });

    collector.on("end", () => {
      sentMsg.edit({ components: [] }).catch(() => {});
    });

  } catch (err) {
    console.error("[Collectors] Erro ao listar:", err);
    message.reply("❌ Erro ao listar collectors.");
  }
}

// ============================================================================
// MOSTRAR ESTATÍSTICAS
// ============================================================================

async function mostrarStats(message) {
  try {
    if (!fs.existsSync(COLLECTORS_FILE)) {
      return message.reply("✅ Nenhum collector ativo no momento.");
    }

    const collectors = JSON.parse(fs.readFileSync(COLLECTORS_FILE, "utf8"));

    // Contar por tipo
    const porTipo = {};
    collectors.forEach(c => {
      porTipo[c.type] = (porTipo[c.type] || 0) + 1;
    });

    // Calcular idade média
    const agora = Date.now();
    const idades = collectors.map(c => agora - c.timestamp);
    const idadeMedia = idades.reduce((a, b) => a + b, 0) / idades.length;
    const idadeMediaMin = Math.floor(idadeMedia / 1000 / 60);

    // Encontrar mais antigo
    const maisAntigo = Math.max(...idades);
    const maisAntigoMin = Math.floor(maisAntigo / 1000 / 60);

    // Montar descrição
    let descricao = `**Total:** ${collectors.length} collectors\n`;
    descricao += `**Idade Média:** ${idadeMediaMin} minutos\n`;
    descricao += `**Mais Antigo:** ${maisAntigoMin} minutos\n\n`;
    descricao += `**Por Tipo:**\n`;

    for (const [tipo, count] of Object.entries(porTipo)) {
      descricao += `• ${tipo}: ${count}\n`;
    }

    const embed = new EmbedBuilder()
      .setTitle("📈 Estatísticas de Collectors")
      .setDescription(descricao)
      .setColor(0x57F287)
      .setTimestamp();

    await message.channel.send({ embeds: [embed] });

  } catch (err) {
    console.error("[Collectors] Erro ao mostrar stats:", err);
    message.reply("❌ Erro ao mostrar estatísticas.");
  }
}

// ============================================================================
// LIMPAR COLLECTORS
// ============================================================================

async function limparCollectors(message) {
  try {
    if (!fs.existsSync(COLLECTORS_FILE)) {
      return message.reply("✅ Nenhum collector para limpar.");
    }

    let collectors = JSON.parse(fs.readFileSync(COLLECTORS_FILE, "utf8"));
    const before = collectors.length;

    // Remove collectors com mais de 7 dias
    const sevenDaysAgo = Date.now() - (7 * 24 * 60 * 60 * 1000);
    collectors = collectors.filter(c => c.timestamp > sevenDaysAgo);

    const after = collectors.length;
    const removidos = before - after;

    fs.writeFileSync(COLLECTORS_FILE, JSON.stringify(collectors, null, 2));

    if (removidos === 0) {
      return message.reply("✅ Nenhum collector antigo encontrado.");
    }

    const embed = new EmbedBuilder()
      .setTitle("🧹 Limpeza Concluída")
      .setDescription(
        `${removidos} collector(s) removido(s)\n` +
        `${after} collector(s) restante(s)`
      )
      .setColor(0x57F287);

    await message.channel.send({ embeds: [embed] });

  } catch (err) {
    console.error("[Collectors] Erro ao limpar:", err);
    message.reply("❌ Erro ao limpar collectors.");
  }
}

// ============================================================================
// REMOVER COLLECTOR ESPECÍFICO
// ============================================================================

async function removerCollector(message, messageId) {
  try {
    if (!fs.existsSync(COLLECTORS_FILE)) {
      return message.reply("❌ Nenhum collector encontrado.");
    }

    let collectors = JSON.parse(fs.readFileSync(COLLECTORS_FILE, "utf8"));
    const before = collectors.length;

    collectors = collectors.filter(c => c.messageId !== messageId);
    const after = collectors.length;

    if (before === after) {
      return message.reply(`❌ Collector \`${messageId}\` não encontrado.`);
    }

    fs.writeFileSync(COLLECTORS_FILE, JSON.stringify(collectors, null, 2));

    await message.reply(`✅ Collector \`${messageId}\` removido com sucesso.`);

  } catch (err) {
    console.error("[Collectors] Erro ao remover:", err);
    message.reply("❌ Erro ao remover collector.");
  }
}