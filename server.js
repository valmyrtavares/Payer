// server.js
let tokenReady = false; // 👈 bloqueia rotas até token ser atualizado
console.log('🟡 O servidor começou a rodar o arquivo server.js');
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

app.use(cors({ origin: '*' }));
app.use(express.json());

// ✅ Gera o token imediatamente no startup

await updateEnvToken();

// 🔄 Atualiza o token em memória (sem gravar no disco)
async function updateEnvToken() {
  console.log('🟢 Entrou na função updateEnvToken()');
  try {
    console.log('🔐 Solicitando novo token de autenticação...');
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
    console.log('🔑 Novo token recebido:', newToken ? 'SIM ✅' : 'NÃO ❌');
    console.log('🔑 Tamanho do token:', newToken?.length);

    tokenReady = true;

    console.log(
      '✅ Token atualizado em memória (início):',
      newToken.slice(0, 20) + '...' // mostra parte do token
    );
  } catch (error) {
    console.error('⚠️ Erro ao atualizar token automaticamente:', error.message);
    tokenReady = false;
  }
}

// 🧱 Middleware: bloqueia requisições até o token estar pronto
app.use((req, res, next) => {
  if (!tokenReady) {
    return res.status(503).json({
      error: 'Token ainda não carregado. Tente novamente em alguns segundos.',
    });
  }
  next();
});

// endpoint que seu React chama para iniciar um pagamento
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
    console.error(
      '❌ Erro na chamada create:',
      error.response?.data || error.message
    );
    res
      .status(error.response?.status || 500)
      .json(error.response?.data || { error: error.message });
  }
});

// webhook que o Payer chama
app.post('/api/payer/webhook', (req, res) => {
  console.log('📩 Webhook recebido:', JSON.stringify(req.body, null, 2));
  res.status(200).json({ ok: true });
});

// endpoint de consulta de status
app.get(
  '/api/payer/status/:correlationId/:automationName',
  async (req, res) => {
    const { correlationId, automationName } = req.params;
    console.log(
      `Consultando status para correlationId: ${correlationId}, automationName: ${automationName}`
    );

    try {
      const url = `https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/order/${correlationId}?automationName=${automationName}`;

      const { data } = await axios.get(url, {
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${process.env.API_ID_TOKEN}`,
        },
      });

      console.log('✅ Status consultado com sucesso:', data);
      res.json(data);
    } catch (error) {
      console.error(
        '❌ Erro ao consultar status:',
        error.response?.data || error.message
      );

      // se o token expirou ou ficou inválido, faz novo login automaticamente
      if (error.response?.status === 401) {
        console.log('♻️ Token expirado — tentando renovar...');
        tokenReady = false;
        await updateEnvToken();
      }

      res.status(error.response?.status || 500).json({
        error: error.response?.data || { message: error.message },
      });
    }
  }
);

const startServer = async () => {
  console.log('🚀 Iniciando servidor...');
  await updateEnvToken(); // ✅ Agora realmente roda antes de iniciar
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
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
