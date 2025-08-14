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

const PORT = 3001;
app.listen(PORT, () => {
  console.log(`Servidor rodando na porta ${PORT}`);
});
