import express from 'express';
import dotenv from 'dotenv';
import cors from 'cors';
import notificationsRoutes from './routes/notifications.js';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json());

app.use('/api/notifications', notificationsRoutes);

app.listen(3000, () => {
  console.log('Servidor rodando na porta 3000');
});
