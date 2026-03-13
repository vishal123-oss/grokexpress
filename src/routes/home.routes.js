import { homeController } from '../controllers/home.controller.js';

export const homeRoutes = [
  { method: 'GET', path: '/', handler: homeController.getHome },
  { method: 'GET', path: '/health', handler: homeController.getHealth }
];
