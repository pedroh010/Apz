// ============================================================================
// src/commands/mediator/mediador.js
// Sistema de cadastro de mediador com modais e botões
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ModalBuilder,
  TextInputBuilder,
  TextInputStyle,
  MessageFlags
} from "discord.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const COR_EMBED = 0xF8F8F0;
const MEDIADORES_FILE = "mediadores.json";

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

function carregarMediadores() {
  try {
    return JSON.parse(fs.readFileSync(MEDIADORES_FILE, "utf8"));
  } catch {
    return [];
  }
}

function salvarMediadores(mediadores) {
  fs.writeFileSync(MEDIADORES_FILE, JSON.stringify(mediadores, null, 2));
}

function getMediadorData(userId) {
  const mediadores = carregarMediadores();
  return mediadores.find(m => m.id === userId) || null;
}

function atualizarMediador(userId, dados) {
  const mediadores = carregarMediadores();
  const index = mediadores.findIndex(m => m.id === userId);
  
  if (index !== -1) {
    mediadores[index] = { ...mediadores[index], ...dados, id: userId };
  } else {
    mediadores.push({ id: userId, ...dados });
  }
  
  salvarMediadores(mediadores);
}

// ============================================================================
// EMBEDS
// ============================================================================

function criarEmbedPrincipal(user) {
  const mediador = getMediadorData(user.id);
  
  const nomePix = mediador?.nome || "Não Definido";
  const chavePix = mediador?.pix || "Não definido";
  const qrCode = mediador?.qrcode || "Não Definido";
  
  return new EmbedBuilder()
    .setTitle("Mediador")
    .setDescription(`**Informações de <@${user.id}>**\n> Você pode configurar o pix e o qr-code interagindo com os botões abaixo.`)
    .setColor(COR_EMBED)
    .addFields(
      { name: "Nome Pix", value: nomePix },
      { name: "Chave Pix", value: chavePix },
      { name: "Qr Code", value: qrCode }
    );
}

function criarEmbedQRCode(user) {
  const mediador = getMediadorData(user.id);
  const qrcode = mediador?.qrcode;
  
  const embed = new EmbedBuilder()
    .setTitle("QR Code")
    .setDescription(`**Informações de <@${user.id}>**\n> Gerencie seu QR Code usando os botões abaixo.`)
    .setColor(COR_EMBED);
  
  if (qrcode && qrcode !== "Não Definido") {
    embed.setImage(qrcode);
  } else {
    embed.addFields({ name: "Status", value: "Nenhum QR Code cadastrado" });
  }
  
  return embed;
}

// ============================================================================
// BOTÕES
// ============================================================================

function criarBotoesPrincipais() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mediador_chave_pix")
      .setLabel("Chave Pix")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("mediador_qr_code")
      .setLabel("QR Code")
      .setStyle(ButtonStyle.Secondary)
  );
}

function criarBotoesQRCode() {
  return new ActionRowBuilder().addComponents(
    new ButtonBuilder()
      .setCustomId("mediador_qr_enviar")
      .setLabel("QR Code")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("mediador_qr_home")
      .setLabel("Home")
      .setStyle(ButtonStyle.Secondary),
    new ButtonBuilder()
      .setCustomId("mediador_qr_deletar")
      .setLabel("Deletar")
      .setStyle(ButtonStyle.Secondary)
  );
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "mediador",
  description: "Cadastro e gerenciamento de mediador",

  async execute(message) {
    // Verificar cargo de mediador
    let config;
    try {
      config = JSON.parse(fs.readFileSync("mediador_config.json"));
    } catch {
      return message.reply("Nenhum cargo de Mediador foi definido. Use !setmed primeiro.");
    }

    if (!message.member.roles.cache.has(config.mediatorRole)) {
      return message.reply("Você não possui o cargo de Mediador.");
    }

    const embed = criarEmbedPrincipal(message.author);
    const row = criarBotoesPrincipais();

    const sentMsg = await message.channel.send({
      embeds: [embed],
      components: [row]
    });

    // Collector para os botões
    const collector = sentMsg.createMessageComponentCollector({ time: 0 });

    collector.on("collect", async i => {
      // Verificar se é o autor
      if (i.user.id !== message.author.id) {
        return i.reply({
          content: "Apenas quem usou o comando pode interagir com os botões.",
          flags: MessageFlags.Ephemeral
        });
      }

      // Botão: Chave Pix (abre modal)
      if (i.customId === "mediador_chave_pix") {
        const modal = new ModalBuilder()
          .setCustomId("modal_chave_pix")
          .setTitle("Cadastrar Chave PIX");

        const mediador = getMediadorData(i.user.id);

        const chavePix = new TextInputBuilder()
          .setCustomId("input_chave_pix")
          .setLabel("Chave PIX")
          .setPlaceholder("CPF, Email, Telefone ou Chave Aleatória")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        if (mediador?.pix) {
          chavePix.setValue(mediador.pix);
        }

        const nomeCompleto = new TextInputBuilder()
          .setCustomId("input_nome_completo")
          .setLabel("Nome Completo")
          .setPlaceholder("Ex: João Silva")
          .setStyle(TextInputStyle.Short)
          .setRequired(true);

        if (mediador?.nome) {
          nomeCompleto.setValue(mediador.nome);
        }

        const row1 = new ActionRowBuilder().addComponents(chavePix);
        const row2 = new ActionRowBuilder().addComponents(nomeCompleto);

        modal.addComponents(row1, row2);

        await i.showModal(modal);
      }

      // Botão: QR Code (muda para tela de QR Code)
      if (i.customId === "mediador_qr_code") {
        const embedQR = criarEmbedQRCode(i.user);
        const rowQR = criarBotoesQRCode();

        await i.update({
          embeds: [embedQR],
          components: [rowQR]
        });
      }

      // Botão: Enviar QR Code
      if (i.customId === "mediador_qr_enviar") {
        await i.reply({
          content: "Envie a imagem do qrcode no chat",
          flags: MessageFlags.Ephemeral
        });

        // Criar collector para aguardar imagem
        const msgCollector = message.channel.createMessageCollector({
          filter: m => m.author.id === i.user.id,
          time: 60000,
          max: 1
        });

        msgCollector.on("collect", async msg => {
          const attachment = msg.attachments.first();

          if (!attachment || !attachment.contentType?.startsWith("image/")) {
            return msg.reply("Você precisa enviar uma imagem válida.");
          }

          // Salvar URL da imagem
          atualizarMediador(i.user.id, { qrcode: attachment.url });

          // Atualizar embed
          const embedAtualizado = criarEmbedQRCode(i.user);
          await sentMsg.edit({
            embeds: [embedAtualizado],
            components: [criarBotoesQRCode()]
          });

          await msg.reply("QR Code atualizado com sucesso!");

          // Deletar mensagens após 5 segundos
          setTimeout(async () => {
            try {
              await msg.delete();
            } catch {}
          }, 5000);
        });

        msgCollector.on("end", (collected, reason) => {
          if (reason === "time") {
            i.followUp({
              content: "Tempo esgotado. Use o botão novamente para enviar o QR Code.",
              flags: MessageFlags.Ephemeral
            });
          }
        });
      }

      // Botão: Home (volta para tela principal)
      if (i.customId === "mediador_qr_home") {
        const embedPrincipal = criarEmbedPrincipal(i.user);
        const rowPrincipal = criarBotoesPrincipais();

        await i.update({
          embeds: [embedPrincipal],
          components: [rowPrincipal]
        });
      }

      // Botão: Deletar QR Code
      if (i.customId === "mediador_qr_deletar") {
        atualizarMediador(i.user.id, { qrcode: "Não Definido" });

        const embedAtualizado = criarEmbedQRCode(i.user);
        await i.update({
          embeds: [embedAtualizado],
          components: [criarBotoesQRCode()]
        });

        await i.followUp({
          content: "QR Code deletado com sucesso!",
          flags: MessageFlags.Ephemeral
        });
      }
    });
  }
};

// ============================================================================
// HANDLER DE MODAL (adicionar no index.js)
// ============================================================================

export async function handleMediadorModal(interaction) {
  if (interaction.customId === "modal_chave_pix") {
    const chavePix = interaction.fields.getTextInputValue("input_chave_pix");
    const nomeCompleto = interaction.fields.getTextInputValue("input_nome_completo");

    // Salvar dados
    atualizarMediador(interaction.user.id, {
      pix: chavePix,
      nome: nomeCompleto
    });

    await interaction.reply({
      content: "Dados salvos com sucesso!",
      flags: MessageFlags.Ephemeral
    });

    // Atualizar embed original
    const embedAtualizado = criarEmbedPrincipal(interaction.user);
    await interaction.message.edit({
      embeds: [embedAtualizado],
      components: [criarBotoesPrincipais()]
    });
  }
}