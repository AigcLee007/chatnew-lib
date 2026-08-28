import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, test } from 'vitest';

const config = readFileSync(
  resolve(process.cwd(), 'deploy/nginx/chatvip-portal.conf.example'),
  'utf8',
);

describe('production Nginx example', () => {
  test('uses only the supported public hostnames and BaoTa portal root', () => {
    expect(config).not.toContain('chatvvip.aittco.com');
    expect(config).toContain('root /www/wwwroot/chatvip.aittco.com;');
  });

  test('routes classic UI, classic API, and LibreChat to their required upstreams', () => {
    expect(config).toMatch(/location \/api\/\s*\{[\s\S]*?proxy_pass http:\/\/127\.0\.0\.1:3001;/);
    expect(config).toMatch(/location \/main\/\s*\{[\s\S]*?proxy_pass http:\/\/127\.0\.0\.1:3001\/;/);
    expect(config).toMatch(/server_name chat\.aittco\.com;[\s\S]*?proxy_pass http:\/\/127\.0\.0\.1:3080;/);
  });

  test('keeps SSL, forwarding, WebSocket, timeout, and upload directives', () => {
    expect(config).toContain('ssl_certificate ');
    expect(config).toContain('ssl_certificate_key ');
    expect(config).toContain('proxy_set_header X-Real-IP $remote_addr;');
    expect(config).toContain('proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;');
    expect(config).toContain('proxy_set_header Upgrade $http_upgrade;');
    expect(config).toMatch(/proxy_read_timeout \d+s;/);
    expect(config).toMatch(/proxy_send_timeout \d+s;/);
    expect(config).toMatch(/client_max_body_size \d+m;/);
  });
});
