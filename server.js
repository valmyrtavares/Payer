// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// CORS e JSON
app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

const PAYGO_KEY = process.env.PAYGO_TOKEN; // <-- coloque sua key no .env
console.log('🔑 PAYGO_KEY:', PAYGO_KEY ? '✔️ definida' : '❌ ausente');
// Healthcheck
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/api/paygo', async (req, res) => {
  console.log('📥 Requisição recebida:', req.body);
  try {
    const url = `https://sandbox.controlpay.com.br/webapi/Venda/Vender/?key=${PAYGO_KEY}`;

    // garante formato "1,00" (string)
    const payload = { ...req.body };
    if (typeof payload.valorTotalVendido === 'number') {
      payload.valorTotalVendido = payload.valorTotalVendido
        .toFixed(2)
        .replace('.', ',');
    }

    // terminalId como string
    if (payload.terminalId) payload.terminalId = String(payload.terminalId);

    console.log('➡️ Enviando para ControlPay:', payload);

    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DragonTotem/1.0',
      },
      timeout: 30000,
    });

    console.log('✅ Resposta ControlPay:', data);
    res.json(data); // devolve a resposta "crua" do ControlPay
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('❌ Erro ControlPay:', detail);
    res.status(500).json({ error: detail });
  }
});

// Endpoint para consultar status de uma venda existente
app.get('/api/paygo/:id', async (req, res) => {
  const vendaId = req.params.id;
  console.log('📦 Consultando status da venda:', vendaId);

  try {
    // const url = `https://sandbox.controlpay.com.br/webapi/Venda/Consultar/${vendaId}?key=${PAYGO_KEY}`;
    const url = `https://sandbox.controlpay.com.br/webapi/IntencaoVenda/GetById/?key=${PAYGO_KEY}&intencaoVendaId=${encodeURIComponent(
      vendaId
    )}`;

    const { data } = await axios.get(url, {
      headers: { 'User-Agent': 'DragonTotem/1.0' },
      timeout: 30000,
    });
    console.log(
      '🔍 Payload ControlPay (GetById):',
      JSON.stringify(data, null, 2)
    );
    res.json(data);
  } catch (error) {
    const detail = error.response?.data || error.message;
    console.error('❌ Erro ao consultar venda:', detail);
    res.status(500).json({ error: detail });
  }
});

app.post('/api/paygo/listar-vendas', async (req, res) => {
  try {
    const { terminalId, dataInicio, dataFim } = req.body;

    const url = `https://sandbox.controlpay.com.br/webapi/IntencaoVenda/GetByFiltros?key=${PAYGO_KEY}`;

    // Corpo da requisição com filtros vindos do frontend
    const filtros = {
      terminalId: terminalId || '4517',
      dataInicio: dataInicio || null, // formato esperado yyyy-MM-ddTHH:mm:ss
      dataFim: dataFim || null,
      vendasDia: !dataInicio && !dataFinal, // se não mandar datas, pega do dia
    };

    const { data } = await axios.post(url, filtros, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DragonTotem/1.0',
      },
    });

    res.json(data.intencoesVendas || []);
  } catch (error) {
    console.error(
      '❌ Erro ao listar vendas:',
      error.response?.data || error.message
    );
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

app.post('/api/paygo/cancelar-venda', async (req, res) => {
  try {
    const {
      intencaoVendaId,
      terminalId,
      aguardarTefIniciarTransacao,
      senhaTecnica,
    } = req.body;

    const url = `https://sandbox.controlpay.com.br/webapi/Venda/CancelarVenda/?key=${PAYGO_KEY}`;

    const payload = {
      intencaoVendaId,
      terminalId,
      aguardarTefIniciarTransacao: aguardarTefIniciarTransacao ?? true,
      senhaTecnica: senhaTecnica || '111111', // senha técnica padrão
    };

    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'DragonTotem/1.0',
      },
    });

    res.json(data);
  } catch (error) {
    console.error(
      '❌ Erro ao cancelar venda:',
      error.response?.data || error.message
    );
    res.status(500).json({ error: error.response?.data || error.message });
  }
});

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
