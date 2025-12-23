import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';
import http from 'http';
import { Server } from 'socket.io';

let tokenReady = false;
console.log('🟡 O servidor começou a rodar o arquivo server.js');

const app = express();
app.use(cors({ origin: '*' }));
app.use(express.json());

// 🔧 cria servidor HTTP e integra com socket.io
const server = http.createServer(app);
const io = new Server(server, { cors: { origin: '*' } });

// ✅ Atualiza o token no startup
await updateEnvToken();

async function updateEnvToken() {
  console.log('🟢 Entrou na função updateEnvToken()');
  try {
    const loginUrl =
      'https://bk07exvx19.execute-api.us-east-1.amazonaws.com/dev-stage/oauth/login';
    const body = {
      clientId: '3veb9e18d50ceqes38o1i8mlph',
      username: process.env.LOGIN_USERNAME,
      password: process.env.LOGIN_PASSWORD,
    };
    const { data } = await axios.post(loginUrl, body, {
      headers: { 'Content-Type': 'application/json' },
    });
    const newToken = data?.AuthenticationResult?.IdToken;
    if (!newToken) {
      console.error('❌ Não foi possível obter o IdToken do login.');
      tokenReady = false;
      return;
    }
    process.env.API_ID_TOKEN = newToken;
    console.log('🔑 Token atualizado com sucesso');
    tokenReady = true;
  } catch (error) {
    console.error('⚠️ Erro ao atualizar token:', error.message);
    tokenReady = false;
  }
}

// 🧱 Bloqueia requisições até o token estar pronto
app.use((req, res, next) => {
  if (!tokenReady)
    return res
      .status(503)
      .json({ error: 'Token ainda não carregado. Tente novamente.' });
  next();
});

// 🔔 Recebe webhook do Payer e envia evento ao front
app.post('/api/payer/webhook', (req, res) => {
  console.log('📩 Webhook recebido:', JSON.stringify(req.body, null, 2));
  io.emit('paymentStatus', req.body); // 👈 envia para todos os frontends conectados
  res.status(200).json({ ok: true });
});

// 🧩 Demais rotas (payment e status) continuam iguais
app.post('/api/payer/payment', async (req, res) => {
  try {
    const payload = req.body;
    const url =
      'https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/create';
    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_ID_TOKEN}`,
      },
    });
    res.json(data);
  } catch (error) {
    console.error('❌ Erro na chamada create:', error.response?.data || error);
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: error.message });
  }
});

// ❌ Aborta uma operação em andamento
app.post('/api/payer/abort', async (req, res) => {
  try {
    const {
      correlationId,
      automationName,
      receiver,
      origin = 'LAB',
    } = req.body;

    if (!correlationId || !automationName || !receiver) {
      return res.status(400).json({
        error:
          'correlationId, automationName e receiver são obrigatórios para abortar.',
      });
    }

    const payload = {
      type: 'INPUT',
      origin,
      data: {
        callbackUrl: 'https://payer-4ptm.onrender.com/api/payer/webhook',
        correlationId,
        automationName,
        receiver,
        message: {
          command: 'ABORT',
        },
      },
    };

    const url =
      'https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/create';

    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_ID_TOKEN}`,
      },
    });

    console.log('🛑 Abort enviado ao Payer:', payload);

    // ⚠️ Isso NÃO é o status final, apenas o ACK da requisição
    res.json({
      ok: true,
      message: 'Comando ABORT enviado com sucesso',
      payerResponse: data,
    });
  } catch (error) {
    console.error(
      '❌ Erro ao abortar operação:',
      error.response?.data || error
    );

    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: error.message });
  }
});

// 🚀 Inicia servidor
const startServer = async () => {
  console.log('🚀 Iniciando servidor...');
  await updateEnvToken();
  const PORT = process.env.PORT || 3001;
  server.listen(PORT, () =>
    console.log(`🚀 Servidor rodando na porta ${PORT}`)
  );
};

startServer();

// 🔁 1️⃣ Renova token a cada 55 minutos
setInterval(() => {
  console.log('🕒 Renovando token a cada 55 minutos...');
  updateEnvToken();
}, 55 * 60 * 1000);

// 💓 2️⃣ Mantém o Render acordado a cada 5 minutos
setInterval(async () => {
  try {
    await fetch('https://payer-4ptm.onrender.com');
    console.log('💤 Mantendo servidor ativo com ping...');
  } catch (err) {
    console.error('⚠️ Falha ao fazer ping:', err.message);
  }
}, 5 * 60 * 1000);
