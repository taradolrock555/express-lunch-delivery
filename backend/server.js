require('dotenv').config();

const cors = require('cors');
const express = require('express');
const customerRoutes = require('./routes/customerRoutes');
const geoRoutes = require('./routes/geoRoutes');
const orderRoutes = require('./routes/orderRoutes');
const routeRoutes = require('./routes/routeRoutes');
const riderRoutes = require('./routes/riderRoutes');

const app = express();
const port = Number(process.env.PORT) || 3000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Rider Route Management API is running' });
});

app.use('/api/orders', orderRoutes);
app.use('/api/customers', customerRoutes);
app.use('/api/geo', geoRoutes);
app.use('/api/routes', routeRoutes);
app.use('/api/riders', riderRoutes);

app.use((req, res) => {
  res.status(404).json({ message: 'Route not found' });
});

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({ message: 'Internal server error' });
});

app.listen(port, () => {
  console.log(`Server is running at http://localhost:${port}`);
});
