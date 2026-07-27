const jwt = require('jsonwebtoken');
const token = jwt.sign({ userId: 'user_id_here' }, 'rahasiasuperkuat123', { expiresIn: '7d' });
console.log('Token:', token);
