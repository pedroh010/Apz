import { EmbedBuilder } from "discord.js";
import fs from "fs";

export default {
  name: "setthumbnail",
  description: "Define o thumbnail das embeds do 2x2mob",

  async execute(message, args) {
    const link = args[0];
    if (!link) {
      return message.reply("⚠️ Uso correto: `!setthumbnail https://link.com/imagem.gif`");
    }

    if (!link.startsWith("http")) {
      return message.reply("⚠️ O link precisa começar com http ou https.");
    }

    // salva o link em um arquivo de config
    let config = {};
    try {
      config = JSON.parse(fs.readFileSync("thumbnail_config.json"));
    } catch {}

    config.thumbnailLink = link;
    fs.writeFileSync("thumbnail_config.json", JSON.stringify(config, null, 2));

    const embed = new EmbedBuilder()
      .setTitle("Thumbnail atualizado!")
      .setDescription("Agora todas as embeds do 2x2mob vão usar este thumbnail.")
      .setThumbnail(link);

    await message.channel.send({ embeds: [embed] });
  }
};