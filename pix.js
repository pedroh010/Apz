// ============================================================================
// commands/player/pix.js
// Gera QR Code PIX com detecção automática do tipo
// ============================================================================

import { EmbedBuilder, AttachmentBuilder } from "discord.js";
import QRCode from "qrcode";

// ============================================================================
// DETECÇÃO DE TIPO DE CHAVE PIX
// ============================================================================

function detectarTipoPix(chave) {
  chave = chave.trim();

  // CPF (11 dígitos)
  if (/^\d{11}$/.test(chave)) {
    return "CPF";
  }

  // CNPJ (14 dígitos)
  if (/^\d{14}$/.test(chave)) {
    return "CNPJ";
  }

  // Celular com DDD (11 dígitos com +55)
  if (/^\+?55\d{11}$/.test(chave.replace(/\D/g, ''))) {
    return "Celular";
  }

  // E-mail
  if (/^[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}$/i.test(chave)) {
    return "E-mail";
  }

  // Chave Aleatória (UUID format)
  if (/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(chave)) {
    return "Chave Aleatória";
  }

  // Se não detectou, retorna genérico
  return "Chave PIX";
}

// ============================================================================
// VALIDAÇÃO DE CHAVE PIX
// ============================================================================

function validarPix(chave) {
  const regex = /^(\d{11}|\d{14}|[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}|[\w._%+-]+@[\w.-]+\.[a-zA-Z]{2,}|\+?55\d{11})$/i;
  return regex.test(chave.trim());
}

// ============================================================================
// GERAÇÃO DE QR CODE
// ============================================================================

function gerarPayloadPix(chave) {
  return `00020126580014BR.GOV.BCB.PIX0136${chave}5204000053039865802BR5920Recebedor6009SAO PAULO62070503***6304`;
}

async function gerarQRCode(chave) {
  try {
    const payload = gerarPayloadPix(chave);
    return await QRCode.toBuffer(payload, {
      errorCorrectionLevel: 'M',
      type: 'png',
      width: 256, // largura menor para reduzir o tamanho
      margin: 4   // margem menor
    });
  } catch (err) {
    console.error("[PIX] Erro ao gerar QR Code:", err.message);
    throw err;
  }
}

// ============================================================================
// COMANDO PRINCIPAL
// ============================================================================

export default {
  name: "pix",
  description: "Gera QR Code PIX a partir de uma chave",

  async execute(message, args) {
    // Verificar se foi fornecida uma chave
    if (args.length === 0) {
      return message.reply({
        content: "❌ **Uso correto:**\n`!pix <chave_pix>`\n\n**Exemplos:**\n`!pix exemplo@email.com`\n`!pix 12345678901`\n`!pix 123e4567-e89b-12d3-a456-426614174000`"
      });
    }

    const chave = args.join(" ").trim();

    // Validar chave PIX
    if (!validarPix(chave)) {
      return message.reply({
        content: "❌ **Chave PIX inválida!**\n\nFormatos aceitos:\n• CPF (11 dígitos)\n• CNPJ (14 dígitos)\n• E-mail\n• Celular (+5511999999999)\n• Chave Aleatória (UUID)"
      });
    }

    // Detectar tipo da chave
    const tipoPix = detectarTipoPix(chave);

    try {
      // Gerar QR Code
      const qrBuffer = await gerarQRCode(chave);
      const attachment = new AttachmentBuilder(qrBuffer, { name: "qrcode-pix.png" });

      // Criar embed com borda branca
const embed = new EmbedBuilder()
  .setTitle("Chave PIX")
  .setDescription(`Tipo: ${tipoPix}`)
  .setColor(0xFFFFFF) // Branco
  .setImage("attachment://qrcode-pix.png");

await message.reply({
  embeds: [embed],
  files: [attachment]
});

    } catch (error) {
      console.error("[PIX] Erro ao processar comando:", error);
      return message.reply({
        content: "❌ Ocorreu um erro ao gerar o QR Code. Tente novamente."
      });
    }
  }
};