// ============================================================================
// commands/mediator/faturamento.js
// Comando para visualizar faturamento de mediadores
// ============================================================================

import { EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { 
  calcularFaturamento, 
  formatarHoras, 
  formatarValor,
  getNomeMediador 
} from "../../utils/faturamentoSystem.js";

// ============================================================================
// CONFIGURAÇÃO
// ============================================================================

const PERIODOS = {
  hoje: { dias: 1, nome: "Hoje", pagina: 1 },
  tres: { dias: 3, nome: "3 dias", pagina: 2 },
  sete: { dias: 7, nome: "7 dias", pagina: 3 }
};

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "faturamento",
  description: "Visualizar faturamento de mediador",

  async execute(message, args) {
    let targetUserId;
    let targetUserName;

    if (args.length > 0 && message.mentions.users.size > 0) {
      const mentioned = message.mentions.users.first();
      targetUserId = mentioned.id;
      targetUserName = mentioned.username;
    } else {
      targetUserId = message.author.id;
      targetUserName = message.author.username;
    }

    const nomeMediador = getNomeMediador(targetUserId) || targetUserName;

    // Embed inicial (7 dias por padrão)
    const embed = criarEmbed(targetUserId, nomeMediador, "sete");
    const row = criarBotoes("sete");

    const sentMsg = await message.reply({ 
      embeds: [embed], 
      components: [row] 
    });

    const collector = sentMsg.createMessageComponentCollector({ 
      time: 0,
      filter: i => i.user.id === message.author.id
    });

    collector.on("collect", async interaction => {
      await interaction.deferUpdate().catch(() => {});

      const periodo = interaction.customId.replace("faturamento_", "");

      const newEmbed = criarEmbed(targetUserId, nomeMediador, periodo);
      const newRow = criarBotoes(periodo);

      await sentMsg.edit({ 
        embeds: [newEmbed], 
        components: [newRow] 
      }).catch(() => {});
    });

    collector.on("end", () => {
      const disabledRow = criarBotoes("sete", true);
      sentMsg.edit({ components: [disabledRow] }).catch(() => {});
    });
  }
};

// ============================================================================
// CRIAR EMBED
// ============================================================================

function criarEmbed(mediadorId, mediadorNome, periodoKey) {
  const config = PERIODOS[periodoKey];
  const dados = calcularFaturamento(mediadorId, config.dias);

  return new EmbedBuilder()
    .setTitle("Seu Faturamento")
    .setDescription(
      `**Período:** \`${config.nome}\`\n` +
      `**Total:** \`${formatarValor(dados.total)}\`\n` +
      `**Horas trabalhadas:** \`${formatarHoras(dados.totalMinutos)}\`\n` +
      `**Média por hora:** \`${formatarValor(dados.mediaPorHora)}\``
    )
  .setColor(0xFFFFFF)
  .setFooter({ text: `Página ${config.pagina} de 3` });
}

// ============================================================================
// CRIAR BOTÕES
// ============================================================================

function criarBotoes(periodoAtivo, disabledAll = false) {
  const row = new ActionRowBuilder();

  for (const [key, config] of Object.entries(PERIODOS)) {
    const isActive = key === periodoAtivo;

    const button = new ButtonBuilder()
      .setCustomId(`faturamento_${key}`)
      .setLabel(config.nome)
      // 🔧 Todos os botões ficam cinza
      .setStyle(ButtonStyle.Secondary)
      // 🔑 Apenas o botão ativo fica desativado
      .setDisabled(disabledAll ? true : isActive);

    row.addComponents(button);
  }

  return row;
}