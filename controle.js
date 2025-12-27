// ============================================================================
// commands/mediator/controle.js - COM PERSISTÊNCIA
// ============================================================================

import fs from "fs";
import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { saveControleMediadores } from "../../utils/collectorManager.js";
import { registrarEntradaNaFila, registrarSaidaDaFila } from "../../utils/faturamentoSystem.js";

// Funções auxiliares para salvar/carregar fila
const FILE_FILA = "fila.json";

function salvarFila(queue) {
  fs.writeFileSync(FILE_FILA, JSON.stringify(queue, null, 2));
}

function carregarFila() {
  try {
    return JSON.parse(fs.readFileSync(FILE_FILA));
  } catch {
    return [];
  }
}

export default {
  name: "controle",
  description: "Gerencia a fila de mediadores",

  async execute(message, args) {
    if (args[0] !== "criar") {
      return message.reply("❌ Use `!controle criar` para iniciar a fila de mediadores.");
    }

    // Carregar fila persistida
    if (!message.client.mediatorQueue) {
      message.client.mediatorQueue = carregarFila();
    }

    let value;
    if (message.client.mediatorQueue.length === 0) {
      value = "Nenhum Mediador na fila.";
    } else {
      value = message.client.mediatorQueue.map((m, i) => `${i + 1}. <@${m.id}> (${m.nome})`).join("\n");
    }

    const embed = new EmbedBuilder()
      .setColor(1756756)
      .addFields({
        name: "Fila de Mediadores",
        value
      });

    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId("controle:entrarFila")
        .setLabel("Entrar na Fila")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId("controle:sairFila")
        .setLabel("Sair da Fila")
        .setStyle(ButtonStyle.Danger)
    );

    const sentMessage = await message.channel.send({ embeds: [embed], components: [row] });

    // ⭐ SALVAR COLLECTOR PARA PERSISTÊNCIA
    saveControleMediadores(sentMessage.channel.id, sentMessage.id);

    fs.writeFileSync("controle_config.json", JSON.stringify({
      channelId: sentMessage.channel.id,
      messageId: sentMessage.id
    }, null, 2));
  },

  async handleButton(interaction, acao, dados) {
    const client = interaction.client;
    let queue = client.mediatorQueue || [];

    if (acao === "entrarFila") {
      let mediadores = [];
      try {
        mediadores = JSON.parse(fs.readFileSync("mediadores.json"));
      } catch {
        mediadores = [];
      }

      const dadosMediador = mediadores.find(m => m.id === interaction.user.id);
      if (!dadosMediador) {
        return interaction.reply({
          content: "Você precisa se cadastrar com !mediador antes de entrar na fila.",
          ephemeral: true
        });
      }

      if (!queue.find(m => m.id === interaction.user.id)) {
        queue.push({
          id: dadosMediador.id,
          nome: dadosMediador.nome,
          pix: dadosMediador.pix,
          qrcode: dadosMediador.qrcode
        });
        
        // ⭐ REGISTRAR ENTRADA NA FILA (COMEÇAR A CONTAR HORAS)
        registrarEntradaNaFila(dadosMediador.id, dadosMediador.nome);

        // Salvar fila atualizada
        client.mediatorQueue = queue;
        salvarFila(queue);
      }
    }

    if (acao === "sairFila") {
      queue = queue.filter(m => m.id !== interaction.user.id);
      client.mediatorQueue = queue;
      
      // ⭐ REGISTRAR SAÍDA DA FILA (PARAR DE CONTAR HORAS)
      registrarSaidaDaFila(interaction.user.id);

      // Salvar fila atualizada
      salvarFila(queue);
    }

    let value;
    if (queue.length === 0) {
      value = "Nenhum Mediador na fila.";
    } else {
      value = queue.map((m, i) => `${i + 1}. <@${m.id}> (${m.nome})`).join("\n");
    }

    const newEmbed = new EmbedBuilder()
      .setColor(1756756)
      .addFields({ name: "Fila de Mediadores", value });

    await interaction.update({ embeds: [newEmbed], components: interaction.message.components });
  }
};