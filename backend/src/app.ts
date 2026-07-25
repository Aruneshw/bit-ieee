import express from 'express';
import cors from 'cors';
import arduinoRouter from './routes/arduino';
import circuitRouter from './routes/circuit';

const app = express();

app.use(cors());
app.use(express.json());

app.use('/api/arduino', arduinoRouter);
app.use('/api/circuit', circuitRouter);

// Routes will be added here
app.get('/health', (req, res) => {
  res.json({ status: 'ok', message: 'Backend is running' });
});

export default app;
