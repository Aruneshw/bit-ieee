import app from './app';
import dotenv from 'dotenv';

// Load environment variables from the parent directory's .env.local if present
dotenv.config({ path: '../.env.local' });
dotenv.config();

const PORT = process.env.PORT || 8000;

app.listen(PORT, () => {
  console.log(`Backend Server running on port ${PORT}`);
});
