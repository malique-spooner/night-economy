# POS Integration Contract

Night Economy treats the point of sale as an external system. The contract below is the boundary used by the local POS Simulator first and a real POS adapter later.

## Ownership

| Data | Owner | Night Economy access |
| --- | --- | --- |
| POS product ID, SKU, primary name, base price, availability | POS | Read-only sync |
| Sales | POS | Read-only import |
| Market symbol, display name, category, floor, ceiling, priority, market enabled | Night Economy | Operator-managed |
| Market price | Night Economy | Published back to POS |

Night Economy never creates a product in the POS contract. A POS product must be synced and mapped before it can be configured for the market.

## Required HTTP API

All responses are JSON. Amounts use integer minor currency units (for example, `1200` is GBP 12.00). IDs are stable strings.

### `GET /v1/products`

Returns the catalogue owned by the POS.

```json
{
  "products": [
    {
      "id": "pos_cem",
      "sku": "COCK-001",
      "name": "Classic Espresso Martini",
      "basePriceMinor": 1200,
      "currentPriceMinor": 1200,
      "currency": "GBP",
      "isAvailable": true,
      "updatedAt": "2026-07-14T18:00:00.000Z"
    }
  ]
}
```

### `GET /v1/sales?since=<ISO timestamp>`

Returns completed sale lines since the supplied timestamp. The POS must return a sale line only once for a given `id`.

```json
{
  "sales": [
    {
      "id": "sale_0001_line_01",
      "occurredAt": "2026-07-14T20:04:00.000Z",
      "productId": "pos_cem",
      "quantity": 2,
      "unitPriceMinor": 1200,
      "currency": "GBP"
    }
  ]
}
```

### `POST /v1/price-publications`

Night Economy publishes only mapped market-product prices. The POS applies accepted lines atomically where possible and reports the status of every line.

```json
{
  "publicationId": "publication_123",
  "lines": [
    {
      "productId": "pos_cem",
      "newPriceMinor": 1250
    }
  ]
}
```

```json
{
  "publicationId": "publication_123",
  "status": "published",
  "lines": [
    {
      "productId": "pos_cem",
      "status": "published",
      "oldPriceMinor": 1200,
      "newPriceMinor": 1250
    }
  ]
}
```

## Local development loop

The local POS Simulator runs independently on `http://127.0.0.1:3002`. Its local connector polls this contract, writes imported sales into Supabase, asks the deployed `market-cycle` Edge Function to calculate the price round, and posts those resulting price publications back to the simulator. The pricing engine itself runs only in Supabase; the local connector exists solely because Supabase cannot call a local development URL.
