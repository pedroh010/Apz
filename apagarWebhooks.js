export default {
  name: "apagarWebhooks",
  description: "Apaga todos os webhooks de todos os canais",

  async execute(message, args) {
    if (!message.member.permissions.has("Administrator")) {
      return message.reply("❌ Você precisa ser administrador para usar este comando.");
    }

    let apagados = 0;

    for (const [id, channel] of message.guild.channels.cache) {
      try {
        const webhooks = await channel.fetchWebhooks();
        for (const webhook of webhooks.values()) {
          await webhook.delete("Comando !apagarWebhooks");
          apagados++;
        }
      } catch (err) {
        console.error(`Erro no canal ${channel.name}:`, err.message);
      }
    }

    message.reply(`✅ Foram apagados ${apagados} webhooks.`);
  }
};