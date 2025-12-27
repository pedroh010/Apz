import fs from "fs";

export default {
  name: "qrcode",
  description: "Cadastrar ou atualizar o QR Code do mediador",

  async execute(message, args) {
    if (args.length < 1) {
      return message.reply("❌ Uso correto: `!qrcode <link_da_imagem>`");
    }

    const qrcode = args[0];
    if (!(qrcode.startsWith("http://") || qrcode.startsWith("https://"))) {
      return message.reply("❌ O QR Code precisa ser um link válido.");
    }

    let mediadores = [];
    try { mediadores = JSON.parse(fs.readFileSync("mediadores.json")); } catch {}

    const mediadorId = message.author.id;
    let mediador = mediadores.find(m => m.id === mediadorId);

    if (!mediador) {
      return message.reply("⚠️ Você precisa se cadastrar primeiro com `!mediador`.");
    }

    mediador.qrcode = qrcode;
    fs.writeFileSync("mediadores.json", JSON.stringify(mediadores, null, 2));

    // Confirma no chat
    await message.reply(`✅ QR Code atualizado!\n${qrcode}`);
  }
};