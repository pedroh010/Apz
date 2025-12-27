import fs from "fs";

function getMediatorRole(client) {
  if (client.mediatorRole) return client.mediatorRole;
  try {
    const data = JSON.parse(fs.readFileSync("mediador_config.json"));
    return data.mediatorRole;
  } catch {
    return null;
  }
}

export default {
  name: "fch",
  description: "Fecha a fila atual",

  async execute(message, args) {
    const mediatorRole = getMediatorRole(message.client);
    if (!mediatorRole || !message.member.roles.cache.has(mediatorRole)) {
      return message.reply("❌ Apenas mediadores podem usar este comando.");
    }

    // Se for usado dentro de uma thread, fecha a thread
    if (message.channel.isThread()) {
      try {
        await message.channel.delete();
      } catch (err) {
        console.error("Erro ao fechar thread:", err);
        return message.reply("❌ Não foi possível fechar a fila.");
      }
      return;
    }

    // Se for usado em um canal normal, tenta apagar a mensagem da fila
    try {
      await message.delete(); // apaga o comando
      await message.channel.send("✅ Fila encerrada pelo mediador.");
    } catch (err) {
      console.error("Erro ao fechar fila:", err);
      return message.reply("❌ Não foi possível fechar a fila.");
    }
  }
};