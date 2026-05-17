# InnerG Command Center

Connected dashboard hub for:

- Energy
- Eco
- OWNYOURWEB
- ShopNasGraphics

The frontend is a static dashboard. Data syncs through a Supabase Edge Function so every device sees the same boards after entering the dashboard token.

## Message Routing

Use explicit prefixes:

```text
energy: Event reminder for Friday at 7PM
eco: New skill idea for the InnerG Intel ecosystem
ownyourweb: New website client needs domain connected
shopnas: New logo project, paid already, needs intake
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
