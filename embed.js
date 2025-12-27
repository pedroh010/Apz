import { EmbedBuilder, PermissionsBitField } from "discord.js";
import pkg from "seyfert";
const { Separator, Spacing } = pkg;

export default {
  name: "e",
  description: "Gera embeds brancas com separadores",

  async execute(message) {
    if (!message.member.permissions.has(PermissionsBitField.Flags.Administrator)) {
      return message.reply("Apenas administradores podem usar este comando.");
    }

    const conteudo = message.content.slice(2).trim();
    if (!conteudo) {
      return message.reply("Uso correto: `!e texto | - | texto`");
    }

    const partes = conteudo.split("|").map(p => p.trim()).filter(p => p.length > 0);

    const embeds = [];
    const components = [];

    for (const parte of partes) {
      if (parte === "-" || parte === "---") {
        const separator = new Separator()
          .setSpacing(Spacing.Small)
          .setDivider(true);
        components.push(separator);
      } else {
        embeds.push(
          new EmbedBuilder()
            .setDescription(parte)
            .setColor(0xFFFFFF)
        );
      }
    }

    await message.channel.send({ embeds, components });
    await message.delete().catch(() => {});
  }
};