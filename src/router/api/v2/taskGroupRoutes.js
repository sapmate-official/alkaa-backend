const express = require('express');
const router = express.Router();
const taskGroupController = require('../../../controller/api/v2/taskGroupController');
const { validateToken } = require('../../../middleware/validateToken');

router.use(validateToken);

router.post('/', taskGroupController.createGroup);
router.get('/', taskGroupController.getAllGroups);
router.get('/:id', taskGroupController.getGroupById);
router.put('/:id', taskGroupController.updateGroup);
router.delete('/:id', taskGroupController.deleteGroup);
router.post('/:id/members', taskGroupController.addMembers);
router.delete('/:id/members', taskGroupController.removeMembers);

module.exports = router;
