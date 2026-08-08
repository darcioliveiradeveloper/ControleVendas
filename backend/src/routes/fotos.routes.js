const express = require('express');
const { servirFoto } = require('../fotos');

const router = express.Router();

router.get('/:id', (req, res) => {
  servirFoto(req.params.id, res);
});

module.exports = router;
