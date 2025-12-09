import { Client } from '@upstash/qstash';

export const qstashClient = new Client({
  token: process.env.QSTASH_TOKEN,
});