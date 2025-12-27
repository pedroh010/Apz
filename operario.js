// ============================================================================
// systems/operario.js - COM PERSISTÊNCIA
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  AttachmentBuilder,
  MessageFlags,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelType
} from "discord.js";
import QRCode from "qrcode";
import { saveThreadVitoria, deleteCollector } from "../utils/collectorManager.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const RANKING_FILE = "ranking.json";
const REGEX_PIX = /^(\d{11}|\d{14}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,})$/i;
const chavesRegistradas = new Set();

const CATEGORIA_VOZ_ID = "1449887843873722502";

setInterval(() => {
  chavesRegistradas.clear();
}, 10 * 60 * 1000);

// ============================================================================
// RANKING
// ============================================================================

function carregarRanking() {
  try {
    return JSON.parse(fs.readFileSync(RANKING_FILE, "utf8"));
  } catch {
    return {};
  }
}

function salvarRanking(ranking) {
  try {
    fs.writeFileSync(RANKING_FILE, JSON.stringify(ranking, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[Operario] Erro ao salvar ranking:", err.message);
    return false;
  }
}

function atualizarRanking(userId) {
  const ranking = carregarRanking();
  const agora = Date.now();
  
  if (!ranking[userId]) {
    ranking[userId] = { 
      vitorias: 0,
      historico: []
    };
  }
  
  ranking[userId].vitorias++;
  
  if (!ranking[userId].historico) {
    ranking[userId].historico = [];
  }
  ranking[userId].historico.push(agora);
  
  salvarRanking(ranking);
  
  console.log(`[Operario] Vitória registrada: ${userId} (total: ${ranking[userId].vitorias})`);
  return ranking[userId].vitorias;
}

// ============================================================================
// QR CODE
// ============================================================================

function validarPix(chave) {
  return REGEX_PIX.test(chave);
}

function gerarPayloadPix(chave) {
  return `00020126580014BR.GOV.BCB.PIX0136${chave}5204000053039865802BR5920Recebedor6009SAO PAULO62070503***6304`;
}

async function gerarQRCode(chave) {
  try {
    const payload = gerarPayloadPix(chave);
    return await QRCode.toBuffer(payload);
  } catch (err) {
    console.error("[Operario] Erro ao gerar QR Code:", err.message);
    throw err;
  }
}

// ============================================================================
// HANDLER DE BOTÕES
// ============================================================================

export async function handleOperarioButtons(interaction) {
  const { customId, channel } = interaction;

  if (!channel.isThread()) return;

  // FINALIZAR THREAD
  if (customId === "pix:finalizar") {
    await interaction.deferUpdate().catch(() => {});

    const mediadorId = channel.mediadorId;
    if (!mediadorId || interaction.user.id !== mediadorId) {
      return interaction.followUp({
        content: "❌ Somente o mediador pode finalizar.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }

    try {
      await interaction.followUp({
        content: "✅ Fechando fila.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
      
      // ⭐ REMOVER TODOS OS COLLECTORS DA THREAD
      const messages = await channel.messages.fetch({ limit: 50 });
      messages.forEach(msg => {
        if (msg.components.length > 0) {
          deleteCollector(msg.id);
        }
      });
      
      await channel.delete();
    } catch (err) {
      console.error("[Operario] Erro ao finalizar:", err.message);
      await interaction.followUp({
        content: "❌ Erro ao encerrar thread.",
        flags: MessageFlags.Ephemeral
      }).catch(() => {});
    }
    return;
  }

  // GERAR QR CODE
  if (customId.startsWith("pix:qr:")) {
    await interaction.deferReply({ flags: MessageFlags.Ephemeral }).catch(() => {});

    try {
      const chave = customId.split(":").slice(2).join(":");
      const buffer = await gerarQRCode(chave);
      const attachment = new AttachmentBuilder(buffer, { name: "pix.png" });

      const embed = new EmbedBuilder()
        .setTitle("Chave PIX do Vencedor")
        .setColor(0xFFFFFF)
        .setImage("attachment://pix.png");

      await interaction.editReply({ embeds: [embed], files: [attachment] }).catch(() => {});
    } catch (error) {
      console.error("[Operario] Erro ao gerar QR:", error);
      await interaction.editReply({ 
        content: "❌ Não foi possível gerar o QR Code." 
      }).catch(() => {});
    }
    return;
  }

  // SOLICITAR TELA
  if (customId === "pix:solicitar_tela") {
    const jogadores = channel.jogadores || [];
    const vencedorId = channel.vencedorId;
    
    if (!vencedorId) {
      return interaction.reply({
        content: "❌ Não foi possível identificar o vencedor desta sala.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (interaction.user.id === vencedorId) {
      return interaction.reply({
        content: "❌ Você não pode solicitar análise, pois não é o perdedor desta sala.",
        flags: MessageFlags.Ephemeral
      });
    }

    if (!jogadores.includes(interaction.user.id)) {
      return interaction.reply({
        content: "❌ Você não participa desta sala.",
        flags: MessageFlags.Ephemeral
      });
    }

    const modal = new ModalBuilder()
      .setCustomId("modal_solicitar_tela")
      .setTitle("Solicitar Análise de Tela");

    const nickInput = new TextInputBuilder()
      .setCustomId("nick_jogador")
      .setLabel("Nick do Jogador")
      .setPlaceholder("Digite o nick do jogador...")
      .setStyle(TextInputStyle.Short)
      .setRequired(true);

    const motivoInput = new TextInputBuilder()
      .setCustomId("motivo")
      .setLabel("Motivo")
      .setPlaceholder("Descreva o motivo da solicitação...")
      .setStyle(TextInputStyle.Paragraph)
      .setRequired(true);

    const row1 = new ActionRowBuilder().addComponents(nickInput);
    const row2 = new ActionRowBuilder().addComponents(motivoInput);

    modal.addComponents(row1, row2);

    await interaction.showModal(modal);
  }
}

// ============================================================================
// HANDLER DE MODAL
// ============================================================================

export async function handleSolicitarTelaModal(interaction) {
  if (interaction.customId !== "modal_solicitar_tela") return;

  const nick = interaction.fields.getTextInputValue("nick_jogador");
  const motivo = interaction.fields.getTextInputValue("motivo");

  const canaisVoz = interaction.guild.channels.cache
    .filter(ch => 
      ch.type === ChannelType.GuildVoice && 
      ch.parentId === CATEGORIA_VOZ_ID
    )
    .map(ch => 
      new StringSelectMenuOptionBuilder()
        .setLabel(ch.name)
        .setValue(ch.id)
    );

  if (canaisVoz.length === 0) {
    return interaction.reply({
      content: "❌ Nenhum canal de voz disponível na categoria configurada.",
      ephemeral: true
    });
  }

  const selectVoz = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId(`select_canal_voz_${nick}_${interaction.user.id}`)
      .setPlaceholder("Selecione o canal de voz")
      .addOptions(canaisVoz.slice(0, 25))
  );

  interaction.client.solicitacoesTela = interaction.client.solicitacoesTela || new Map();
  interaction.client.solicitacoesTela.set(interaction.user.id, {
    nick,
    motivo,
    solicitante: interaction.user.id,
    threadId: interaction.channel.id
  });

  await interaction.reply({
    content: "**Selecione o canal de voz onde o jogador deve entrar:**",
    components: [selectVoz],
    ephemeral: true
  });
}

// ============================================================================
// HANDLER DE SELECT MENU
// ============================================================================

export async function handleCanalVozSelect(interaction) {
  if (!interaction.customId.startsWith("select_canal_voz_")) return;

  await interaction.deferUpdate();

  const canalId = interaction.values[0];
  const canal = interaction.guild.channels.cache.get(canalId);

  if (!canal) {
    return interaction.followUp({
      content: "❌ Canal não encontrado.",
      ephemeral: true
    });
  }

  const dados = interaction.client.solicitacoesTela?.get(interaction.user.id);

  if (!dados) {
    return interaction.followUp({
      content: "❌ Dados da solicitação não encontrados.",
      ephemeral: true
    });
  }

  const thread = interaction.guild.channels.cache.get(dados.threadId);

  if (!thread) {
    return interaction.followUp({
      content: "❌ Thread não encontrada.",
      ephemeral: true
    });
  }

  const embed1 = new EmbedBuilder()
    .setDescription(
      `### Análise Solicitada\n` +
      `**Nick do Jogador:** ${dados.nick}\n` +
      `**Motivo:**\n\`\`\`${dados.motivo}\`\`\``
    )
    .setColor(0xFFFFFF)
    .setFooter({ 
      text: `Solicitado por: ${interaction.user.username} | ${interaction.user.id}` 
    });

  const embed2 = new EmbedBuilder()
    .setDescription(
      `O **${dados.nick}** tem 5 minutos para entrar na <#${canalId}>.\n` +
      `**OBS:** Caso não consiga entrar no tempo estipulado, informe o motivo.`
    )
    .setColor(0xFFD966);

  await thread.send({ embeds: [embed1, embed2] });

  const mensagemVitoria = await thread.messages.fetch({ limit: 10 }).then(msgs => 
    msgs.find(m => 
      m.author.id === interaction.client.user.id && 
      m.embeds.length > 0 && 
      m.embeds[0].description?.includes("Vitória Adicionada")
    )
  );

  if (mensagemVitoria && mensagemVitoria.components.length > 0) {
    const row = ActionRowBuilder.from(mensagemVitoria.components[0]);
    
    row.components.forEach(btn => {
      if (btn.data.custom_id === "pix:solicitar_tela") {
        btn.setDisabled(true);
      }
    });

    await mensagemVitoria.edit({ components: [row] }).catch(() => {});
  }

  await interaction.followUp({
    content: `✅ Solicitação de tela enviada para <#${canalId}>!`,
    ephemeral: true
  });

  interaction.client.solicitacoesTela.delete(interaction.user.id);
}

// ============================================================================
// MONITORAR THREAD
// ============================================================================

async function monitorarThread(thread, jogadores) {
  console.log(`[Operario] Monitorando thread ${thread.name}`);

  const collector = thread.createMessageCollector({ 
    time: 0,
    filter: m => !m.author.bot
  });

  collector.on("collect", async msg => {
    if (msg.author.bot) return;

    const chave = msg.content.trim();

    if (!validarPix(chave)) return;

    const chaveUnica = `${thread.id}:${chave}`;
    if (chavesRegistradas.has(chaveUnica)) {
      console.log("[Operario] Chave PIX duplicada ignorada");
      return;
    }
    chavesRegistradas.add(chaveUnica);

    const vencedorId = msg.author.id;
    const perdedorId = jogadores.find(j => j !== vencedorId);

    if (!perdedorId) {
      console.error("[Operario] Perdedor não identificado");
      return;
    }

    thread.vencedorId = vencedorId;

    atualizarRanking(vencedorId);

    const ranking = carregarRanking();
    const vitorias = ranking[vencedorId]?.vitorias || 0;
    const perdedorVitorias = ranking[perdedorId]?.vitorias || 0;

    const embed = new EmbedBuilder()
      .setDescription(
        `### Vitória Adicionada!\n\n` +
        `<@${vencedorId}> (${vitorias} vitórias) +1\n` +
        `<@${perdedorId}> (${perdedorVitorias} vitórias)\n\n` +
        `-# O jogador <@${perdedorId}> pode solicitar análise em 2 minutos.`
      )
      .setColor(0xFBBD1A)
      .setThumbnail(msg.author.displayAvatarURL({ format: "png" }));

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("pix:finalizar")
        .setLabel("Finalizar")
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId("pix:solicitar_tela")
        .setLabel("Solicitar Tela")
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`pix:qr:${chave}`)
        .setLabel("QR Code")
        .setStyle(ButtonStyle.Secondary)
    );

    const vitoriaMsg = await thread.send({ embeds: [embed], components: [row] });
    
    // ⭐ SALVAR COLLECTOR DE VITÓRIA
    saveThreadVitoria(thread.id, vitoriaMsg.id, thread.id, { id: thread.mediadorId });

    collector.stop("vitoria_detectada");
  });

  collector.on("end", (collected, reason) => {
    console.log(`[Operario] Collector encerrado: ${reason}`);
  });
}

// ============================================================================
// EXPORTAÇÃO
// ============================================================================

export default {
  name: "operario",
  description: "Sistema de vitórias automático",
  carregarRanking,
  salvarRanking,
  atualizarRanking,
  monitorarThread
};