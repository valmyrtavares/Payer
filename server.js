// server.js
import dotenv from 'dotenv';
dotenv.config();

import express from 'express';
import axios from 'axios';
import cors from 'cors';

const app = express();

const token = process.env.API_ID_TOKEN;

app.use(cors({ origin: 'http://localhost:3000' }));
app.use(express.json());

// endpoint que seu React chama para iniciar um pagamento
app.post('/api/payer/payment', async (req, res) => {
  console.log('payload :', req.body);
  console.log('TOKEN', token);
  try {
    const payload = req.body; // já vem pronto no formato que você mostrou

    const url =
      'https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/create';

    const { data } = await axios.post(url, payload, {
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`, // 👈 pega do .env
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
  // aqui você salva no banco, dispara socket/evento para o React etc.
  res.status(200).json({ ok: true });
});

// endpoint de consulta de status
app.get(
  '/api/payer/status/:correlationId/:automationName',
  console.log('Consulta de status requisitada'),
  async (req, res) => {
    const { correlationId, automationName } = req.params;
    console.log(
      `Consultando status para correlationId: ${correlationId}, automationName: ${automationName}`
    );

    try {
      const url = `https://v4kugeekeb.execute-api.us-east-1.amazonaws.com/prod-stage/cloud-notification/order/${correlationId}?automationName=${automationName}`;
      const { data } = await axios.get(url);
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

const PORT = process.env.PORT || 3001;
app.listen(PORT, () => {
  console.log(`🚀 Servidor rodando na porta ${PORT}`);
});
