// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

// 🔄 Atualiza o token em memória (sem gravar no disco)
async function updateEnvToken() {
  try {
    const loginUrl =
      'https://bk07exvx19.execute-api.us-east-1.amazonaws.com/dev-stage/oauth/login';

    const body = {
      clientId: '3veb9e18d50ceqes38o1i8mlph',
      username: 'pesato4388@ahanim.com',
      password: 'Acesso@123',
    };

    const { data } = await axios.post(loginUrl, body, {
      headers: { 'Content-Type': 'application/json' },
    });

    const newToken = data?.AuthenticationResult?.IdToken;

    if (!newToken) {
      console.error('❌ Não foi possível obter o IdToken do login.');
      return;
    }

    process.env.API_ID_TOKEN = newToken;
    console.log('✅ Token atualizado em memória.');
  } catch (error) {
    console.error(
      '⚠️ Erro ao atualizar o token automaticamente:',
      error.message
    );
  }
}

app.use(cors({ origin: '*' }));
app.use(express.json());

// endpoint que seu React chama para iniciar um pagamento
app.post('/api/payer/payment', async (req, res) => {
  try {
    const payload = req.body;

    const url =
      'https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/create';

    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${process.env.API_ID_TOKEN}`, // 👈 token atualizado dinamicamente
      },
    });

    res.json(data);
  } catch (error) {
    if (error.response) {
      console.error('Erro na resposta da API:', error.response.data);
      res.status(error.response.status).json(error.response.data);
    } else if (error.request) {
      console.error('Nenhuma resposta recebida:', error.request);
      res.status(500).json({ error: 'Nenhuma resposta recebida da API PayGo' });
    } else {
      console.error('Erro na configuração da requisição:', error.message);
      res.status(500).json({ error: error.message });
    }
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
          Authorization: `Bearer ${process.env.API_ID_TOKEN}`, // 👈 usa o token mais recente
        },
      });

      console.log('✅ Status consultado com sucesso:', data);
      res.json(data);
    } catch (error) {
      console.error(
        '❌ Erro ao consultar status:',
        error.response?.data || error.message
      );
      res.status(500).json({ error: error.response?.data || error.message });
    }
  }
);

// ✅ Inicializa o servidor
const startServer = async () => {
  await updateEnvToken(); // Atualiza o token antes de subir
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`🚀 Servidor rodando na porta ${PORT}`));
};

startServer();
