const express = require('express');
const router = express.Router();
const taskController = require('../../../controller/api/v2/taskController');
const { validateToken } = require('../../../middleware/validateToken');

router.use(validateToken);

router.post('/', taskController.createTask);
router.get('/', taskController.getAllTasks);
router.get('/:id', taskController.getTaskById);
router.put('/:id', taskController.updateTask);
router.delete('/:id', taskController.deleteTask);
router.get('/user/:userId', taskController.getTasksByUser);
router.get('/manager/:managerId', taskController.getTasksByManager);
router.post('/:taskId/updates', taskController.addTaskUpdate);

module.exports = router;
