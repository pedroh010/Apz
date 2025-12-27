// ============================================================================
// src/commands/player/rank.js
// Sistema de ranking otimizado (Geral, Semanal, Mensal)
// ============================================================================

import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from "discord.js";
import operario from "../../systems/operario.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const COR_EMBED = 0xFFFFFF; // Branco

// ============================================================================
// FUNÇÕES DE RANKING
// ============================================================================

/**
 * Filtra ranking por período
 */
function filtrarPorPeriodo(ranking, periodo) {
  const agora = Date.now();
  const umaSemana = 7 * 24 * 60 * 60 * 1000;
  const umMes = 30 * 24 * 60 * 60 * 1000;

  if (periodo === "geral") {
    return ranking;
  }

  const filtrado = {};
  const limite = periodo === "semanal" ? agora - umaSemana : agora - umMes;

  for (const [userId, data] of Object.entries(ranking)) {
    const vitoriasRecentes = (data.historico || []).filter(v => v >= limite).length;
    if (vitoriasRecentes > 0) {
      filtrado[userId] = { vitorias: vitoriasRecentes };
    }
  }

  return filtrado;
}

/**
 * Gera lista formatada do top 20
 */
function gerarLista(ranking = {}, periodo = "geral") {
  const rankingFiltrado = filtrarPorPeriodo(ranking, periodo);
  
  const sorted = Object.entries(rankingFiltrado)
    .sort(([, a], [, b]) => (b.vitorias || 0) - (a.vitorias || 0))
    .slice(0, 20);

  if (!sorted.length) {
    return "Nenhum jogador ranqueado ainda.";
  }

  let lista = "";
  sorted.forEach(([id, data], idx) => {
    const pos = idx === 0 ? "1." : idx === 1 ? "2." : idx === 2 ? "3." : `${idx + 1}.`;
    lista += `${pos} <@${id}> - ${data.vitorias || 0} vitórias\n`;
  });

  return lista;
}

/**
 * Gera embed de ranking
 */
function gerarEmbed(ranking, periodo = "geral") {
  const titulos = {
    geral: "Top 20 Geral",
    semanal: "Top 20 Semanal",
    mensal: "Top 20 Mensal"
  };

  return new EmbedBuilder()
    .setTitle(titulos[periodo])
    .setDescription(gerarLista(ranking, periodo))
    .setColor(COR_EMBED);
}

/**
 * Gera botões de período
 */
function gerarBotoesPeriodo(periodoAtivo = "geral") {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("rank_geral")
      .setLabel("Geral")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(periodoAtivo === "geral"),
    new ButtonBuilder()
      .setCustomId("rank_semanal")
      .setLabel("Semanal")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(periodoAtivo === "semanal"),
    new ButtonBuilder()
      .setCustomId("rank_mensal")
      .setLabel("Mensal")
      .setStyle(ButtonStyle.Secondary)
      .setDisabled(periodoAtivo === "mensal")
  );
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "rank",
  description: "Mostra o sistema de ranking (Geral, Semanal, Mensal)",

  async execute(message) {
    const embedPrincipal = new EmbedBuilder()
      .setTitle("Ranking")
      .setDescription("Clique nos botões abaixo para ver o ranking ou seu perfil.")
      .setColor(COR_EMBED);

    const rowPrincipal = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("rank_top")
        .setLabel("Ranking")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId("rank_me")
        .setLabel("Meu Perfil")
        .setStyle(ButtonStyle.Secondary)
    );

    const sentMsg = await message.channel.send({
      embeds: [embedPrincipal],
      components: [rowPrincipal]
    });

    const collector = sentMsg.createMessageComponentCollector({ 
      time: 0
    });

    collector.on("collect", async i => {
      const ranking = operario.carregarRanking() || {};

      // Botão: Ver Ranking (abre com períodos)
      if (i.customId === "rank_top") {
        const replyMsg = await i.reply({
          embeds: [gerarEmbed(ranking, "geral")],
          components: [gerarBotoesPeriodo("geral")],
          fetchReply: true,
          flags: MessageFlags.Ephemeral
        }).catch(() => {});

        if (!replyMsg) return;

        // Collector para os botões de período (ephemeral)
        const periodoCollector = replyMsg.createMessageComponentCollector({
          time: 0
        });

        periodoCollector.on("collect", async btnI => {
          if (btnI.customId === "rank_geral" || btnI.customId === "rank_semanal" || btnI.customId === "rank_mensal") {
            const periodo = btnI.customId.replace("rank_", "");
            const rankingAtualizado = operario.carregarRanking() || {};
            
            await btnI.update({
              embeds: [gerarEmbed(rankingAtualizado, periodo)],
              components: [gerarBotoesPeriodo(periodo)]
            }).catch(() => {});
          }
        });
      }

      // Botão: Meu Perfil
      if (i.customId === "rank_me") {
        const sorted = Object.entries(ranking)
          .sort(([, a], [, b]) => (b.vitorias || 0) - (a.vitorias || 0));

        const pos = sorted.findIndex(([id]) => id === i.user.id);
        const vitorias = ranking[i.user.id]?.vitorias || 0;

        let posicaoTexto;
        if (pos === -1) {
          posicaoTexto = "#0";
        } else if (pos === 0) {
          posicaoTexto = "1º";
        } else if (pos === 1) {
          posicaoTexto = "2º";
        } else if (pos === 2) {
          posicaoTexto = "3º";
        } else {
          posicaoTexto = `${pos + 1}º`;
        }

        const embedPerfil = new EmbedBuilder()
          .setTitle("Meu Perfil")
          .setColor(COR_EMBED)
          .setThumbnail(i.user.displayAvatarURL({ extension: "png" }))
          .addFields(
            { name: "Vitórias:", value: `${vitorias}`, inline: true },
            { name: "Posição no Ranking:", value: posicaoTexto, inline: true }
          );

        return i.reply({
          embeds: [embedPerfil],
          flags: MessageFlags.Ephemeral
        }).catch(() => {});
      }
    });
  }
};