UPDATE public.inventory_movements
SET occurred_at = date_trunc('month', (occurred_at AT TIME ZONE 'America/Sao_Paulo'))::timestamp + interval '14 days 12 hours'
WHERE movement_type = 'sale';