# LibreChat + AITTCO Deployment

This checkout routes the configured models through `https://api.aittco.com` and prompts each user for their own provider API key.

## Production Update

For the production server update procedure, including its fixed checkout path and Compose command,
follow [AGENTS.md](AGENTS.md#production-server-updates).

## Provider routing

| UI group | LibreChat endpoint | Gateway request shape |
| --- | --- | --- |
| OpenAI | custom `OpenAI` | `https://api.aittco.com/v1/chat/completions` |
| xAI | custom `xAI` | `https://api.aittco.com/v1/chat/completions` |
| Gemini | native `google` | `https://api.aittco.com/v1beta/models/{model}:generateContent` |
| Claude | native `anthropic` | `https://api.aittco.com/v1/messages` |

The BaseURL is fixed by the administrator. Users can provide API keys through the LibreChat Web UI, but cannot replace the gateway address.

## Prepare the host

Run the following from PowerShell:

```powershell
Set-Location D:\chat-libre\LibreChat
Copy-Item .env.example .env
```

Merge the values from `.env.aittco.example` into `.env`. Keep the upstream `.env.example` entries required by your selected LibreChat release, and replace every `replace-with-*` value. Generate persistent secrets with:

```powershell
openssl rand -hex 32
openssl rand -hex 16
```

Do not put an end-user provider key in `.env`; retain `GOOGLE_KEY=user_provided` and `ANTHROPIC_API_KEY=user_provided`. The custom OpenAI and xAI endpoints use `apiKey: user_provided` in `librechat.yaml`.

## Start LibreChat

Validate the merged Compose model before pulling images:

```powershell
docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml config --quiet
```

Start the stack:

```powershell
docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml pull
docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml up -d
docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml logs -f api
```

Open `http://localhost:3080`. The bundled admin panel is at `http://localhost:3000` when enabled by the upstream Compose file.

After changing `.env` or `librechat.yaml`, restart the API service:

```powershell
docker compose --env-file .env -f docker-compose.yml -f docker-compose.override.yml up -d --force-recreate api
```

## Code Interpreter and Artifacts

LibreChat's Code Interpreter is a separate sandbox service. Deploy the `ClickHouse/code-interpreter` service using its upstream Docker Compose or Helm instructions, then set:

```dotenv
LIBRECHAT_CODE_BASEURL=https://your-code-interpreter.example.com
LIBRECHAT_CODE_API_KEY=your-code-interpreter-api-key
```

The URL must be reachable from the LibreChat `api` container. Do not run arbitrary user code in the LibreChat API container itself. The YAML enables `execute_code`, `artifacts`, and `file_search` agent capabilities and pins those tools in the prompt bar. Artifacts use the default Sandpack CDN; set `SANDPACK_BUNDLER_URL` in `.env` only when a self-hosted bundler is required.

## Authentication headers

The native Gemini client sends the user key as `x-goog-api-key`. The native Anthropic client sends the key using Anthropic's expected authentication headers and includes `anthropic-version` as required by the protocol. Set `GOOGLE_AUTH_HEADER=true` only if AITTCO explicitly requires Gemini keys in `Authorization: Bearer` instead of `x-goog-api-key`.

## Verification checklist

1. In Settings, enter a test Gemini key and send a message with `gemini-3.1-pro-preview`; API logs should show an AITTCO request using `v1beta/models/...:generateContent`.
2. Enter an Anthropic key and test `claude-sonnet-5`; logs should show `/v1/messages`.
3. Enter a key in the OpenAI custom endpoint and test `gpt-5.6-terra`; logs should show `/v1/chat/completions`.
4. Repeat with `grok-4.5` under the xAI group.
5. Upload a PDF and an image to a vision-capable model. The gateway must accept the provider-native attachment format.
6. Pin or open Artifacts and run a small Code Interpreter task only after the external sandbox health check succeeds.

If a model is missing, check `ENDPOINTS`, the two curated model lists in `.env`, and the custom model lists in `librechat.yaml`. If a request is sent to a provider's public URL instead of AITTCO, inspect the API container environment and restart after correcting `.env`.
