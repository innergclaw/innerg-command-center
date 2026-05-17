# InnerG Command Center

Connected dashboard hub for:

- InnerG Intel
- ShopNasGraphics
- OwnYourWeb
- Personal

The frontend is a static dashboard. Data syncs through a Supabase Edge Function so every device sees the same boards after entering the dashboard token.

Live URL:

```text
https://innergclaw.github.io/innerg-command-center/
```

## Message Routing

Use explicit prefixes:

```text
innerg intel: New skill idea for the InnerG Intel ecosystem
shopnas: New logo project, paid already, needs intake
ownyourweb: New website client needs domain connected
personal: Event reminder for Friday at 7PM
```

If no prefix is used, the backend routes by keywords.

## Supabase

- Project ref: `zkyhhoxcrjkhywblzehr`
- Edge Function: `innerg-command-center`
- Table: `public.innerg_command_items`

Required Edge Function secret:

```bash
COMMAND_CENTER_TOKEN=...
```

The deployed app should not contain this token in public source.

## Telegram

The Edge Function includes a Telegram webhook mode at:

```text
https://zkyhhoxcrjkhywblzehr.supabase.co/functions/v1/innerg-command-center?source=telegram
```

Do not register this against the existing bot until the current Telegram webhook owner is confirmed. Telegram only allows one webhook URL per bot, so switching this directly can break another live workflow.
