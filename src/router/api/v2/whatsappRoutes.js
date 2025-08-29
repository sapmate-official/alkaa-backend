const express = require('express');
const router = express.Router();
const whatsappController = require('../../../controller/api/v2/whatsappController');
const { validateToken } = require('../../../middleware/validateToken');

router.use(validateToken);

router.post('/send', whatsappController.sendNotification);
router.post('/task-assignment', whatsappController.sendTaskAssignmentNotification);
router.post('/task-update', whatsappController.sendTaskUpdateNotification);

module.exports = router;
