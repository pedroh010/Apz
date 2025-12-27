// ============================================================================
// commands/admin/setanalista.js
// Sistema unificado de configuração de analistas (Mobile e Emulador)
// ============================================================================

import fs from "fs";
import {
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  StringSelectMenuOptionBuilder,
  ChannelSelectMenuBuilder,
  ChannelType,
  PermissionFlagsBits
} from "discord.js";

// ============================================================================
// ARQUIVO DE CONFIGURAÇÃO
// ============================================================================

const ANALISTAS_FILE = "analistas.json";

function loadAnalistas() {
  try {
    return JSON.parse(fs.readFileSync(ANALISTAS_FILE, "utf8"));
  } catch {
    return {
      mobile: null,
      emulador: null,
      canalSolicitacao: null
    };
  }
}

function saveAnalistas(data) {
  try {
    fs.writeFileSync(ANALISTAS_FILE, JSON.stringify(data, null, 2));
    return true;
  } catch (err) {
    console.error("[SetAnalista] Erro ao salvar:", err.message);
    return false;
  }
}

// ============================================================================
// CRIAR EMBED UNIFICADO
// ============================================================================

function criarEmbed(mobileId = null, emuladorId = null, canalId = null) {
  const valorMobile = mobileId ? `<@&${mobileId}>` : "Nenhum cargo selecionado";
  const valorEmulador = emuladorId ? `<@&${emuladorId}>` : "Nenhum cargo selecionado";
  const valorCanal = canalId ? `<#${canalId}>` : "Nenhum canal selecionado";
  
  return new EmbedBuilder()
    .setTitle("Selecione os cargos de analista")
    .setColor(0xEAAA00)
    .addFields(
      {
        name: "<:1000050595:1452429661459185725> Cargo de Analista Mobile",
        value: valorMobile
      },
      {
        name: "<:1000050595:1452429661459185725> Cargo de Analista Emulador",
        value: valorEmulador
      },
      {
        name: "<:1000050595:1452429661459185725> Selecione o canal de solicitação",
        value: valorCanal
      }
    );
}

// ============================================================================
// CRIAR SELECT MENUS
// ============================================================================

function criarSelectMenus(guild) {
  const roles = guild.roles.cache
    .filter(role => role.id !== guild.id) // Excluir @everyone
    .sort((a, b) => b.position - a.position)
    .first(25); // Discord limita a 25 opções

  const roleOptions = roles.map(role =>
    new StringSelectMenuOptionBuilder()
      .setLabel(role.name)
      .setValue(role.id)
      .setEmoji("👥")
  );

  // Select Menu Mobile
  const selectMobile = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("analista_select_mobile")
      .setPlaceholder("🎮 Selecione cargo de Analista Mobile...")
      .addOptions(roleOptions)
  );

  // Select Menu Emulador
  const selectEmulador = new ActionRowBuilder().addComponents(
    new StringSelectMenuBuilder()
      .setCustomId("analista_select_emulador")
      .setPlaceholder("💻 Selecione cargo de Analista Emulador...")
      .addOptions(roleOptions)
  );

  // Channel Select Menu
  const selectCanal = new ActionRowBuilder().addComponents(
    new ChannelSelectMenuBuilder()
      .setCustomId("analista_select_canal")
      .setPlaceholder("📢 Selecione canal de solicitação...")
      .setChannelTypes(ChannelType.GuildText) // Apenas canais de texto
  );

  return [selectMobile, selectEmulador, selectCanal];
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "analista",
  description: "Configura os cargos de analistas (Mobile e Emulador)",

  async execute(message) {
    // Verificar permissão de administrador
    if (!message.member.permissions.has(PermissionFlagsBits.Administrator)) {
      return message.reply("❌ Você precisa ser administrador para usar este comando.");
    }

    const analistas = loadAnalistas();

    // Criar embed único
    const embed = criarEmbed(analistas.mobile, analistas.emulador, analistas.canalSolicitacao);

    // Criar select menus
    const [selectMobile, selectEmulador, selectCanal] = criarSelectMenus(message.guild);

    // Enviar mensagem única
    const msg = await message.channel.send({
      embeds: [embed],
      components: [selectMobile, selectEmulador, selectCanal]
    });

    // Collector único para todos os select menus
    const collector = msg.createMessageComponentCollector({
      time: 0,
      dispose: true
    });

    collector.on("collect", async interaction => {
      // Verificar permissão
      if (!interaction.member.permissions.has(PermissionFlagsBits.Administrator)) {
        return interaction.reply({
          content: "❌ Apenas administradores podem alterar.",
          ephemeral: true
        });
      }

      await interaction.deferUpdate();

      const data = loadAnalistas();

      // Mobile
      if (interaction.customId === "analista_select_mobile") {
        const cargoId = interaction.values[0];
        data.mobile = cargoId;
        saveAnalistas(data);

        const novoEmbed = criarEmbed(data.mobile, data.emulador, data.canalSolicitacao);
        await msg.edit({
          embeds: [novoEmbed],
          components: [selectMobile, selectEmulador, selectCanal]
        });

        await interaction.followUp({
          content: `✅ Cargo de Analista Mobile atualizado: <@&${cargoId}>`,
          ephemeral: true
        });

        // Atualizar cache
        message.client.analistaMobile = cargoId;
      }

      // Emulador
      if (interaction.customId === "analista_select_emulador") {
        const cargoId = interaction.values[0];
        data.emulador = cargoId;
        saveAnalistas(data);

        const novoEmbed = criarEmbed(data.mobile, data.emulador, data.canalSolicitacao);
        await msg.edit({
          embeds: [novoEmbed],
          components: [selectMobile, selectEmulador, selectCanal]
        });

        await interaction.followUp({
          content: `✅ Cargo de Analista Emulador atualizado: <@&${cargoId}>`,
          ephemeral: true
        });

        // Atualizar cache
        message.client.analistaEmulador = cargoId;
      }

      // Canal de Solicitação
      if (interaction.customId === "analista_select_canal") {
        const canalId = interaction.values[0];
        data.canalSolicitacao = canalId;
        saveAnalistas(data);

        const novoEmbed = criarEmbed(data.mobile, data.emulador, data.canalSolicitacao);
        await msg.edit({
          embeds: [novoEmbed],
          components: [selectMobile, selectEmulador, selectCanal]
        });

        await interaction.followUp({
          content: `✅ Canal de solicitação atualizado: <#${canalId}>`,
          ephemeral: true
        });

        // Atualizar cache
        message.client.canalSolicitacao = canalId;
      }
    });

    // Cleanup quando mensagem for deletada
    const cleanupListener = (deletedMsg) => {
      if (deletedMsg.id === msg.id) {
        collector.stop('message_deleted');
        message.client.removeListener('messageDelete', cleanupListener);
      }
    };

    message.client.on('messageDelete', cleanupListener);

    collector.on('end', () => {
      message.client.removeListener('messageDelete', cleanupListener);
    });
  }
};