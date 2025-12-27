// ============================================================================
// commands/mediator/telador.js
// Sistema de solicitação de analistas (Mobile e Emulador)
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  MessageFlags
} from "discord.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

function getMediatorRole(client) {
  if (client.mediatorRole) return client.mediatorRole;
  try {
    const data = JSON.parse(fs.readFileSync("mediador_config.json", "utf8"));
    return data.mediatorRole;
  } catch {
    return null;
  }
}

function getAnalistasConfig() {
  try {
    return JSON.parse(fs.readFileSync("analistas.json", "utf8"));
  } catch {
    return {
      mobile: null,
      emulador: null,
      canalSolicitacao: null
    };
  }
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "telador",
  description: "Solicitar analista para a fila (mob ou emu)",

  async execute(message, args) {
    // Verificar se é mediador
    const mediatorRole = getMediatorRole(message.client);
    
    if (!mediatorRole || !message.member.roles.cache.has(mediatorRole)) {
      return message.reply("❌ Apenas mediadores podem usar este comando.");
    }

    // Verificar se está em uma thread
    if (!message.channel.isThread()) {
      return message.reply("❌ Este comando só pode ser usado dentro de uma fila (thread).");
    }

    // Verificar argumento (mob ou emu)
    if (args.length === 0) {
      return message.reply("❌ **Uso correto:**\n`!telador mob` - Solicitar Analista Mobile\n`!telador emu` - Solicitar Analista Emulador");
    }

    const tipo = args[0].toLowerCase();
    
    if (tipo !== "mob" && tipo !== "emu") {
      return message.reply("❌ **Tipo inválido!**\nUse: `!telador mob` ou `!telador emu`");
    }

    // Carregar configurações
    const config = getAnalistasConfig();
    
    if (!config.canalSolicitacao) {
      return message.reply("❌ Nenhum canal de solicitação foi configurado. Use `!analista` para configurar.");
    }

    // Buscar canal de solicitação
    const canalSolicitacao = message.client.channels.cache.get(config.canalSolicitacao);
    
    if (!canalSolicitacao) {
      return message.reply("❌ Canal de solicitação não encontrado.");
    }

    // Verificar se cargo de analista existe
    const cargoAnalista = tipo === "mob" ? config.mobile : config.emulador;
    
    if (!cargoAnalista) {
      return message.reply(`❌ Cargo de Analista ${tipo === "mob" ? "Mobile" : "Emulador"} não foi configurado.`);
    }

    // Confirmar para o mediador
    await message.reply("✅ Solicitação enviada. Aguarde!");

    // Criar embed de solicitação
    const tipoTexto = tipo === "mob" ? "Mobile" : "Emulador";
    
    const embed = new EmbedBuilder()
      .setColor(0xFFD274) // 16774388 em hex
      .addFields({
        name: "Solicitação de análise",
        value: `O <@${message.author.id}> está solicitando um Analista ${tipoTexto}`
      });

    // Criar botões
    const row = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`telador_aceitar_${tipo}_${message.channel.id}_${message.author.id}`)
        .setLabel("Aceitar")
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`telador_recusar_${tipo}_${message.channel.id}_${message.author.id}`)
        .setLabel("Recusar")
        .setStyle(ButtonStyle.Danger)
    );

    // Enviar no canal de solicitação
    const solicitacaoMsg = await canalSolicitacao.send({
      content: `<@&${cargoAnalista}>`, // Mencionar cargo
      embeds: [embed],
      components: [row]
    });

    // Armazenar dados da solicitação na mensagem
    solicitacaoMsg.solicitacaoData = {
      threadId: message.channel.id,
      mediadorId: message.author.id,
      tipo: tipo,
      timestamp: Date.now()
    };
  }
};

// ============================================================================
// HANDLER DE BOTÕES (adicionar no index.js)
// ============================================================================

export async function handleTeladorButtons(interaction) {
  const [acao, tipo, threadId, mediadorId] = interaction.customId.split("_").slice(1);

  await interaction.deferUpdate();

  const thread = interaction.client.channels.cache.get(threadId);
  
  if (!thread) {
    return interaction.followUp({
      content: "❌ A fila não existe mais.",
      flags: MessageFlags.Ephemeral
    });
  }

  // ACEITAR
  if (acao === "aceitar") {
    const analistaId = interaction.user.id;
    const analistaNome = interaction.user.username;
    const tipoTexto = tipo === "mob" ? "Mobile" : "Emulador";

    // Adicionar analista à thread
    try {
      await thread.members.add(analistaId);
    } catch (err) {
      console.error("[Telador] Erro ao adicionar analista:", err.message);
    }

    // Notificar na thread
    await thread.send(`✅ **Analista ${tipoTexto} chegou!**\n<@${analistaId}> (${analistaNome}) aceitou a solicitação.`);

    // Atualizar embed da solicitação
    const embedAtualizado = new EmbedBuilder()
      .setColor(0x57F287) // Verde
      .addFields({
        name: "✅ Solicitação aceita",
        value: `<@${analistaId}> aceitou a análise de <@${mediadorId}>\nTipo: Analista ${tipoTexto}`
      });

    await interaction.message.edit({
      embeds: [embedAtualizado],
      components: [] // Remove botões
    });

    await interaction.followUp({
      content: `✅ Você foi adicionado à fila!`,
      flags: MessageFlags.Ephemeral
    });
  }

  // RECUSAR
  if (acao === "recusar") {
    const tipoTexto = tipo === "mob" ? "Mobile" : "Emulador";

    // Atualizar embed da solicitação
    const embedAtualizado = new EmbedBuilder()
      .setColor(0xED4245) // Vermelho
      .addFields({
        name: "❌ Solicitação recusada",
        value: `<@${interaction.user.id}> recusou a análise de <@${mediadorId}>\nTipo: Analista ${tipoTexto}`
      });

    await interaction.message.edit({
      embeds: [embedAtualizado],
      components: [] // Remove botões
    });

    await interaction.followUp({
      content: `❌ Solicitação recusada.`,
      flags: MessageFlags.Ephemeral
    });
  }
}