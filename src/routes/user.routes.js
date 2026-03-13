import { userController } from '../controllers/user.controller.js';

export const userRoutes = [
  { method: 'GET', path: '/users', handler: userController.getAllUsers },
  { method: 'GET', path: '/users/:id', handler: userController.getUserById },
  { method: 'POST', path: '/users', handler: userController.createUser },
  { method: 'PUT', path: '/users/:id', handler: userController.updateUser },
  { method: 'DELETE', path: '/users/:id', handler: userController.deleteUser }
];
