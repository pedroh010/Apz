import fs from "fs";

export default {
  name: "setapostas",
  description: "Define o canal onde as threads de apostas serão criadas",

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ Você precisa ser administrador para usar este comando.");
    }

    const canal = message.mentions.channels.first();
    if (!canal) {
      return message.reply("❌ Você precisa mencionar um canal. Exemplo: `!setapostas #apostas`");
    }

    // Salvar em JSON
    const data = { apostasChannel: canal.id };
    fs.writeFileSync("apostas_config.json", JSON.stringify(data, null, 2));

    // Guardar em memória para uso imediato
    message.client.apostasChannel = canal.id;

    message.reply(`✅ Canal de apostas definido como: <#${canal.id}>`);
  }
};