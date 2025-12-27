// ============================================================================
// utils/faturamentoSystem.js
// Sistema completo de faturamento de mediadores
// ============================================================================

import fs from "fs";

const FATURAMENTO_FILE = "faturamento.json";
const HORAS_FILE = "horas_mediadores.json";

// ============================================================================
// ESTRUTURA DE DADOS
// ============================================================================

/**
 * faturamento.json:
 * [
 *   {
 *     mediadorId: "123456789",
 *     mediadorNome: "João",
 *     timestamp: 1703347200000,
 *     valor: 1.00,
 *     modalidade: "1x1mob",
 *     threadId: "thread123"
 *   }
 * ]
 * 
 * horas_mediadores.json:
 * {
 *   "123456789": {
 *     nome: "João",
 *     sessoes: [
 *       { inicio: 1703347200000, fim: 1703350800000 }
 *     ]
 *   }
 * }
 */

// ============================================================================
// FUNÇÕES DE LEITURA/ESCRITA
// ============================================================================

function carregarFaturamento() {
  try {
    if (!fs.existsSync(FATURAMENTO_FILE)) {
      return [];
    }
    return JSON.parse(fs.readFileSync(FATURAMENTO_FILE, "utf8"));
  } catch (err) {
    console.error("[Faturamento] Erro ao carregar:", err.message);
    return [];
  }
}

function salvarFaturamento(data) {
  try {
    fs.writeFileSync(FATURAMENTO_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[Faturamento] Erro ao salvar:", err.message);
    return false;
  }
}

function carregarHoras() {
  try {
    if (!fs.existsSync(HORAS_FILE)) {
      return {};
    }
    return JSON.parse(fs.readFileSync(HORAS_FILE, "utf8"));
  } catch (err) {
    console.error("[Faturamento] Erro ao carregar horas:", err.message);
    return {};
  }
}

function salvarHoras(data) {
  try {
    fs.writeFileSync(HORAS_FILE, JSON.stringify(data, null, 2), "utf8");
    return true;
  } catch (err) {
    console.error("[Faturamento] Erro ao salvar horas:", err.message);
    return false;
  }
}

// ============================================================================
// REGISTRAR FILA MEDIADA
// ============================================================================

/**
 * Registra uma fila mediada (R$ 1,00 fixo)
 * @param {string} mediadorId - ID do mediador
 * @param {string} mediadorNome - Nome do mediador
 * @param {string} modalidade - Tipo de fila (1x1mob, 2x2mob, etc)
 * @param {string} threadId - ID da thread (opcional)
 */
export function registrarFilaMediada(mediadorId, mediadorNome, modalidade = "1x1mob", threadId = null) {
  try {
    const faturamento = carregarFaturamento();
    
    const registro = {
      mediadorId,
      mediadorNome,
      timestamp: Date.now(),
      valor: 1.00, // Fixo R$ 1,00 por fila
      modalidade,
      threadId
    };

    faturamento.push(registro);
    salvarFaturamento(faturamento);

    console.log(`[Faturamento] Registrado: ${mediadorNome} - R$ 1,00 (${modalidade})`);
    return true;
  } catch (err) {
    console.error("[Faturamento] Erro ao registrar fila:", err.message);
    return false;
  }
}

// ============================================================================
// CONTROLE DE HORAS TRABALHADAS
// ============================================================================

/**
 * Registra quando mediador ENTRA na fila
 * @param {string} mediadorId - ID do mediador
 * @param {string} mediadorNome - Nome do mediador
 */
export function registrarEntradaNaFila(mediadorId, mediadorNome) {
  try {
    const horas = carregarHoras();

    if (!horas[mediadorId]) {
      horas[mediadorId] = {
        nome: mediadorNome,
        sessoes: [],
        sessaoAtiva: null
      };
    }

    // Se já tem sessão ativa, ignora
    if (horas[mediadorId].sessaoAtiva) {
      console.log(`[Faturamento] ${mediadorNome} já está na fila`);
      return false;
    }

    // Inicia nova sessão
    horas[mediadorId].sessaoAtiva = {
      inicio: Date.now(),
      fim: null
    };

    salvarHoras(horas);
    console.log(`[Faturamento] ${mediadorNome} ENTROU na fila`);
    return true;
  } catch (err) {
    console.error("[Faturamento] Erro ao registrar entrada:", err.message);
    return false;
  }
}

/**
 * Registra quando mediador SAI da fila
 * @param {string} mediadorId - ID do mediador
 */
export function registrarSaidaDaFila(mediadorId) {
  try {
    const horas = carregarHoras();

    if (!horas[mediadorId] || !horas[mediadorId].sessaoAtiva) {
      console.log(`[Faturamento] Mediador ${mediadorId} não tem sessão ativa`);
      return false;
    }

    // Finaliza sessão
    const sessao = horas[mediadorId].sessaoAtiva;
    sessao.fim = Date.now();

    // Move para histórico
    horas[mediadorId].sessoes.push(sessao);
    horas[mediadorId].sessaoAtiva = null;

    salvarHoras(horas);

    const duracao = Math.floor((sessao.fim - sessao.inicio) / 1000 / 60);
    console.log(`[Faturamento] ${horas[mediadorId].nome} SAIU da fila (${duracao}min)`);
    return true;
  } catch (err) {
    console.error("[Faturamento] Erro ao registrar saída:", err.message);
    return false;
  }
}

// ============================================================================
// CÁLCULOS DE FATURAMENTO
// ============================================================================

/**
 * Calcula faturamento de um mediador em um período
 * @param {string} mediadorId - ID do mediador
 * @param {number} dias - Período em dias (1, 3, 7)
 * @returns {Object} - { total, horas, mediaPorHora, quantidadeFilas }
 */
export function calcularFaturamento(mediadorId, dias = 7) {
  try {
    const agora = Date.now();
    const periodoInicio = agora - (dias * 24 * 60 * 60 * 1000);

    // Buscar filas mediadas no período
    const faturamento = carregarFaturamento();
    const filasDoPeriodo = faturamento.filter(f => 
      f.mediadorId === mediadorId && 
      f.timestamp >= periodoInicio
    );

    const quantidadeFilas = filasDoPeriodo.length;
    const total = quantidadeFilas * 1.00; // R$ 1,00 por fila

    // Calcular horas trabalhadas no período
    const horas = carregarHoras();
    const mediadorData = horas[mediadorId];

    let totalMinutos = 0;

    if (mediadorData) {
      // Somar sessões finalizadas no período
      const sessoesDoPeriodo = mediadorData.sessoes.filter(s => 
        s.inicio >= periodoInicio
      );

      for (const sessao of sessoesDoPeriodo) {
        const duracao = (sessao.fim - sessao.inicio) / 1000 / 60; // minutos
        totalMinutos += duracao;
      }

      // Se tem sessão ativa que começou no período, conta até agora
      if (mediadorData.sessaoAtiva && mediadorData.sessaoAtiva.inicio >= periodoInicio) {
        const duracaoAtual = (agora - mediadorData.sessaoAtiva.inicio) / 1000 / 60;
        totalMinutos += duracaoAtual;
      }
    }

    const totalHoras = totalMinutos / 60;
    const mediaPorHora = totalHoras > 0 ? total / totalHoras : 0;

    return {
      total: total.toFixed(2),
      quantidadeFilas,
      totalMinutos: Math.floor(totalMinutos),
      totalHoras: totalHoras.toFixed(2),
      mediaPorHora: mediaPorHora.toFixed(2),
      periodo: dias
    };
  } catch (err) {
    console.error("[Faturamento] Erro ao calcular:", err.message);
    return {
      total: "0.00",
      quantidadeFilas: 0,
      totalMinutos: 0,
      totalHoras: "0.00",
      mediaPorHora: "0.00",
      periodo: dias
    };
  }
}

/**
 * Formata minutos em "Xh Ymin"
 * @param {number} minutos - Total de minutos
 * @returns {string} - Formatado (ex: "79h 36min")
 */
export function formatarHoras(minutos) {
  const horas = Math.floor(minutos / 60);
  const mins = Math.floor(minutos % 60);
  return `${horas}h ${mins}min`;
}

/**
 * Formata valor em Real
 * @param {number|string} valor - Valor numérico
 * @returns {string} - Formatado (ex: "R$ 1.234,56")
 */
export function formatarValor(valor) {
  const num = typeof valor === "string" ? parseFloat(valor) : valor;
  return `R$ ${num.toFixed(2).replace(".", ",")}`;
}

// ============================================================================
// FUNÇÕES AUXILIARES
// ============================================================================

/**
 * Busca nome do mediador
 * @param {string} mediadorId - ID do mediador
 * @returns {string} - Nome do mediador
 */
export function getNomeMediador(mediadorId) {
  try {
    const horas = carregarHoras();
    if (horas[mediadorId]) {
      return horas[mediadorId].nome;
    }

    // Busca no faturamento
    const faturamento = carregarFaturamento();
    const registro = faturamento.find(f => f.mediadorId === mediadorId);
    if (registro) {
      return registro.mediadorNome;
    }

    return "Mediador";
  } catch {
    return "Mediador";
  }
}

/**
 * Lista todos os mediadores com faturamento
 * @returns {Array} - Lista de mediadores
 */
export function listarMediadores() {
  try {
    const horas = carregarHoras();
    return Object.keys(horas).map(id => ({
      id,
      nome: horas[id].nome
    }));
  } catch {
    return [];
  }
}

// ============================================================================
// ESTATÍSTICAS GERAIS
// ============================================================================

/**
 * Calcula estatísticas gerais do sistema
 * @param {number} dias - Período em dias
 * @returns {Object} - Estatísticas gerais
 */
export function calcularEstatisticasGerais(dias = 7) {
  try {
    const agora = Date.now();
    const periodoInicio = agora - (dias * 24 * 60 * 60 * 1000);

    const faturamento = carregarFaturamento();
    const filasDoPeriodo = faturamento.filter(f => f.timestamp >= periodoInicio);

    const totalFilas = filasDoPeriodo.length;
    const totalFaturado = totalFilas * 1.00;

    // Mediadores únicos
    const mediadoresUnicos = new Set(filasDoPeriodo.map(f => f.mediadorId));

    return {
      totalFilas,
      totalFaturado: totalFaturado.toFixed(2),
      mediadoresAtivos: mediadoresUnicos.size,
      periodo: dias
    };
  } catch (err) {
    console.error("[Faturamento] Erro ao calcular estatísticas:", err.message);
    return {
      totalFilas: 0,
      totalFaturado: "0.00",
      mediadoresAtivos: 0,
      periodo: dias
    };
  }
}