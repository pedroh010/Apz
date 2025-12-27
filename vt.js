// ============================================================================
// 📁 src/commands/mediator/vt.js
// Dar vitória manual (SEM PONTOS)
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from "discord.js";
import operario from "../../systems/operario.js";
import { CONFIG } from "../../utils/constants.js";

function getMediatorRole(client) {
  if (client.mediatorRole) return client.mediatorRole;
  try {
    const data = JSON.parse(fs.readFileSync(CONFIG.ARQUIVOS.MEDIADOR_CONFIG, "utf8"));
    return data.mediatorRole;
  } catch {
    return null;
  }
}

export default {
  name: "vt",
  description: "Dar vitória manual a um jogador (SEM PONTOS - SÓ VITÓRIAS)",

  async execute(message, args) {
    const mediatorRole = getMediatorRole(message.client);
    
    if (!mediatorRole || !message.member.roles.cache.has(mediatorRole)) {
      return message.reply("❌ Apenas mediadores podem usar este comando.");
    }

    const user = message.mentions.users.first();
    if (!user) {
      return message.reply("❌ Você precisa mencionar um jogador.\n**Exemplo:** `!vt @jogador`");
    }

    // Atualiza ranking (SÓ VITÓRIAS)
    await operario.atualizarRanking(user.id);

    // Busca total de vitórias
    const ranking = operario.carregarRanking();
    const vitorias = ranking[user.id]?.vitorias || 0;

    const embed = new EmbedBuilder()
      .setDescription(
        `### Vitória Adicionada!\n\n` +
        `<@${user.id}> agora tem **${vitorias} vitórias** +1\n\n` +
        `-# O jogador poderá solicitar análise em até 2 minutos.`
      )
      .setColor(CONFIG.CORES.VITORIA)
      .setThumbnail(user.displayAvatarURL({ extension: "png" }));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("manual_finalizar")
        .setLabel("Finalizar")
        .setStyle(ButtonStyle.Danger)
    );

    const sentMsg = await message.channel.send({ embeds: [embed], components: [row] });

    const collector = sentMsg.createMessageComponentCollector({ time: 0 });
    
    collector.on("collect", async i => {
      await i.deferUpdate().catch(() => {});

      if (!i.member.roles.cache.has(mediatorRole)) {
        return i.followUp({ 
          content: "❌ Somente mediadores podem finalizar.", 
          flags: MessageFlags.Ephemeral 
        }).catch(() => {});
      }

      try {
        if (message.channel.isThread()) {
          await message.channel.delete(); // Fecha a thread
        } else {
          await sentMsg.delete(); // Apaga a mensagem
          await i.followUp({ 
            content: "✅ Fila encerrada pelo mediador.", 
            flags: MessageFlags.Ephemeral 
          }).catch(() => {});
        }
      } catch (err) {
        console.error("[vt] Erro ao fechar fila:", err);
        await i.followUp({ 
          content: "❌ Não foi possível fechar a fila.", 
          flags: MessageFlags.Ephemeral 
        }).catch(() => {});
      }
    });
  }
};