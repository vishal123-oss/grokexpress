import { env } from 'node:process';

export const config = {
  port: env.PORT || 3000,
  env: env.NODE_ENV || 'development',
  name: 'grokexpress'
};
