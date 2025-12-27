import fs from "fs";

export default {
  name: "setmed",
  description: "Define o cargo de Mediador",

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("Você precisa ser administrador para usar este comando.");
    }

    const role = message.mentions.roles.first();
    if (!role) {
      return message.reply(" Você precisa mencionar um cargo. Exemplo: `!setmed @Mediador`");
    }

    // Salvar em JSON
    const data = { mediatorRole: role.id };
    fs.writeFileSync("mediador_config.json", JSON.stringify(data, null, 2));

    // Também guardar em memória para uso imediato
    message.client.mediatorRole = role.id;

    message.reply(` Cargo de Mediador definido como: **${role.name}** e salvo em arquivo.`);
  }
};